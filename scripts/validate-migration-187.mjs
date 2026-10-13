#!/usr/bin/env node
// scripts/validate-migration-187.mjs
//
// Validation harness for `nex-supabase/migrations/187_nex_world_country_us_au_seed.sql`.
// -------------------------------------------------------------------------------------
// Proves migration 187 can be applied, rolled back, and re-applied
// without damaging pre-existing country records, on a DISPOSABLE
// Postgres running in a Docker container on localhost. This script
// never contacts Supabase, pooler, RDS, or any URL that is not
// localhost · it hard-rejects such URLs on multiple layers.
//
// Usage:
//   node scripts/validate-migration-187.mjs
//
// Requirements:
//   · docker CLI available on PATH (Docker Desktop / docker.io / podman alias)
//   · npm "pg" package installed (already present in nexapp)
//   · migration file at nex-supabase/migrations/187_nex_world_country_us_au_seed.sql
//
// Exit code: 0 on all-pass · 1 on any assertion failure or infra error.

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const MIGRATION_PATH = join(
  REPO_ROOT,
  "nex-supabase",
  "migrations",
  "187_nex_world_country_us_au_seed.sql",
);

// ─── Hard production protection (defence-in-depth) ──────────────────
//
// A dumb mistake like "oh I'll just quickly test against the staging
// pooler" is the ONE thing this harness must refuse. Every layer
// below asserts localhost only; if any check breaks the script exits
// before touching Postgres.

const FORBIDDEN_URL_SUBSTRINGS = [
  "supabase.co",
  "supabase.com",
  "pooler.supabase",
  "amazonaws.com",
  "rds.amazonaws.com",
  "neon.tech",
  "crunchybridge.com",
  "render.com",
  "railway.app",
  "fly.io",
  "digitalocean.com",
];

function assertSafeUrl(url) {
  const low = (url ?? "").toString().toLowerCase();
  for (const bad of FORBIDDEN_URL_SUBSTRINGS) {
    if (low.includes(bad)) {
      throw new Error(
        `REFUSED · URL contains production-adjacent marker '${bad}': ${url}`,
      );
    }
  }
  if (!/^(?:postgres(?:ql)?:\/\/)?[^/]*(?:localhost|127\.0\.0\.1)(?::\d+)?/.test(
    low,
  )) {
    throw new Error(
      `REFUSED · URL must contain localhost or 127.0.0.1 host: ${url}`,
    );
  }
}

