// scripts/apply-migration-286-sandbox.mjs
//
// Owner-authorised 2026-11-27 (phrase variant "approve mig 286 sandbox"
// in user message of 2026-11-27 · interpreted as the sealed
// `APPROVE MIG 286 SANDBOX APPLY` token · recorded for audit in
// NEX-DELIVERY-LEDGER task #120).
//
// Applies nex-supabase/migrations/286_nex_business_operating_country.sql
// to SANDBOX ONLY (kdstoyyeygcopkogqsyv). Hard-rejects on production ref.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found in .env.local`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = env("SANDBOX_DATABASE_URL");
const u = new URL(databaseUrl);
const refFromUser = u.username.match(/\.([a-z0-9]{15,})/)?.[1] ?? null;
const refFromHost = u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1] ?? null;
const ref = refFromUser ?? refFromHost;
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(2); }
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · unknown ref ${ref}`); process.exit(2); }
console.log(`Target · sandbox ${ref}`);

const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/286_nex_business_operating_country.sql"),
  "utf8",
);

// Apply
const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  // The SQL file already carries its own begin/commit — do not double-wrap.
  await c.query(sql);
  console.log("Migration applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(3);
} finally {
  await c.end();
}

// Verify
const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const col = await v.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_business'
        AND column_name='operating_country_code'`,
  );
  if (col.rows.length !== 1) {
    console.error("FAIL · column operating_country_code not present after apply");
    process.exit(4);
  }
  const check = await v.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname='nex_business_operating_country_valid'`,
  );
  if (check.rows.length !== 1) {
    console.error("FAIL · CHECK constraint not present after apply");
    process.exit(4);
  }
  const backfill = await v.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE operating_country_code IS NOT NULL)::int AS backfilled,
       COUNT(*) FILTER (WHERE operating_country_code IS NULL)::int AS still_null
       FROM nex_business`,
  );
  const comment = await v.query(
    `SELECT col_description('public.nex_business'::regclass,
       (SELECT attnum FROM pg_attribute
         WHERE attrelid='public.nex_business'::regclass
           AND attname='operating_country_code')) AS comment`,
  );
  console.log(`✓ Column: ${JSON.stringify(col.rows[0])}`);
  console.log(`✓ CHECK: ${check.rows[0].conname} · ${check.rows[0].def}`);
  console.log(
    `✓ Backfill · total=${backfill.rows[0].total} · backfilled=${backfill.rows[0].backfilled} · still_null=${backfill.rows[0].still_null}`,
  );
  console.log(`✓ Column comment present: ${Boolean(comment.rows[0].comment)}`);
} finally {
  await v.end();
}
console.log("DONE · sandbox migration 286 applied + verified");
