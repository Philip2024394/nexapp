// scripts/apply-migration-274-sandbox.mjs
//
// Owner-authorised 2026-11-12 · apply migration 274
// (nex_account_profile.about_me text column + 500-char CHECK) to
// SANDBOX only. Hard-refuses the production ref.

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
  resolve(repoRoot, "nex-supabase/migrations/274_nex_account_profile_about_me.sql"),
  "utf8",
);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 274 applied · committed");
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
    "SELECT version, description FROM nex_migration_history WHERE version = '274'",
  );
  if (hist.rows.length !== 1) {
    console.error("VERIFY FAILED · nex_migration_history row for 274 missing");
    process.exit(4);
  }
  console.log(`✓ History: 274 · ${hist.rows[0].description}`);

  const cols = await v.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
     WHERE table_schema='public' AND table_name='nex_account_profile' AND column_name='about_me'`,
  );
  if (cols.rows.length !== 1 || cols.rows[0].data_type !== "text") {
    console.error("VERIFY FAILED · about_me column missing or wrong type");
    process.exit(5);
  }
  console.log(`✓ Column: about_me ${cols.rows[0].data_type} nullable=${cols.rows[0].is_nullable}`);

  const chk = await v.query(
    `SELECT constraint_name FROM information_schema.table_constraints
     WHERE table_schema='public' AND table_name='nex_account_profile'
       AND constraint_name='nex_account_profile_about_me_max'`,
  );
  if (chk.rows.length !== 1) {
    console.error("VERIFY FAILED · CHECK constraint missing");
    process.exit(6);
  }
  console.log(`✓ CHECK constraint present`);
} finally {
  await v.end();
}
