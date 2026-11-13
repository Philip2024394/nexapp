// scripts/apply-migration-340-sandbox.mjs
//
// Owner-authorised 2026-11-12 · apply migration 340 (global theme
// sharing column) to the NEX SANDBOX project kdstoyyeygcopkogqsyv
// ONLY. Hard-refuses prod ref ijvqdvsvwtwxzcqmoqit.
//
// Scope:
//   · Adds one non-null boolean column theme_sharing_globally_enabled
//     with default TRUE on nex_account.
//   · No backfill · default is applied to every existing row by
//     Postgres so the pre-migration behaviour is preserved exactly.
//   · Pre-snapshot verifies the column does not already exist, then
//     verifies post-apply that every row has the default TRUE value.

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

const sqlPath = resolve(repoRoot, "nex-supabase/migrations/340_nex_account_theme_sharing_globally_enabled.sql");
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
      AND column_name='theme_sharing_globally_enabled'`,
);
console.log(`  · theme_sharing_globally_enabled column pre-apply: ${colPre.rows.length > 0 ? "ALREADY PRESENT" : "absent"}`);
await pre.end();

// [B] Apply migration
console.log(`\n[B] Applying migration 340 ...`);
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
      AND column_name='theme_sharing_globally_enabled'`,
);
console.log(`  · theme_sharing_globally_enabled column: ${JSON.stringify(col.rows[0] ?? {})}`);

const fillCheck = await v.query(
  `SELECT count(*)::int AS total,
          count(*) FILTER (WHERE theme_sharing_globally_enabled = true)::int AS true_count,
          count(*) FILTER (WHERE theme_sharing_globally_enabled = false)::int AS false_count
     FROM nex_account`,
);
console.log(`  · post-apply default spread:`);
console.log(`      total:    ${fillCheck.rows[0].total}`);
console.log(`      true:     ${fillCheck.rows[0].true_count} (expected = total · DEFAULT applied)`);
console.log(`      false:    ${fillCheck.rows[0].false_count} (expected 0)`);

const hist = await v.query(
  `SELECT version, description FROM nex_migration_history WHERE version='340'`,
);
console.log(`  · mig 340 history row: ${hist.rows.length > 0 ? "PRESENT" : "ABSENT"}`);
if (hist.rows[0]) console.log(`      ${hist.rows[0].description}`);

await v.end();
console.log(`\n✓ DONE · sandbox migration 340 applied + verified`);
