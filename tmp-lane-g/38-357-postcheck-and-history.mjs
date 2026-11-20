// tmp-lane-g/38-357-postcheck-and-history.mjs
//
// Gate A · 357 full postcheck + missing history row insert.
// Runs AFTER the partial-apply on sandbox kdstoyyeygcopkogqsyv where
// MIG-A DDL committed but the history INSERT failed (missing description).
//
// Checks:
//   1. Sandbox-ref pin (reject production).
//   2. Extract function body from pinned MIG-A SQL source.
//   3. Query pg_proc.prosrc for live nex_invite_to_call_tx.
//   4. Byte-for-byte body comparison via sha256 (not length).
//   5. Signature / overload / owner / prosecdef / search_path.
//   6. has_function_privilege for anon / service_role / authenticated.
//   7. auth.uid() fail-closed invocation → expect 42501.
//   8. INSERT missing history row with ON CONFLICT (version) DO NOTHING.
//
// Stops on first failure. Never prints secrets.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import pg from "pg";

function env(key) {
  const raw = readFileSync(".env.local", "utf8");
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const url = env("SANDBOX_DATABASE_URL") ?? env("DATABASE_URL");
if (!url) { console.error("FATAL · no DATABASE_URL"); process.exit(2); }

const parsed = new URL(url);
let ref = null;
if (parsed.hostname.endsWith(".pooler.supabase.com")) {
  const m = parsed.username.match(/^postgres\.([a-z0-9]+)$/);
  ref = m ? m[1] : null;
} else if (parsed.hostname.endsWith(".supabase.co")) {
  const m = parsed.hostname.match(/^(?:db\.)?([a-z0-9]+)\.supabase\.co$/);
  ref = m ? m[1] : null;
}
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · ref '${ref}' is not sandbox`); process.exit(3); }
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production"); process.exit(3); }
console.log(`Target · sandbox ${ref}`);

// ── Extract body from MIG-A source ────────────────────────────────────────
const migSrc = readFileSync("nex-supabase/migrations/357_nex_group_call_invite_v4_combined.sql", "utf8");
// MIG-A uses `LANGUAGE plpgsql ... AS $$ ... $$;` for the function body.
// Postgres stores pg_proc.prosrc INCLUDING the surrounding newlines, so
// capture everything between `AS $$` and `$$;` inclusive of the newlines
// on both sides. (Matches line 123 `AS $$` and line 305 `$$;` in mig-357.)
const bodyRe = /AS \$\$([\s\S]*?)\$\$;/;
const bodyMatch = migSrc.match(bodyRe);
if (!bodyMatch) { console.error("FAIL · cannot extract body from MIG-A source"); process.exit(1); }
const srcBody = bodyMatch[1];
const srcBodySha = createHash("sha256").update(srcBody).digest("hex");
console.log(`MIG-A body  len=${srcBody.length} sha256=${srcBodySha}`);

// ── Connect ───────────────────────────────────────────────────────────────
const c = new pg.Client({ connectionString: url });
await c.connect();
console.log("CONNECTED");

try {
  const fn = await c.query(`
    SELECT proname, pronargs, prosecdef, proconfig,
           pg_get_userbyid(proowner) AS owner,
           pg_get_function_identity_arguments(p.oid) AS signature,
           prosrc,
           length(prosrc) AS body_len
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND proname = 'nex_invite_to_call_tx'
  `);
  if (!fn.rows.length) { console.error("FAIL · function not in pg_proc"); process.exit(1); }
  if (fn.rows.length > 1) { console.error(`FAIL · multiple overloads: ${fn.rows.length}`); process.exit(1); }
  const f = fn.rows[0];
  const liveBodySha = createHash("sha256").update(f.prosrc).digest("hex");
  console.log(`Live body   len=${f.body_len} sha256=${liveBodySha}`);
  console.log(`signature=${f.signature}`);
  console.log(`owner=${f.owner} prosecdef=${f.prosecdef} proconfig=${JSON.stringify(f.proconfig)}`);

  const bodyMatches = liveBodySha === srcBodySha;
  console.log(`BODY MATCH: ${bodyMatches}`);
  if (!bodyMatches) {
    console.error("STOP · live body does not match MIG-A source byte-for-byte");
    const minLen = Math.min(f.body_len, srcBody.length);
    let firstDiff = -1;
    for (let i = 0; i < minLen; i++) {
      if (f.prosrc[i] !== srcBody[i]) { firstDiff = i; break; }
    }
    if (firstDiff >= 0) {
      console.error(`  first diff at byte ${firstDiff}`);
      console.error(`  live: ...${JSON.stringify(f.prosrc.slice(Math.max(0, firstDiff - 20), firstDiff + 20))}`);
      console.error(`  src:  ...${JSON.stringify(srcBody.slice(Math.max(0, firstDiff - 20), firstDiff + 20))}`);
    } else {
      console.error(`  length differs: live=${f.body_len} src=${srcBody.length}`);
    }
    process.exit(1);
  }

  // Structural
  if (f.pronargs !== 7) { console.error(`FAIL · pronargs=${f.pronargs} expected 7`); process.exit(1); }
  if (!f.prosecdef) { console.error("FAIL · prosecdef != true"); process.exit(1); }
  if (!f.proconfig?.includes("search_path=public, pg_temp")) { console.error("FAIL · search_path"); process.exit(1); }
  if (f.owner !== "postgres") { console.error(`FAIL · owner=${f.owner}`); process.exit(1); }
  const expectedSig = "p_invitee_account_id uuid, p_media_type text, p_host_country text, p_attachment_meta jsonb, p_invite_body text, p_attachment_url text, p_existing_session_id uuid";
  if (f.signature !== expectedSig) {
    console.error(`FAIL · signature mismatch\n  got:  ${f.signature}\n  exp:  ${expectedSig}`);
    process.exit(1);
  }
  console.log("STRUCT · signature + owner + prosecdef + search_path PASS");

  // Privileges
  const sig = "public.nex_invite_to_call_tx(uuid,text,text,jsonb,text,text,uuid)";
  let privFail = false;
  for (const [role, expected] of [["anon", false], ["service_role", false], ["authenticated", true]]) {
    const v = (await c.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS v", [role, sig])).rows[0].v;
    const ok = v === expected;
    console.log(`  priv · ${role}=${v} (exp ${expected}) ${ok ? "PASS" : "FAIL"}`);
    if (!ok) privFail = true;
  }
  if (privFail) { console.error("STOP · privilege postcheck failed"); process.exit(1); }

  // auth.uid() fail-closed · invoke RPC in a session without JWT claims.
  console.log("── auth.uid() fail-closed test");
  try {
    await c.query(`
      SELECT * FROM nex_invite_to_call_tx(
        '00000000-0000-0000-0000-000000000000'::uuid,
        'audio','US','{}'::jsonb,'','https://example.com/x',NULL
      )
    `);
    console.error("FAIL · expected fail-closed exception; call returned rows");
    process.exit(1);
  } catch (e) {
    if (e.code === "42501") {
      console.log(`  fail-closed PASS · SQLSTATE=42501 message="${e.message}"`);
    } else {
      console.error(`UNEXPECTED SQLSTATE=${e.code} message="${e.message}"`);
      console.error("(Expected 42501 caller_account_not_found when auth.uid() returns NULL)");
      process.exit(1);
    }
  }

  // Insert missing 357 history row.
  console.log("── 357 history row insert");
  await c.query(
    `INSERT INTO nex_migration_history(version, description, notes)
     VALUES ($1, $2, $3) ON CONFLICT (version) DO NOTHING`,
    [
      "357",
      "nex_group_call_invite_v4_combined · whitespace guard + 4-cap pre-insert check",
      "Closes GB-WHITESPACE-GUARD · narrows GB-4CAP to direct-write only · sandbox only",
    ]
  );
  const hist = await c.query(
    "SELECT version, applied_at, description, notes FROM nex_migration_history WHERE version = $1",
    ["357"]
  );
  if (!hist.rows.length) { console.error("FAIL · history row still absent"); process.exit(1); }
  console.log(`  history: version=${hist.rows[0].version} applied_at=${hist.rows[0].applied_at}`);
  console.log(`  description=${hist.rows[0].description}`);
  console.log(`  notes=${hist.rows[0].notes}`);

  console.log("\n357 · POSTCHECK COMPLETE · HISTORY ROW WRITTEN");
} finally {
  try { await c.end(); } catch { /* ignore */ }
}
