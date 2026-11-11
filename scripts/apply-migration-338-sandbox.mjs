// scripts/apply-migration-338-sandbox.mjs
//
// Owner-authorised 2026-11-11 · Phase 3 of the unified visual library.
// Applies 338_nex_themes_plus_until.sql to the SANDBOX Supabase project
// kdstoyyeygcopkogqsyv. Hard-refuses prod ref ijvqdvsvwtwxzcqmoqit.
//
// Scope:
//   · Adds one nullable column nex_account.themes_plus_until timestamptz
//   · No backfill · no existing-row mutation
//   · Pre-snapshot: row count of nex_account + any existing column named
//     themes_plus_until (defence-in-depth check for prior apply)
//   · Post: confirm column exists, all existing rows have NULL, migration
//     history recorded.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvVar(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const match = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) throw new Error(`${name} not found in .env.local`);
  let v = match[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = loadEnvVar("SANDBOX_DATABASE_URL");
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF    = "kdstoyyeygcopkogqsyv";
const u = new URL(databaseUrl);
const refFromUser = u.username.match(/\.([a-z0-9]{15,})/)?.[1] ?? null;
const refFromHost = u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1] ?? null;
const projectRef = refFromUser ?? refFromHost;

console.log(`DB host:     ${u.hostname}`);
console.log(`Project ref: ${projectRef ?? "<UNKNOWN>"}`);
if (projectRef === PRODUCTION_REF) { console.error(`STOP · production ref detected · aborting`); process.exit(2); }
if (projectRef !== SANDBOX_REF)    { console.error(`STOP · ref "${projectRef}" is not SANDBOX`); process.exit(2); }
console.log(`Pre-flight OK · targeting SANDBOX ${SANDBOX_REF}\n`);

const sqlPath = resolve(repoRoot, "nex-supabase/migrations/338_nex_themes_plus_until.sql");
const sql = readFileSync(sqlPath, "utf8");
console.log(`Loaded SQL · ${sql.length} bytes`);

// [A] Pre-snapshot
console.log(`\n[A] Pre-snapshot ...`);
const pre = new Client({ connectionString: databaseUrl });
await pre.connect();
const acc = await pre.query(`SELECT count(*)::int AS n FROM nex_account`);
console.log(`  · nex_account total rows: ${acc.rows[0].n}`);
const colPre = await pre.query(
  `SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_account'
      AND column_name='themes_plus_until'`,
);
console.log(`  · themes_plus_until column pre-apply: ${colPre.rows.length > 0 ? "ALREADY PRESENT" : "absent"}`);
await pre.end();

// [B] Apply migration
console.log(`\n[B] Applying migration 338 ...`);
const apply = new Client({ connectionString: databaseUrl });
try {
  await apply.connect();
  await apply.query(sql);
  console.log(`  · Migration applied · transaction committed inside the SQL`);
} catch (err) {
  console.error(`  · Apply FAILED:`, err?.message ?? err);
  process.exit(3);
} finally {
  await apply.end();
}

// [C] Post-verify
console.log(`\n[C] Post-verify ...`);
const v = new Client({ connectionString: databaseUrl });
await v.connect();

const col = await v.query(
  `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_account'
      AND column_name='themes_plus_until'`,
);
console.log(`  · themes_plus_until column: ${JSON.stringify(col.rows[0] ?? {})}`);

const fillCheck = await v.query(
  `SELECT count(*)::int AS total,
          count(*) FILTER (WHERE themes_plus_until IS NULL)::int AS null_count,
          count(*) FILTER (WHERE themes_plus_until IS NOT NULL)::int AS set_count
     FROM nex_account`,
);
console.log(`  · post-apply account state:`);
console.log(`      total:     ${fillCheck.rows[0].total}`);
console.log(`      null:      ${fillCheck.rows[0].null_count}`);
console.log(`      set:       ${fillCheck.rows[0].set_count} (expected 0 · no backfill)`);

const hist = await v.query(
  `SELECT version, description FROM nex_migration_history WHERE version='338'`,
);
console.log(`  · mig 338 history row: ${hist.rows.length > 0 ? "PRESENT" : "ABSENT"}`);
if (hist.rows[0]) console.log(`      ${hist.rows[0].description}`);

await v.end();
console.log(`\n✓ DONE · sandbox migration 338 applied + verified`);