// Scrub ambient env vars that could point at production.
for (const k of [
  "NEX_POSTGRES_URL",
  "NEX_SUPABASE_URL",
  "NEXT_PUBLIC_NEX_SUPABASE_URL",
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  delete process.env[k];
}

// ─── Container / Postgres parameters ────────────────────────────────

const CONTAINER_NAME = `nex-mig187-validator-${Date.now()}`;
const PG_PORT = 54000 + Math.floor(Math.random() * 1000);
const PG_PASSWORD = `throwaway-${Math.random().toString(36).slice(2)}`;
const PG_URL = `postgres://postgres:${PG_PASSWORD}@localhost:${PG_PORT}/postgres`;
const PG_IMAGE = "postgres:16-alpine";

assertSafeUrl(PG_URL);

// ─── Fixture schema (minimum shape migration 187 touches) ───────────
//
// Column shapes mirror the real nex.* tables as inspected on the
// live Supabase project (2026-10-13). Only what the migration
// actually reads/writes is included · the harness is NOT a general
// nex-schema mirror.

const FIXTURE_SCHEMA_SQL = `
  CREATE SCHEMA IF NOT EXISTS nex;

  CREATE TABLE IF NOT EXISTS nex.world_country (
    iso_alpha_2    char(2) PRIMARY KEY,
    iso_alpha_3    char(3),
    numeric_code   text,
    name           text NOT NULL,
    official_name  text,
    region         text NOT NULL,
    subregion      text,
    un_member      boolean NOT NULL DEFAULT false,
    sovereign      boolean NOT NULL DEFAULT true,
    currency       text,
    languages      text[],
    metadata       jsonb NOT NULL DEFAULT '{}',
    active_in_nex  boolean NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS nex.discovery_programme (
    programme_id    uuid PRIMARY KEY,
    slug            text UNIQUE,
    display_name    text,
    topic           text,
    description     text,
    status          text,
    cadence_seconds int,
    policy_json     jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS nex.discovery_programme_country (
    programme_id   uuid NOT NULL REFERENCES nex.discovery_programme(programme_id),
    iso_alpha_2    char(2) NOT NULL REFERENCES nex.world_country(iso_alpha_2),
    included       boolean NOT NULL DEFAULT true,
    priority       int NOT NULL DEFAULT 100,
    policy_json    jsonb NOT NULL DEFAULT '{}',
    PRIMARY KEY (programme_id, iso_alpha_2)
  );

  CREATE TABLE IF NOT EXISTS nex_migration_history (
    version      text PRIMARY KEY,
    applied_at   timestamptz NOT NULL DEFAULT now(),
    description  text,
    notes        text
  );
`;

// ─── Pre-existing data (fixture used by every scenario) ─────────────

const SEED_PROGRAMME_SQL = `
  INSERT INTO nex.discovery_programme
    (programme_id, slug, display_name, status, cadence_seconds, policy_json)
  VALUES
    ('00000000-0000-4000-8000-000000000001',
     'scaffolding',
     'Scaffolding programme',
     'active',
     300,
     jsonb_build_object('seeded_by', 'validate-migration-187-harness'));
`;

const SEED_GB_DE_SQL = `
  INSERT INTO nex.world_country (iso_alpha_2, iso_alpha_3, name, region, metadata)
  VALUES
    ('GB', 'GBR', 'United Kingdom', 'Europe',
     jsonb_build_object('source', 'pre-existing-seed')),
    ('DE', 'DEU', 'Germany', 'Europe',
     jsonb_build_object('source', 'pre-existing-seed'));

  INSERT INTO nex.discovery_programme_country
    (programme_id, iso_alpha_2, included, priority, policy_json)
  VALUES
    ('00000000-0000-4000-8000-000000000001', 'GB', true, 100,
     jsonb_build_object('source', 'pre-existing-seed')),
    ('00000000-0000-4000-8000-000000000001', 'DE', true, 100,
     jsonb_build_object('source', 'pre-existing-seed'));
`;

const SEED_MANUAL_US_SQL = `
  INSERT INTO nex.world_country (iso_alpha_2, iso_alpha_3, name, region, metadata)
  VALUES
    ('US', 'USA', 'United States (manual pre-187)', 'Americas',
     jsonb_build_object('source', 'manual-pre-187'));

  INSERT INTO nex.discovery_programme_country
    (programme_id, iso_alpha_2, included, priority, policy_json)
  VALUES
    ('00000000-0000-4000-8000-000000000001', 'US', true, 100,
     jsonb_build_object('source', 'manual-pre-187'));
`;

// ─── Rollback SQL (lifted verbatim from file header 2026-10-13) ─────
// Keep this in sync with the file's rollback comment block. The
// harness exercises exactly this SQL · if the migration's hardened
// rollback is updated, update this constant and re-run.

const ROLLBACK_SQL = `
  BEGIN;
    DELETE FROM nex.discovery_programme_country
     WHERE programme_id = '00000000-0000-4000-8000-000000000001'
       AND iso_alpha_2 IN ('US', 'AU')
       AND policy_json->>'added_by_migration' = '187';

    DELETE FROM nex.world_country
     WHERE iso_alpha_2 IN ('US', 'AU')
       AND metadata->>'added_by_migration' = '187';

    DELETE FROM nex_migration_history WHERE version = '187';
  COMMIT;
`;

// ─── Reset helper used between scenarios ────────────────────────────

const RESET_SQL = `
  DROP SCHEMA IF EXISTS nex CASCADE;
  DROP TABLE IF EXISTS nex_migration_history;
`;

// ─── Assertion framework ────────────────────────────────────────────

const results = [];

function check(name, ok, details = "") {
  results.push({ name, ok, details });
  const tag = ok ? "\x1b[32m[PASS]\x1b[0m" : "\x1b[31m[FAIL]\x1b[0m";
  const d = details ? ` · ${details}` : "";
  console.log(`${tag} ${name}${d}`);
}

// ─── Docker lifecycle ───────────────────────────────────────────────

function docker(args, opts = {}) {
  const r = spawnSync("docker", args, {
    encoding: "utf8",
    stdio: opts.inherit ? "inherit" : "pipe",
  });
  if (r.error && r.error.code === "ENOENT") {
    throw new Error(
      "docker CLI not found on PATH. Install Docker Desktop (or podman + 'docker' alias) and re-run.",
    );
  }
  return r;
}

async function startPostgres() {
  console.log(
    `\nStarting ephemeral Postgres · image=${PG_IMAGE} · port=${PG_PORT} · container=${CONTAINER_NAME}`,
  );
  const r = docker([
    "run",
    "-d",
    "--rm",
    "--name",
    CONTAINER_NAME,
    "-e",
    `POSTGRES_PASSWORD=${PG_PASSWORD}`,
    "-e",
    "POSTGRES_DB=postgres",
    "-p",
    `${PG_PORT}:5432`,
    PG_IMAGE,
  ]);
  if (r.status !== 0) {
    throw new Error(`docker run failed · stderr: ${r.stderr}`);
  }
  await waitForPostgresReady();
}

async function stopPostgres() {
  console.log(`\nStopping container ${CONTAINER_NAME}`);
  docker(["stop", CONTAINER_NAME]);
}

async function waitForPostgresReady() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const client = new Client({ connectionString: PG_URL });
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      console.log("Postgres is ready.");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("Postgres did not become ready in 60s");
}

