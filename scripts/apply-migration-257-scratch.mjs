#!/usr/bin/env node
// scripts/apply-migration-257-scratch.mjs
//
// SCRATCH-ONLY applier for Migration 257. Cannot connect to Supabase.
// Can ONLY connect to a local PostgreSQL instance (localhost or 127.0.0.1)
// via an explicit SCRATCH_DATABASE_URL env var OR --url CLI argument.
//
// Hard safety separation from the production runner:
//   · Does NOT read .env.local DATABASE_URL under any circumstance.
//   · Rejects any hostname matching known remote patterns.
//   · Requires hostname = 'localhost' or '127.0.0.1'.
//   · Requires an explicit scratch database name (default: nex_rehearsal_257).
//   · Supports --dry-run.
//   · Migration 257 owns its own transaction + ledger write · runner just
//     executes the SQL and reports pre/post state.
//   · ROLLBACK safety-net before any process.exit if transaction indicator
//     is still active.
//   · Never prints credentials.
//
// Owner-authorised 2026-11-02 as LOCAL FILE ONLY.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const MIGRATION_FILE = "nex-supabase/migrations/257_nex_account_independent_shop_vault_entitlements.sql";
const MIGRATION_VERSION = "257";
const PREREQUISITES = ["046", "207", "224"];
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
    `FATAL: scratch URL hostname must be 'localhost' or '127.0.0.1'. Got: '${h}'.`,
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
    `FATAL: scratch URL database name is '${dbName}'. Expected: '${EXPECTED_SCRATCH_DB_NAME}'.`,
  );
  process.exit(3);
}

// ─── Read migration SQL ────────────────────────────────────────────────

const sql = readFileSync(resolve(MIGRATION_FILE), "utf8");

console.log(`SCRATCH RUNNER · migration ${MIGRATION_VERSION}`);
console.log(`MIGRATION file: ${MIGRATION_FILE}`);
console.log(`MODE:           ${DRY_RUN ? "DRY-RUN" : "APPLY (migration owns transaction)"}`);
console.log(`HOST:           ${h}:${parsed.port || "(default)"}`);
console.log(`DATABASE:       ${dbName}`);
console.log(`CREDENTIALS:    (not printed)`);

// ─── Connect + run ─────────────────────────────────────────────────────

const client = new pg.Client({ connectionString: rawUrl });
await client.connect();
console.log("CONNECTED to scratch DB");

let exitCode = 0;
let transactionActive = false;

try {
  // Prerequisite check · scratch rehearsal must have 046, 207, 224 ledger
  // rows (either seeded by the scratch setup OR applied by the scratch-207
  // runner above).
  for (const prereq of PREREQUISITES) {
    const q = await client.query(
      "SELECT 1 FROM nex_migration_history WHERE version = $1",
      [prereq],
    );
    if (q.rowCount === 0) {
      console.error(
        `FATAL: prerequisite migration ${prereq} not recorded in scratch ledger. ` +
          "Seed it first (046, 224 should come from the schema skeleton · 207 from the scratch-207 runner).",
      );
      exitCode = 4;
      throw new Error(`prereq ${prereq} missing`);
    }
  }
  console.log(`PRE   prerequisites verified: ${PREREQUISITES.join(", ")}`);

  const pre_257 = await client.query(
    "SELECT COUNT(*)::int AS c FROM nex_migration_history WHERE version = $1",
    [MIGRATION_VERSION],
  );
  console.log(
    `PRE   migration ${MIGRATION_VERSION} recorded? ${pre_257.rows[0].c > 0 ? "YES (migration will abort)" : "NO"}`,
  );

  const pre_bisnis = await client.query(
    "SELECT COUNT(*)::int AS c FROM nex_account WHERE tier='bisnis'",
  );
  console.log(
    `PRE   bisnis-tier rows: ${pre_bisnis.rows[0].c} (migration expects exactly 2)`,
  );

  if (DRY_RUN) {
    console.log("");
    console.log("DRY-RUN: SQL that WOULD apply (migration owns BEGIN/COMMIT · not executed):");
    console.log("─".repeat(60));
    console.log(sql);
    console.log("─".repeat(60));
    console.log("DRY-RUN complete · no changes made.");
  } else {
    transactionActive = true;
    await client.query(sql);
    transactionActive = false;
    console.log("APPLIED migration 257 (migration owns transaction + ledger)");

    const post_cols = await client.query(`
      SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_account'
        AND column_name IN (
          'shop_tier','shop_period_end','shop_status','shop_past_due_at',
          'vault_tier','vault_period_end','vault_status','vault_past_due_at',
          'business_trial_status'
        )
      ORDER BY column_name
    `);
    console.log(`POST  entitlement columns: ${post_cols.rows.length}/9`);
    for (const r of post_cols.rows) {
      console.log(
        `      · ${r.column_name} · ${r.data_type} · nullable=${r.is_nullable}`,
      );
    }

    const post_backfill = await client.query(`
      SELECT
        COUNT(*)::int AS backfilled,
        COUNT(*) FILTER (WHERE shop_tier='unlimited')::int AS tier_ok,
        COUNT(*) FILTER (WHERE shop_status='active')::int AS status_ok,
        COUNT(*) FILTER (WHERE shop_period_end IS NOT NULL AND shop_period_end = bisnis_expires_at)::int AS period_end_ok
      FROM nex_account WHERE tier='bisnis'
    `);
    const r = post_backfill.rows[0];
    console.log(
      `POST  backfill rows=${r.backfilled} · tier=unlimited:${r.tier_ok} · status=active:${r.status_ok} · period_end matches bisnis_expires_at:${r.period_end_ok} (all should equal 2)`,
    );

    const post_ledger = await client.query(
      "SELECT applied_at FROM nex_migration_history WHERE version = $1",
      [MIGRATION_VERSION],
    );
    console.log(
      `POST  ledger: applied_at=${post_ledger.rows[0]?.applied_at ?? "MISSING"}`,
    );
  }
} catch (e) {
  if (transactionActive) {
    try {
      await client.query("ROLLBACK");
      console.error("ROLLBACK safety-net executed");
    } catch (rollbackErr) {
      console.error(`ROLLBACK safety-net reported: ${rollbackErr.message}`);
    }
    transactionActive = false;
  }
  console.error(`FAIL: ${e.message}`);
  if (exitCode === 0) exitCode = 1;
} finally {
  try {
    await client.end();
  } catch {
    /* non-fatal */
  }
}

console.log(exitCode === 0 ? "DONE" : "DONE (with failure)");
process.exit(exitCode);
