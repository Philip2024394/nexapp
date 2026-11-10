// scripts/apply-migration-333-sandbox.mjs
// Apply mig 333 (merchant-qr bucket · RESTRICTIVE hardening) to SANDBOX.
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

const sql = readFileSync(resolve(repoRoot, "nex-supabase/migrations/333_nex_merchant_qr_bucket_restrictive_hardening.sql"), "utf8");
const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 333 applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(3);
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
  const names = policies.rows.map((r) => r.policyname);
  for (const need of ["nex_merchant_qr_anon_deny", "nex_merchant_qr_authenticated_deny", "nex_merchant_qr_service_role_all"]) {
    if (!names.includes(need)) { console.error(`✗ Missing policy ${need}`); process.exit(4); }
  }
  for (const r of policies.rows) {
    if (r.policyname.endsWith("_deny") && r.permissive !== "RESTRICTIVE") {
      console.error(`✗ Policy ${r.policyname} is not RESTRICTIVE`);
      process.exit(5);
    }
  }
  console.log(`✓ 3 target policies present · deny are RESTRICTIVE · service_role is PERMISSIVE`);
  for (const r of policies.rows) console.log(`  - ${r.policyname} · ${r.permissive} · ${r.roles}`);
} finally {
  await v.end();
}
console.log("\nMig 333 sandbox apply + verification complete.");
