// scripts/apply-migration-303-sandbox.mjs
//
// Owner-authorised 2026-11-08 (round 5) · one-shot migration apply for
// 303_nex_page_view.sql against the SANDBOX Supabase project.
//
// Hard pre-flight check · aborts if SANDBOX_DATABASE_URL doesn't point
// at the sealed sandbox project `kdstoyyeygcopkogqsyv`. REFUSES if the
// URL points at the production project `ijvqdvsvwtwxzcqmoqit`.
// Runs the SQL inside a single transaction so a mid-apply failure
// rolls back.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

// --- Load SANDBOX_DATABASE_URL from .env.local ---------------------
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

// --- Project-ref safety gate · sandbox only ------------------------
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
const u = new URL(databaseUrl);
// Supabase project ref appears EITHER in pooler usernames
// (`postgres.<ref>`) OR directly in direct-connection hostnames
// (`db.<ref>.supabase.co`). Check both so sandbox + production refs
// resolve regardless of connection mode.
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

// --- Load migration SQL --------------------------------------------
const migrationPath = resolve(
  repoRoot,
  "nex-supabase/migrations/303_nex_page_view.sql",
);
const sql = readFileSync(migrationPath, "utf8");
console.log(`Loaded migration · ${migrationPath} · ${sql.length} bytes`);

// --- Apply ---------------------------------------------------------
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

// --- Verify --------------------------------------------------------
const verifier = new Client({ connectionString: databaseUrl });
await verifier.connect();
try {
  const tableCheck = await verifier.query(
    `SELECT COUNT(*)::int AS n
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'nex_page_view'`,
  );
  const indexCheck = await verifier.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'nex_page_view'
      ORDER BY indexname`,
  );
  const grantCheck = await verifier.query(
    `SELECT grantee, privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'nex_page_view'
      ORDER BY grantee, privilege_type`,
  );
  const historyCheck = await verifier.query(
    `SELECT version, description FROM nex_migration_history WHERE version = '303'`,
  );
  console.log(`✓ Table nex_page_view exists: ${tableCheck.rows[0].n === 1}`);
  console.log(`✓ Indexes:`);
  for (const r of indexCheck.rows) console.log(`    - ${r.indexname}`);
  console.log(`✓ Grants:`);
  for (const r of grantCheck.rows)
    console.log(`    - ${r.grantee} · ${r.privilege_type}`);
  console.log(`✓ Migration history:`);
  for (const r of historyCheck.rows)
    console.log(`    - ${r.version} · ${r.description}`);
} finally {
  await verifier.end();
}

console.log("DONE · sandbox migration 303 applied + verified");
