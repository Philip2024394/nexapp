#!/usr/bin/env node
// scripts/apply-migration-257.mjs
//
// Guarded applier for Migration 257 (independent Shop + Vault entitlements).
// Pattern mirrors apply-migration-224.mjs with safety extensions:
//   1. URL parse + hostname-exact validation
//   2. Runner-side prerequisite check (046, 207, 224)
//   3. ROLLBACK before any process.exit · never exits inside active txn
//   4. --dry-run mode · reads SQL + prints pre-state · does NOT execute
//
// Migration 257 contains its OWN BEGIN/COMMIT and its OWN INSERT INTO
// nex_migration_history. The runner does NOT wrap in an extra transaction
// (would create a nested savepoint and complicate pg driver semantics) and
// does NOT insert the ledger row (257 handles it internally).
//
// Owner-authorised 2026-11-02 as LOCAL FILE ONLY. Does not execute
// against any remote database without owner-side approval.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const CANONICAL_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const MIGRATION_FILE = "nex-supabase/migrations/257_nex_account_independent_shop_vault_entitlements.sql";
const MIGRATION_VERSION = "257";
const PREREQUISITES = ["046", "207", "224"];
const DRY_RUN = process.argv.includes("--dry-run");

// ─── Env + URL identity ────────────────────────────────────────────────

function readEnv(key) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === key) return m[2];
  }
  return null;
}

const url = readEnv("DATABASE_URL");
if (!url) {
  console.error("FATAL: DATABASE_URL missing from .env.local");
  process.exit(2);
}

let parsed;
try {
  parsed = new URL(url);
} catch (e) {
  console.error(`FATAL: DATABASE_URL is not a valid URL (${e.message})`);
  process.exit(2);
}

let projectRef = null;
if (parsed.hostname.endsWith(".pooler.supabase.com")) {
  const m = parsed.username.match(/^postgres\.([a-z0-9]+)$/);
  if (m) projectRef = m[1];
} else if (parsed.hostname.endsWith(".supabase.co")) {
  const m = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
  if (m) projectRef = m[1];
}

if (projectRef !== CANONICAL_PROJECT_REF) {
  console.error(
    `FATAL: project ref '${projectRef ?? "(unparseable)"}' does not match ` +
      `canonical '${CANONICAL_PROJECT_REF}'. Refusing to connect.`,
  );
  console.error(`       hostname observed: ${parsed.hostname}`);
  process.exit(3);
}

// ─── Read migration SQL ────────────────────────────────────────────────

const sql = readFileSync(resolve(MIGRATION_FILE), "utf8");

console.log(`MIGRATION file:    ${MIGRATION_FILE}`);
console.log(`MIGRATION version: ${MIGRATION_VERSION}`);
console.log(
  `MODE:              ${DRY_RUN ? "DRY-RUN · reads SQL + pre-state · does NOT execute" : "APPLY · will execute (migration owns its transaction)"}`,
);
console.log(`PROJECT:           ${CANONICAL_PROJECT_REF} (hostname-verified)`);

// ─── Connect + run ─────────────────────────────────────────────────────

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED");

let exitCode = 0;
let transactionActive = false;

try {
  // Runner-side prerequisite check (clearer error than the migration's
  // DO block would produce · same semantics)
  for (const prereq of PREREQUISITES) {
    const q = await client.query(
      "SELECT 1 FROM nex_migration_history WHERE version = $1",
      [prereq],
    );
    if (q.rowCount === 0) {
      console.error(`FATAL: prerequisite migration ${prereq} not applied.`);
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
    `PRE   migration ${MIGRATION_VERSION} recorded? ${pre_257.rows[0].c > 0 ? "YES (migration will raise and abort)" : "NO"}`,
  );

  const pre_bisnis = await client.query(
    "SELECT COUNT(*)::int AS c FROM nex_account WHERE tier='bisnis'",
  );
  console.log(
    `PRE   bisnis-tier rows: ${pre_bisnis.rows[0].c} (migration expects exactly 2)`,
  );

  if (DRY_RUN) {
    console.log("");
    console.log("DRY-RUN: SQL that WOULD apply (migration owns its own BEGIN/COMMIT · not executed):");
    console.log("─".repeat(60));
    console.log(sql);
    console.log("─".repeat(60));
    console.log("DRY-RUN complete · no changes made.");
  } else {
    // Execute the migration SQL as-is. Migration 257 opens its own
    // transaction with BEGIN, holds an advisory lock for the duration,
    // runs 7 parts, writes the ledger row, and commits. If any DO block
    // RAISES EXCEPTION, Postgres rolls back the entire transaction and
    // the pg driver throws · caught here · no ledger row recorded.
    //
    // We mark transactionActive=true for correctness during the single
    // await, even though 257 manages the actual transaction internally.
    // This ensures a mid-flight catch path tries ROLLBACK as a safety
    // net (which will be a no-op if 257 already rolled back).
    transactionActive = true;
    await client.query(sql);
    transactionActive = false;
    console.log("APPLIED migration 257 (ledger row written inside migration transaction)");

    // Post-state
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
      SELECT COUNT(*)::int AS backfilled FROM nex_account
      WHERE tier='bisnis' AND shop_tier='unlimited' AND shop_period_end IS NOT NULL
    `);
    console.log(
      `POST  backfilled bisnis→unlimited rows: ${post_backfill.rows[0].backfilled} (expected 2)`,
    );

    const post_ledger = await client.query(
      "SELECT applied_at FROM nex_migration_history WHERE version = $1",
      [MIGRATION_VERSION],
    );
    console.log(
      `POST  ledger row: applied_at=${post_ledger.rows[0]?.applied_at ?? "MISSING"}`,
    );
  }
} catch (e) {
  // 257 owns its own transaction so ROLLBACK is normally not needed from
  // the runner · but we attempt it as a safety net in case the pg driver
  // ended up with an open transaction state. ROLLBACK on an already-closed
  // transaction is a no-op warning.
  if (transactionActive) {
    try {
      await client.query("ROLLBACK");
      console.error("ROLLBACK safety-net executed");
    } catch (rollbackErr) {
      // Expected if 257 already rolled back · log but do not propagate
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
