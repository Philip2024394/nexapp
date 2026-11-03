#!/usr/bin/env node
// scripts/apply-migration-258-scratch.mjs
//
// SCRATCH-ONLY applier for Migration 258 (billing foundation).
// Cannot connect to Supabase · can ONLY connect to localhost.
//
// Hard safety separation from any production runner:
//   · Does NOT read .env.local DATABASE_URL under any circumstance.
//   · Rejects any remote hostname pattern.
//   · Requires hostname = 'localhost' or '127.0.0.1'.
//   · Requires an explicit scratch database name (default: nex_rehearsal_257).
//   · Supports --dry-run.
//   · Migration 258 owns its own transaction + ledger write · runner just
//     executes the SQL and reports pre/post state.
//   · ROLLBACK safety-net before any process.exit if transaction indicator
//     is still active.
//   · Never prints credentials.
//
// Owner-authorised 2026-11-02 as LOCAL FILE ONLY.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const MIGRATION_FILE = "nex-supabase/migrations/258_nex_billing_foundation.sql";
const MIGRATION_VERSION = "258";
const PREREQUISITES = ["046", "207", "224", "257"];
const EXPECTED_SCRATCH_DB_NAME = "nex_rehearsal_257";
const DRY_RUN = process.argv.includes("--dry-run");

// ─── Resolve scratch URL · NEVER falls back to production env ──────────

let rawUrl = null;
const urlIdx = process.argv.indexOf("--url");
if (urlIdx !== -1 && process.argv[urlIdx + 1]) {
  rawUrl = process.argv[urlIdx + 1];
}
if (!rawUrl) {
  rawUrl = process.env.SCRATCH_DATABASE_URL ?? null;
}
if (!rawUrl) {
  console.error(
    "FATAL: scratch runner requires an explicit scratch URL. Provide:\n" +
      "       --url postgresql://postgres:PASSWORD@localhost:5432/nex_rehearsal_257\n" +
      "       OR set SCRATCH_DATABASE_URL in the environment.\n" +
      "       This runner refuses to read .env.local DATABASE_URL.",
  );
  process.exit(2);
}

// ─── Validate: must be localhost ───────────────────────────────────────

let parsed;
try {
  parsed = new URL(rawUrl);
} catch (e) {
  console.error(`FATAL: scratch URL is not a valid URL (${e.message})`);
  process.exit(2);
}

const h = parsed.hostname.toLowerCase();
const REMOTE_PATTERNS = [
  "supabase.co",
  "supabase.com",
  "pooler.supabase.com",
  "amazonaws.com",
  "rds.amazonaws.com",
];
for (const pattern of REMOTE_PATTERNS) {
  if (h.includes(pattern)) {
    console.error(
      `FATAL: scratch URL hostname '${h}' looks remote (matches '${pattern}'). ` +
        "Scratch runner refuses to connect to anything other than localhost.",
    );
    process.exit(3);
  }
}
if (h !== "localhost" && h !== "127.0.0.1") {
  console.error(
    `FATAL: scratch URL hostname must be 'localhost' or '127.0.0.1'. Got: '${h}'. Aborting.`,
  );
  process.exit(3);
}

