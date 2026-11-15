// scripts/apply-migration-346-sandbox.mjs
//
// Sandbox-only apply for migration 346 · Vault security logging + lockout
// + security-events feed. Owner-authorised 2026-11-15.
//
// Hard-refuses if SANDBOX_DATABASE_URL does not reference
// `kdstoyyeygcopkogqsyv` · production project `ijvqdvsvwtwxzcqmoqit`
// remains sealed per the 2026-11-10 production-sealed doctrine.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envRaw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");

function envValue(name) {
  const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v || null;
}

const SANDBOX_DATABASE_URL = envValue("SANDBOX_DATABASE_URL");
if (!SANDBOX_DATABASE_URL) {
  console.error("STOP · SANDBOX_DATABASE_URL missing");
  process.exit(1);
}
if (!SANDBOX_DATABASE_URL.includes("kdstoyyeygcopkogqsyv")) {
  console.error("STOP · not sandbox");
  process.exit(2);
}
if (SANDBOX_DATABASE_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("STOP · contains production ref");
  process.exit(3);
}

const migrationPath = resolve(
  repoRoot,
  "nex-supabase/migrations/346_nex_vault_security_logging.sql",
);
const sql = readFileSync(migrationPath, "utf8");

const client = new Client({ connectionString: SANDBOX_DATABASE_URL });
await client.connect();

const target = await client.query(
  "SELECT current_database() AS db, current_user AS user",
);
console.log("Target:", target.rows[0]);

try {
  await client.query(sql);
  console.log("✓ mig 346 applied");

  // Verify the three concerns landed.
  const pinCols = await client.query(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_vault_pin_attempt'
        AND column_name IN ('ip_address','ip_country','user_agent_family','attempt_source')
      ORDER BY column_name`,
  );
  console.log("\n=== nex_vault_pin_attempt added columns ===");
  console.table(pinCols.rows);

  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public'
        AND table_name IN ('nex_vault_pin_lockout','nex_vault_security_event')
      ORDER BY table_name`,
  );
  console.log("\n=== new tables ===");
  console.table(tables.rows);

  const constraints = await client.query(
    `SELECT conname, contype
       FROM pg_constraint
      WHERE conname IN (
        'nex_vault_pin_attempt_attempt_source_check',
        'nex_vault_pin_attempt_ip_country_check',
        'nex_vault_pin_attempt_user_agent_family_check',
        'nex_vault_pin_lockout_failures_nonneg',
        'nex_vault_security_event_event_type_check',
        'nex_vault_security_event_ip_country_check'
      )
      ORDER BY conname`,
  );
  console.log("\n=== check constraints ===");
  console.table(constraints.rows);

  const indexes = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname='public'
        AND indexname IN (
          'idx_nex_vault_security_event_account_occurred',
          'idx_nex_vault_security_event_account_unread'
        )
      ORDER BY indexname`,
  );
  console.log("\n=== indexes ===");
  console.table(indexes.rows);
} finally {
  await client.end();
}
