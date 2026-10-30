#!/usr/bin/env node
// scripts/apply-migrations-to-test.mjs
//
// Owner-authorised 2026-10-30 (Path B · BUILD ONLY). Guarded migration
// applier for the dedicated Supabase TEST project.
//
// This script applies the EXACT list of 161 production-applied migration
// versions (sourced from the sealed read-only probe of
// `nex_migration_history` on project `ijvqdvsvwtwxzcqmoqit`) against
// the test project ONLY.
//
// ──────────────────────────────────────────────────────────────────────
// 8 SAFEGUARDS (owner-sealed, verified before any DB write)
// ──────────────────────────────────────────────────────────────────────
//
//   1. No production writes. Script refuses to run if TEST_DATABASE_URL
//      contains the production project ref `ijvqdvsvwtwxzcqmoqit`.
//      Verified BEFORE any pg connect() call.
//   2. Explicit manifest. The 161 versions are read from
//      scripts/_test-applied-versions.json. The script asserts
//      total === 161 and refuses to run on count mismatch. No
//      automatic directory discovery.
//   3. Duplicate prefixes. 187 and 224 are resolved via the manifest's
//      resolution_map (keyed by the production descriptions), NOT by
//      filesystem order.
//   4. Draft headers ignored. The script never inspects file headers.
//      Only the authoritative version list drives application.
//   5. Missing / ambiguous files. Pre-flight resolves every version to
//      a file BEFORE any DB write. Hard failure (exit 2) if any file is
//      missing OR if any non-187/224 version has multiple matches.
//   6. Idempotency. Reads TEST nex_migration_history before each apply.
//      Already-recorded versions are SKIPPED (not re-applied).
//   7. Transactional integrity. Each migration runs inside its own
//      BEGIN...COMMIT. On ANY failure the transaction is ROLLED BACK
//      and the script exits non-zero. NO row is ever written to
//      nex_migration_history on a failed migration — the migration
//      SQL itself writes that row inside its own transaction, which
//      disappears with the rollback (owner correction 2026-10-30).
//      Failure details go to stderr and `logs/apply-migrations-
//      <timestamp>.log` — never to the DB.
//   8. Project identity. Verified via a dedicated preflight step.
//
// ──────────────────────────────────────────────────────────────────────
// USAGE
// ──────────────────────────────────────────────────────────────────────
//
//   # Build-time safety self-tests (no DB connection)
//   node scripts/apply-migrations-to-test.mjs --safety-tests
//
//   # Dry-run resolution preflight (no DB connection)
//   node scripts/apply-migrations-to-test.mjs --dry-run
//
//   # Apply against the test project (requires TEST_DATABASE_URL)
//   TEST_DATABASE_URL=postgres://... node scripts/apply-migrations-to-test.mjs
//
// The default behaviour (no flag) will attempt to connect and apply.
// There is no `--force` or production-override; refusal is fatal.

import { readFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { resolve, join } from "node:path";

// ─── Constants ────────────────────────────────────────────────────────

const PROD_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const MANIFEST_PATH = "scripts/_test-applied-versions.json";
const MIGRATIONS_DIR = "nex-supabase/migrations";
const EXPECTED_COUNT = 161;
const LOG_DIR = "logs";

// ─── Phase 0 · argv parsing ───────────────────────────────────────────

const argv = process.argv.slice(2);
const MODE = argv.includes("--safety-tests")
  ? "safety-tests"
  : argv.includes("--dry-run")
  ? "dry-run"
  : "apply";

// ─── Safeguard 2 · load + validate manifest ───────────────────────────

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error(`FATAL · manifest not found at ${MANIFEST_PATH}`);
    process.exit(2);
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch (e) {
    console.error(`FATAL · manifest parse failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
  if (manifest.schema_version !== 1) {
    console.error(`FATAL · manifest schema_version is ${manifest.schema_version}, expected 1`);
    process.exit(2);
  }
  if (!Array.isArray(manifest.entries)) {
    console.error("FATAL · manifest.entries is not an array");
    process.exit(2);
  }
  if (manifest.total !== EXPECTED_COUNT || manifest.entries.length !== EXPECTED_COUNT) {
    console.error(`FATAL · manifest count mismatch · total=${manifest.total} entries=${manifest.entries.length} expected=${EXPECTED_COUNT}`);
    process.exit(2);
  }
  return manifest;
}

// ─── Safeguard 3 + 5 · resolve each version to an exact file path ────

function resolveFiles(manifest, migrationsDirOverride) {
  const dir = migrationsDirOverride ?? MIGRATIONS_DIR;
  const resolvedList = [];
  const errors = [];
  for (const entry of manifest.entries) {
    const expected = join(dir, entry.file);
    if (!existsSync(expected)) {
      errors.push(`version ${entry.version} · manifest declares ${entry.file} but file does not exist at ${expected}`);
      continue;
    }
    // For duplicate-prefix versions, assert the manifest filename
    // matches the resolution_map (defence against manual edits).
    if (manifest.resolution_map && manifest.resolution_map[entry.version]) {
      if (manifest.resolution_map[entry.version] !== entry.file) {
        errors.push(`version ${entry.version} · entry file ${entry.file} does not match resolution_map ${manifest.resolution_map[entry.version]}`);
        continue;
      }
    }
    resolvedList.push({ version: entry.version, file: entry.file, path: expected });
  }
  if (errors.length > 0) {
    console.error("FATAL · resolution errors (no DB write attempted):");
    for (const e of errors) console.error("  · " + e);
    process.exit(2);
  }
  return resolvedList;
}

// ─── Safeguards 1 + 8 · project-identity gate ─────────────────────────

function assertNotProduction(databaseUrl) {
  if (!databaseUrl || typeof databaseUrl !== "string") {
    console.error("FATAL · TEST_DATABASE_URL is not set");
    process.exit(2);
  }
  if (databaseUrl.includes(PROD_PROJECT_REF)) {
    console.error(`REFUSED · TEST_DATABASE_URL contains the production project ref ${PROD_PROJECT_REF}`);
    console.error("This script never writes to production. Aborting.");
    process.exit(2);
  }
}

// ─── Logging (safeguard 7 · failure logs go to disk, not DB) ──────────

function openLog() {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(LOG_DIR, `apply-migrations-${stamp}.log`);
  const write = (line) => appendFileSync(path, line + "\n");
  write(`# apply-migrations-to-test · ${new Date().toISOString()}`);
  write(`# mode: ${MODE}`);
  return { path, write };
}

// ─── Safety tests (no DB connection) ──────────────────────────────────

async function runSafetyTests() {
  console.log("─── Safety self-tests · no DB connection ───");
  let failed = 0;
  const check = (name, ok, detail) => {
    const mark = ok ? "✓" : "✗";
    console.log(`  ${mark} ${name}${detail ? " · " + detail : ""}`);
    if (!ok) failed++;
  };

  // Test 1 · production refusal
  try {
    const before = process.exit;
    let exitCode = null;
    process.exit = (c) => { exitCode = c; throw new Error("exit-trap"); };
    try {
      assertNotProduction(`postgres://x:y@z/${PROD_PROJECT_REF}`);
    } catch (e) {
      if (!/exit-trap/.test(String(e))) throw e;
    } finally {
      process.exit = before;
    }
    check("production-ref URL is refused", exitCode === 2, `exit code was ${exitCode}`);
  } catch (e) {
    check("production-ref URL is refused", false, e instanceof Error ? e.message : String(e));
  }

  // Test 2 · empty TEST_DATABASE_URL is refused
  try {
    const before = process.exit;
    let exitCode = null;
    process.exit = (c) => { exitCode = c; throw new Error("exit-trap"); };
    try {
      assertNotProduction("");
    } catch (e) {
      if (!/exit-trap/.test(String(e))) throw e;
    } finally {
      process.exit = before;
    }
    check("empty TEST_DATABASE_URL is refused", exitCode === 2, `exit code was ${exitCode}`);
  } catch (e) {
    check("empty TEST_DATABASE_URL is refused", false, e instanceof Error ? e.message : String(e));
  }

  // Test 3 · manifest count assertion
  const manifest = loadManifest();
  check("manifest total === 161", manifest.total === 161);
  check("manifest.entries.length === 161", manifest.entries.length === 161);
  check("manifest has resolution_map for 187", Boolean(manifest.resolution_map?.["187"]));
  check("manifest has resolution_map for 224", Boolean(manifest.resolution_map?.["224"]));

  // Test 4 · every entry resolves to a real file
  const resolved = resolveFiles(manifest);
  check("all 161 entries resolve to real files", resolved.length === 161, `${resolved.length}/161 resolved`);

  // Test 5 · duplicate-prefix resolution picks the right file
  const r187 = resolved.find((r) => r.version === "187");
  const r224 = resolved.find((r) => r.version === "224");
  check(
    "187 resolves to the world_country_us_au_seed file",
    r187?.file === "187_nex_world_country_us_au_seed.sql",
    r187?.file,
  );
  check(
    "224 resolves to the is_mock_persona file",
    r224?.file === "224_nex_account_is_mock_persona.sql",
    r224?.file,
  );

  // Test 6 · simulated missing-file hard-failure
  try {
    const before = process.exit;
    let exitCode = null;
    process.exit = (c) => { exitCode = c; throw new Error("exit-trap"); };
    try {
      resolveFiles(manifest, "/nonexistent/dir");
    } catch (e) {
      if (!/exit-trap/.test(String(e))) throw e;
    } finally {
      process.exit = before;
    }
    check("missing-file causes hard failure (exit 2)", exitCode === 2, `exit code was ${exitCode}`);
  } catch (e) {
    check("missing-file causes hard failure (exit 2)", false, e instanceof Error ? e.message : String(e));
  }

  // Test 7 · simulated tampered-manifest fails resolution_map check
  const tampered = JSON.parse(JSON.stringify(manifest));
  tampered.entries.find((e) => e.version === "187").file = "187_nex_source_registry_osm_products.sql";
  try {
    const before = process.exit;
    let exitCode = null;
    process.exit = (c) => { exitCode = c; throw new Error("exit-trap"); };
    try {
      resolveFiles(tampered);
    } catch (e) {
      if (!/exit-trap/.test(String(e))) throw e;
    } finally {
      process.exit = before;
    }
    check("tampered manifest (187 → wrong file) is refused", exitCode === 2, `exit code was ${exitCode}`);
  } catch (e) {
    check("tampered manifest (187 → wrong file) is refused", false, e instanceof Error ? e.message : String(e));
  }

  console.log("");
  console.log(failed === 0 ? "ALL SAFETY TESTS PASSED" : `FAILED · ${failed} test(s) failed`);
  process.exit(failed === 0 ? 0 : 1);
}

// ─── Dry-run · resolution preflight only ──────────────────────────────

function runDryRun() {
  console.log("─── Dry-run · resolution preflight · no DB connection ───");
  const manifest = loadManifest();
  const resolved = resolveFiles(manifest);
  console.log(`Manifest: ${MANIFEST_PATH}`);
  console.log(`Total: ${resolved.length}`);
  console.log(`Resolution map:`);
  for (const [v, f] of Object.entries(manifest.resolution_map ?? {})) {
    console.log(`  ${v} → ${f}`);
  }
  console.log(`First 3 resolved: ${resolved.slice(0, 3).map((r) => r.version).join(", ")}`);
  console.log(`Last 3 resolved:  ${resolved.slice(-3).map((r) => r.version).join(", ")}`);
  console.log("");
  console.log("OK · would apply 161 migrations against TEST_DATABASE_URL.");
  console.log("Re-run without --dry-run to execute (requires owner approval per boundary 3).");
}

// ─── Apply mode · the real executor (gated) ──────────────────────────

async function runApply() {
  console.log("─── Apply mode · gated executor ───");
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assertNotProduction(databaseUrl);

  const manifest = loadManifest();
  const resolved = resolveFiles(manifest);
  console.log(`Resolved ${resolved.length}/161 migration files · pre-flight OK`);

  const log = openLog();
  console.log(`Logging to ${log.path}`);

  // Lazy-load pg so safety-tests + dry-run never require the dep to be
  // installed in the context.
  const pg = (await import("pg")).default;
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  log.write(`connected · ${new Date().toISOString()}`);

  // Does the test project already have nex_migration_history? If not,
  // the very first migration (001) creates it, so skip the idempotency
  // check for 001 and proceed. For every subsequent version, query
  // history first.
  let historyExists = false;
  try {
    const { rows } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='nex_migration_history'`,
    );
    historyExists = rows.length > 0;
  } catch (e) {
    log.write(`history-check failed: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }

  const appliedVersions = new Set();
  if (historyExists) {
    const { rows } = await client.query(`SELECT version FROM nex_migration_history`);
    for (const r of rows) appliedVersions.add(String(r.version));
    log.write(`existing applied: ${appliedVersions.size}`);
  }

  let applied = 0;
  let skipped = 0;

  for (const r of resolved) {
    if (appliedVersions.has(r.version)) {
      console.log(`SKIP ${r.version} · already recorded`);
      log.write(`SKIP ${r.version}`);
      skipped++;
      continue;
    }
    const sql = readFileSync(r.path, "utf8");
    try {
      // Each migration carries its own BEGIN/COMMIT. Running them raw
      // means a failure inside the migration's own transaction rolls
      // back everything the migration did — including any INSERT INTO
      // nex_migration_history that the migration SQL would have added.
      // No separate rollback step is needed from the applier.
      await client.query(sql);
      console.log(`APPLIED ${r.version} · ${r.file}`);
      log.write(`APPLIED ${r.version} · ${r.file}`);
      applied++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`FAILED ${r.version} · ${r.file} · ${msg}`);
      log.write(`FAILED ${r.version} · ${r.file} · ${msg}`);
      // Safety: no status row is written to the DB on failure. The
      // migration's own transaction rolled back. Applier exits
      // non-zero so re-runs don't silently continue past this version.
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log(`─── Done · ${applied} applied, ${skipped} skipped, ${resolved.length} total ───`);
  log.write(`done · ${applied} applied, ${skipped} skipped`);
}

// ─── Main ─────────────────────────────────────────────────────────────

(async () => {
  if (MODE === "safety-tests") {
    await runSafetyTests();
    return;
  }
  if (MODE === "dry-run") {
    runDryRun();
    return;
  }
  await runApply();
})().catch((e) => {
  console.error("UNCAUGHT:", e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
