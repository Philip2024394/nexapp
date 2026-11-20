// scripts/apply-migration-361-sandbox.mjs
//
// NEX Gate A Connected Matrix §16.48.25 · Apply migration 361
// (fix_nex_is_participant_in_session_acl · ACL correction follow-up to
// migration 360) against Supabase sandbox kdstoyyeygcopkogqsyv ONLY.
// Production ijvqdvsvwtwxzcqmoqit SEALED.
//
// Dated: 2026-11-20
// Modelled on apply-migration-360-sandbox.mjs.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Client } from "pg";

const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const PROD_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const MIGRATION_NUMBER = "361";
const MIGRATION_FILE = "nex-supabase/migrations/361_fix_nex_is_participant_in_session_acl.sql";
const EXPECTED_SHA = "84023fb5d3b71ed0bec49916bf04001f2a8df7eae71ac2c45cc4d42c736fcf07";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function env(key) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

// ── Project-ref pin (direct OR pooler) ────────────────────────────────────
const url = env("SANDBOX_DATABASE_URL") ?? env("DATABASE_URL");
if (!url) { console.error("FATAL: no DATABASE_URL in .env.local"); process.exit(2); }
if (url.includes(PROD_PROJECT_REF)) {
  console.error(`STOP · URL references production ref ${PROD_PROJECT_REF}`);
  process.exit(3);
}

const parsed = new URL(url);
let projectRef = null;

if (parsed.hostname.endsWith(".pooler.supabase.com")) {
  const m = parsed.username.match(/^postgres\.([a-z0-9]+)$/);
  if (m) projectRef = m[1];
  if (projectRef !== CANONICAL_PROJECT_REF) {
    console.error(`STOP · pooler-username project-ref '${projectRef}' !== '${CANONICAL_PROJECT_REF}'`);
    process.exit(3);
  }
} else if (parsed.hostname.endsWith(".supabase.co")) {
  const m = parsed.hostname.match(/^(?:db\.)?([a-z0-9]+)\.supabase\.co$/);
  if (m) projectRef = m[1];
  if (projectRef !== CANONICAL_PROJECT_REF) {
    console.error(`STOP · hostname project-ref '${projectRef}' !== '${CANONICAL_PROJECT_REF}'`);
    process.exit(3);
  }
} else {
  console.error(`STOP · unrecognised hostname '${parsed.hostname}'`); process.exit(3);
}
console.log(`Target · sandbox ${projectRef}`);

// ── Migration SQL file + SHA pin ───────────────────────────────────────────
const sqlBuf = readFileSync(resolve(repoRoot, MIGRATION_FILE));
const actualSha = createHash("sha256").update(sqlBuf).digest("hex");
if (actualSha !== EXPECTED_SHA) {
  console.error(`STOP · migration file SHA mismatch: got ${actualSha} expected ${EXPECTED_SHA}`);
  process.exit(1);
}
console.log(`SHA · ${actualSha} VERIFIED`);
const sql = sqlBuf.toString("utf8");

