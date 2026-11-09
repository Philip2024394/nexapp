// scripts/apply-migration-320-sandbox.mjs
//
// Phase 2 Sprint 1 · apply mig 320 (nex_device registry) to SANDBOX.
// Owner-authorised 2026-11-09 under sandbox-only conditions.
// Hard-refuses production ref (ijvqdvsvwtwxzcqmoqit).

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

const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/320_nex_device_registry.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 320 applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(3);
} finally {
  await c.end();
}

// Verification
const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  // V-F2-T1a · history row present
  const hist = await v.query(
    "SELECT version, description FROM nex_migration_history WHERE version = '320'",
  );
  if (hist.rows.length !== 1) {
    console.error("VERIFY FAILED · nex_migration_history row for 320 missing");
    process.exit(4);
  }
  console.log(`✓ History: 320 · ${hist.rows[0].description}`);

  // V-F2-T1b · table exists with expected shape
  const cols = await v.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'nex_device'
      ORDER BY ordinal_position`
  );
  const names = cols.rows.map((r) => r.column_name);
  const expected = [
    "id", "account_id", "public_key", "key_algorithm",
    "device_nickname", "last_seen_at", "created_at", "revoked_at",
  ];
  const missing = expected.filter((e) => !names.includes(e));
  const unexpected = names.filter((n) => !expected.includes(n));
  if (missing.length > 0 || unexpected.length > 0) {
    console.error(`✗ Shape mismatch · missing=[${missing.join(",")}] unexpected=[${unexpected.join(",")}]`);
    process.exit(5);
  }
  console.log(`✓ Table shape correct · 8 columns · ${names.join(", ")}`);

  // V-F2-T1c · I-1 invariant · no forbidden content columns
  const forbidden = ["body", "ciphertext", "message_body", "attachment_bytes", "plaintext", "content"];
  const hasForbidden = names.filter((n) => forbidden.includes(n));
  if (hasForbidden.length > 0) {
    console.error(`✗ I-1 VIOLATION · forbidden columns present: ${hasForbidden.join(", ")}`);
    process.exit(6);
  }
  console.log(`✓ I-1 compliance · zero forbidden content columns`);

  // V-F2-T1d · RLS enabled
  const rls = await v.query(
    `SELECT relrowsecurity FROM pg_class WHERE relname = 'nex_device' AND relnamespace = 'public'::regnamespace`
  );
  if (!rls.rows[0]?.relrowsecurity) {
    console.error(`✗ RLS NOT enabled on nex_device`);
    process.exit(7);
  }
  console.log(`✓ RLS enabled on nex_device`);

  // V-F2-T1e · role grants · service_role only
  const grants = await v.query(
    `SELECT grantee, privilege_type
       FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name   = 'nex_device'
        AND grantee IN ('anon', 'authenticated', 'service_role')`
  );
  const grantSet = new Set(grants.rows.map((r) => `${r.grantee}:${r.privilege_type}`));
  const anonHasAny = Array.from(grantSet).some((g) => g.startsWith("anon:"));
  const authHasAny = Array.from(grantSet).some((g) => g.startsWith("authenticated:"));
  if (anonHasAny || authHasAny) {
    console.error(`✗ Role grants · anon or authenticated has access: ${Array.from(grantSet).join(", ")}`);
    process.exit(8);
  }
  const serviceGrants = Array.from(grantSet).filter((g) => g.startsWith("service_role:"));
  const expectedServiceGrants = ["SELECT", "INSERT", "UPDATE", "DELETE"];
  const missingSvc = expectedServiceGrants.filter((p) => !serviceGrants.includes(`service_role:${p}`));
  if (missingSvc.length > 0) {
    console.error(`✗ service_role missing grants: ${missingSvc.join(", ")}`);
    process.exit(9);
  }
  console.log(`✓ Role grants · service_role has SELECT/INSERT/UPDATE/DELETE · anon+authenticated denied`);

  // V-F2-T1f · indexes present
  const idx = await v.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'nex_device' ORDER BY indexname`
  );
  const idxNames = idx.rows.map((r) => r.indexname);
  const expectedIdx = [
    "nex_device_pkey",
    "nex_device_account_id_active_idx",
    "nex_device_account_pubkey_active_unique",
  ];
  const missingIdx = expectedIdx.filter((e) => !idxNames.includes(e));
  if (missingIdx.length > 0) {
    console.error(`✗ Missing indexes: ${missingIdx.join(", ")}`);
    process.exit(10);
  }
  console.log(`✓ Indexes present · ${idxNames.join(", ")}`);

  // V-F2-T1g · zero rows at apply time (clean table)
  const count = await v.query(`SELECT COUNT(*)::int AS n FROM nex_device`);
  if (count.rows[0].n !== 0) {
    console.error(`✗ nex_device has ${count.rows[0].n} rows at apply time · expected 0`);
    process.exit(11);
  }
  console.log(`✓ nex_device · 0 rows (clean apply)`);
} finally {
  await v.end();
}

console.log("\nMig 320 sandbox apply + verification complete · V-F2-T1 all green.");
