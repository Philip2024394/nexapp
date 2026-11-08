// scripts/apply-migration-308-sandbox.mjs
//
// Owner-authorised 2026-11-08 (round 29) · NEX Shop capacity metering.
// Applies 308_nex_business_storage_metering.sql to SANDBOX ONLY.
// Hard-refuses production per sealed boundary rule.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
const refFromUser = u.username.match(/\.([a-z0-9]{15,})/)?.[1] ?? null;
const refFromHost = u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1] ?? null;
const ref = refFromUser ?? refFromHost;
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(2); }
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · unknown ref ${ref}`); process.exit(2); }
console.log(`Target · sandbox ${ref}`);

const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/308_nex_business_storage_metering.sql"),
  "utf8",
);
const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query("BEGIN");
  await c.query(sql);
  await c.query("COMMIT");
  console.log("Migration applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  try { await c.query("ROLLBACK"); } catch {}
  process.exit(3);
} finally {
  await c.end();
}

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const cols = await v.query(
    `SELECT column_name, is_nullable, data_type, column_default
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_business'
        AND column_name IN ('storage_bytes_used','bandwidth_bytes_month','storage_pack_bytes','bandwidth_pack_bytes','bandwidth_period_start')
      ORDER BY column_name`,
  );
  const fns = await v.query(
    `SELECT routine_name FROM information_schema.routines
      WHERE routine_schema='public' AND routine_name IN (
        'nex_shop_increment_storage_bytes',
        'nex_shop_increment_bandwidth_bytes',
        'nex_shop_bandwidth_rollover'
      ) ORDER BY routine_name`,
  );
  const grants = await v.query(
    `SELECT routine_name, grantee, privilege_type
       FROM information_schema.routine_privileges
      WHERE routine_schema='public' AND grantee='service_role'
        AND routine_name IN (
          'nex_shop_increment_storage_bytes',
          'nex_shop_increment_bandwidth_bytes',
          'nex_shop_bandwidth_rollover'
        ) ORDER BY routine_name`,
  );
  const hist = await v.query(
    `SELECT version, description FROM nex_migration_history WHERE version='308'`,
  );
  const check = await v.query(
    `SELECT conname FROM pg_constraint WHERE conname='ck_nex_business_storage_nonneg'`,
  );
  console.log(`✓ Columns:`);
  for (const r of cols.rows) console.log(`    - ${r.column_name} · nullable=${r.is_nullable} · ${r.data_type} · default=${r.column_default}`);
  console.log(`✓ Functions: ${fns.rows.map((r) => r.routine_name).join(", ")}`);
  console.log(`✓ service_role grants: ${grants.rows.length}`);
  console.log(`✓ CHECK constraint: ${check.rows[0]?.conname ?? "MISSING"}`);
  console.log(`✓ History: ${hist.rows[0]?.version} · ${hist.rows[0]?.description}`);
} finally {
  await v.end();
}
console.log("DONE · sandbox migration 308 applied + verified");
