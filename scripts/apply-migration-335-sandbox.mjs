// scripts/apply-migration-335-sandbox.mjs
// Apply mig 335 (revoke open EXECUTE grants on mutating SECDEF fns) to SANDBOX.
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

const sql = readFileSync(resolve(repoRoot, "nex-supabase/migrations/335_nex_revoke_open_execute_grants_mutating_secdef.sql"), "utf8");
const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 335 applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(3);
} finally {
  await c.end();
}

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const hist = await v.query("SELECT version, description FROM nex_migration_history WHERE version='335'");
  if (hist.rows.length !== 1) { console.error("✗ history row missing"); process.exit(4); }
  console.log(`✓ History: 335 · ${hist.rows[0].description.slice(0, 90)}...`);

  const targets = [
    "nex_purge_delivered_encrypted_messages",
    "nex_bridge99_create_first_message",
    "nex_allocate_handle",
    "nex_lease_generation_jobs",
    "nex_reclaim_expired_leases",
    "nex_transition_generation_job_failure",
    "nex_follow_recompute_counters",
  ];
  let anyFailed = false;
  for (const name of targets) {
    const g = await v.query(
      `SELECT grantee FROM information_schema.role_routine_grants
        WHERE routine_name=$1 AND routine_schema='public' AND privilege_type='EXECUTE' AND grantee IN ('public','anon','authenticated','PUBLIC')`,
      [name]
    );
    if (g.rows.length > 0) {
      console.error(`✗ ${name} still granted to: ${g.rows.map((r) => r.grantee).join(", ")}`);
      anyFailed = true;
    } else {
      console.log(`✓ ${name} · public/anon/authenticated revoked`);
    }
  }
  if (anyFailed) { process.exit(5); }

  // Prove service_role still has EXECUTE
  for (const name of targets) {
    const g = await v.query(
      `SELECT COUNT(*)::int AS n FROM information_schema.role_routine_grants
        WHERE routine_name=$1 AND routine_schema='public' AND privilege_type='EXECUTE' AND grantee='service_role'`,
      [name]
    );
    if (g.rows[0].n < 1) { console.error(`✗ ${name} lost service_role EXECUTE`); process.exit(6); }
  }
  console.log(`✓ service_role EXECUTE preserved on all 7 functions`);
} finally {
  await v.end();
}
console.log("\nMig 335 sandbox apply + verification complete.");
