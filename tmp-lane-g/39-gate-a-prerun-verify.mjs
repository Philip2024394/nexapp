// tmp-lane-g/39-gate-a-prerun-verify.mjs
//
// Gate A · Pre-run verification before executing the connected V-* matrix.
// Revalidates that 357/358/359 are deployed, their definitions match the
// pinned migration SQL, their security/signatures/privileges are correct,
// and exactly one history row exists per version. READ-ONLY.
//
// Never prints secrets; sandbox-ref pinned.

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
  ref = parsed.username.match(/^postgres\.([a-z0-9]+)$/)?.[1] ?? null;
} else if (parsed.hostname.endsWith(".supabase.co")) {
  ref = parsed.hostname.match(/^(?:db\.)?([a-z0-9]+)\.supabase\.co$/)?.[1] ?? null;
}
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · ref '${ref}' not sandbox`); process.exit(3); }
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production"); process.exit(3); }
console.log(`Target · sandbox ${ref}`);

// ── Pinned expectations per §16.47.5 ─────────────────────────────────────
const EXPECTED = [
  {
    version: "357",
    fname: "nex_invite_to_call_tx",
    sigText:
      "p_invitee_account_id uuid, p_media_type text, p_host_country text, p_attachment_meta jsonb, p_invite_body text, p_attachment_url text, p_existing_session_id uuid",
    canonicalSig: "public.nex_invite_to_call_tx(uuid,text,text,jsonb,text,text,uuid)",
    pronargs: 7,
    mig: "nex-supabase/migrations/357_nex_group_call_invite_v4_combined.sql",
    expectedFileSha: "de77e9a19eb49df85433bf66969b87a44b05885b302a23559e76134b799bfea7",
  },
  {
    version: "358",
    fname: "nex_create_group_call_session_tx",
    sigText: null, // extract from pg_proc only (signature-text target varies)
    canonicalSigPrefix: "public.nex_create_group_call_session_tx(",
    pronargs: 4,
    mig: "nex-supabase/migrations/358_nex_create_group_call_session_tx.sql",
    expectedFileSha: "51cb55863636a8b23f4c825646f5eeb980159493cedef7b36aea44154d4344db",
  },
  {
    version: "359",
    fname: "nex_join_group_call_session_tx",
    sigText: null,
    canonicalSigPrefix: "public.nex_join_group_call_session_tx(",
    pronargs: 2,
    mig: "nex-supabase/migrations/359_nex_join_group_call_session_tx.sql",
    expectedFileSha: "375fc243fd87bfab75c074824b29007518f84c868f588a6d92e018fc5a0802b9",
  },
];

// ── File SHA pins ────────────────────────────────────────────────────────
for (const e of EXPECTED) {
  const buf = readFileSync(e.mig);
  const sha = createHash("sha256").update(buf).digest("hex");
  if (sha !== e.expectedFileSha) {
    console.error(`FAIL · ${e.mig} SHA drift: got ${sha} expected ${e.expectedFileSha}`);
    process.exit(1);
  }
  console.log(`SHA · ${e.mig.split("/").pop()} = ${sha.slice(0, 16)}… PINNED`);
}

// ── Extract body sha for each migration ──────────────────────────────────
function extractBody(path) {
  const src = readFileSync(path, "utf8");
  const bodyRe = /AS \$\$([\s\S]*?)\$\$;/;
  const m = src.match(bodyRe);
  if (!m) throw new Error(`no body in ${path}`);
  return { body: m[1], sha: createHash("sha256").update(m[1]).digest("hex") };
}

const bodyExpectations = {};
for (const e of EXPECTED) {
  const { body, sha } = extractBody(e.mig);
  bodyExpectations[e.version] = { expectedBodySha: sha, expectedBodyLen: body.length };
  console.log(`BODY · ${e.version} expected sha256=${sha.slice(0, 16)}… len=${body.length}`);
}

// ── Connect ──────────────────────────────────────────────────────────────
const c = new pg.Client({ connectionString: url });
await c.connect();
console.log("CONNECTED");

let anyFail = false;
try {
  for (const e of EXPECTED) {
    console.log(`\n── Verifying migration ${e.version} · ${e.fname}`);

    // pg_proc inspection
    const rows = (await c.query(
      `SELECT proname, pronargs, prosecdef, proconfig,
              pg_get_userbyid(proowner) AS owner,
              pg_get_function_identity_arguments(p.oid) AS signature,
              length(prosrc) AS body_len,
              md5(prosrc) AS body_md5,
              prosrc
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND proname = $1`,
      [e.fname]
    )).rows;
    if (rows.length === 0) {
      console.error(`  FAIL · function not found: ${e.fname}`);
      anyFail = true;
      continue;
    }
    if (rows.length > 1) {
      console.error(`  FAIL · multiple overloads for ${e.fname}: ${rows.length}`);
      anyFail = true;
      continue;
    }
    const f = rows[0];
    console.log(`  signature=${f.signature}`);
    console.log(`  pronargs=${f.pronargs} prosecdef=${f.prosecdef} owner=${f.owner}`);
    console.log(`  proconfig=${JSON.stringify(f.proconfig)}`);

    if (f.pronargs !== e.pronargs) { console.error(`  FAIL · pronargs ${f.pronargs} vs ${e.pronargs}`); anyFail = true; }
    if (!f.prosecdef) { console.error(`  FAIL · prosecdef false`); anyFail = true; }
    if (!f.proconfig?.includes("search_path=public, pg_temp")) { console.error(`  FAIL · search_path`); anyFail = true; }
    if (f.owner !== "postgres") { console.error(`  FAIL · owner ${f.owner}`); anyFail = true; }
    if (e.sigText && f.signature !== e.sigText) { console.error(`  FAIL · signature drift`); anyFail = true; }

    // Body byte-for-byte match to pinned source
    const liveBodySha = createHash("sha256").update(f.prosrc).digest("hex");
    const expectedBodySha = bodyExpectations[e.version].expectedBodySha;
    const bodyMatch = liveBodySha === expectedBodySha;
    console.log(`  body sha256 live=${liveBodySha.slice(0, 16)}… expected=${expectedBodySha.slice(0, 16)}… MATCH=${bodyMatch}`);
    if (!bodyMatch) { console.error(`  FAIL · body drift`); anyFail = true; }

    // Effective privileges — use pg_get_function_identity_arguments-derived sig
    // to be safe regardless of overload shape.
    const sig = `public.${f.proname}(${(await c.query(
      `SELECT string_agg(format_type(unnest, NULL), ',') AS s
         FROM unnest(ARRAY(SELECT unnest(proargtypes) FROM pg_proc WHERE oid = (
                   SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                   WHERE n.nspname='public' AND proname=$1)))`,
      [f.proname]
    )).rows[0].s})`;
    console.log(`  canonical sig=${sig}`);
    for (const [role, expected] of [["anon", false], ["service_role", false], ["authenticated", true]]) {
      const v = (await c.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS v", [role, sig])).rows[0].v;
      const ok = v === expected;
      console.log(`  priv · ${role}=${v} (exp ${expected}) ${ok ? "PASS" : "FAIL"}`);
      if (!ok) anyFail = true;
    }

    // History row — exactly one
    const hist = (await c.query(
      "SELECT version, applied_at, description, notes FROM nex_migration_history WHERE version = $1",
      [e.version]
    )).rows;
    if (hist.length !== 1) {
      console.error(`  FAIL · history rows for ${e.version}: ${hist.length} (expected 1)`);
      anyFail = true;
    } else {
      console.log(`  history · applied_at=${hist[0].applied_at}`);
      console.log(`  description=${hist[0].description}`);
    }
  }

  // Aggregate mig-133 cap trigger + RLS policy spot-check (only one row each)
  console.log(`\n── Trigger + RLS spot-check`);
  const trg = (await c.query(
    `SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'nex_group_call_participant_cap_tr'`
  )).rows;
  console.log(`  trigger rows=${trg.length} ` + trg.map(t => `${t.tgname}:${t.tgenabled}`).join(" "));
  if (trg.length !== 1 || trg[0].tgenabled !== "O") { console.error("  FAIL · cap trigger"); anyFail = true; }

  const rls = (await c.query(
    `SELECT polname, polcmd
       FROM pg_policy p
       JOIN pg_class c ON c.oid = p.polrelid
      WHERE c.relname = 'nex_group_call_participant'
      ORDER BY polname`
  )).rows;
  console.log(`  RLS policies on nex_group_call_participant: ${rls.length}`);
  for (const r of rls) console.log(`    ${r.polname} cmd=${r.polcmd}`);
  if (rls.length === 0) { console.error("  FAIL · no RLS policies"); anyFail = true; }

} finally {
  try { await c.end(); } catch { /* ignore */ }
}

if (anyFail) {
  console.error("\nPRE-RUN VERIFY · FAIL — do not proceed");
  process.exit(1);
}
console.log("\nPRE-RUN VERIFY · ALL CHECKS PASSED");
