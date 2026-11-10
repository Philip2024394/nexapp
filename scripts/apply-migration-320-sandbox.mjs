// scripts/apply-migration-320-sandbox.mjs
// Apply mig 320 (nex_order.payment_method column) to SANDBOX.
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
const ref = u.username.match(/\.([a-z0-9]{15,})/)?.[1]
  ?? u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(2); }
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · unknown ref ${ref}`); process.exit(2); }
console.log(`Target · sandbox ${ref}`);

const sql = readFileSync(resolve(repoRoot, "nex-supabase/migrations/320_nex_order_payment_method.sql"), "utf8");
const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 320 applied · committed");
} catch (e) {
  if (!/already exists|duplicate|already recorded/i.test(e?.message ?? "")) {
    console.error("Apply failed:", e?.message);
    process.exit(3);
  }
  console.log(`(idempotent: ${e.message})`);
} finally {
  await c.end();
}

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const col = await v.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_order' AND column_name='payment_method'`
  );
  if (col.rows.length !== 1) { console.error("✗ payment_method column missing"); process.exit(4); }
  console.log(`✓ payment_method column on nex_order`);

  const chk = await v.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid='public.nex_order'::regclass
        AND pg_get_constraintdef(oid) ILIKE '%payment_method%'`
  );
  if (chk.rows.length < 1) { console.error("✗ payment_method CHECK missing"); process.exit(5); }
  console.log(`✓ CHECK present: ${chk.rows[0].def.slice(0, 100)}...`);
} finally {
  await v.end();
}
console.log("\nMig 320 sandbox apply + verification complete.");
