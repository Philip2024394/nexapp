// scripts/apply-migration-318-sandbox.mjs
//
// Owner-authorised 2026-11-10 · one-shot apply for migration 318
// (order_enabled notification preference) to SANDBOX ONLY.
//
// Hard pre-flight check:
//   · Loads NEX_POSTGRES_URL from .env.local
//   · Extracts the Supabase project ref from the host
//   · ABORTS if ref !== "kdstoyyeygcopkogqsyv"
//   · DOUBLE-ABORT if ref === "ijvqdvsvwtwxzcqmoqit" (production)
//
// Scope:
//   · Runs ONLY the single SQL file for migration 318.
//   · Does NOT run any other pending migrations.
//   · Does NOT deploy, push, or touch production.
//   · Wraps the SQL in a transaction so mid-apply failure rolls back.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

function loadEnvVar(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  // Match the FIRST non-commented occurrence only.
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith("#")) continue;
    const m = line.match(new RegExp(`^${name}=(.*)$`));
    if (m) {
      let v = m[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return v;
    }
  }
  throw new Error(`${name} not found in .env.local (non-commented)`);
}

const databaseUrl = loadEnvVar("NEX_POSTGRES_URL");

// ---- Project-ref safety gate ----------------------------------------
const EXPECTED_REF = "kdstoyyeygcopkogqsyv";
const FORBIDDEN_PROD_REF = "ijvqdvsvwtwxzcqmoqit";

const u = new URL(databaseUrl);
// Supabase host shapes we may see:
//   · Direct: db.<ref>.supabase.co
//   · Pooler: aws-0-<region>.pooler.supabase.com (ref lives in username:
//     postgres.<ref>)
let projectRef = null;
const hostMatch = u.hostname.match(/^db\.([a-z0-9]{15,})\.supabase\.co$/);
if (hostMatch) projectRef = hostMatch[1];
if (!projectRef) {
  const userMatch = u.username.match(/\.([a-z0-9]{15,})$/);
  if (userMatch) projectRef = userMatch[1];
}

console.log(`DB host:      ${u.hostname}`);
console.log(`DB username:  ${u.username}`);
console.log(`Project ref:  ${projectRef ?? "<UNKNOWN>"}`);

if (projectRef === FORBIDDEN_PROD_REF) {
  console.error(
    `STOP · PROJECT REF IS PRODUCTION "${FORBIDDEN_PROD_REF}" · migration 318 is authorised for SANDBOX ONLY · aborting`,
  );
  process.exit(2);
}
if (projectRef !== EXPECTED_REF) {
  console.error(
    `STOP · project ref "${projectRef}" is not the authorised SANDBOX project "${EXPECTED_REF}" · aborting`,
  );
  process.exit(2);
}
console.log(`Pre-flight OK · targeting SANDBOX ${EXPECTED_REF}`);

// ---- Load the single migration file ---------------------------------
const migrationPath = resolve(
  repoRoot,
  "nex-supabase/migrations/318_nex_account_notification_prefs_order_PROPOSAL.sql",
);
const sql = readFileSync(migrationPath, "utf8");
console.log(`Loaded migration · ${migrationPath} · ${sql.length} bytes`);

// ---- Apply (single transaction) -------------------------------------
const client = new Client({ connectionString: databaseUrl });
try {
  await client.connect();
  console.log("Connected · BEGIN");
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("Migration applied · COMMIT ok");
} catch (err) {
  console.error("Apply failed · rolling back:", err?.message ?? err);
  try { await client.query("ROLLBACK"); } catch { /* nothing to roll back */ }
  process.exit(3);
} finally {
  await client.end();
}

// ---- Verify (V1 of the sandbox verification procedure) --------------
const verifier = new Client({ connectionString: databaseUrl });
await verifier.connect();
try {
  const colCheck = await verifier.query(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'nex_account_notification_prefs'
        AND column_name = 'order_enabled'`,
  );
  console.log("V1 · column check:");
  for (const r of colCheck.rows) console.log(`  ${JSON.stringify(r)}`);
  if (colCheck.rowCount !== 1) {
    console.error("V1 FAIL · expected exactly 1 row");
    process.exit(4);
  }
  const row = colCheck.rows[0];
  const pass =
    row.data_type === "boolean" &&
    row.is_nullable === "NO" &&
    (row.column_default === "true" || row.column_default === "'true'" || row.column_default === "true::boolean");
  console.log(`V1 ${pass ? "PASS" : "FAIL"}`);

  // Spot-check: every existing row has order_enabled = true after the
  // DEFAULT backfill.
  const spotCheck = await verifier.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE order_enabled IS TRUE)::int AS true_count,
            COUNT(*) FILTER (WHERE order_enabled IS FALSE)::int AS false_count,
            COUNT(*) FILTER (WHERE order_enabled IS NULL)::int AS null_count
       FROM nex_account_notification_prefs`,
  );
  console.log("V2a · existing row backfill:");
  console.log(`  ${JSON.stringify(spotCheck.rows[0])}`);

  if (!pass) process.exit(4);
} finally {
  await verifier.end();
}

console.log("DONE · migration 318 applied to sandbox · V1 + V2a captured");
