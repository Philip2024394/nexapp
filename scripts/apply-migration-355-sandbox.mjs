// scripts/apply-migration-355-sandbox.mjs
//
// AUTHORISED FOR SANDBOX APPLY · founder handoff (host IPv6-only blocker)
// Owner authorisation (session 2026-11-20): "apply mig-355 delivery-pii
// phase A sandbox". SQL + rollback + this script promoted out of
// nex-supabase/candidate-migrations/ on 2026-11-20 along with updating
// the relative repoRoot path (one `..` instead of two).
//
// Phase A is schema-only: adds 5 columns on nex_order, creates
// nex_order_item child table, extends attachment_type enum with
// `order_reference`. NO write-path switch (that is Phase B · Item #7).
// NO backfill (that is Phase C). NO cart_order removal (that is Phase D).
// See Item #6 of the sealed 9-item sandbox engineering pass.
//
// Safety guards (identical pattern to apply-migration-348-sandbox.mjs,
// apply-migration-353-sandbox.mjs.PREVIEW, apply-migration-354-sandbox.mjs.PREVIEW):
//   · Reads SANDBOX_DATABASE_URL from `.env.local`.
//   · Hard-refuses to run if the URL is missing.
//   · Hard-refuses to run if the URL does NOT contain the sandbox
//     project ref `kdstoyyeygcopkogqsyv`.
//   · Hard-refuses to run if the URL DOES contain the production
//     project ref `ijvqdvsvwtwxzcqmoqit`.
//   · Prints the target database name before executing.
//   · Reads the SQL from the POST-PROMOTION path · a run against the
//     PREVIEW filename will fail readFileSync. This is intentional ·
//     the script CANNOT execute against the quarantined preview file.

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

// Promotion-only path · reads the POST-PROMOTION filename. Running
// this script BEFORE promoting the SQL will fail at readFileSync.
const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/355_nex_order_path_a_separation_phase_a.sql"),
  "utf8",
);

const client = new Client({ connectionString: SANDBOX_DATABASE_URL });
await client.connect();

const target = await client.query("SELECT current_database() AS db");
console.log("Target:", target.rows[0]);

try {
  await client.query(sql);
  console.log("✓ mig 355 applied");

  const cols = await client.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'nex_order'
        AND column_name IN ('product_id','delivery_address','delivery_quote','subtotal_pence','payment_method_hint','payment_confirmed_at')
      ORDER BY column_name`,
  );
  console.log("\n=== nex_order Phase A columns ===");
  console.table(cols.rows);

  const items = await client.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'nex_order_item'
      ORDER BY ordinal_position`,
  );
  console.log("\n=== nex_order_item columns ===");
  console.table(items.rows);

  const check = await client.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conname = 'nex_peer_message_attachment_type_check'`,
  );
  console.log("\n=== attachment_type CHECK ===");
  console.table(check.rows);

  const history = await client.query(
    `SELECT version, description, notes
       FROM nex_migration_history
      WHERE version = '355'`,
  );
  console.log("\n=== nex_migration_history row ===");
  console.table(history.rows);
} finally {
  await client.end();
}