// ─── SQL runner · single-connection, logs on error ──────────────────

async function withClient(fn) {
  const client = new Client({ connectionString: PG_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function runSqlBatch(label, sql) {
  await withClient(async (client) => {
    try {
      await client.query(sql);
    } catch (e) {
      console.error(`\n[ERROR] during ${label}:\n${e.message}\n--- SQL ---\n${sql}\n`);
      throw e;
    }
  });
}

async function query(sql, params = []) {
  return withClient(async (client) => {
    const r = await client.query(sql, params);
    return r.rows;
  });
}

async function count(sql, params = []) {
  const rows = await query(sql, params);
  return Number(rows[0]?.n ?? rows[0]?.count ?? 0);
}

// ─── Scenario runners ───────────────────────────────────────────────

async function resetAndSeedCommon() {
  await runSqlBatch("reset", RESET_SQL);
  await runSqlBatch("fixture-schema", FIXTURE_SCHEMA_SQL);
  await runSqlBatch("seed-programme", SEED_PROGRAMME_SQL);
  await runSqlBatch("seed-GB-DE", SEED_GB_DE_SQL);
}

async function applyMigration() {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  await runSqlBatch("apply-migration-187", sql);
}

async function runRollback() {
  await runSqlBatch("rollback-migration-187", ROLLBACK_SQL);
}

// ─── Assertions ─────────────────────────────────────────────────────

async function assertPostApplyCleanScenario(scenarioLabel) {
  const prefix = `[${scenarioLabel}] after apply`;

  const usRows = await query(
    `SELECT iso_alpha_2, metadata, name FROM nex.world_country WHERE iso_alpha_2 = 'US'`,
  );
  check(
    `${prefix} · US row exists`,
    usRows.length === 1,
    usRows.length === 1 ? `name='${usRows[0].name}'` : `rows=${usRows.length}`,
  );
  check(
    `${prefix} · US metadata.added_by_migration = 187`,
    usRows[0]?.metadata?.added_by_migration === 187,
    `metadata=${JSON.stringify(usRows[0]?.metadata).slice(0, 80)}…`,
  );

  const auRows = await query(
    `SELECT iso_alpha_2, metadata, name FROM nex.world_country WHERE iso_alpha_2 = 'AU'`,
  );
  check(`${prefix} · AU row exists`, auRows.length === 1);
  check(
    `${prefix} · AU metadata.added_by_migration = 187`,
    auRows[0]?.metadata?.added_by_migration === 187,
  );

  const gbRows = await query(
    `SELECT iso_alpha_2, metadata FROM nex.world_country WHERE iso_alpha_2 = 'GB'`,
  );
  check(
    `${prefix} · GB row untouched (pre-existing-seed source preserved)`,
    gbRows[0]?.metadata?.source === "pre-existing-seed",
  );

  const deRows = await query(
    `SELECT iso_alpha_2, metadata FROM nex.world_country WHERE iso_alpha_2 = 'DE'`,
  );
  check(
    `${prefix} · DE row untouched (pre-existing-seed source preserved)`,
    deRows[0]?.metadata?.source === "pre-existing-seed",
  );

  const dpc = await query(
    `SELECT iso_alpha_2, policy_json
       FROM nex.discovery_programme_country
      WHERE iso_alpha_2 IN ('US', 'AU')
      ORDER BY iso_alpha_2`,
  );
  check(`${prefix} · US + AU opt-ins exist`, dpc.length === 2);
  check(
    `${prefix} · US opt-in policy_json.added_by_migration = 187`,
    dpc.find((r) => r.iso_alpha_2 === "US")?.policy_json?.added_by_migration ===
      187,
  );
  check(
    `${prefix} · AU opt-in policy_json.added_by_migration = 187`,
    dpc.find((r) => r.iso_alpha_2 === "AU")?.policy_json?.added_by_migration ===
      187,
  );

  const mh = await query(
    `SELECT version FROM nex_migration_history WHERE version = '187'`,
  );
  check(`${prefix} · nex_migration_history has version=187`, mh.length === 1);
}

async function assertPostRollbackCleanScenario(scenarioLabel) {
  const prefix = `[${scenarioLabel}] after rollback`;

  const n = await count(
    `SELECT COUNT(*)::text AS n FROM nex.world_country WHERE iso_alpha_2 IN ('US','AU') AND metadata->>'added_by_migration' = '187'`,
  );
  check(`${prefix} · migration-added US/AU rows removed`, n === 0);

  const nAll = await count(
    `SELECT COUNT(*)::text AS n FROM nex.world_country WHERE iso_alpha_2 IN ('US','AU')`,
  );
  // In the clean scenario there is no pre-existing US/AU · so this should also be 0.
  // In the manual-US scenario · the pre-existing US row has no 187 marker · it must survive.
  // The caller passes `expectedSurviving` to differentiate.
  // Here we just report the raw count · scenario-specific checks happen below.
  console.log(`[${scenarioLabel}] raw US+AU count after rollback = ${nAll}`);

  const gb = await query(
    `SELECT metadata FROM nex.world_country WHERE iso_alpha_2 = 'GB'`,
  );
  check(
    `${prefix} · GB still untouched`,
    gb[0]?.metadata?.source === "pre-existing-seed",
  );

  const de = await query(
    `SELECT metadata FROM nex.world_country WHERE iso_alpha_2 = 'DE'`,
  );
  check(
    `${prefix} · DE still untouched`,
    de[0]?.metadata?.source === "pre-existing-seed",
  );

  const mh = await query(
    `SELECT version FROM nex_migration_history WHERE version = '187'`,
  );
  check(
    `${prefix} · nex_migration_history row for 187 removed`,
    mh.length === 0,
  );
}

async function assertPostRollbackPreservesManualUS() {
  const prefix = `[manual-US scenario] after rollback`;

  const us = await query(
    `SELECT iso_alpha_2, metadata, name FROM nex.world_country WHERE iso_alpha_2 = 'US'`,
  );
  check(
    `${prefix} · manual US row STILL present (no 187 marker · scoped rollback left it alone)`,
    us.length === 1 && us[0]?.metadata?.source === "manual-pre-187",
    us[0]?.name,
  );

  const au = await count(
    `SELECT COUNT(*)::text AS n FROM nex.world_country WHERE iso_alpha_2 = 'AU'`,
  );
  check(`${prefix} · AU row removed by rollback`, au === 0);

  const usOpt = await query(
    `SELECT policy_json FROM nex.discovery_programme_country WHERE iso_alpha_2 = 'US'`,
  );
  check(
    `${prefix} · manual US opt-in STILL present`,
    usOpt.length === 1 && usOpt[0]?.policy_json?.source === "manual-pre-187",
  );

  const auOpt = await count(
    `SELECT COUNT(*)::text AS n FROM nex.discovery_programme_country WHERE iso_alpha_2 = 'AU'`,
  );
  check(`${prefix} · AU opt-in removed by rollback`, auOpt === 0);
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(MIGRATION_PATH)) {
    throw new Error(`Migration not found at: ${MIGRATION_PATH}`);
  }
  console.log(`Validation harness · migration file:\n  ${MIGRATION_PATH}`);
  console.log(`Postgres URL (localhost-only, validated):\n  ${PG_URL}`);

  await startPostgres();

  try {
    // ─── Scenario 1 · CLEAN · no pre-existing US/AU ───
    console.log("\n═══ Scenario 1 · CLEAN ═══");
    await resetAndSeedCommon();
    await applyMigration();
    await assertPostApplyCleanScenario("clean");
    await runRollback();
    await assertPostRollbackCleanScenario("clean");
    const cleanUsAu = await count(
      `SELECT COUNT(*)::text AS n FROM nex.world_country WHERE iso_alpha_2 IN ('US','AU')`,
    );
    check(
      "[clean] US and AU fully removed (no pre-existing rows)",
      cleanUsAu === 0,
    );

    // ─── Scenario 2 · MANUAL US pre-exists ───
    console.log(
      "\n═══ Scenario 2 · MANUAL US pre-exists (no 187 marker) ═══",
    );
    await resetAndSeedCommon();
    await runSqlBatch("seed-manual-US", SEED_MANUAL_US_SQL);
    await applyMigration();

    const usAfterApply = await query(
      `SELECT metadata, name FROM nex.world_country WHERE iso_alpha_2 = 'US'`,
    );
    check(
      "[manual-US scenario] after apply · US row NOT replaced (ON CONFLICT DO NOTHING honoured)",
      usAfterApply[0]?.metadata?.source === "manual-pre-187",
      usAfterApply[0]?.name,
    );
    const auAfterApply = await query(
      `SELECT metadata FROM nex.world_country WHERE iso_alpha_2 = 'AU'`,
    );
    check(
      "[manual-US scenario] after apply · AU row DID get inserted with 187 marker",
      auAfterApply[0]?.metadata?.added_by_migration === 187,
    );

    await runRollback();
    await assertPostRollbackPreservesManualUS();

    // ─── Scenario 3 · IDEMPOTENCY · apply twice ───
    console.log("\n═══ Scenario 3 · IDEMPOTENCY · apply + apply ═══");
    await resetAndSeedCommon();
    await applyMigration();
    const countAfterFirst = await count(
      `SELECT COUNT(*)::text AS n FROM nex.world_country`,
    );
    await applyMigration();
    const countAfterSecond = await count(
      `SELECT COUNT(*)::text AS n FROM nex.world_country`,
    );
    check(
      "[idempotency] second apply does not duplicate rows",
      countAfterFirst === countAfterSecond,
      `first=${countAfterFirst} · second=${countAfterSecond}`,
    );
    await assertPostApplyCleanScenario("idempotency-second");

    // ─── Scenario 4 · ROUND-TRIP · apply → rollback → apply ───
    console.log(
      "\n═══ Scenario 4 · ROUND-TRIP · apply → rollback → apply ═══",
    );
    await resetAndSeedCommon();
    await applyMigration();
    await runRollback();
    await applyMigration();
    await assertPostApplyCleanScenario("round-trip-reapply");
  } finally {
    await stopPostgres().catch(() => undefined);
  }

  // ─── Summary ───
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n═══ SUMMARY ═══`);
  console.log(`${passed} passed · ${failed} failed · ${results.length} total`);
  if (failed > 0) {
    console.log(`\nFailed assertions:`);
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  · ${r.name}${r.details ? " · " + r.details : ""}`);
    }
    process.exit(1);
  }
  console.log("\n✅ All migration-187 validation checks passed.");
  process.exit(0);
}

process.on("unhandledRejection", (e) => {
  console.error("\nUNHANDLED REJECTION:", e);
  spawnSync("docker", ["stop", CONTAINER_NAME]);
  process.exit(1);
});

main().catch((e) => {
  console.error("\nHARNESS ERROR:", e.message);
  spawnSync("docker", ["stop", CONTAINER_NAME]);
  process.exit(1);
});
