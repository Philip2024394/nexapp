// scripts/apply-migration-362-sandbox.mjs
//
// NEX Gate A Connected Matrix §16.48.25 · Lane 2 · apply migration 362
// (add accepted_at to nex_group_call_participant) against Supabase
// sandbox kdstoyyeygcopkogqsyv ONLY. Production ijvqdvsvwtwxzcqmoqit
// SEALED.
//
// Dated: 2026-11-20
// Modelled on apply-migration-361-sandbox.mjs.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Client } from "pg";

const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const PROD_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const MIGRATION_NUMBER = "362";
const MIGRATION_FILE = "nex-supabase/migrations/362_nex_group_call_participant_accepted_at.sql";
const EXPECTED_SHA = "2a9c46b6528f5333f2026336e21d83d366261e5faf5888065b5c6a106e56b82b";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function env(key) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

// ── Project-ref pin (direct OR pooler) ────────────────────────────────────
const url = env("SANDBOX_DATABASE_URL") ?? env("DATABASE_URL");
if (!url) { console.error("FATAL: no DATABASE_URL in .env.local"); process.exit(2); }
if (url.includes(PROD_PROJECT_REF)) {
  console.error(`STOP · URL references production ref ${PROD_PROJECT_REF}`);
  process.exit(3);
}

const parsed = new URL(url);
let projectRef = null;

if (parsed.hostname.endsWith(".pooler.supabase.com")) {
  const m = parsed.username.match(/^postgres\.([a-z0-9]+)$/);
  if (m) projectRef = m[1];
  if (projectRef !== CANONICAL_PROJECT_REF) {
    console.error(`STOP · pooler-username project-ref '${projectRef}' !== '${CANONICAL_PROJECT_REF}'`);
    process.exit(3);
  }
} else if (parsed.hostname.endsWith(".supabase.co")) {
  const m = parsed.hostname.match(/^(?:db\.)?([a-z0-9]+)\.supabase\.co$/);
  if (m) projectRef = m[1];
  if (projectRef !== CANONICAL_PROJECT_REF) {
    console.error(`STOP · hostname project-ref '${projectRef}' !== '${CANONICAL_PROJECT_REF}'`);
    process.exit(3);
  }
} else {
  console.error(`STOP · unrecognised hostname '${parsed.hostname}'`); process.exit(3);
}
console.log(`Target · sandbox ${projectRef}`);

// ── Migration SQL file + SHA pin ───────────────────────────────────────────
const sqlBuf = readFileSync(resolve(repoRoot, MIGRATION_FILE));
const actualSha = createHash("sha256").update(sqlBuf).digest("hex");
if (actualSha !== EXPECTED_SHA) {
  console.error(`STOP · migration file SHA mismatch: got ${actualSha} expected ${EXPECTED_SHA}`);
  process.exit(1);
}
console.log(`SHA · ${actualSha} VERIFIED`);
const sql = sqlBuf.toString("utf8");

// ── Connect + apply ────────────────────────────────────────────────────────
const tStart = Date.now();
const c = new Client({ connectionString: url });
try {
  await c.connect();
  console.log("CONNECTED");

  // Pre-state: capture current head
  const headPre = await c.query(
    `SELECT version, applied_at
       FROM nex_migration_history
     ORDER BY applied_at DESC, version DESC
      LIMIT 1`
  );
  console.log(`PRE · head version=${headPre.rows[0]?.version} applied_at=${headPre.rows[0]?.applied_at}`);

  const pre = await c.query(
    "SELECT version FROM nex_migration_history WHERE version = $1",
    [MIGRATION_NUMBER]
  );
  if (pre.rows.length > 0) {
    console.log(`Migration ${MIGRATION_NUMBER} already in history · verifying post-state only`);
  } else {
    await c.query(sql);
    console.log(`Migration ${MIGRATION_NUMBER} SQL executed`);
  }

  // ── Post-check ──────────────────────────────────────────────────────────
  console.log("── POST-CHECK");

  // 1. Column exists, nullable, correct type
  const colRows = await c.query(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'nex_group_call_participant'
        AND column_name  = 'accepted_at'`
  );
  if (!colRows.rows.length) {
    console.error("POST: FAIL — accepted_at column missing from nex_group_call_participant");
    process.exit(1);
  }
  const col = colRows.rows[0];
  console.log(`  column · data_type=${col.data_type} is_nullable=${col.is_nullable} default=${col.column_default}`);
  if (col.data_type !== "timestamp with time zone") {
    console.error(`POST: FAIL data_type=${col.data_type} (expected timestamp with time zone)`);
    process.exit(1);
  }
  if (col.is_nullable !== "YES") {
    console.error(`POST: FAIL is_nullable=${col.is_nullable} (expected YES)`);
    process.exit(1);
  }
  if (col.column_default !== null) {
    console.error(`POST: FAIL column_default=${col.column_default} (expected NULL · no backfill)`);
    process.exit(1);
  }

  // 2. Column comment is present (semantic documentation lives on the column)
  const commentRows = await c.query(
    `SELECT col_description(
              (SELECT oid FROM pg_class WHERE relname='nex_group_call_participant' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')),
              (SELECT attnum FROM pg_attribute
                 WHERE attrelid = (SELECT oid FROM pg_class WHERE relname='nex_group_call_participant' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public'))
                   AND attname='accepted_at')
            ) AS comment`
  );
  const comment = commentRows.rows[0]?.comment ?? "";
  if (!comment || comment.length < 10) {
    console.error(`POST: FAIL column comment missing or too short · got '${comment}'`);
    process.exit(1);
  }
  console.log(`  comment · len=${comment.length} · present`);

  // 3. Historical rows · no value should have been backfilled.
  const countRows = await c.query(
    `SELECT COUNT(*) FILTER (WHERE accepted_at IS NOT NULL) AS populated,
            COUNT(*) AS total
       FROM nex_group_call_participant`
  );
  const { populated, total } = countRows.rows[0];
  console.log(`  historical rows · total=${total} accepted_at populated=${populated}`);
  if (Number(populated) !== 0) {
    console.error(`POST: FAIL ${populated} historical rows have accepted_at set · migration forbids backfill`);
    process.exit(1);
  }

  // 4. History row
  const hist = await c.query(
    "SELECT version, applied_at FROM nex_migration_history WHERE version = $1",
    [MIGRATION_NUMBER]
  );
  if (!hist.rows.length) { console.error("POST: FAIL history row missing"); process.exit(1); }
  console.log(`  history: version=${hist.rows[0].version} applied_at=${hist.rows[0].applied_at}`);

  // Post-state head
  const headPost = await c.query(
    `SELECT version, applied_at
       FROM nex_migration_history
     ORDER BY applied_at DESC, version DESC
      LIMIT 1`
  );
  console.log(`POST · head version=${headPost.rows[0]?.version} applied_at=${headPost.rows[0]?.applied_at}`);

  const ms = Date.now() - tStart;
  console.log(`\nMig ${MIGRATION_NUMBER} sandbox apply complete · duration=${ms}ms · exitCode=${process.exitCode ?? 0}`);

} catch (e) {
  console.error(`FAIL: ${e.message}${e.code ? " SQLSTATE=" + e.code : ""}`);
  process.exit(1);
} finally {
  try { await c.end(); } catch { /* ignore */ }
}
