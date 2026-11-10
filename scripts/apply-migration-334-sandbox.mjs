// scripts/apply-migration-334-sandbox.mjs
// Apply mig 334 (payment_method history correction) to SANDBOX.
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

const sql = readFileSync(resolve(repoRoot, "nex-supabase/migrations/334_nex_order_payment_method_history_correction.sql"), "utf8");
const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 334 applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(3);
} finally {
  await c.end();
}

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const hist = await v.query(
    "SELECT version, description FROM nex_migration_history WHERE version = '334'",
  );
  if (hist.rows.length !== 1) { console.error("✗ history row missing"); process.exit(4); }
  console.log(`✓ History: 334 · ${hist.rows[0].description}`);

  const col = await v.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='nex_order' AND column_name='payment_method'`
  );
  if (col.rows.length !== 1) { console.error("✗ column missing"); process.exit(5); }
  console.log(`✓ payment_method column present`);

  const chk = await v.query(
    `SELECT conname FROM pg_constraint WHERE conrelid='public.nex_order'::regclass AND conname='nex_order_payment_method_check'`
  );
  if (chk.rows.length !== 1) { console.error("✗ named CHECK missing"); process.exit(6); }
  console.log(`✓ CHECK nex_order_payment_method_check present`);
} finally {
  await v.end();
}
console.log("\nMig 334 sandbox apply + verification complete.");
