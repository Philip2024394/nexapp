// scripts/apply-migration-327-sandbox.mjs
// Apply mig 327 (nex_ciphertext_orphan_scan table + RLS) to SANDBOX.
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
  resolve(repoRoot, "nex-supabase/migrations/327_nex_ciphertext_orphan_scan_PROPOSAL.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 327 applied · committed");
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
  const tbl = await v.query(
    "SELECT 1 FROM pg_class WHERE relname='nex_ciphertext_orphan_scan' AND relnamespace='public'::regnamespace"
  );
  if (tbl.rows.length !== 1) {
    console.error("✗ Table missing");
    process.exit(4);
  }
  console.log(`✓ Table nex_ciphertext_orphan_scan present`);

  const rls = await v.query(
    "SELECT relrowsecurity FROM pg_class WHERE oid='public.nex_ciphertext_orphan_scan'::regclass"
  );
  if (rls.rows[0]?.relrowsecurity !== true) {
    console.error("✗ RLS not enabled");
    process.exit(5);
  }
  console.log(`✓ RLS enabled`);

  const idx = await v.query(
    "SELECT indexname FROM pg_indexes WHERE indexname='nex_ciphertext_orphan_scan_started_idx'"
  );
  if (idx.rows.length !== 1) {
    console.error("✗ Started-at index missing");
    process.exit(6);
  }
  console.log(`✓ Index nex_ciphertext_orphan_scan_started_idx present`);
} finally {
  await v.end();
}
console.log("\nMig 327 sandbox apply + verification complete.");
