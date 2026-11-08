// scripts/apply-migration-290-production.mjs
//
// Phase 1 · F-2 · apply mig 290 (nex_security_rate_limit) to PRODUCTION.
// Prepared 2026-11-09 under G1 build authorisation.
// DOES NOT EXECUTE unless the owner has set NEX_PRODUCTION_APPLY_CONFIRMED
// in the environment · G3 gate.
//
// Usage (after G3 owner authorisation):
//   NEX_PRODUCTION_APPLY_CONFIRMED=YES-I-UNDERSTAND \
//     node scripts/apply-migration-290-production.mjs
//
// Without the env flag, the script prints a safety banner and exits with
// code 1. This prevents accidental production application.

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
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

// G3 confirmation gate · the owner must set this explicitly to proceed.
if (process.env.NEX_PRODUCTION_APPLY_CONFIRMED !== "YES-I-UNDERSTAND") {
  console.error("============================================================");
  console.error("Mig 290 production apply · G3 authorisation required");
  console.error("============================================================");
  console.error("This script applies migration 290 to the PRODUCTION Supabase");
  console.error("project ijvqdvsvwtwxzcqmoqit. It is prepared but will not run");
  console.error("without an explicit owner-set environment flag:");
  console.error("");
  console.error("  NEX_PRODUCTION_APPLY_CONFIRMED=YES-I-UNDERSTAND \\");
  console.error("    node scripts/apply-migration-290-production.mjs");
  console.error("");
  console.error("Mig 290 creates the nex_security_rate_limit table + index +");
  console.error("explicit role revokes/grants. Rollback is available via");
  console.error("290_nex_security_rate_limit.rollback.sql · drops the empty");
  console.error("table + index · no data loss.");
  console.error("============================================================");
  process.exit(1);
}

const databaseUrl = env("DATABASE_URL");
const u = new URL(databaseUrl);
const refFromUser = u.username.match(/\.([a-z0-9]{15,})/)?.[1] ?? null;
const refFromHost = u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1] ?? null;
const ref = refFromUser ?? refFromHost;

// Hard safety · refuse if the target is not production.
if (ref !== "ijvqdvsvwtwxzcqmoqit") {
  console.error(`STOP · unexpected ref ${ref} · this script targets production ijvqdvsvwtwxzcqmoqit only`);
  process.exit(2);
}
if (ref === "kdstoyyeygcopkogqsyv") {
  // Shouldn't happen per the check above, but double-safety.
  console.error("STOP · sandbox ref detected · this script is production-only");
  process.exit(2);
}
console.log(`Target · production ${ref}`);

// Idempotency check · refuse if already applied.
const preCheck = new Client({ connectionString: databaseUrl });
await preCheck.connect();
try {
  const existing = await preCheck.query(
    "SELECT version FROM nex_migration_history WHERE version = '290'",
  );
  if (existing.rows.length > 0) {
    console.error("STOP · mig 290 already present in nex_migration_history on production");
    console.error("Delete the ledger row manually if you need to re-apply (not recommended).");
    process.exit(3);
  }
} finally {
  await preCheck.end();
}

const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/290_nex_security_rate_limit.sql"),
  "utf8",
);

const applyClient = new Client({ connectionString: databaseUrl });
try {
  await applyClient.connect();
  await applyClient.query(sql);
  console.log("Migration 290 applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(4);
} finally {
  await applyClient.end();
}

// Verification
const verifyClient = new Client({ connectionString: databaseUrl });
try {
  await verifyClient.connect();

  const hist = await verifyClient.query(
    "SELECT version, description FROM nex_migration_history WHERE version = '290'",
  );
  if (hist.rows.length !== 1) {
    console.error("VERIFY FAILED · nex_migration_history row for 290 missing");
    process.exit(5);
  }
  console.log(`✓ History: ${hist.rows[0].version} · ${hist.rows[0].description}`);

  const table = await verifyClient.query(
    "SELECT COUNT(*)::bigint AS n FROM nex_security_rate_limit",
  );
  console.log(`✓ nex_security_rate_limit exists · row count: ${table.rows[0].n}`);

  const rls = await verifyClient.query(
    "SELECT relrowsecurity FROM pg_class WHERE relname = 'nex_security_rate_limit'",
  );
  if (!rls.rows[0]?.relrowsecurity) {
    console.error("VERIFY FAILED · RLS not enabled on nex_security_rate_limit");
    process.exit(6);
  }
  console.log("✓ RLS enabled on nex_security_rate_limit");

  const idx = await verifyClient.query(
    "SELECT indexname FROM pg_indexes WHERE tablename = 'nex_security_rate_limit' ORDER BY indexname",
  );
  console.log(`✓ Indexes: ${idx.rows.map((r) => r.indexname).join(", ")}`);
} finally {
  await verifyClient.end();
}

console.log("\nMig 290 production apply complete · V-F2-T1 passed.");
console.log("Next step · V-F2-T2 (rate-limit enforcement on a hot route) ·");
console.log("exercise /api/nex-native/security/password/change with 11+ rapid");
console.log("requests from same account · expect 429 on 11th.");
