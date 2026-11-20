// scripts/apply-migration-360-sandbox.mjs
//
// NEX Gate A Connected Matrix §16.48.25 · Apply migration 360
// (fix_group_call_rls_recursion) against Supabase sandbox
// kdstoyyeygcopkogqsyv ONLY. Production SEALED.
//
// Dated: 2026-11-20
// Modelled on apply-migration-359-sandbox.mjs.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Client } from "pg";

const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const PROD_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const MIGRATION_NUMBER = "360";
const MIGRATION_FILE = "nex-supabase/migrations/360_fix_group_call_rls_recursion.sql";
const EXPECTED_SHA = "cd46ab7aa349075beebcb8b7930cc96f29e5ec336a4e1aaf26d550a9e85fdaff";

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

  // 1. Helper function present + correct attrs
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
  if (!fn.proconfig?.some((c) => c.startsWith("search_path="))) { console.error("POST: FAIL search_path not pinned"); process.exit(1); }

  // 2. ACL · REVOKE PUBLIC + GRANT authenticated
  const sig = "public.nex_is_participant_in_session(uuid)";
  for (const [role, expected] of [["public", false], ["anon", false], ["authenticated", true]]) {
    const v = (await c.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS v", [role, sig])).rows[0].v;
    console.log(`  privilege · ${role}: ${v} (exp ${expected}) → ${v === expected ? "PASS" : "FAIL"}`);
    if (v !== expected) { process.exitCode = 1; }
  }

  // 3. The two rewritten SELECT policies no longer subquery their recursion
  //    targets (nex_group_call_participant).
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
