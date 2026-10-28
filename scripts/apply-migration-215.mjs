// scripts/apply-migration-215.mjs
//
// Owner-authorised 2026-10-23 · one-shot migration apply for
// 215_nex_friend_request.sql against Supabase ijvqdvsvwtwxzcqmoqit.
//
// Hard pre-flight check per CLAUDE.md §8 · aborts if DATABASE_URL
// doesn't point at the sealed canonical NEX project. Runs the SQL
// inside a single transaction so a mid-apply failure rolls back.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

// --- Load DATABASE_URL from .env.local -----------------------------
function loadEnvVar(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const match = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) throw new Error(`${name} not found in .env.local`);
  // Strip surrounding quotes if present.
  let v = match[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

const databaseUrl = loadEnvVar("DATABASE_URL");

// --- Project-ref safety gate ---------------------------------------
const EXPECTED_REF = "ijvqdvsvwtwxzcqmoqit";
const u = new URL(databaseUrl);
// Supabase pooler username looks like `postgres.<project-ref>`.
const refMatch = u.username.match(/\.([a-z0-9]{15,})/);
const projectRef = refMatch ? refMatch[1] : null;
console.log(`DB host:      ${u.hostname}`);
console.log(`DB username:  ${u.username}`);
console.log(`Project ref:  ${projectRef ?? "<UNKNOWN>"}`);
if (projectRef !== EXPECTED_REF) {
  console.error(
    `STOP · project ref "${projectRef}" is not the sealed NEX project "${EXPECTED_REF}" · aborting`,
  );
  process.exit(2);
}
console.log(`Pre-flight OK · targeting canonical NEX project ${EXPECTED_REF}`);

// --- Load migration SQL --------------------------------------------
const migrationPath = resolve(
  repoRoot,
  "nex-supabase/migrations/215_nex_friend_request.sql",
);
const sql = readFileSync(migrationPath, "utf8");
console.log(`Loaded migration · ${migrationPath} · ${sql.length} bytes`);

// --- Apply ----------------------------------------------------------
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

// --- Verify ---------------------------------------------------------
const verifier = new Client({ connectionString: databaseUrl });
await verifier.connect();
try {
  const tableCheck = await verifier.query(
    `SELECT COUNT(*)::int AS n
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'nex_friend_request'`,
  );
  const indexCheck = await verifier.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'nex_friend_request'
      ORDER BY indexname`,
  );
  const policyCheck = await verifier.query(
    `SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'nex_friend_request'
      ORDER BY policyname`,
  );
  console.log(`✓ Table nex_friend_request exists: ${tableCheck.rows[0].n === 1}`);
  console.log(`✓ Indexes:`);
  for (const r of indexCheck.rows) console.log(`    - ${r.indexname}`);
  console.log(`✓ RLS policies:`);
  for (const r of policyCheck.rows) console.log(`    - ${r.policyname}`);
} finally {
  await verifier.end();
}

console.log("DONE");
