// scripts/apply-migration-347-sandbox.mjs
//
// Sandbox-only apply for migration 347 · Vault PIN reset token table.
// Owner-authorised 2026-11-15 as Phase 2B of the escrow/lockout/
// notifications system. Prod ref `ijvqdvsvwtwxzcqmoqit` hard-refused.

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

const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/347_nex_vault_pin_reset_token.sql"),
  "utf8",
);

const client = new Client({ connectionString: SANDBOX_DATABASE_URL });
await client.connect();

const target = await client.query("SELECT current_database() AS db");
console.log("Target:", target.rows[0]);

try {
  await client.query(sql);
  console.log("✓ mig 347 applied");

  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name='nex_vault_pin_reset_token'`,
  );
  console.log("\n=== table ===");
  console.table(tables.rows);

  const cols = await client.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_vault_pin_reset_token'
      ORDER BY ordinal_position`,
  );
  console.log("\n=== columns ===");
  console.table(cols.rows);

  const indexes = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname='public' AND tablename='nex_vault_pin_reset_token'
      ORDER BY indexname`,
  );
  console.log("\n=== indexes ===");
  console.table(indexes.rows);

  const constraints = await client.query(
    `SELECT conname FROM pg_constraint
      WHERE conrelid='public.nex_vault_pin_reset_token'::regclass
      ORDER BY conname`,
  );
  console.log("\n=== constraints ===");
  console.table(constraints.rows);
} finally {
  await client.end();
}
