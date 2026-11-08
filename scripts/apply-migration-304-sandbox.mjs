// scripts/apply-migration-304-sandbox.mjs
//
// Owner-authorised 2026-11-08 (round 8) · Priority 2 remediation.
// Applies 304_nex_incident_v2.sql to the SANDBOX Supabase project.
// REFUSES to run against production ref `ijvqdvsvwtwxzcqmoqit`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

function loadEnvVar(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const match = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) throw new Error(`${name} not found in .env.local`);
  let v = match[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

const databaseUrl = loadEnvVar("SANDBOX_DATABASE_URL");

const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
const u = new URL(databaseUrl);
const refFromUser = u.username.match(/\.([a-z0-9]{15,})/)?.[1] ?? null;
const refFromHost = u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1] ?? null;
const projectRef = refFromUser ?? refFromHost;
console.log(`DB host:      ${u.hostname}`);
console.log(`DB username:  ${u.username}`);
console.log(`Project ref:  ${projectRef ?? "<UNKNOWN>"}`);
if (projectRef === PRODUCTION_REF) {
  console.error(
    `STOP · project ref "${projectRef}" is the PRODUCTION NEX project · this script is sandbox-only · aborting`,
  );
  process.exit(2);
}
if (projectRef !== SANDBOX_REF) {
  console.error(
    `STOP · project ref "${projectRef}" is not the sealed SANDBOX project "${SANDBOX_REF}" · aborting`,
  );
  process.exit(2);
}
console.log(`Pre-flight OK · targeting SANDBOX NEX project ${SANDBOX_REF}`);

const migrationPath = resolve(
  repoRoot,
  "nex-supabase/migrations/304_nex_incident_v2.sql",
);
const sql = readFileSync(migrationPath, "utf8");
console.log(`Loaded migration · ${migrationPath} · ${sql.length} bytes`);

const client = new Client({ connectionString: databaseUrl });
try {
  await client.connect();
  console.log("Connected · beginning transaction");
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("Migration applied · transaction committed");
} catch (err) {
  console.error("Apply failed · rolling back:", err?.message ?? err);
  try {
    await client.query("ROLLBACK");
  } catch {
    /* nothing to roll back */
  }
  process.exit(3);
} finally {
  await client.end();
}

// Verify
const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const severity = await v.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'ck_nex_incident_severity'`,
  );
  const status = await v.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'ck_nex_incident_status'`,
  );
  const scope = await v.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'ck_nex_incident_scope'`,
  );
  const cols = await v.query(
    `SELECT column_name, is_nullable, data_type
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_incident'
        AND column_name IN ('last_seen_at','detection_source','service','verified_by_admin','verified_at','dedup_key')
      ORDER BY column_name`,
  );
  const idx = await v.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname='public' AND tablename='nex_incident'
      ORDER BY indexname`,
  );
  const eventKind = await v.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'ck_nex_incident_event_kind'`,
  );
  const history = await v.query(
    `SELECT version, description FROM nex_migration_history WHERE version = '304'`,
  );
  const grants = await v.query(
    `SELECT grantee, privilege_type FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name='nex_incident' AND grantee='service_role'
      ORDER BY privilege_type`,
  );
  const historicalRows = await v.query(
    `SELECT COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE last_seen_at IS NULL)::int AS missing_last_seen,
            COUNT(*) FILTER (WHERE detection_source IS NULL)::int AS missing_source,
            COUNT(*) FILTER (WHERE status = 'VERIFIED')::int AS already_verified
       FROM nex_incident`,
  );
  console.log(`✓ severity CHECK: ${severity.rows[0]?.def}`);
  console.log(`✓ status CHECK:   ${status.rows[0]?.def}`);
  console.log(`✓ scope CHECK:    ${scope.rows[0]?.def}`);
  console.log(`✓ event kind:     ${eventKind.rows[0]?.def}`);
  console.log(`✓ New columns:`);
  for (const r of cols.rows)
    console.log(`    - ${r.column_name} · nullable=${r.is_nullable} · ${r.data_type}`);
  console.log(`✓ Indexes:`);
  for (const r of idx.rows) console.log(`    - ${r.indexname}`);
  console.log(`✓ service_role grants (unchanged):`);
  for (const r of grants.rows) console.log(`    - ${r.privilege_type}`);
  console.log(
    `✓ Historical compat · total=${historicalRows.rows[0].n} · missing_last_seen=${historicalRows.rows[0].missing_last_seen} · missing_source=${historicalRows.rows[0].missing_source} · already_VERIFIED=${historicalRows.rows[0].already_verified}`,
  );
  if (historicalRows.rows[0].already_verified !== 0) {
    console.error(
      "FAIL · a historical row was silently reinterpreted as VERIFIED. The migration must not retroactively mark RECOVERED rows.",
    );
    process.exit(4);
  }
  if (historicalRows.rows[0].missing_last_seen !== 0) {
    console.error("FAIL · last_seen_at backfill missed rows");
    process.exit(4);
  }
  console.log(`✓ Migration history:`);
  for (const r of history.rows)
    console.log(`    - ${r.version} · ${r.description}`);
} finally {
  await v.end();
}

console.log("DONE · sandbox migration 304 applied + verified");
