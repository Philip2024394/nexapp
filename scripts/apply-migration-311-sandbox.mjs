// scripts/apply-migration-311-sandbox.mjs
//
// Owner-authorised 2026-11-09 Round 31a · nex_business Stripe Connect
// columns. Applies 311 to SANDBOX ONLY · hard-refuses production.

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
  resolve(repoRoot, "nex-supabase/migrations/311_nex_business_stripe_connect.sql"),
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
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_business'
        AND column_name LIKE 'stripe_connect%'
      ORDER BY column_name`,
  );
  const hist = await v.query(
    `SELECT version, description FROM nex_migration_history WHERE version='311'`,
  );
  const expected = [
    "stripe_connect_account_id",
    "stripe_connect_charges_enabled",
    "stripe_connect_country",
    "stripe_connect_last_webhook_at",
    "stripe_connect_onboarded_at",
    "stripe_connect_payouts_enabled",
    "stripe_connect_requirements_currently_due",
  ];
  const present = cols.rows.map((r) => r.column_name).sort();
  console.log(`✓ Columns present: ${present.join(", ")}`);
  const missing = expected.filter((e) => !present.includes(e));
  if (missing.length > 0) {
    console.error(`✗ Missing columns: ${missing.join(", ")}`);
    process.exit(4);
  }
  console.log(`✓ History: ${hist.rows[0]?.version} · ${hist.rows[0]?.description}`);
} finally {
  await v.end();
}
console.log("DONE · sandbox migration 311 applied + verified");
