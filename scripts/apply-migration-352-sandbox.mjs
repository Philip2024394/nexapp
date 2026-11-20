// scripts/apply-migration-352-sandbox.mjs
//
// Idempotent sandbox apply-script for migration 352 ·
// public.nex_prelaunch_signup (launch-notification email list).
//
// Authored 2026-11-20 under owner authorisation "apply mig-352
// prelaunch sandbox". Pattern mirrors apply-migration-353-sandbox.mjs.
//
// Safety guards (identical envelope to apply-migration-353):
//   · Reads SANDBOX_DATABASE_URL from `.env.local`.
//   · Hard-refuses if SANDBOX_DATABASE_URL is missing.
//   · Hard-refuses if URL does NOT contain sandbox ref `kdstoyyeygcopkogqsyv`.
//   · Hard-refuses if URL DOES contain prod ref `ijvqdvsvwtwxzcqmoqit`.
//   · Prints the target database name before executing.
//   · Reads the SQL from the POST-PROMOTION path. A run against an
//     un-promoted (`_PROPOSAL` suffix) filename will fail readFileSync
//     — intentional.
//
// Idempotency:
//   · The migration body uses CREATE TABLE IF NOT EXISTS + CREATE UNIQUE
//     INDEX IF NOT EXISTS + CREATE INDEX IF NOT EXISTS, so re-running the
//     apply is harmless. The ALTER TABLE ... ENABLE ROW LEVEL SECURITY
//     line is idempotent at the DB level (no-op if already enabled).
//   · COMMENT ON overwrites in place; safe to repeat.
//
// Post-check report:
//   · pg_class row for nex_prelaunch_signup (presence + relrowsecurity).
//   · information_schema.columns column set.
//   · pg_indexes for the two indexes.
//   · pg_policies count (expected 0 under strict INSERT-service-role model).
//
// Host note (2026-11-20):
//   This Windows host cannot route IPv6 to the Supabase direct DB
//   endpoint and the current pooler username registration for
//   `postgres.kdstoyyeygcopkogqsyv` returns "tenant/user not found"
//   across 9 regions. Execution is therefore a founder handoff —
//   run this from a Linux/WSL/macOS host or after the pooler tenant
//   registration is corrected.

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
  console.error("STOP · SANDBOX_DATABASE_URL missing from .env.local");
  process.exit(1);
}
if (!SANDBOX_DATABASE_URL.includes("kdstoyyeygcopkogqsyv")) {
  console.error("STOP · SANDBOX_DATABASE_URL does not contain sandbox project ref");
  process.exit(2);
}
if (SANDBOX_DATABASE_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("STOP · SANDBOX_DATABASE_URL contains production project ref");
  process.exit(3);
}

// Promotion-only path. Running this script BEFORE the SQL file has been
// renamed to strip the `_PROPOSAL` suffix fails fast at readFileSync.
const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/352_nex_prelaunch_signup.sql"),
  "utf8",
);

const client = new Client({ connectionString: SANDBOX_DATABASE_URL });
await client.connect();

const target = await client.query("SELECT current_database() AS db");
console.log("Target:", target.rows[0]);

try {
  await client.query(sql);
  console.log("✓ mig 352 applied (idempotent)");

  const tbl = await client.query(
    `SELECT relname, relrowsecurity
       FROM pg_class
      WHERE relname = 'nex_prelaunch_signup'
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')`,
  );
  console.log("\n=== pg_class (table + RLS state) ===");
  console.table(tbl.rows);

  const cols = await client.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'nex_prelaunch_signup'
      ORDER BY ordinal_position`,
  );
  console.log("\n=== columns ===");
  console.table(cols.rows);

  const idx = await client.query(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'nex_prelaunch_signup'
      ORDER BY indexname`,
  );
  console.log("\n=== indexes ===");
  console.table(idx.rows);

  const pol = await client.query(
    `SELECT policyname, cmd, qual, with_check
       FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'nex_prelaunch_signup'`,
  );
  console.log("\n=== policies (expected: 0 rows) ===");
  console.table(pol.rows);
} finally {
  await client.end();
}
