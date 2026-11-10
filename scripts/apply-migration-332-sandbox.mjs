// scripts/apply-migration-332-sandbox.mjs
// Apply mig 332 (expire_undelivered grant fix) to SANDBOX.
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
  resolve(repoRoot, "nex-supabase/migrations/332_nex_peer_message_expire_undelivered_grants_fix.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 332 applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(3);
} finally {
  await c.end();
}

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const grants = await v.query(
    `SELECT grantee, privilege_type FROM information_schema.role_routine_grants
      WHERE routine_name = 'nex_peer_message_expire_undelivered'`
  );
  const other = grants.rows.filter((r) => ["public", "anon", "authenticated"].includes(r.grantee) && r.privilege_type === "EXECUTE");
  if (other.length > 0) {
    console.error(`✗ Non-service roles still have EXECUTE: ${other.map((r) => r.grantee).join(", ")}`);
    process.exit(4);
  }
  const svc = grants.rows.some((r) => r.grantee === "service_role" && r.privilege_type === "EXECUTE");
  if (!svc) {
    console.error("✗ service_role missing EXECUTE");
    process.exit(5);
  }
  console.log(`✓ EXECUTE granted service_role only · public/anon/authenticated revoked`);
} finally {
  await v.end();
}
console.log("\nMig 332 sandbox apply + verification complete.");