const dbName = (parsed.pathname || "").replace(/^\//, "");
if (!dbName) {
  console.error("FATAL: scratch URL must include a database name in the path.");
  process.exit(3);
}
if (dbName !== EXPECTED_SCRATCH_DB_NAME) {
  console.error(
    `FATAL: scratch URL database name is '${dbName}'. Expected: '${EXPECTED_SCRATCH_DB_NAME}'. Aborting.`,
  );
  process.exit(3);
}

// ─── Read migration SQL ────────────────────────────────────────────────

const sql = readFileSync(resolve(MIGRATION_FILE), "utf8");

console.log(`SCRATCH RUNNER · migration ${MIGRATION_VERSION}`);
console.log(`MIGRATION file: ${MIGRATION_FILE}`);
console.log(`MODE:           ${DRY_RUN ? "DRY-RUN" : "APPLY"}`);
console.log(`HOST:           ${h}:${parsed.port || "(default)"}`);
console.log(`DATABASE:       ${dbName}`);
console.log(`CREDENTIALS:    (not printed)`);

const client = new pg.Client({ connectionString: rawUrl });
await client.connect();
console.log("CONNECTED to scratch DB");

let exitCode = 0;
let transactionActive = false;

try {
  // Prerequisite ledger check · surface before touching schema
  for (const req of PREREQUISITES) {
    const r = await client.query(
      "SELECT COUNT(*)::int AS c FROM nex_migration_history WHERE version = $1",
      [req],
    );
    const ok = r.rows[0].c > 0;
    console.log(`PRE   prerequisite ${req}: ${ok ? "RECORDED" : "MISSING"}`);
    if (!ok) {
      throw new Error(`prerequisite migration ${req} missing from scratch nex_migration_history`);
    }
  }

  const pre_258 = await client.query(
    "SELECT COUNT(*)::int AS c FROM nex_migration_history WHERE version = $1",
    [MIGRATION_VERSION],
  );
  console.log(
    `PRE   migration ${MIGRATION_VERSION} recorded? ${pre_258.rows[0].c > 0 ? "YES (will raise)" : "NO"}`,
  );

  const pre_cols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_account'
      AND column_name IN (
        'shop_stripe_customer_id','shop_stripe_subscription_id','shop_stripe_price_id',
        'vault_stripe_customer_id','vault_stripe_subscription_id','vault_stripe_price_id'
      )
    ORDER BY column_name
  `);
  console.log(`PRE   stripe linkage columns present: ${pre_cols.rows.length}/6`);

  const pre_tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name IN (
        'nex_billing_event_log','nex_billing_adverse_event','nex_billing_checkout_session'
      )
    ORDER BY table_name
  `);
  console.log(`PRE   billing tables present: ${pre_tables.rows.length}/3`);

  if (DRY_RUN) {
    console.log("");
    console.log("DRY-RUN: SQL that WOULD apply inside migration's own BEGIN/COMMIT (not executed):");
    console.log("─".repeat(60));
    console.log(sql);
    console.log("─".repeat(60));
    console.log("DRY-RUN complete · no changes made.");
  } else {
    // Migration 258 owns its own BEGIN/COMMIT.
    await client.query(sql);
    console.log("APPLIED migration 258 (scratch DB)");

    const post_cols = await client.query(`
      SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_account'
        AND column_name IN (
          'shop_stripe_customer_id','shop_stripe_subscription_id','shop_stripe_price_id',
          'vault_stripe_customer_id','vault_stripe_subscription_id','vault_stripe_price_id'
        )
      ORDER BY column_name
    `);
    console.log(`POST  stripe linkage columns present: ${post_cols.rows.length}/6`);
    for (const r of post_cols.rows) {
      console.log(`      · ${r.column_name} · ${r.data_type} · nullable=${r.is_nullable}`);
    }

    const post_tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public'
        AND table_name IN (
          'nex_billing_event_log','nex_billing_adverse_event','nex_billing_checkout_session'
        )
      ORDER BY table_name
    `);
    console.log(`POST  billing tables present: ${post_tables.rows.length}/3`);
    for (const r of post_tables.rows) {
      console.log(`      · ${r.table_name}`);
    }

    const post_hist = await client.query(
      "SELECT version, applied_at FROM nex_migration_history WHERE version = $1",
      [MIGRATION_VERSION],
    );
    console.log(
      `POST  ledger: ${post_hist.rowCount > 0 ? `version=${post_hist.rows[0].version} applied_at=${post_hist.rows[0].applied_at}` : "MISSING"}`,
    );
  }
} catch (e) {
  // Migration 258 owns its own transaction; if we see transactionActive we
  // defensively ROLLBACK. In the normal success path 258 COMMITs itself,
  // and on failure Postgres aborts the transaction so this is a safety net.
  if (transactionActive) {
    try {
      await client.query("ROLLBACK");
      console.error("ROLLED BACK scratch migration 258 transaction (safety net)");
    } catch (rollbackErr) {
      console.error(`ROLLBACK itself failed: ${rollbackErr.message}`);
    }
    transactionActive = false;
  }
  console.error(`FAIL: ${e.message}`);
  exitCode = 1;
} finally {
  try {
    await client.end();
  } catch {
    /* non-fatal */
  }
}

console.log(exitCode === 0 ? "DONE" : "DONE (with failure)");
process.exit(exitCode);
