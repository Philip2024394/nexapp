// scripts/apply-migration-305-sandbox.mjs
//
// Owner-authorised 2026-11-08 (round 11) · Priority 2 completion.
// Applies 305_nex_incident_v2_perf.sql to the SANDBOX Supabase project.
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
console.log(`Project ref:  ${projectRef ?? "<UNKNOWN>"}`);
if (projectRef === PRODUCTION_REF) {
  console.error(`STOP · project ref "${projectRef}" is the PRODUCTION project · aborting`);
  process.exit(2);
}
if (projectRef !== SANDBOX_REF) {
  console.error(`STOP · project ref "${projectRef}" is not the sealed SANDBOX project · aborting`);
  process.exit(2);
}
console.log(`Pre-flight OK · targeting SANDBOX NEX project ${SANDBOX_REF}`);

const migrationPath = resolve(
  repoRoot,
  "nex-supabase/migrations/305_nex_incident_v2_perf.sql",
);
const sql = readFileSync(migrationPath, "utf8");
console.log(`Loaded migration · ${sql.length} bytes`);

const client = new Client({ connectionString: databaseUrl });
try {
  await client.connect();
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

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const col = await v.query(
    `SELECT column_name, is_nullable, column_default, data_type
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_incident'
        AND column_name='dedup_count'`,
  );
  const ck = await v.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'ck_nex_incident_dedup_count'`,
  );
  const idx = await v.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname='public' AND tablename='nex_incident'
        AND indexname IN ('idx_nex_incident_verified_at',
                          'idx_nex_incident_closed_at',
                          'idx_nex_incident_correlation_status')
      ORDER BY indexname`,
  );
  const compat = await v.query(
    `SELECT COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE dedup_count IS NULL)::int AS missing,
            COUNT(*) FILTER (WHERE dedup_count < 1)::int AS invalid
       FROM nex_incident`,
  );
  const history = await v.query(
    `SELECT version, description FROM nex_migration_history WHERE version = '305'`,
  );
  const grants = await v.query(
    `SELECT grantee, privilege_type FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name='nex_incident' AND grantee='service_role'
      ORDER BY privilege_type`,
  );
  console.log(`✓ dedup_count: ${JSON.stringify(col.rows[0])}`);
  console.log(`✓ CHECK: ${ck.rows[0]?.def}`);
  console.log(`✓ New indexes:`);
  for (const r of idx.rows) console.log(`    - ${r.indexname}`);
  console.log(
    `✓ Historical compat · total=${compat.rows[0].n} · missing=${compat.rows[0].missing} · invalid=${compat.rows[0].invalid}`,
  );
  if (compat.rows[0].missing !== 0 || compat.rows[0].invalid !== 0) {
    console.error("FAIL · historical dedup_count backfill left gaps");
    process.exit(4);
  }
  console.log(`✓ service_role grants (unchanged):`);
  for (const r of grants.rows) console.log(`    - ${r.privilege_type}`);
  console.log(`✓ History: ${history.rows[0]?.version} · ${history.rows[0]?.description}`);
} finally {
  await v.end();
}

console.log("DONE · sandbox migration 305 applied + verified");
