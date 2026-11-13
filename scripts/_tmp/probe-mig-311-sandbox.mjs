// scripts/_tmp/probe-mig-311-sandbox.mjs
//
// READ-ONLY probe of mig 311 (nex_business_stripe_connect) against
// sandbox kdstoyyeygcopkogqsyv. Owner-authorised 2026-11-10 as the
// P1 read-only first step of the Merchant-Owned Payments plan.
//
// Reports:
//   · nex_migration_history row for '311'
//   · nex_business column presence (stripe_connect_account_id,
//     charges_enabled, payouts_enabled, country, etc. — the full
//     sealed set per the migration file)
//   · CHECK constraints + indices added by 311
//   · Existing nex_business row count with a non-null
//     stripe_connect_account_id (if column exists)
//   · Which match / which drift from the authored migration file

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = env("SANDBOX_DATABASE_URL");
const u = new URL(databaseUrl);
const ref = u.username.match(/\.([a-z0-9]{15,})/)?.[1]
  ?? u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(2); }
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · unknown ref ${ref}`); process.exit(2); }
console.log(`Target · sandbox ${ref}\n`);

const c = new Client({ connectionString: databaseUrl });
await c.connect();
async function q(sql, params = []) { return (await c.query(sql, params)).rows; }

// [1] migration history row
const hist = await q(
  "SELECT version, description, applied_at FROM nex_migration_history WHERE version = '311'",
);
console.log(`[1] nex_migration_history row for '311': ${hist.length === 1 ? "PRESENT" : "ABSENT"}`);
hist.forEach((r) => console.log(`    ${r.version} · ${r.description} · applied_at=${r.applied_at}`));

// [2] read the sealed migration 311 SQL to extract expected columns
const migText = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/311_nex_business_stripe_connect.sql"),
  "utf8",
);
const expectedCols = Array.from(
  migText.matchAll(/ADD COLUMN IF NOT EXISTS\s+(\w+)/gi),
  (m) => m[1],
);
console.log(`\n[2] Columns authored by mig 311 (${expectedCols.length}):`);
expectedCols.forEach((c) => console.log(`    ${c}`));

// [3] actual columns on nex_business matching the expected set
const colRows = await q(
  `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='nex_business'
      AND column_name = ANY($1)
    ORDER BY column_name`,
  [expectedCols],
);
console.log(`\n[3] Columns present on public.nex_business (${colRows.length} of ${expectedCols.length}):`);
colRows.forEach((r) => console.log(`    ${r.column_name.padEnd(36)} ${r.data_type.padEnd(28)} nullable=${r.is_nullable}`));

const presentSet = new Set(colRows.map((r) => r.column_name));
const missing = expectedCols.filter((c) => !presentSet.has(c));
console.log(`\n[4] Missing columns (${missing.length}):`);
missing.forEach((c) => console.log(`    ✗ ${c}`));

// [5] CHECK constraints added by 311 (search by name pattern)
const checks = await q(
  `SELECT conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint
    WHERE conrelid='public.nex_business'::regclass
      AND conname ILIKE 'ck_%stripe%'
    ORDER BY conname`,
);
console.log(`\n[5] CHECK constraints matching 'stripe' on nex_business (${checks.length}):`);
checks.forEach((r) => console.log(`    ${r.conname}\n      ${r.def}`));

// [6] indices on nex_business referencing stripe columns
const idx = await q(
  `SELECT indexname, indexdef
     FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='nex_business'
      AND indexname ILIKE '%stripe%'
    ORDER BY indexname`,
);
console.log(`\n[6] Indices on nex_business referencing stripe (${idx.length}):`);
idx.forEach((r) => console.log(`    ${r.indexname}\n      ${r.indexdef}`));

// [7] existing businesses with a non-null stripe_connect_account_id
if (presentSet.has("stripe_connect_account_id")) {
  const connected = await q(
    `SELECT COUNT(*)::int AS n
       FROM public.nex_business
      WHERE stripe_connect_account_id IS NOT NULL`,
  );
  console.log(`\n[7] Businesses with stripe_connect_account_id set: ${connected[0]?.n ?? 0}`);
} else {
  console.log(`\n[7] stripe_connect_account_id column not present · skipping row count`);
}

await c.end();

// [8] Verdict
console.log(`\n[8] VERDICT`);
if (hist.length === 1 && missing.length === 0) {
  console.log(`    ✓ Migration 311 appears FULLY APPLIED and columns match the authored set.`);
} else if (hist.length === 1 && missing.length > 0) {
  console.log(`    ⚠ History row present BUT ${missing.length} authored column(s) missing · possible drift or partial apply.`);
} else if (hist.length === 0 && colRows.length === 0) {
  console.log(`    ✗ Migration 311 NOT APPLIED to sandbox · no history row + no columns.`);
} else if (hist.length === 0 && colRows.length > 0) {
  console.log(`    ⚠ Columns present but no history row · migration may have been applied out-of-band or script didn't record.`);
} else {
  console.log(`    ? Mixed state · see rows above.`);
}
