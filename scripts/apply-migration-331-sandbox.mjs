// scripts/apply-migration-331-sandbox.mjs
// Apply mig 331 (audit RLS defence-in-depth) to sandbox. Hard-refuses prod.

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
  resolve(repoRoot, "nex-supabase/migrations/331_nex_security_audit_rls_defence_in_depth.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 331 applied · committed");
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
    "SELECT version, description FROM nex_migration_history WHERE version = '331'",
  );
  if (hist.rows.length !== 1) {
    console.error("VERIFY FAILED · history row missing");
    process.exit(4);
  }
  console.log(`✓ History: 331 · ${hist.rows[0].description}`);

  for (const t of ["nex_security_audit_retention", "nex_security_audit_reconciliation"]) {
    const rls = await v.query(
      "SELECT relrowsecurity FROM pg_class WHERE oid=('public.' || $1)::regclass",
      [t],
    );
    if (rls.rows[0]?.relrowsecurity !== true) {
      console.error(`✗ RLS still not enabled on ${t}`);
      process.exit(5);
    }
  }
  console.log(`✓ RLS now enabled on both sibling audit tables`);
} finally {
  await v.end();
}

console.log("\nMig 331 sandbox apply + verification complete.");
