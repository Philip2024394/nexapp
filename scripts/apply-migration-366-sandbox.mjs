// scripts/apply-migration-366-sandbox.mjs
//
// Applies mig 366 (durable in-app notification inbox) to Supabase
// sandbox kdstoyyeygcopkogqsyv ONLY via aws-1-eu-west-3 pooler.
// Production ijvqdvsvwtwxzcqmoqit SEALED.
//
// Dated 2026-11-23. Owner-authorised by directive wording "Apply
// migration 366 only to a verified isolated sandbox".
//
// Modelled on apply-migration-365-sandbox.mjs.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Client } from "pg";

const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const PROD_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const MIGRATION_NUMBER = "366";
const MIGRATION_FILE = "nex-supabase/migrations/366_nex_notification.sql";
const EXPECTED_SHA = "595b193f80ea69c66d2e0062dde95c9274e540035a79e979a29e8a92e9f2c590";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const urlProc = spawnSync("node", [resolve(repoRoot, "scripts/_tmp/pooler-url.mjs")], { encoding: "utf8" });
if (urlProc.status !== 0) { console.error("FATAL · pooler-url helper failed:", urlProc.stderr); process.exit(2); }
const url = urlProc.stdout.trim();
if (!url.includes(CANONICAL_PROJECT_REF) || url.includes(PROD_PROJECT_REF)) {
  console.error("STOP · pooler URL ref mismatch"); process.exit(3);
}
const parsed = new URL(url);
if (!parsed.hostname.endsWith(".pooler.supabase.com")) {
  console.error(`STOP · not pooler host: ${parsed.hostname}`); process.exit(3);
}
const m = parsed.username.match(/^postgres\.([a-z0-9]+)$/);
if (!m || m[1] !== CANONICAL_PROJECT_REF) {
  console.error(`STOP · pooler-username ref '${m?.[1]}' !== '${CANONICAL_PROJECT_REF}'`); process.exit(3);
}
console.log(`Target · sandbox ${CANONICAL_PROJECT_REF} via ${parsed.hostname}:${parsed.port}`);

const sqlBuf = readFileSync(resolve(repoRoot, MIGRATION_FILE));
const actualSha = createHash("sha256").update(sqlBuf).digest("hex");
if (actualSha !== EXPECTED_SHA) {
  console.error(`STOP · SHA mismatch · got ${actualSha} expected ${EXPECTED_SHA}`); process.exit(1);
}
console.log(`SHA · ${actualSha} VERIFIED`);
const sql = sqlBuf.toString("utf8");

