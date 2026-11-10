// scripts/apply-migration-325-sandbox.mjs
// Apply mig 325 (nex_chat_encryption_adoption_v) to SANDBOX.
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
  resolve(repoRoot, "nex-supabase/migrations/325_nex_chat_adoption_metric_PROPOSAL.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 325 applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(3);
} finally {
  await c.end();
}

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const mv = await v.query(
    "SELECT matviewname FROM pg_matviews WHERE matviewname='nex_chat_encryption_adoption_v'"
  );
  if (mv.rows.length !== 1) {
    console.error("✗ Materialized view missing");
    process.exit(4);
  }
  console.log(`✓ Materialized view nex_chat_encryption_adoption_v present`);

  // Can we select from it? (It may return zero rows but should not error.)
  await v.query("SELECT COUNT(*) FROM nex_chat_encryption_adoption_v");
  console.log(`✓ SELECT from view works`);
} finally {
  await v.end();
}
console.log("\nMig 325 sandbox apply + verification complete.");