// ── Connect + apply ────────────────────────────────────────────────────────
const tStart = Date.now();
const c = new Client({ connectionString: url });
try {
  await c.connect();
  console.log("CONNECTED");

  // Pre-state: capture current head
  const headPre = await c.query(
    `SELECT version, applied_at
       FROM nex_migration_history
     ORDER BY applied_at DESC, version DESC
      LIMIT 1`
  );
  console.log(`PRE · head version=${headPre.rows[0]?.version} applied_at=${headPre.rows[0]?.applied_at}`);

  const pre = await c.query(
    "SELECT version FROM nex_migration_history WHERE version = $1",
    [MIGRATION_NUMBER]
  );
  if (pre.rows.length > 0) {
    console.log(`Migration ${MIGRATION_NUMBER} already in history · verifying post-state only`);
  } else {
    await c.query(sql);
    console.log(`Migration ${MIGRATION_NUMBER} SQL executed`);
  }

  // ── Post-check ──────────────────────────────────────────────────────────
  console.log("── POST-CHECK");

  // 1. Helper function present + unchanged attrs (pure ACL rewrite · body + flags untouched)
  const fnRows = await c.query(
    `SELECT proname, pronargs, prosecdef, provolatile, proconfig,
            pg_get_userbyid(proowner) AS owner,
            pg_get_function_identity_arguments(p.oid) AS signature
       FROM pg_proc p
       JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND proname = 'nex_is_participant_in_session'`
  );
  if (!fnRows.rows.length) {
    console.error("POST: FAIL — nex_is_participant_in_session not found in pg_proc");
    process.exit(1);
  }
  const fn = fnRows.rows[0];
  console.log(`  pg_proc: pronargs=${fn.pronargs} prosecdef=${fn.prosecdef} provolatile=${fn.provolatile} proconfig=${JSON.stringify(fn.proconfig)} owner=${fn.owner}`);
  if (!fn.prosecdef) { console.error("POST: FAIL prosecdef != true"); process.exit(1); }
  if (fn.provolatile !== "s") { console.error(`POST: FAIL provolatile=${fn.provolatile} (expected s=STABLE)`); process.exit(1); }
  if (!fn.proconfig?.some((cfg) => cfg === "search_path=public" || cfg === "search_path=\"public\"")) {
    console.error(`POST: FAIL proconfig does not contain search_path=public · got ${JSON.stringify(fn.proconfig)}`);
    process.exit(1);
  }
  if (fn.owner !== "postgres") {
    console.error(`POST: FAIL owner=${fn.owner} (expected postgres)`);
    process.exit(1);
  }

  // 2. ACL · REVOKE PUBLIC + REVOKE anon + REVOKE service_role + GRANT authenticated
  //    anon=false and service_role=false are the NEW assertions introduced by migration 361.
  const sig = "public.nex_is_participant_in_session(uuid)";
  for (const [role, expected] of [
    ["public", false],
    ["anon", false],              // NEW assertion vs migration 360 post-check
    ["authenticated", true],
    ["service_role", false],      // NEW assertion vs migration 360 post-check
  ]) {
    const v = (await c.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS v", [role, sig])).rows[0].v;
    console.log(`  privilege · ${role}: ${v} (exp ${expected}) → ${v === expected ? "PASS" : "FAIL"}`);
    if (v !== expected) { process.exitCode = 1; }
  }

  // 3. Policy rewrites from migration 360 still intact · no self-reference recursion,
  //    helper call still present on both policies.
  const polRows = await c.query(
    `SELECT c.relname AS tbl, p.polname,
            pg_get_expr(p.polqual, p.polrelid) AS using_expr
       FROM pg_policy p
       JOIN pg_class c ON p.polrelid = c.oid
      WHERE p.polname IN (
              'nex_group_call_participant_select_scoped',
              'nex_group_call_session_select_participants'
            )`
  );
  if (polRows.rows.length < 2) {
    console.error(`POST: FAIL expected 2 policies, got ${polRows.rows.length}`);
    process.exitCode = 1;
  }
  for (const r of polRows.rows) {
    const expr = r.using_expr ?? "";
    const containsSelf = /FROM\s+(public\.)?nex_group_call_participant/i.test(expr);
    const callsHelper = /nex_is_participant_in_session/.test(expr);
    const ok = !containsSelf && callsHelper;
    console.log(`  policy · ${r.tbl}.${r.polname} · selfRef=${containsSelf} helper=${callsHelper} → ${ok ? "PASS" : "FAIL"}`);
    if (!ok) { process.exitCode = 1; }
  }

  // 4. History row
  const hist = await c.query(
    "SELECT version, applied_at FROM nex_migration_history WHERE version = $1",
    [MIGRATION_NUMBER]
  );
  if (!hist.rows.length) { console.error("POST: FAIL history row missing"); process.exit(1); }
  console.log(`  history: version=${hist.rows[0].version} applied_at=${hist.rows[0].applied_at}`);

  // Post-state head
  const headPost = await c.query(
    `SELECT version, applied_at
       FROM nex_migration_history
     ORDER BY applied_at DESC, version DESC
      LIMIT 1`
  );
  console.log(`POST · head version=${headPost.rows[0]?.version} applied_at=${headPost.rows[0]?.applied_at}`);

  const ms = Date.now() - tStart;
  console.log(`\nMig ${MIGRATION_NUMBER} sandbox apply complete · duration=${ms}ms · exitCode=${process.exitCode ?? 0}`);

} catch (e) {
  console.error(`FAIL: ${e.message}${e.code ? " SQLSTATE=" + e.code : ""}`);
  process.exit(1);
} finally {
  try { await c.end(); } catch { /* ignore */ }
}
