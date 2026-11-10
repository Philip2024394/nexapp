// scripts/apply-migration-330-sandbox.mjs
//
// Apply mig 330 (rate-limit_claim canonical body fix) to SANDBOX.
// Owner-authorised 2026-11-10 after discovering mig 291 had been applied
// from the OLD _claim.sql body. Hard-refuses production ref.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = env("SANDBOX_DATABASE_URL");
const u = new URL(databaseUrl);
const ref = u.username.match(/\.([a-z0-9]{15,})/)?.[1]
  ?? u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(2); }
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · unknown ref ${ref}`); process.exit(2); }
console.log(`Target · sandbox ${ref}`);

const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/330_nex_security_rate_limit_claim_fix_canonical.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 330 applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(3);
} finally {
  await c.end();
}

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const hist = await v.query(
    "SELECT version, description FROM nex_migration_history WHERE version = '330'",
  );
  if (hist.rows.length !== 1) {
    console.error("VERIFY FAILED · history row missing");
    process.exit(4);
  }
  console.log(`✓ History: 330 · ${hist.rows[0].description}`);

  const src = await v.query(
    "SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname='nex_security_rate_limit_claim' AND pronamespace='public'::regnamespace"
  );
  const def = src.rows[0]?.def ?? "";
  if (def.includes("_action not in (") || def.includes("_action NOT IN (")) {
    console.error("✗ Function body still contains hardcoded enum · CREATE OR REPLACE did not take effect");
    process.exit(5);
  }
  if (!def.includes("clock_timestamp()")) {
    console.error("✗ Function body does not match canonical variant · missing clock_timestamp()");
    process.exit(6);
  }
  console.log(`✓ Function body is canonical · no hardcoded enum · uses clock_timestamp()`);

  // Live test · hq_admin_grant must now return allowed=true on first call
  const test = await v.query(
    "SELECT * FROM nex_security_rate_limit_claim('acct:00000000-aaaa-4aaa-aaaa-888888888888', 'hq_admin_grant', 15, 30)"
  );
  if (test.rows[0]?.allowed !== true) {
    console.error(`✗ Live test · hq_admin_grant still rejected: allowed=${test.rows[0]?.allowed} retry_after=${test.rows[0]?.retry_after_seconds}`);
    process.exit(7);
  }
  console.log(`✓ Live test · hq_admin_grant now allowed=true · retry_after=${test.rows[0].retry_after_seconds}`);
  await v.query("DELETE FROM nex_security_rate_limit WHERE key='acct:00000000-aaaa-4aaa-aaaa-888888888888'");
  console.log(`✓ Test row cleaned up`);

  // Prune function must still exist
  const prune = await v.query(
    "SELECT 1 FROM pg_proc WHERE proname='nex_security_rate_limit_prune' AND pronamespace='public'::regnamespace"
  );
  if (prune.rows.length !== 1) {
    console.error("✗ nex_security_rate_limit_prune disappeared · mig 330 should not touch it");
    process.exit(8);
  }
  console.log(`✓ Prune function still present`);
} finally {
  await v.end();
}

console.log("\nMig 330 sandbox apply + verification complete.");
