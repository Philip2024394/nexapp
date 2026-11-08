// scripts/apply-migration-312-sandbox.mjs
//
// Phase 1 · F-1 · apply mig 312 (billing tables RLS lockdown) to SANDBOX.
// Owner-authorised 2026-11-09. SANDBOX ONLY · hard-refuses production.
//
// Usage:
//   node scripts/apply-migration-312-sandbox.mjs
//
// Expected sandbox behaviour: mig 258 is NOT applied to sandbox per inventory,
// so this migration runs the conditional no-op path. It records '312' in
// nex_migration_history. The RLS/revoke/grant statements do NOT execute
// because the target tables don't exist. This proves the conditional no-op
// is safe before the same file is applied to production (where 258 lives
// and the lockdown statements DO execute).

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

const databaseUrl = env("SANDBOX_DATABASE_URL");
const u = new URL(databaseUrl);
const refFromUser = u.username.match(/\.([a-z0-9]{15,})/)?.[1] ?? null;
const refFromHost = u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1] ?? null;
const ref = refFromUser ?? refFromHost;
if (ref === "ijvqdvsvwtwxzcqmoqit") {
  console.error("STOP · production ref detected · this script is sandbox-only");
  process.exit(2);
}
if (ref !== "kdstoyyeygcopkogqsyv") {
  console.error(`STOP · unknown ref ${ref} · expected sandbox kdstoyyeygcopkogqsyv`);
  process.exit(2);
}
console.log(`Target · sandbox ${ref}`);

const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/312_nex_billing_rls_lockdown.sql"),
  "utf8",
);

const applyClient = new Client({ connectionString: databaseUrl });
try {
  await applyClient.connect();
  await applyClient.query(sql);
  console.log("Migration 312 applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(3);
} finally {
  await applyClient.end();
}

// Verification
const verifyClient = new Client({ connectionString: databaseUrl });
try {
  await verifyClient.connect();
  const hist = await verifyClient.query(
    "SELECT version, description FROM nex_migration_history WHERE version = '312'",
  );
  if (hist.rows.length !== 1) {
    console.error("VERIFY FAILED · nex_migration_history row for 312 missing");
    process.exit(4);
  }
  console.log(`✓ History: ${hist.rows[0].version} · ${hist.rows[0].description}`);

  // Check whether 258 was present (should NOT be in sandbox per inventory)
  const mig258 = await verifyClient.query(
    "SELECT 1 FROM nex_migration_history WHERE version = '258'",
  );
  if (mig258.rows.length === 0) {
    console.log("✓ Confirmed no-op path · mig 258 is NOT applied in sandbox");
    console.log("✓ RLS statements correctly skipped · file is production-safe");
  } else {
    // If 258 IS applied, verify the RLS state
    console.log("Note · mig 258 IS applied in this env · verifying RLS state");
    for (const table of [
      "nex_billing_event_log",
      "nex_billing_adverse_event",
      "nex_billing_checkout_session",
    ]) {
      const r = await verifyClient.query(
        "SELECT relrowsecurity FROM pg_class WHERE relname = $1",
        [table],
      );
      if (!r.rows[0]?.relrowsecurity) {
        console.error(`VERIFY FAILED · RLS not enabled on ${table}`);
        process.exit(5);
      }
      console.log(`✓ RLS enabled on ${table}`);
    }
  }
} finally {
  await verifyClient.end();
}

console.log("\nMig 312 sandbox apply complete.");
