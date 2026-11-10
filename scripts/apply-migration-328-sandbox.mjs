// scripts/apply-migration-328-sandbox.mjs
// Apply mig 328 (nex_peer_message_encrypted_true NOT VALID) to SANDBOX.
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

const sql = readFileSync(resolve(repoRoot, "nex-supabase/migrations/328_nex_peer_message_encrypted_check_NOT_VALID_PROPOSAL.sql"), "utf8");
const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 328 applied · committed");
} catch (e) {
  if (!/already exists|duplicate|already recorded/i.test(e?.message ?? "")) {
    console.error("Apply failed:", e?.message);
    process.exit(3);
  }
  console.log(`(idempotent: ${e.message})`);
} finally {
  await c.end();
}

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const c = await v.query(
    "SELECT convalidated FROM pg_constraint WHERE conname='nex_peer_message_encrypted_true' AND conrelid='public.nex_peer_message'::regclass"
  );
  if (c.rows.length < 1) { console.error("✗ CHECK constraint missing"); process.exit(4); }
  if (c.rows[0].convalidated !== false) {
    console.error(`✗ Constraint should be NOT VALID · convalidated=${c.rows[0].convalidated}`);
    process.exit(5);
  }
  console.log(`✓ CHECK nex_peer_message_encrypted_true present · convalidated=false (NOT VALID)`);
} finally {
  await v.end();
}
console.log("\nMig 328 sandbox apply + verification complete.");
