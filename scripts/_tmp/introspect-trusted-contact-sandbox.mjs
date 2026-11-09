// scripts/_tmp/introspect-trusted-contact-sandbox.mjs
//
// Read-only introspection against sandbox kdstoyyeygcopkogqsyv.
// Owner-authorised 2026-11-09. SANDBOX-ONLY · hard-refuses production.
// No writes. No DDL. Pure SELECT queries.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
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
console.log(`Target · sandbox ${ref}\n`);

const c = new Client({ connectionString: databaseUrl });
await c.connect();

async function q(sql, params = []) {
  const r = await c.query(sql, params);
  return r.rows;
}

// 1. Does the schema exist?
const schemas = await q("SELECT nspname FROM pg_namespace WHERE nspname = 'nex'");
console.log(`[1] nex schema: ${schemas.length === 1 ? "EXISTS" : "MISSING"}`);

// 2. Does the table exist?
const tables = await q(
  "SELECT tablename FROM pg_tables WHERE schemaname = 'nex' AND tablename = 'trusted_contact'"
);
console.log(`[2] nex.trusted_contact table: ${tables.length === 1 ? "EXISTS" : "MISSING"}`);

if (tables.length === 1) {
  const cols = await q(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema='nex' AND table_name='trusted_contact'
      ORDER BY ordinal_position`
  );
  console.log(`[3] Columns (${cols.length}):`);
  cols.forEach((r) => console.log(`    ${r.column_name.padEnd(28)} ${r.data_type.padEnd(28)} nullable=${r.is_nullable}  default=${r.column_default ?? "·"}`));

  const idx = await q(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE schemaname='nex' AND tablename='trusted_contact'
      ORDER BY indexname`
  );
  console.log(`\n[4] Indices (${idx.length}):`);
  idx.forEach((r) => console.log(`    ${r.indexname}\n      ${r.indexdef}`));

  const rls = await q(
    `SELECT relname, relrowsecurity, relforcerowsecurity
       FROM pg_class
      WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname='nex')
        AND relname = 'trusted_contact'`
  );
  console.log(`\n[5] RLS: rowsecurity=${rls[0]?.relrowsecurity}  forcerowsecurity=${rls[0]?.relforcerowsecurity}`);

  const pol = await q(
    `SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS qual, pg_get_expr(polwithcheck, polrelid) AS wcheck
       FROM pg_policy
      WHERE polrelid = 'nex.trusted_contact'::regclass`
  );
  console.log(`[6] Policies (${pol.length}):`);
  pol.forEach((r) => console.log(`    ${r.polname.padEnd(30)} cmd=${r.polcmd}\n      USING: ${r.qual ?? "·"}\n      CHECK: ${r.wcheck ?? "·"}`));

  const grants = await q(
    `SELECT grantee, privilege_type
       FROM information_schema.role_table_grants
      WHERE table_schema='nex' AND table_name='trusted_contact'
      ORDER BY grantee, privilege_type`
  );
  console.log(`\n[7] Grants (${grants.length}):`);
  grants.forEach((r) => console.log(`    ${r.grantee.padEnd(20)} ${r.privilege_type}`));
}

// 8. Migration history entry for 224
const hist = await q(
  "SELECT version, description, applied_at FROM nex_migration_history WHERE version IN ('224','225','277') ORDER BY version"
);
console.log(`\n[8] Migration history rows for 224/225/277 (${hist.length}):`);
hist.forEach((r) => console.log(`    ${r.version} · ${r.description} · applied_at=${r.applied_at}`));

// 9. Related table state
for (const t of ["emergency_incident", "incident_recipient", "emergency_location_update", "emergency_fanout_log", "emergency_responder_optin", "emergency_rate_limit"]) {
  const exists = await q(
    `SELECT 1 FROM pg_tables WHERE schemaname='nex' AND tablename=$1`,
    [t]
  );
  console.log(`[9] nex.${t}: ${exists.length === 1 ? "EXISTS" : "MISSING"}`);
}

await c.end();
