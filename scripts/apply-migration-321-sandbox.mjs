// scripts/apply-migration-321-sandbox.mjs
// Apply mig 321 (nex-merchant-qr private bucket RLS) to SANDBOX.
// Requires bucket to exist first: node scripts/create-sandbox-bucket-merchant-qr.mjs
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

const sql = readFileSync(resolve(repoRoot, "nex-supabase/migrations/321_nex_merchant_qr_bucket.sql"), "utf8");
const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 321 applied · committed");
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
  const policies = await v.query(
    `SELECT policyname, permissive, roles FROM pg_policies
      WHERE schemaname='storage' AND tablename='objects'
        AND policyname LIKE 'nex_merchant_qr_%'
      ORDER BY policyname`
  );
  if (policies.rows.length < 3) {
    console.error(`✗ Expected 3+ merchant-qr policies · got ${policies.rows.length}`);
    for (const p of policies.rows) console.error(`  - ${p.policyname} · ${p.permissive} · ${p.roles}`);
    process.exit(4);
  }
  console.log(`✓ Merchant-QR bucket policies present (${policies.rows.length}):`);
  for (const p of policies.rows) console.log(`  - ${p.policyname} · ${p.permissive} · ${p.roles}`);
} finally {
  await v.end();
}
console.log("\nMig 321 sandbox apply + verification complete.");
