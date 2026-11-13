// scripts/apply-migration-344-sandbox.mjs
//
// Sandbox-only apply for migration 344 · nex_business.shop_intro_message.
// Owner-authorised 2026-11-13.
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
  "nex-supabase/migrations/344_nex_business_shop_intro_message.sql",
);
const sql = readFileSync(migrationPath, "utf8");

const client = new Client({ connectionString: SANDBOX_DATABASE_URL });
await client.connect();

const projectCheck = await client.query(
  "SELECT current_database() AS db, inet_server_addr()::text AS host",
);
console.log("Target DB:", projectCheck.rows[0]);

try {
  await client.query(sql);
  console.log("✓ mig 344 applied");

  const columnCheck = await client.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_name = 'nex_business'
        AND column_name = 'shop_intro_message'`,
  );
  console.log("\n=== Column check ===");
  console.log(columnCheck.rows);

  const constraintCheck = await client.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conname = 'nex_business_shop_intro_message_length'`,
  );
  console.log("\n=== CHECK constraint ===");
  console.log(constraintCheck.rows);

  const historyCheck = await client.query(
    `SELECT version, applied_at FROM nex_migration_history WHERE version = '344'`,
  );
  console.log("\n=== Migration history ===");
  console.log(historyCheck.rows);

  // Force PostgREST to reload its schema cache so the Supabase REST
  // client sees the new column immediately (same pattern as mig 285).
  await client.query("NOTIFY pgrst, 'reload schema'");
  console.log("✓ PostgREST schema cache reload notified");
} catch (err) {
  console.error("APPLY FAILED:", err.message);
  process.exit(10);
} finally {
  await client.end();
}
