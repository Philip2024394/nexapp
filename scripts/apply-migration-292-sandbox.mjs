// scripts/apply-migration-292-sandbox.mjs
//
// Phase 0 Security · apply mig 292 (nex_security_audit_log · retention ·
// reconciliation staging tables) to SANDBOX. Hard-refuses production ref.

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
  resolve(repoRoot, "nex-supabase/migrations/292_nex_security_audit_log.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 292 applied · committed");
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
    "SELECT version, description FROM nex_migration_history WHERE version = '292'",
  );
  if (hist.rows.length !== 1) {
    console.error("VERIFY FAILED · history row missing");
    process.exit(4);
  }
  console.log(`✓ History: 292 · ${hist.rows[0].description}`);

  for (const t of ["nex_security_audit_log", "nex_security_audit_retention", "nex_security_audit_reconciliation"]) {
    const r = await v.query(
      "SELECT 1 FROM pg_class WHERE relname=$1 AND relnamespace='public'::regnamespace",
      [t],
    );
    if (r.rows.length !== 1) {
      console.error(`✗ Table missing: ${t}`);
      process.exit(5);
    }
  }
  console.log(`✓ 3 audit tables created`);

  for (const t of ["nex_security_audit_log", "nex_security_audit_retention", "nex_security_audit_reconciliation"]) {
    const rls = await v.query(
      "SELECT relrowsecurity FROM pg_class WHERE oid=('public.' || $1)::regclass",
      [t],
    );
    if (rls.rows[0]?.relrowsecurity !== true) {
      console.error(`✗ RLS not enabled on ${t}`);
      process.exit(6);
    }
  }
  console.log(`✓ RLS enabled on all 3`);
} finally {
  await v.end();
}

console.log("\nMig 292 sandbox apply + verification complete.");
