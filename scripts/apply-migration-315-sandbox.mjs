// scripts/apply-migration-315-sandbox.mjs
//
// Phase 2 Support Tickets · apply mig 315 to SANDBOX. Owner authorised
// 2026-11-10. Hard refuses production kdstoyyeygcopkogqsyv pattern
// mirrors mig 313/314.

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
  resolve(repoRoot, "nex-supabase/migrations/315_nex_support_ticket.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 315 applied · committed");
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
    "SELECT version, description FROM nex_migration_history WHERE version = '315'",
  );
  if (hist.rows.length !== 1) { console.error("✗ history row missing"); process.exit(4); }
  console.log(`✓ History: 315 · ${hist.rows[0].description}`);

  for (const t of ["support_ticket", "support_message", "support_admin_grant"]) {
    const r = await v.query(
      "SELECT 1 FROM pg_tables WHERE schemaname='nex' AND tablename=$1",
      [t],
    );
    if (r.rows.length !== 1) { console.error(`✗ table nex.${t} missing`); process.exit(5); }
    console.log(`✓ Table · nex.${t}`);
  }

  const trig = await v.query(
    `SELECT tgname FROM pg_trigger WHERE tgrelid='nex.support_ticket'::regclass
       AND tgname='trg_nex_support_ticket_touch_updated_at'`,
  );
  if (trig.rows.length !== 1) { console.error("✗ touch trigger missing"); process.exit(6); }
  console.log(`✓ Trigger · trg_nex_support_ticket_touch_updated_at`);

  const grants = await v.query(
    `SELECT grantee, privilege_type
       FROM information_schema.role_table_grants
      WHERE table_schema='nex'
        AND table_name IN ('support_ticket','support_message','support_admin_grant')
        AND grantee IN ('anon','authenticated')`,
  );
  if (grants.rows.length !== 0) {
    console.error(`✗ anon/authenticated still hold grants: ${JSON.stringify(grants.rows)}`);
    process.exit(7);
  }
  console.log(`✓ Grants · anon + authenticated REVOKED on all 3 tables`);
} finally {
  await v.end();
}

console.log("\nMig 315 sandbox apply + verification complete.");
