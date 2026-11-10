// scripts/apply-migration-322-sandbox.mjs
// Apply mig 322 (nex_payment_provider_config) to SANDBOX.
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

const sql = readFileSync(resolve(repoRoot, "nex-supabase/migrations/322_nex_payment_provider_config_PROPOSAL.sql"), "utf8");
const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 322 applied · committed");
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
  const tbl = await v.query("SELECT 1 FROM pg_class WHERE relname='nex_payment_provider_config' AND relnamespace='public'::regnamespace");
  if (tbl.rows.length !== 1) { console.error("✗ Table missing"); process.exit(4); }
  console.log(`✓ Table nex_payment_provider_config present`);
  const rls = await v.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.nex_payment_provider_config'::regclass");
  if (rls.rows[0]?.relrowsecurity !== true) { console.error("✗ RLS not enabled"); process.exit(5); }
  console.log(`✓ RLS enabled`);
} finally {
  await v.end();
}
console.log("\nMig 322 sandbox apply + verification complete.");