const tStart = Date.now();
const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await c.connect();
  console.log("CONNECTED · pooler");

  const pre = await c.query("SELECT to_regclass('public.nex_notification') AS t");
  console.log(`  pre nex_notification exists: ${pre.rows[0].t ?? "false"}`);

  const histPre = await c.query("SELECT version FROM nex_migration_history WHERE version = $1", [MIGRATION_NUMBER]);
  if (histPre.rows.length > 0) {
    console.log(`Migration ${MIGRATION_NUMBER} already in history · verifying post-state only`);
  } else {
    await c.query(sql);
    console.log(`Migration ${MIGRATION_NUMBER} SQL executed`);
  }

  console.log("── POST-CHECK");

  // 1 · table exists
  const t = await c.query("SELECT to_regclass('public.nex_notification') AS t");
  if (!t.rows[0].t) { console.error("POST FAIL · table missing"); process.exit(1); }
  console.log(`  table: ${t.rows[0].t} PASS`);

  // 2 · column shape
  const cols = await c.query(`
    SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='nex_notification'
     ORDER BY ordinal_position`);
  const colSet = new Set(cols.rows.map(r => r.column_name));
  const expected = ["id","recipient_account_id","source","source_ref","category","title","subtitle","href","thumbnail_url","sender_account_id","profile_href","sender_has_shop","created_at","read_at"];
  const missing = expected.filter(n => !colSet.has(n));
  if (missing.length) { console.error(`POST FAIL · missing cols: ${missing.join(",")}`); process.exit(1); }
  console.log(`  columns: ${expected.length}/${expected.length} present PASS`);

  // 3 · CHECK constraints include the new source values
  const chk = await c.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
     WHERE conrelid='public.nex_notification'::regclass AND contype='c'`);
  const srcCheck = chk.rows.find(r => r.conname === "nex_notification_source_values");
  if (!srcCheck) { console.error("POST FAIL · source CHECK missing"); process.exit(1); }
  for (const needle of ["order_paid","contact_request","contact_accepted","message","inquiry"]) {
    if (!srcCheck.def.includes(`'${needle}'`)) { console.error(`POST FAIL · source CHECK missing '${needle}'`); process.exit(1); }
  }
  console.log(`  source CHECK contains all 5 active producer values PASS`);

  // 4 · unique partial index for dedup
  const idx = await c.query(`
    SELECT indexname, indexdef
      FROM pg_indexes
     WHERE schemaname='public' AND tablename='nex_notification'`);
  const uniq = idx.rows.find(r => r.indexname === "nex_notification_recipient_source_ref_uniq");
  if (!uniq) { console.error("POST FAIL · unique partial index missing"); process.exit(1); }
  if (!/WHERE\s*\(?source_ref IS NOT NULL\)?/i.test(uniq.indexdef)) {
    console.error(`POST FAIL · unique index lacks partial predicate: ${uniq.indexdef}`); process.exit(1);
  }
  console.log(`  unique partial index on (recipient,source_ref) WHERE source_ref IS NOT NULL PASS`);

  // 5 · RLS on + policies installed
  const rls = await c.query(`
    SELECT relrowsecurity, relforcerowsecurity
      FROM pg_class WHERE oid='public.nex_notification'::regclass`);
  if (!rls.rows[0].relrowsecurity) { console.error("POST FAIL · RLS not enabled"); process.exit(1); }
  const pols = await c.query(`SELECT polname, polcmd FROM pg_policy WHERE polrelid='public.nex_notification'::regclass`);
  const polSet = new Set(pols.rows.map(p => p.polname));
  for (const n of ["nex_notification_recipient_select","nex_notification_recipient_mark_read"]) {
    if (!polSet.has(n)) { console.error(`POST FAIL · policy ${n} missing`); process.exit(1); }
  }
  console.log(`  RLS on + 2 policies installed PASS`);

  // 6 · column-level grant on read_at only for authenticated UPDATE
  const grants = await c.query(`
    SELECT grantee, privilege_type, column_name
      FROM information_schema.column_privileges
     WHERE table_schema='public' AND table_name='nex_notification'
       AND grantee IN ('authenticated','anon','service_role')
       AND privilege_type='UPDATE'
     ORDER BY grantee, column_name`);
  const authUpdateCols = grants.rows
    .filter(r => r.grantee === "authenticated" && r.privilege_type === "UPDATE")
    .map(r => r.column_name);
  const anonAny = grants.rows.some(r => r.grantee === "anon");
  if (anonAny) { console.error(`POST FAIL · anon has grants: ${JSON.stringify(grants.rows.filter(r => r.grantee==="anon"))}`); process.exit(1); }
  if (authUpdateCols.length !== 1 || authUpdateCols[0] !== "read_at") {
    console.error(`POST FAIL · authenticated UPDATE cols ${JSON.stringify(authUpdateCols)} expected [read_at]`); process.exit(1);
  }
  console.log(`  column-level GRANT authenticated UPDATE (read_at) only · anon has none PASS`);

  // 7 · history row
  const hist = await c.query("SELECT version, applied_at, description FROM nex_migration_history WHERE version = $1", [MIGRATION_NUMBER]);
  if (!hist.rows.length) { console.error("POST FAIL · history row missing"); process.exit(1); }
  console.log(`  history · ${hist.rows[0].version} @ ${hist.rows[0].applied_at}`);

  const ms = Date.now() - tStart;
  console.log(`\nMig ${MIGRATION_NUMBER} apply complete · duration=${ms}ms · exitCode=${process.exitCode ?? 0}`);
} catch (e) {
  console.error(`FAIL: ${e.message}${e.code ? " SQLSTATE=" + e.code : ""}`);
  process.exit(1);
} finally {
  try { await c.end(); } catch {}
}
