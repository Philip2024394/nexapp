// scripts/apply-migration-212.mjs
//
// One-off migration apply · owner-authorised 2026-10-20.
// Verifies project ID then applies 212_nex_business_shop_cover_overrides.sql
// against the sealed Supabase project ijvqdvsvwtwxzcqmoqit.

import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envRaw = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
const env = Object.fromEntries(
  envRaw.split(/\r?\n/).filter(Boolean).filter((l) => !l.startsWith("#")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1)];
  }),
);
const url = env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing from .env.local");
  process.exit(1);
}
if (!url.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error(`FATAL · DATABASE_URL does not point at sealed project. Found:\n${url.replace(/:[^@]+@/, ":****@")}`);
  process.exit(1);
}
console.log(`== Target == ${url.replace(/:[^@]+@/, ":****@")}\n`);

const sql = readFileSync(
  resolve(__dirname, "..", "nex-supabase", "migrations", "212_nex_business_shop_cover_overrides.sql"),
  "utf-8",
);
console.log("== Executing migration 212 ==\n");

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("✓ Migration 212 applied\n");

  const { rows } = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='nex_business'
      AND column_name IN ('shop_cover_image_url','shop_cover_tint_hex')
    ORDER BY column_name
  `);
  console.log("== Post-apply column verify ==");
  console.log(rows);

  const { rows: constraints } = await client.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conname = 'nex_business_shop_cover_tint_hex_format'
  `);
  console.log("\n== Post-apply CHECK verify ==");
  console.log(constraints);
} catch (e) {
  console.error("MIGRATION FAILED:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
