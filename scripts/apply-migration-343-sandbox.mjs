// scripts/apply-migration-343-sandbox.mjs
//
// Owner-authorised 2026-11-13 · apply migration 343 to sandbox
// kdstoyyeygcopkogqsyv ONLY. Hard-refuses prod ref.
// Adds nex_account.bubble_self_appearance + bubble_peer_appearance
// (smallint 0..100, nullable) + CHECK constraints.

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

const sqlPath = resolve(repoRoot, "nex-supabase/migrations/343_nex_account_bubble_appearance.sql");
const sql = readFileSync(sqlPath, "utf8");
console.log(`Loaded SQL · ${sql.length} bytes`);

// [A] Pre
console.log(`\n[A] Pre-snapshot ...`);
const pre = new Client({ connectionString: databaseUrl });
await pre.connect();
const preCols = (await pre.query(
  `SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_account'
      AND column_name IN ('bubble_self_appearance','bubble_peer_appearance')
    ORDER BY column_name`,
)).rows;
console.log(`  · appearance columns pre-apply: ${preCols.length > 0 ? preCols.map(r => r.column_name).join(', ') : "absent"}`);
const n = (await pre.query(`SELECT count(*)::int AS n FROM nex_account`)).rows[0].n;
console.log(`  · nex_account rows: ${n}`);
await pre.end();

// [B] Apply
console.log(`\n[B] Applying migration 343 ...`);
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
const cols = (await v.query(
  `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_account'
      AND column_name IN ('bubble_self_appearance','bubble_peer_appearance')
    ORDER BY column_name`,
)).rows;
for (const r of cols) console.log(`  · ${r.column_name}: ${JSON.stringify(r)}`);

const checks = (await v.query(
  `SELECT conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint
    WHERE conrelid='nex_account'::regclass
      AND conname IN ('nex_account_bubble_self_appearance_valid','nex_account_bubble_peer_appearance_valid')
    ORDER BY conname`,
)).rows;
for (const r of checks) console.log(`  · ${r.conname}: ${r.def}`);

const spread = (await v.query(
  `SELECT count(*)::int AS total,
          count(*) FILTER (WHERE bubble_self_appearance IS NULL)::int AS self_null,
          count(*) FILTER (WHERE bubble_peer_appearance IS NULL)::int AS peer_null
     FROM nex_account`,
)).rows[0];
console.log(`  · post state: total=${spread.total} self_null=${spread.self_null} peer_null=${spread.peer_null}`);

const hist = (await v.query(
  `SELECT version, description FROM nex_migration_history WHERE version='343'`,
)).rows[0];
console.log(`  · mig 343 history: ${hist ? "PRESENT · " + hist.description : "ABSENT"}`);

// Functional round-trip on 99901
const ACC = "11111111-1111-4111-8111-111111111111";
const pre99 = (await v.query(
  `SELECT bubble_self_appearance AS s, bubble_peer_appearance AS p FROM nex_account WHERE id=$1`,
  [ACC],
)).rows[0];
console.log(`  · 99901 pre:  self=${pre99.s} peer=${pre99.p}`);
try {
  await v.query(
    `UPDATE nex_account SET bubble_self_appearance=60, bubble_peer_appearance=30 WHERE id=$1`,
    [ACC],
  );
  const post99 = (await v.query(
    `SELECT bubble_self_appearance AS s, bubble_peer_appearance AS p FROM nex_account WHERE id=$1`,
    [ACC],
  )).rows[0];
  console.log(`  · 99901 write test: self=${post99.s} peer=${post99.p} (expected 60/30)`);
} finally {
  // Restore
  await v.query(
    `UPDATE nex_account SET bubble_self_appearance=NULL, bubble_peer_appearance=NULL WHERE id=$1`,
    [ACC],
  );
}

// CHECK rejection test
let rejected = false;
try {
  await v.query(`UPDATE nex_account SET bubble_self_appearance=150 WHERE id=$1`, [ACC]);
} catch (e) {
  rejected = true;
  console.log(`  · out-of-range CHECK rejected: ✓ (${e.constraint})`);
}
if (!rejected) console.log(`  · out-of-range CHECK rejected: ✗ did not reject`);

await v.end();
console.log(`\n✓ DONE · sandbox migration 343 applied + verified`);
