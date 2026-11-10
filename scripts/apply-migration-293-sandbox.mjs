// scripts/apply-migration-293-sandbox.mjs
//
// Phase 0 Security · apply mig 293 (nex_security_audit_reconcile_unmatched
// SECURITY DEFINER RPC) to SANDBOX. Hard-refuses production ref.

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
  resolve(repoRoot, "nex-supabase/migrations/293_nex_security_audit_reconcile.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 293 applied · committed");
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
    "SELECT version, description FROM nex_migration_history WHERE version = '293'",
  );
  if (hist.rows.length !== 1) {
    console.error("VERIFY FAILED · history row missing");
    process.exit(4);
  }
  console.log(`✓ History: 293 · ${hist.rows[0].description}`);

  const sig = await v.query(
    `SELECT prosecdef, proconfig, pg_get_function_result(oid) AS rtype
       FROM pg_proc
      WHERE proname = 'nex_security_audit_reconcile_unmatched'
        AND pronamespace = 'public'::regnamespace`,
  );
  if (sig.rows.length !== 1) {
    console.error(`✗ RPC not found or duplicated · rows=${sig.rows.length}`);
    process.exit(5);
  }
  if (sig.rows[0].prosecdef !== true) {
    console.error("✗ Function is not SECURITY DEFINER");
    process.exit(6);
  }
  const config = (sig.rows[0].proconfig || []).join(" ");
  if (!config.includes("search_path=")) {
    console.error(`✗ search_path not pinned · proconfig=${config}`);
    process.exit(7);
  }
  console.log(`✓ Function present · SECURITY DEFINER · search_path pinned · returns ${sig.rows[0].rtype}`);

  const grants = await v.query(
    `SELECT grantee, privilege_type FROM information_schema.role_routine_grants
      WHERE routine_name = 'nex_security_audit_reconcile_unmatched'`
  );
  const serviceRoleHas = grants.rows.some((r) => r.grantee === "service_role" && r.privilege_type === "EXECUTE");
  const otherGrants = grants.rows.filter((r) => ["public", "anon", "authenticated"].includes(r.grantee) && r.privilege_type === "EXECUTE");
  if (!serviceRoleHas) {
    console.error("✗ service_role missing EXECUTE grant");
    process.exit(8);
  }
  if (otherGrants.length > 0) {
    console.error(`✗ Non-service-role roles have EXECUTE: ${otherGrants.map((r) => r.grantee).join(", ")}`);
    process.exit(9);
  }
  console.log(`✓ EXECUTE granted service_role only`);
} finally {
  await v.end();
}

console.log("\nMig 293 sandbox apply + verification complete.");
