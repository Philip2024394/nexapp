// scripts/apply-migration-342-sandbox.mjs
//
// Owner-authorised 2026-11-13 · apply migration 342 to sandbox
// kdstoyyeygcopkogqsyv ONLY. Hard-refuses prod ref.
// Extends nex_theme_ownership_acquired_via_known CHECK to include
// 'first_free' (+ purchase_consistency variant).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function loadEnvVar(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = loadEnvVar("SANDBOX_DATABASE_URL");
const PROD = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX = "kdstoyyeygcopkogqsyv";
const u = new URL(databaseUrl);
const ref =
  u.username.match(/\.([a-z0-9]{15,})/)?.[1] ??
  u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
console.log(`DB host:     ${u.hostname}\nProject ref: ${ref}`);
if (ref === PROD) { console.error("STOP · production"); process.exit(2); }
if (ref !== SANDBOX) { console.error(`STOP · ref ${ref} is not SANDBOX`); process.exit(2); }
console.log(`Pre-flight OK · targeting SANDBOX ${SANDBOX}\n`);

const sqlPath = resolve(repoRoot, "nex-supabase/migrations/342_nex_theme_ownership_first_free_acquired_via.sql");
const sql = readFileSync(sqlPath, "utf8");
console.log(`Loaded SQL · ${sql.length} bytes`);

// [A] Pre
console.log(`\n[A] Pre-snapshot ...`);
const pre = new Client({ connectionString: databaseUrl });
await pre.connect();
const preCheck = (await pre.query(
  `SELECT conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint
    WHERE conrelid='nex_theme_ownership'::regclass
      AND conname='nex_theme_ownership_acquired_via_known'`,
)).rows[0];
console.log(`  · pre check: ${preCheck?.def ?? "(absent)"}`);
await pre.end();

// [B] Apply
console.log(`\n[B] Applying migration 342 ...`);
const apply = new Client({ connectionString: databaseUrl });
try {
  await apply.connect();
  await apply.query(sql);
  console.log(`  · applied`);
} catch (err) {
  console.error(`  · Apply FAILED:`, err?.message ?? err);
  process.exit(3);
} finally {
  await apply.end();
}

// [C] Post
console.log(`\n[C] Post-verify ...`);
const v = new Client({ connectionString: databaseUrl });
await v.connect();
const postCheck = (await v.query(
  `SELECT conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint
    WHERE conrelid='nex_theme_ownership'::regclass
      AND conname='nex_theme_ownership_acquired_via_known'`,
)).rows[0];
console.log(`  · post check: ${postCheck?.def}`);

const hist = (await v.query(
  `SELECT version, description FROM nex_migration_history WHERE version='342'`,
)).rows[0];
console.log(`  · mig 342 history: ${hist ? "PRESENT · " + hist.description : "ABSENT"}`);

// Functional insert test (idempotent cleanup around it)
const ACC = "11111111-1111-4111-8111-111111111111";
await v.query(`DELETE FROM nex_theme_ownership WHERE account_id=$1 AND acquired_via='first_free'`, [ACC]);
try {
  await v.query(
    `INSERT INTO nex_theme_ownership (account_id, theme_id, acquired_via, acquired_at) VALUES ($1,'nex-default','first_free',now())`,
    [ACC],
  );
  console.log(`  · first_free insert: ✓ succeeded`);
} catch (e) {
  console.log(`  · first_free insert: ✗ ${e.message}`);
}
await v.query(`DELETE FROM nex_theme_ownership WHERE account_id=$1 AND acquired_via='first_free'`, [ACC]);
await v.end();

console.log(`\n✓ DONE · sandbox migration 342 applied + verified`);
