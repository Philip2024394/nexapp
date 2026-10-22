// scripts/probe-trust-state-pg.mjs
//
// Read-only probe via direct Postgres (pg) · Supabase REST only
// exposes `public` schema so the `nex` schema needs direct SQL to
// probe. Zero writes.

import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
const envRaw = readFileSync(envPath, "utf-8");
const env = Object.fromEntries(
  envRaw
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
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
  console.error("DATABASE_URL does not point at sealed project. Aborting.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

async function run(label, sql) {
  console.log(`\n== ${label} ==`);
  try {
    const r = await client.query(sql);
    console.log(r.rows);
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }
}

await run("Schema existence", `
  SELECT schema_name FROM information_schema.schemata
  WHERE schema_name IN ('nex','public') ORDER BY schema_name
`);

await run("Table existence in nex", `
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='nex' AND table_name IN (
    'source_registry','business_canonical','business_evidence'
  ) ORDER BY table_name
`);

await run("Row counts in nex", `
  SELECT
    (SELECT COUNT(*) FROM nex.source_registry) AS source_registry,
    (SELECT COUNT(*) FROM nex.business_canonical) AS business_canonical,
    (SELECT COUNT(*) FROM nex.business_evidence) AS business_evidence
`);

await run("Sample source_registry (first 5)", `
  SELECT source_id, display_name, source_kind FROM nex.source_registry LIMIT 5
`);

await run("Sample business_canonical (first 3)", `
  SELECT canonical_business_id, name_canonical, lifecycle_state
  FROM nex.business_canonical LIMIT 3
`);

await run("Owner candidate · Philip's business (if any)", `
  SELECT b.id AS business_id, b.display_name, b.slug, b.owner_account_id,
         a.nex_handle, a.display_name AS account_display_name
  FROM nex_business b
  JOIN nex_account a ON a.id = b.owner_account_id
  WHERE a.nex_handle ILIKE '%philip%' OR a.email ILIKE '%phillipofarrell%'
  LIMIT 5
`);

await run("WIP column · canonical_business_id on nex_business?", `
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='nex_business'
    AND column_name='canonical_business_id'
`);

await client.end();
