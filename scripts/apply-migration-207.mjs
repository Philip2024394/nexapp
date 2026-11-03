#!/usr/bin/env node
// scripts/apply-migration-207.mjs
//
// Guarded applier for Migration 207 (onboarding + vault trial).
// Pattern mirrors apply-migration-224.mjs with four safety extensions:
//   1. URL parse + hostname-exact validation (not just .includes())
//   2. Explicit BEGIN/COMMIT around migration SQL AND ledger insert
//      (migration 207's own SQL has no transaction block)
//   3. ROLLBACK before any process.exit · never exits inside active txn
//   4. --dry-run mode · reads SQL + prints pre-state · does NOT execute
//
// Owner-authorised 2026-11-02 as LOCAL FILE ONLY. Does not execute
// against any remote database without owner-side approval.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const CANONICAL_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const MIGRATION_FILE = "nex-supabase/migrations/207_nex_onboarding_and_vault_trial.sql";
const MIGRATION_VERSION = "207";
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

// Parse the URL (never log the password portion). Supabase connection
// strings come in two shapes:
//   · pooler  · hostname=aws-0-<region>.pooler.supabase.com · username=postgres.<ref>
//   · direct  · hostname=db.<ref>.supabase.co · username=postgres
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
  `MODE:              ${DRY_RUN ? "DRY-RUN · reads SQL + pre-state · does NOT execute" : "APPLY · will execute in a single transaction"}`,
);
console.log(`PROJECT:           ${CANONICAL_PROJECT_REF} (hostname-verified)`);

// ─── Connect + run ─────────────────────────────────────────────────────

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED");

let exitCode = 0;
let transactionActive = false;

try {
  // Pre-state (aggregate only · no PII)
  const pre_207 = await client.query(
    "SELECT COUNT(*)::int AS c FROM nex_migration_history WHERE version = $1",
    [MIGRATION_VERSION],
  );
  console.log(
    `PRE   migration ${MIGRATION_VERSION} recorded? ${pre_207.rows[0].c > 0 ? "YES (will no-op · columns and ledger idempotent)" : "NO"}`,
  );

  const pre_cols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_account'
      AND column_name IN ('onboarding_step','shop_theme_id','vault_trial_used_at')
    ORDER BY column_name
  `);
  console.log(
    `PRE   target columns present: ${pre_cols.rows.length}/3 → ${
      pre_cols.rows.map((r) => r.column_name).join(", ") || "(none)"
    }`,
  );

  const pre_total = await client.query("SELECT COUNT(*)::int AS c FROM nex_account");
  console.log(`PRE   nex_account total rows: ${pre_total.rows[0].c}`);

  if (DRY_RUN) {
    console.log("");
    console.log("DRY-RUN: SQL that WOULD apply inside one BEGIN/COMMIT (not executed):");
    console.log("─".repeat(60));
    console.log(sql);
    console.log("─".repeat(60));
    console.log("LEDGER insert that WOULD run after the SQL (same transaction):");
    console.log(
      `  INSERT INTO nex_migration_history (version, applied_at, description, notes)\n` +
        `  VALUES ('207', NOW(), 'nex_onboarding_and_vault_trial · 3 columns', 'Owner-authorised 2026-11-02 · prerequisite for migration 257')`,
    );
    console.log("DRY-RUN complete · no changes made.");
  } else {
    // Apply · atomic: migration SQL AND ledger insert in one transaction.
    // Migration 207's own SQL does NOT contain BEGIN/COMMIT (just ALTER
    // TABLE ADD COLUMN IF NOT EXISTS statements). The runner wraps the
    // SQL + ledger insert in one explicit transaction so a ledger-insert
    // failure rolls back the column additions.
    await client.query("BEGIN");
    transactionActive = true;

    await client.query(sql);

    await client.query(
      `INSERT INTO nex_migration_history (version, applied_at, description, notes)
       VALUES ($1, NOW(), $2, $3)
       ON CONFLICT DO NOTHING`,
      [
        MIGRATION_VERSION,
        "nex_onboarding_and_vault_trial · 3 columns (onboarding_step, shop_theme_id, vault_trial_used_at)",
        "Owner-authorised 2026-11-02 · prerequisite for migration 257",
      ],
    );

    await client.query("COMMIT");
    transactionActive = false;
    console.log("APPLIED migration 207 + ledger in one transaction");

    // Post-state
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

    const post_hist = await client.query(
      "SELECT version, applied_at FROM nex_migration_history WHERE version = $1",
      [MIGRATION_VERSION],
    );
    console.log(
      `POST  ledger: ${post_hist.rowCount > 0 ? `version=${post_hist.rows[0].version} applied_at=${post_hist.rows[0].applied_at}` : "MISSING"}`,
    );
  }
} catch (e) {
  // Attempt to roll back if we were mid-transaction before raising the error
  // to the user. Do NOT process.exit while the transaction is still open.
  if (transactionActive) {
    try {
      await client.query("ROLLBACK");
      console.error("ROLLED BACK migration 207 transaction (ledger insert or SQL failed)");
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
    /* connection cleanup failure is non-fatal here */
  }
}

console.log(exitCode === 0 ? "DONE" : "DONE (with failure)");
process.exit(exitCode);
