// scripts/apply-migration-341-sandbox.mjs
//
// Owner-authorised 2026-11-12 · apply migration 341 (bubble colour
// columns) to the NEX SANDBOX project kdstoyyeygcopkogqsyv ONLY.
// Hard-refuses prod ref ijvqdvsvwtwxzcqmoqit.
//
// Scope:
//   · Adds two nullable text columns bubble_self_hex, bubble_peer_hex
//     on nex_account.
//   · Adds two CHECK constraints enforcing lowercase #RRGGBB (or NULL).
//   · No backfill · every existing row keeps NULL so theme defaults
//     continue to paint.

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

const sqlPath = resolve(repoRoot, "nex-supabase/migrations/341_nex_account_bubble_colours.sql");
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
      AND column_name IN ('bubble_self_hex','bubble_peer_hex')
    ORDER BY column_name`,
);
console.log(`  · bubble colour columns pre-apply: ${colPre.rows.length > 0 ? colPre.rows.map(r => r.column_name).join(', ') : "absent"}`);
await pre.end();

// [B] Apply migration
console.log(`\n[B] Applying migration 341 ...`);
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

// [C] Post-verify · columns + constraints
console.log(`\n[C] Post-verify ...`);
const v = new Client({ connectionString: databaseUrl });
await v.connect();

const col = await v.query(
  `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_account'
      AND column_name IN ('bubble_self_hex','bubble_peer_hex')
    ORDER BY column_name`,
);
for (const row of col.rows) {
  console.log(`  · column ${row.column_name}: ${JSON.stringify(row)}`);
}

const checks = await v.query(
  `SELECT conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint
    WHERE conname IN ('nex_account_bubble_self_hex_valid','nex_account_bubble_peer_hex_valid')
    ORDER BY conname`,
);
for (const row of checks.rows) {
  console.log(`  · check ${row.conname}: ${row.def}`);
}

const fillCheck = await v.query(
  `SELECT count(*)::int AS total,
          count(*) FILTER (WHERE bubble_self_hex IS NULL)::int AS self_null,
          count(*) FILTER (WHERE bubble_peer_hex IS NULL)::int AS peer_null
     FROM nex_account`,
);
console.log(`  · post-apply account state:`);
console.log(`      total:       ${fillCheck.rows[0].total}`);
console.log(`      self NULL:   ${fillCheck.rows[0].self_null} (expected = total)`);
console.log(`      peer NULL:   ${fillCheck.rows[0].peer_null} (expected = total)`);

const hist = await v.query(
  `SELECT version, description FROM nex_migration_history WHERE version='341'`,
);
console.log(`  · mig 341 history row: ${hist.rows.length > 0 ? "PRESENT" : "ABSENT"}`);
if (hist.rows[0]) console.log(`      ${hist.rows[0].description}`);

await v.end();
console.log(`\n✓ DONE · sandbox migration 341 applied + verified`);
