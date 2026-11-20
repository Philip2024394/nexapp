// scripts/apply-migration-365-sandbox.mjs
//
// Applies mig 365 (ON CONFLICT WHERE predicate · fixes SQLSTATE 42P10
// surfaced after mig 364) to Supabase sandbox kdstoyyeygcopkogqsyv ONLY
// via aws-1-eu-west-3 pooler. Production ijvqdvsvwtwxzcqmoqit SEALED.
//
// Dated 2026-11-20. Owner-authorised by word-trigger
// "apply mig 365 to sandbox".
//
// Modelled on apply-migration-364-sandbox.mjs.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Client } from "pg";

const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const PROD_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const MIGRATION_NUMBER = "365";
const MIGRATION_FILE = "nex-supabase/migrations/365_fix_cart_order_tx_on_conflict_partial.sql";
const EXPECTED_SHA = "606d2d04acf0167deb5fe30628c87ec788e398cb73bd6fcf3fbd4afb9c1ecf38";

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

  const pre = await c.query(`
    SELECT md5(pg_get_functiondef(p.oid)) AS body_md5
      FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE n.nspname = 'public' AND proname = 'nex_create_cart_order_tx'`);
  const preMd5 = pre.rows[0]?.body_md5;
  console.log(`  pre body_md5=${preMd5}`);

  const sig = "public.nex_create_cart_order_tx(uuid,uuid,uuid,text,jsonb,text,uuid,uuid,text,text)";
  const preAnon = (await c.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS v", ["anon", sig])).rows[0].v;
  console.log(`  pre anon EXECUTE=${preAnon} (must stay false)`);

  const histPre = await c.query("SELECT version FROM nex_migration_history WHERE version = $1", [MIGRATION_NUMBER]);
  if (histPre.rows.length > 0) {
    console.log(`Migration ${MIGRATION_NUMBER} already in history · verifying post-state only`);
  } else {
    await c.query(sql);
    console.log(`Migration ${MIGRATION_NUMBER} SQL executed`);
  }

  console.log("── POST-CHECK");

  const fnRows = await c.query(`
    SELECT proname, prosecdef, pg_get_userbyid(proowner) AS owner,
           md5(pg_get_functiondef(p.oid)) AS body_md5,
           pg_get_functiondef(p.oid) AS body,
           proconfig
      FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE n.nspname = 'public' AND proname = 'nex_create_cart_order_tx'`);
  if (!fnRows.rows.length) { console.error("POST FAIL · function missing"); process.exit(1); }
  const fn = fnRows.rows[0];
  console.log(`  pg_proc: secdef=${fn.prosecdef} owner=${fn.owner} proconfig=${JSON.stringify(fn.proconfig)} body_md5=${fn.body_md5}`);
  if (!fn.prosecdef) { console.error("POST FAIL · not SECURITY DEFINER"); process.exit(1); }
  if (fn.owner !== "postgres") { console.error(`POST FAIL · owner=${fn.owner}`); process.exit(1); }
  if (fn.body_md5 === preMd5) { console.error(`POST FAIL · body md5 unchanged (${preMd5})`); process.exit(1); }

  const hasPredicate = /ON CONFLICT\s*\(\s*sender_account_id\s*,\s*send_intent_id\s*\)\s*WHERE\s+send_intent_id\s+IS\s+NOT\s+NULL\s+DO\s+NOTHING/i.test(fn.body);
  console.log(`  deployed body contains WHERE-predicate ON CONFLICT → ${hasPredicate ? "PASS" : "FAIL"}`);
  if (!hasPredicate) process.exitCode = 1;

  let privFail = false;
  for (const [role, expected] of [
    ["public", false],
    ["anon", false],
    ["authenticated", true],
    ["service_role", true],
  ]) {
    const v = (await c.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS v", [role, sig])).rows[0].v;
    const ok = v === expected;
    console.log(`  priv ${role}: ${v} (exp ${expected}) → ${ok ? "PASS" : "FAIL"}`);
    if (!ok) privFail = true;
  }
  if (privFail) process.exitCode = 1;

  const acl = await c.query(`SELECT p.proacl::text AS acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='nex_create_cart_order_tx'`);
  console.log(`  ACL · ${acl.rows[0]?.acl}`);

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
