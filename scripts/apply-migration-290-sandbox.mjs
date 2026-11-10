// scripts/apply-migration-290-sandbox.mjs
//
// Phase 0 Security · apply mig 290 (nex_security_rate_limit counter table)
// to SANDBOX. Hard-refuses production ref.

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
  resolve(repoRoot, "nex-supabase/migrations/290_nex_security_rate_limit.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 290 applied · committed");
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
    "SELECT version, description FROM nex_migration_history WHERE version = '290'",
  );
  if (hist.rows.length !== 1) {
    console.error("VERIFY FAILED · nex_migration_history row for 290 missing");
    process.exit(4);
  }
  console.log(`✓ History: 290 · ${hist.rows[0].description}`);

  const cols = await v.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='nex_security_rate_limit'
     ORDER BY column_name`
  );
  const names = cols.rows.map((r) => r.column_name).sort();
  const expected = ["action", "count", "key", "updated_at", "window_started_at"];
  for (const e of expected) {
    if (!names.includes(e)) {
      console.error(`✗ Missing column: ${e} · got ${names.join(", ")}`);
      process.exit(5);
    }
  }
  console.log(`✓ Table columns: ${names.join(", ")}`);

  const rls = await v.query(
    "SELECT relrowsecurity FROM pg_class WHERE oid='public.nex_security_rate_limit'::regclass"
  );
  if (rls.rows[0]?.relrowsecurity !== true) {
    console.error("✗ RLS not enabled on nex_security_rate_limit");
    process.exit(6);
  }
  console.log(`✓ RLS enabled`);

  const idx = await v.query(
    "SELECT indexname FROM pg_indexes WHERE tablename='nex_security_rate_limit' AND indexname='idx_nex_security_rate_limit_window'"
  );
  if (idx.rows.length !== 1) {
    console.error("✗ Window index missing");
    process.exit(7);
  }
  console.log(`✓ Window index present`);
} finally {
  await v.end();
}

console.log("\nMig 290 sandbox apply + verification complete.");
