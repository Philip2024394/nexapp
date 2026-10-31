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

// --------------------------------------------------------------------------
// Script-owned sidecar ledger · keyed by FULL filename
// --------------------------------------------------------------------------
// Why not reuse nex_migration_history?
//   nex_migration_history uses 'version' TEXT PK, and the sealed migration
//   SQL files write their OWN hardcoded short version strings (e.g. '187',
//   '224'). The 4 duplicate-prefix files (two with '187', two with '224')
//   cannot be distinguished by that ledger. Also 0/236 migrations use
//   ON CONFLICT on their ledger INSERT, so re-running one twice would
//   PK-violate.
//
// Solution: a separate script-owned sidecar table keyed by the full
// filename. The script reads this to decide skip-already-applied. The
// sealed migration SQL files continue writing to nex_migration_history
// unchanged. The two ledgers coexist.
//
// This table lives in schema `public` on the sandbox only. It is NEVER
// created on production (production never runs this script).
await client.query(`
  CREATE TABLE IF NOT EXISTS public.nex_sandbox_apply_ledger (
    filename    text PRIMARY KEY,
    applied_at  timestamptz NOT NULL DEFAULT now()
  );
`);
process.stdout.write("[sandbox apply-schema] Sidecar ledger ready: public.nex_sandbox_apply_ledger\n\n");

// Multi-pass apply · handles FK/dep ordering mismatches between sealed
// migrations. We keep looping until a full pass produces zero new
// successes. Each failure is captured and retried on the next pass.
// If an entire pass applies nothing, we stop and report remaining
// failures with their last error.
let applied = 0;
let skipped = 0;
const failures = new Map(); // filename -> last error message

async function getRemaining() {
  const remaining = [];
  for (const file of files) {
    const filenameKey = file.replace(/\.sql$/i, "");
    const r = await client.query(
      "SELECT 1 FROM public.nex_sandbox_apply_ledger WHERE filename = $1 LIMIT 1",
      [filenameKey],
    );
    if (r.rowCount === 0) remaining.push(file);
    else skipped++;
  }
  return remaining;
}

let remaining = await getRemaining();
// skipped was accumulated for every pre-existing row — but across passes
// we'd double-count. Snapshot it to the first-pass value only.
const skippedSnapshot = skipped;

let pass = 0;
while (true) {
  pass++;
  if (!remaining.length) break;
  process.stdout.write(`\n[sandbox apply-schema] Pass ${pass} · ${remaining.length} remaining\n`);
  let appliedThisPass = 0;
  const nextRemaining = [];
  for (const file of remaining) {
    const filenameKey = file.replace(/\.sql$/i, "");
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    process.stdout.write(`  APPLY ${file} ... `);
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO public.nex_sandbox_apply_ledger (filename) VALUES ($1) ON CONFLICT DO NOTHING",
        [filenameKey],
      );
      process.stdout.write("ok\n");
      applied++;
      appliedThisPass++;
      failures.delete(file);
    } catch (err) {
      process.stdout.write(`defer (${err.message.split("\n")[0].slice(0, 80)})\n`);
      failures.set(file, err.message);
      nextRemaining.push(file);
      // Transaction may be aborted · issue a ROLLBACK to clear state
      try { await client.query("ROLLBACK"); } catch { /* no active tx */ }
    }
  }
  remaining = nextRemaining;
  if (appliedThisPass === 0) break; // no progress · give up
}
const failed = remaining.length;

await client.end();
process.stdout.write(
  `\n[sandbox apply-schema] Done · applied=${applied} skipped=${skippedSnapshot} failed=${failed} passes=${pass}\n`,
);
if (failed > 0) {
  process.stdout.write(`\n[sandbox apply-schema] Permanently failed migrations:\n`);
  for (const [file, msg] of failures.entries()) {
    process.stdout.write(`  - ${file}: ${msg.split("\n")[0]}\n`);
  }
}
process.exit(failed > 0 ? 1 : 0);
