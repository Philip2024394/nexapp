// scripts/apply-migration-354-sandbox.mjs
//
// AUTHORISED FOR SANDBOX APPLY · founder handoff (host IPv6-only blocker)
// Owner authorisation (session 2026-11-20): "apply mig-354 cart-tx
// sandbox + flip flag". SQL + rollback + this script were promoted out
// of nex-supabase/candidate-migrations/ on 2026-11-20 along with
// updating the relative repoRoot path (one `..` instead of two).
//
// The TypeScript wrapper stays disabled until the owner flips
// NEX_CART_ORDER_TX=1 in the sandbox deploy env AND BROWSER-tier
// verification passes against the sandbox. See Item #5 of the sealed
// 9-item sandbox engineering pass.
//
// Safety guards (identical pattern to apply-migration-348-sandbox.mjs
// and apply-migration-353-sandbox.mjs.PREVIEW):
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
  resolve(repoRoot, "nex-supabase/migrations/354_nex_cart_order_create_transactional.sql"),
  "utf8",
);

const client = new Client({ connectionString: SANDBOX_DATABASE_URL });
await client.connect();

const target = await client.query("SELECT current_database() AS db");
console.log("Target:", target.rows[0]);

try {
  await client.query(sql);
  console.log("✓ mig 354 applied");

  const fn = await client.query(
    `SELECT proname, prosecdef, proconfig
       FROM pg_proc
      WHERE proname = 'nex_create_cart_order_tx'`,
  );
  console.log("\n=== nex_create_cart_order_tx (security_definer + proconfig) ===");
  console.table(fn.rows);

  const grants = await client.query(
    `SELECT grantee, privilege_type
       FROM information_schema.role_routine_grants
      WHERE routine_name = 'nex_create_cart_order_tx'
      ORDER BY grantee, privilege_type`,
  );
  console.log("\n=== grants ===");
  console.table(grants.rows);

  const history = await client.query(
    `SELECT version, description, notes
       FROM nex_migration_history
      WHERE version = '354'`,
  );
  console.log("\n=== nex_migration_history row ===");
  console.table(history.rows);
} finally {
  await client.end();
}
