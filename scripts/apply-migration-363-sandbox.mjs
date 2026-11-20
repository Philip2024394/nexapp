// scripts/apply-migration-363-sandbox.mjs
//
// Applies mig 363 (defence-in-depth hardening of nex_create_cart_order_tx ·
// REVOKE anon + service_role GUC assertion) to Supabase sandbox
// kdstoyyeygcopkogqsyv ONLY via the documented pooler at
// aws-1-eu-west-3.pooler.supabase.com. Production ijvqdvsvwtwxzcqmoqit SEALED.
//
// Modelled on apply-migration-361-sandbox.mjs; adds pooler-aware URL
// construction because the direct host db.kdstoyyeygcopkogqsyv.supabase.co
// is IPv6-only on this network.
//
// Dated: 2026-11-20

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Client } from "pg";

const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const PROD_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const MIGRATION_NUMBER = "363";
const MIGRATION_FILE = "nex-supabase/migrations/363_nex_cart_order_tx_revoke_anon.sql";
const EXPECTED_SHA = "88944c230557832ec28b5899cf36b15c78bf0162572a208e491ce79af0079440";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Build pooler URL via helper · keeps password off stdout/logs.
const urlProc = spawnSync("node", [resolve(repoRoot, "scripts/_tmp/pooler-url.mjs")], { encoding: "utf8" });
if (urlProc.status !== 0) {
  console.error("FATAL · pooler-url helper failed:", urlProc.stderr);
  process.exit(2);
}
const url = urlProc.stdout.trim();
if (!url.includes(CANONICAL_PROJECT_REF) || url.includes(PROD_PROJECT_REF)) {
  console.error("STOP · pooler URL ref mismatch");
  process.exit(3);
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
  console.error(`STOP · SHA mismatch · got ${actualSha} expected ${EXPECTED_SHA}`);
  process.exit(1);
}
console.log(`SHA · ${actualSha} VERIFIED`);
const sql = sqlBuf.toString("utf8");

const tStart = Date.now();
const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await c.connect();
  console.log("CONNECTED · pooler");

  const pre = await c.query("SELECT version FROM nex_migration_history WHERE version = $1", [MIGRATION_NUMBER]);
  if (pre.rows.length > 0) {
    console.log(`Migration ${MIGRATION_NUMBER} already in history · verifying post-state only`);
  } else {
    await c.query(sql);
    console.log(`Migration ${MIGRATION_NUMBER} SQL executed`);
  }

  console.log("── POST-CHECK");

  const fnRows = await c.query(`
    SELECT proname, pronargs, prosecdef, provolatile, proconfig,
           pg_get_userbyid(proowner) AS owner,
           pg_get_function_identity_arguments(p.oid) AS signature,
           md5(pg_get_functiondef(p.oid)) AS body_md5
      FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE n.nspname = 'public' AND proname = 'nex_create_cart_order_tx'`);
  if (!fnRows.rows.length) { console.error("POST FAIL · function missing"); process.exit(1); }
  const fn = fnRows.rows[0];
  console.log(`  pg_proc: secdef=${fn.prosecdef} owner=${fn.owner} proconfig=${JSON.stringify(fn.proconfig)} body_md5=${fn.body_md5}`);
  if (!fn.prosecdef) { console.error("POST FAIL · not SECURITY DEFINER"); process.exit(1); }
  if (fn.owner !== "postgres") { console.error(`POST FAIL · owner=${fn.owner}`); process.exit(1); }

  const sig = "public.nex_create_cart_order_tx(uuid,uuid,uuid,text,jsonb,text,uuid,uuid,text,text)";
  let privFail = false;
  for (const [role, expected] of [
    ["public", false],
    ["anon", false],              // the whole point of 363
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
