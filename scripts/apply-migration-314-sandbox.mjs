// scripts/apply-migration-314-sandbox.mjs
//
// Step 1 follow-up · apply mig 314 (trusted_contact.enabled + updated_at)
// to SANDBOX. Owner approval required before invocation · SANDBOX ONLY ·
// hard-refuses production.

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
  resolve(repoRoot, "nex-supabase/migrations/314_nex_trusted_contact_enabled.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 314 applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(3);
} finally {
  await c.end();
}

// Verification
const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const hist = await v.query(
    "SELECT version, description FROM nex_migration_history WHERE version = '314'",
  );
  if (hist.rows.length !== 1) {
    console.error("VERIFY FAILED · nex_migration_history row for 314 missing");
    process.exit(4);
  }
  console.log(`✓ History: 314 · ${hist.rows[0].description}`);

  const cols = await v.query(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema='nex' AND table_name='trusted_contact'
        AND column_name IN ('enabled','updated_at')
      ORDER BY column_name`
  );
  if (cols.rows.length !== 2) {
    console.error(`✗ Expected 2 new columns, found ${cols.rows.length}`);
    process.exit(5);
  }
  cols.rows.forEach((r) => console.log(`✓ Column ${r.column_name} · ${r.data_type} · nullable=${r.is_nullable} · default=${r.column_default}`));

  const trig = await v.query(
    `SELECT tgname FROM pg_trigger
      WHERE tgrelid='nex.trusted_contact'::regclass
        AND tgname='trg_nex_trusted_contact_touch_updated_at'`
  );
  if (trig.rows.length !== 1) {
    console.error("✗ Touch trigger missing");
    process.exit(6);
  }
  console.log(`✓ Trigger · trg_nex_trusted_contact_touch_updated_at present`);

  const idx = await v.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname='nex' AND tablename='trusted_contact'
        AND indexname='idx_nex_trusted_contact_owner_enabled'`
  );
  if (idx.rows.length !== 1) {
    console.error("✗ Partial enabled-filter index missing");
    process.exit(7);
  }
  console.log(`✓ Index · idx_nex_trusted_contact_owner_enabled present`);
} finally {
  await v.end();
}

console.log("\nMig 314 sandbox apply + verification complete.");
