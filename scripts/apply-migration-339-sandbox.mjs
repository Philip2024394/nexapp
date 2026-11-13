// scripts/apply-migration-339-sandbox.mjs
//
// Owner-authorised DRAFT 2026-11-12 · NOT TO BE RUN until owner says so.
// Applies migration 339 (7 Ireland profile fields) to SANDBOX only.
// Hard-refuses the production project ref `ijvqdvsvwtwxzcqmoqit`.
//
// Pattern copied verbatim from the sealed apply-migration-274-sandbox.mjs
// script that applied the about_me column earlier the same day.

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
  resolve(repoRoot, "nex-supabase/migrations/339_nex_account_profile_ireland_fields.sql"),
  "utf8",
);

const preCount = async () => {
  const c = new Client({ connectionString: databaseUrl });
  await c.connect();
  const r = await c.query("SELECT COUNT(*)::int AS n FROM nex_account_profile");
  await c.end();
  return r.rows[0].n;
};
const rowsBefore = await preCount();
console.log(`Pre-apply row count · nex_account_profile · ${rowsBefore}`);

const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query(sql);
  console.log("Migration 339 applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  process.exit(3);
} finally {
  await c.end();
}

// ─── Verification ─────────────────────────────────────────────────────────
const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const expectedColumns = [
    "country_code",
    "address",
    "instagram_handle",
    "tiktok_handle",
    "facebook_handle",
    "x_handle",
    "youtube_handle",
  ];
  for (const col of expectedColumns) {
    const r = await v.query(
      `SELECT data_type, is_nullable FROM information_schema.columns
        WHERE table_schema='public' AND table_name='nex_account_profile'
          AND column_name=$1`,
      [col],
    );
    if (r.rows.length !== 1 || r.rows[0].data_type !== "text" || r.rows[0].is_nullable !== "YES") {
      console.error(`VERIFY FAILED · ${col} missing or wrong type/nullable`);
      process.exit(4);
    }
    console.log(`✓ Column · ${col} · text · nullable=YES`);
  }

  const expectedChecks = [
    "nex_account_profile_country_code_iso2",
    "nex_account_profile_address_len",
    "nex_account_profile_instagram_handle_len",
    "nex_account_profile_tiktok_handle_len",
    "nex_account_profile_facebook_handle_len",
    "nex_account_profile_x_handle_len",
    "nex_account_profile_youtube_handle_len",
  ];
  for (const name of expectedChecks) {
    const r = await v.query(
      `SELECT 1 FROM pg_constraint
        WHERE conrelid='public.nex_account_profile'::regclass
          AND conname=$1 AND contype='c'`,
      [name],
    );
    if (r.rows.length !== 1) {
      console.error(`VERIFY FAILED · CHECK ${name} missing`);
      process.exit(5);
    }
    console.log(`✓ CHECK · ${name}`);
  }

  const hist = await v.query(
    "SELECT version, description FROM nex_migration_history WHERE version='339'",
  );
  if (hist.rows.length !== 1) {
    console.error("VERIFY FAILED · migration_history row for 339 missing");
    process.exit(6);
  }
  console.log(`✓ History · 339 · ${hist.rows[0].description}`);

  const rowsAfter = (await v.query("SELECT COUNT(*)::int AS n FROM nex_account_profile")).rows[0].n;
  if (rowsAfter !== rowsBefore) {
    console.error(`VERIFY FAILED · row count changed · before=${rowsBefore} after=${rowsAfter}`);
    process.exit(7);
  }
  console.log(`✓ Row count unchanged · ${rowsAfter}`);

  // All existing rows should have NULL for the new columns
  const nulls = await v.query(
    `SELECT COUNT(*)::int AS n FROM nex_account_profile
      WHERE country_code IS NULL AND address IS NULL
        AND instagram_handle IS NULL AND tiktok_handle IS NULL
        AND facebook_handle IS NULL AND x_handle IS NULL
        AND youtube_handle IS NULL`,
  );
  if (nulls.rows[0].n !== rowsAfter) {
    console.error(`VERIFY FAILED · ${rowsAfter - nulls.rows[0].n} rows have non-NULL in new columns · expected all NULL`);
    process.exit(8);
  }
  console.log(`✓ All ${rowsAfter} existing rows unchanged (NULL in new columns)`);

  console.log("\nMigration 339 · APPLIED + VERIFIED on sandbox");
} finally {
  await v.end();
}
