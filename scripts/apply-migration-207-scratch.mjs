#!/usr/bin/env node
// scripts/apply-migration-207-scratch.mjs
//
// SCRATCH-ONLY applier for Migration 207. Cannot connect to Supabase.
// Can ONLY connect to a local PostgreSQL instance (localhost or 127.0.0.1)
// via an explicit SCRATCH_DATABASE_URL env var OR --url CLI argument.
//
// Hard safety separation from the production runner:
//   · Does NOT read .env.local DATABASE_URL under any circumstance.
//   · Rejects any hostname containing 'supabase.co', 'supabase.com',
//     'pooler.supabase.com', or anything other than localhost/127.0.0.1.
//   · Rejects any hostname that is not literally 'localhost' or '127.0.0.1'.
//   · Requires an explicit scratch database name (default: nex_rehearsal_257).
//   · Supports --dry-run.
//   · Atomic BEGIN/COMMIT around migration SQL + ledger insert.
//   · ROLLBACK before any process.exit while a transaction is active.
//   · Never prints credentials.
//
// Owner-authorised 2026-11-02 as LOCAL FILE ONLY.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const MIGRATION_FILE = "nex-supabase/migrations/207_nex_onboarding_and_vault_trial.sql";
const MIGRATION_VERSION = "207";
const EXPECTED_SCRATCH_DB_NAME = "nex_rehearsal_257";
const DRY_RUN = process.argv.includes("--dry-run");

// ─── Resolve scratch URL · NEVER falls back to production env ──────────

// Priority 1: --url CLI argument
let rawUrl = null;
const urlIdx = process.argv.indexOf("--url");
if (urlIdx !== -1 && process.argv[urlIdx + 1]) {
  rawUrl = process.argv[urlIdx + 1];
}

// Priority 2: SCRATCH_DATABASE_URL env var (NOT DATABASE_URL)
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

// ─── Validate: must be localhost, must not be any remote-DB hostname ───

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

// Validate database name
const dbName = (parsed.pathname || "").replace(/^\//, "");
if (!dbName) {
  console.error("FATAL: scratch URL must include a database name in the path.");
  process.exit(3);
}
if (dbName !== EXPECTED_SCRATCH_DB_NAME) {
  console.error(
    `FATAL: scratch URL database name is '${dbName}'. Expected: '${EXPECTED_SCRATCH_DB_NAME}'. ` +
      "Create the scratch database first:\n" +
      `       psql -U postgres -c "CREATE DATABASE ${EXPECTED_SCRATCH_DB_NAME};"`,
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

// ─── Connect + run ─────────────────────────────────────────────────────

const client = new pg.Client({ connectionString: rawUrl });
await client.connect();
console.log("CONNECTED to scratch DB");

let exitCode = 0;
let transactionActive = false;

try {
  const pre_207 = await client.query(
    "SELECT COUNT(*)::int AS c FROM nex_migration_history WHERE version = $1",
    [MIGRATION_VERSION],
  );
  console.log(
    `PRE   migration ${MIGRATION_VERSION} recorded? ${pre_207.rows[0].c > 0 ? "YES" : "NO"}`,
  );

  const pre_cols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_account'
      AND column_name IN ('onboarding_step','shop_theme_id','vault_trial_used_at')
    ORDER BY column_name
  `);
  console.log(`PRE   target columns present: ${pre_cols.rows.length}/3`);

  if (DRY_RUN) {
    console.log("");
    console.log("DRY-RUN: SQL that WOULD apply inside one BEGIN/COMMIT (not executed):");
    console.log("─".repeat(60));
    console.log(sql);
    console.log("─".repeat(60));
    console.log("LEDGER insert that WOULD run after the SQL (same transaction):");
    console.log(
      `  INSERT INTO nex_migration_history (version, applied_at, description, notes)\n` +
        `  VALUES ('207', NOW(), 'nex_onboarding_and_vault_trial · 3 columns', 'scratch rehearsal applied')`,
    );
    console.log("DRY-RUN complete · no changes made.");
  } else {
    await client.query("BEGIN");
    transactionActive = true;

    await client.query(sql);

    await client.query(
      `INSERT INTO nex_migration_history (version, applied_at, description, notes)
       VALUES ($1, NOW(), $2, $3)
       ON CONFLICT DO NOTHING`,
      [
        MIGRATION_VERSION,
        "nex_onboarding_and_vault_trial · 3 columns",
        "SCRATCH rehearsal applied (not a canonical apply · see nex_rehearsal_257 database)",
      ],
    );

    await client.query("COMMIT");
    transactionActive = false;
    console.log("APPLIED migration 207 + ledger in one transaction (scratch DB)");

    const post_cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_account'
        AND column_name IN ('onboarding_step','shop_theme_id','vault_trial_used_at')
      ORDER BY column_name
    `);
    console.log(`POST  target columns present: ${post_cols.rows.length}/3`);
    for (const r of post_cols.rows) {
      console.log(
        `      · ${r.column_name} · ${r.data_type} · nullable=${r.is_nullable} · default=${r.column_default ?? "NULL"}`,
      );
    }
  }
} catch (e) {
  if (transactionActive) {
    try {
      await client.query("ROLLBACK");
      console.error("ROLLED BACK scratch migration 207 transaction");
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
