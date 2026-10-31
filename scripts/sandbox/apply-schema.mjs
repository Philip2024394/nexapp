#!/usr/bin/env node
// scripts/sandbox/apply-schema.mjs
//
// Owner-authorised 2026-10-31 (round 11 · sandbox prep).
// Applies NEX schema migrations 001-242 to the SANDBOX Supabase project.
// Strictly excludes:
//   - 243 SUPERSEDED
//   - 244, 245 SUPERSEDED
//   - 244, 245, 246, 247, 248, 249, 251 (country-isolation drafts; owner-gated)
//   - 999 WIP
//   - *.rollback.sql companion files
//
// Rule: refuses to run against the production Supabase project
// `ijvqdvsvwtwxzcqmoqit`. Requires the env var SANDBOX_DATABASE_URL (not
// NEX_POSTGRES_URL or DATABASE_URL) so an operator cannot accidentally
// aim it at production.
//
// Idempotency:
//   - Each migration starts with `BEGIN;` and uses `IF NOT EXISTS`
//     where available. The nex_migration_history ledger uses
//     `ON CONFLICT (version) DO NOTHING`.
//   - Re-running against a partially-applied sandbox is safe: already-
//     applied rows are skipped.
//
// Usage:
//   SANDBOX_DATABASE_URL="postgresql://..." node scripts/sandbox/apply-schema.mjs
//   SANDBOX_DATABASE_URL="postgresql://..." node scripts/sandbox/apply-schema.mjs --dry-run

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PRODUCTION_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";
const EXCLUDE_PATTERNS = [
  /SUPERSEDED/,
  /\.rollback\.sql$/,
  /^999_WIP_/,
  /^244_nex_country_column\.sql$/,
  /^245_nex_country_rls\.sql$/,
  /^246_nex_country_backfill\.sql$/,
  /^247_nex_visibility_column\.sql$/,
  /^248_nex_storage_country_prefix\.sql$/,
  /^249_nex_moderation_status\.sql$/,
  /^251_nex_age_gate\.sql$/,
];

const DRY_RUN = process.argv.includes("--dry-run");

function dieWith(msg, code = 1) {
  process.stderr.write(`\n[sandbox apply-schema] ${msg}\n\n`);
  process.exit(code);
}

const dbUrl = process.env.SANDBOX_DATABASE_URL;
if (!dbUrl) {
  dieWith("SANDBOX_DATABASE_URL is not set. This script will NOT read NEX_POSTGRES_URL or DATABASE_URL to avoid accidental production targeting. Set SANDBOX_DATABASE_URL explicitly.");
}

if (dbUrl.includes(PRODUCTION_PROJECT_ID)) {
  dieWith(`SANDBOX_DATABASE_URL contains the production project ID '${PRODUCTION_PROJECT_ID}'. Refusing to run against production. Point SANDBOX_DATABASE_URL at a sandbox project only.`);
}

const MIGRATIONS_DIR = "nex-supabase/migrations";
let files;
try {
  files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .filter((f) => !EXCLUDE_PATTERNS.some((rx) => rx.test(f)))
    .sort(); // lexicographic == version order because all 3-digit prefix
} catch (err) {
  dieWith(`Cannot read migrations directory ${MIGRATIONS_DIR}: ${err.message}`);
}

process.stdout.write(`[sandbox apply-schema] ${files.length} migrations to apply\n`);
process.stdout.write(`[sandbox apply-schema] First: ${files[0]}\n`);
process.stdout.write(`[sandbox apply-schema] Last:  ${files[files.length - 1]}\n`);
process.stdout.write(`[sandbox apply-schema] Target: ${dbUrl.replace(/:[^:@]*@/, ":<REDACTED>@")}\n`);
process.stdout.write(`[sandbox apply-schema] DRY RUN: ${DRY_RUN}\n\n`);

if (DRY_RUN) {
  process.stdout.write("[sandbox apply-schema] --dry-run specified · would apply:\n");
  for (const f of files) process.stdout.write(`  - ${f}\n`);
  process.exit(0);
}

// Lazy-import pg to avoid requiring it when just dry-running or inspecting.
const pgMod = await import("pg").catch(() => null);
if (!pgMod) {
  dieWith("pg module not installed. Run `npm install pg` first.");
}
const { Client } = pgMod.default ?? pgMod;

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
process.stdout.write("[sandbox apply-schema] Connected.\n\n");

let applied = 0;
let skipped = 0;
let failed = 0;
for (const file of files) {
  const version = file.slice(0, 3);
  // Check ledger first (idempotency); nex_migration_history exists from 001.
  let alreadyApplied = false;
  try {
    const r = await client.query(
      "SELECT 1 FROM nex_migration_history WHERE version = $1 LIMIT 1",
      [version],
    );
    alreadyApplied = r.rowCount > 0;
  } catch {
    // Ledger doesn't exist yet (true on first run of 001). Proceed.
  }
  if (alreadyApplied) {
    process.stdout.write(`  SKIP ${file} (version ${version} already in ledger)\n`);
    skipped++;
    continue;
  }
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  process.stdout.write(`  APPLY ${file} ... `);
  try {
    await client.query(sql);
    process.stdout.write("ok\n");
    applied++;
  } catch (err) {
    process.stdout.write(`FAILED\n`);
    process.stderr.write(`\n[sandbox apply-schema] FAILED on ${file}:\n${err.message}\n\n`);
    failed++;
    break;
  }
}

await client.end();
process.stdout.write(
  `\n[sandbox apply-schema] Done · applied=${applied} skipped=${skipped} failed=${failed}\n`,
);
process.exit(failed > 0 ? 1 : 0);
