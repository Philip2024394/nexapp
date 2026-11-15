// scripts/apply-migration-348-sandbox.mjs
//
// Sandbox-only apply for migration 348 · NEX single-session enforcement.
// Owner-authorised 2026-11-15 as Phase 4 of the escrow/lockout/
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
  resolve(repoRoot, "nex-supabase/migrations/348_nex_single_session_enforcement.sql"),
  "utf8",
);

const client = new Client({ connectionString: SANDBOX_DATABASE_URL });
await client.connect();

const target = await client.query("SELECT current_database() AS db");
console.log("Target:", target.rows[0]);

try {
  await client.query(sql);
  console.log("✓ mig 348 applied");

  const accountCols = await client.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_account'
        AND column_name='active_single_session_id'`,
  );
  console.log("\n=== nex_account.active_single_session_id ===");
  console.table(accountCols.rows);

  const sessionCols = await client.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_session'
        AND column_name IN ('superseded_at','superseded_reason')
      ORDER BY column_name`,
  );
  console.log("\n=== nex_session supersession columns ===");
  console.table(sessionCols.rows);

  const indexes = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname='public'
        AND indexname IN (
          'idx_nex_account_active_single_session',
          'idx_nex_session_account_live_supersede'
        )
      ORDER BY indexname`,
  );
  console.log("\n=== new indexes ===");
  console.table(indexes.rows);

  const constraints = await client.query(
    `SELECT conname FROM pg_constraint
      WHERE conname = 'nex_session_superseded_reason_length'`,
  );
  console.log("\n=== new check constraint ===");
  console.table(constraints.rows);
} finally {
  await client.end();
}
