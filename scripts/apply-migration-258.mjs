#!/usr/bin/env node
// scripts/apply-migration-258.mjs
//
// Owner-authorised 2026-11-05 iter 29 path (a) · one-shot applier for
// Migration 258 (billing foundation) against Supabase
// ijvqdvsvwtwxzcqmoqit. Prerequisites: 046, 207, 224, 257.
//
// Pattern mirrors apply-migration-207.mjs with the same four safety
// extensions · 258 owns its own BEGIN/COMMIT + ledger insert so the
// runner just executes + verifies.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const CANONICAL_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const MIGRATION_FILE = "nex-supabase/migrations/258_nex_billing_foundation.sql";
const MIGRATION_VERSION = "258";
const PREREQUISITES = ["046", "207", "224", "257"];
const DRY_RUN = process.argv.includes("--dry-run");

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
  process.exit(3);
}

const sql = readFileSync(resolve(MIGRATION_FILE), "utf8");

console.log(`MIGRATION file:    ${MIGRATION_FILE}`);
console.log(`MIGRATION version: ${MIGRATION_VERSION}`);
console.log(
  `MODE:              ${DRY_RUN ? "DRY-RUN · reads SQL + pre-state · does NOT execute" : "APPLY · will execute (migration owns its transaction)"}`,
);
console.log(`PROJECT:           ${CANONICAL_PROJECT_REF} (hostname-verified)`);

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED");

let exitCode = 0;

try {
  // Prereq verification
  const prereqs = await client.query(
    `SELECT version FROM nex_migration_history WHERE version = ANY($1) ORDER BY version`,
    [PREREQUISITES],
  );
  const found = new Set(prereqs.rows.map((r) => r.version));
  const missing = PREREQUISITES.filter((v) => !found.has(v));
  if (missing.length > 0) {
    console.error(`FATAL: missing prerequisite migrations: ${missing.join(", ")}`);
    process.exit(4);
  }
  console.log(`PRE   prerequisites verified: ${PREREQUISITES.join(", ")}`);

  const pre_258 = await client.query(
    "SELECT COUNT(*)::int AS c FROM nex_migration_history WHERE version = $1",
    [MIGRATION_VERSION],
  );
  console.log(
    `PRE   migration ${MIGRATION_VERSION} recorded? ${pre_258.rows[0].c > 0 ? "YES" : "NO"}`,
  );
  if (pre_258.rows[0].c > 0) {
    console.log("ALREADY APPLIED · no-op · verifying post-state");
  }

  if (DRY_RUN) {
    console.log("");
    console.log("DRY-RUN: SQL body (truncated preview):");
    console.log("─".repeat(60));
    console.log(sql.slice(0, 400) + (sql.length > 400 ? "\n…[truncated]…" : ""));
    console.log("─".repeat(60));
    console.log("DRY-RUN complete · no changes made.");
  } else if (pre_258.rows[0].c === 0) {
    // 258 owns its own BEGIN/COMMIT + ledger write · runner just executes.
    await client.query(sql);
    console.log("APPLIED migration 258 (migration owns its transaction + ledger)");
  }

  // Post-state verification
  const post_tables = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'nex_billing_customer',
          'nex_billing_subscription',
          'nex_billing_event',
          'nex_billing_adverse_event',
          'nex_billing_verified_mapping'
        )
      ORDER BY table_name`,
  );
  console.log(`POST  billing tables present: ${post_tables.rows.length}/5`);
  for (const r of post_tables.rows) console.log(`      · ${r.table_name}`);

  const post_hist = await client.query(
    "SELECT applied_at FROM nex_migration_history WHERE version = $1",
    [MIGRATION_VERSION],
  );
  console.log(
    `POST  ledger: ${post_hist.rowCount > 0 ? `applied_at=${post_hist.rows[0].applied_at}` : "MISSING"}`,
  );
} catch (e) {
  console.error(`FAIL: ${e.message}`);
  exitCode = 1;
} finally {
  try { await client.end(); } catch { /* ignore */ }
}

console.log(exitCode === 0 ? "DONE" : "DONE (with failure)");
process.exit(exitCode);
