// scripts/apply-migration-326-sandbox.mjs
// Apply mig 326 (nex_peer_message_expire_undelivered function) to SANDBOX.
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
  resolve(repoRoot, "nex-supabase/migrations/326_nex_peer_message_expiry_sweep_PROPOSAL.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 326 applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(3);
} finally {
  await c.end();
}

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const fn = await v.query(
    `SELECT prosecdef, proconfig FROM pg_proc
      WHERE proname='nex_peer_message_expire_undelivered'
        AND pronamespace='public'::regnamespace`
  );
  if (fn.rows.length < 1) {
    console.error("✗ Function missing");
    process.exit(4);
  }
  console.log(`✓ Function nex_peer_message_expire_undelivered present · SECURITY DEFINER=${fn.rows[0].prosecdef}`);

  const grants = await v.query(
    `SELECT grantee, privilege_type FROM information_schema.role_routine_grants
      WHERE routine_name = 'nex_peer_message_expire_undelivered'`
  );
  const other = grants.rows.filter((r) => ["public", "anon", "authenticated"].includes(r.grantee) && r.privilege_type === "EXECUTE");
  if (other.length > 0) {
    console.error(`✗ Non-service roles granted EXECUTE: ${other.map((r) => r.grantee).join(", ")}`);
    process.exit(5);
  }
  console.log(`✓ No public/anon/authenticated EXECUTE grant`);

  // Idempotent call test: should return 0 since no rows meet criteria in sandbox.
  const r = await v.query("SELECT nex_peer_message_expire_undelivered() AS rowcount");
  console.log(`✓ Function callable · returned rowcount=${r.rows[0].rowcount}`);
} finally {
  await v.end();
}
console.log("\nMig 326 sandbox apply + verification complete.");
