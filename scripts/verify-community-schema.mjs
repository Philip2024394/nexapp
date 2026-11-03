// scripts/verify-community-schema.mjs
//
// Read-only verification of the Community Noticeboard schema state on
// the sealed Supabase project `ijvqdvsvwtwxzcqmoqit`. Used after the
// 146+147+149 applier found that the schema is further ahead than the
// nex_migration_history record suggests.
//
// NO WRITES. Pure SELECT queries. Safe to run on production.

import { readFileSync } from "node:fs";
import pg from "pg";

function readEnv(key) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === key) return m[2];
  }
  return null;
}

const url = readEnv("DATABASE_URL");
if (!url || !url.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: DATABASE_URL not pointing at ijvqdvsvwtwxzcqmoqit");
  process.exit(3);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

async function q(sql, label) {
  const r = await client.query(sql);
  console.log(`\n── ${label} ──`);
  console.log(JSON.stringify(r.rows, null, 2));
}

try {
  await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name LIKE 'nex_community_%'
      ORDER BY table_name`,
    "nex_community_* tables",
  );

  await q(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_community_membership'
      ORDER BY ordinal_position`,
    "nex_community_membership columns",
  );

  await q(
    `SELECT conname AS constraint_name, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid='public.nex_community_membership'::regclass
      ORDER BY conname`,
    "nex_community_membership constraints",
  );

  await q(
    `SELECT level, COUNT(*)::int AS n
       FROM nex_community_zone
      GROUP BY level
      ORDER BY level`,
    "nex_community_zone rows by level",
  );

  await q(
    `SELECT country, COUNT(*)::int AS zones
       FROM nex_community_zone
      GROUP BY country
      ORDER BY country`,
    "nex_community_zone rows by country",
  );

  await q(
    `SELECT version, description, applied_at
       FROM nex_migration_history
      WHERE version IN ('146','147','148','149','150','151','152','197')
      ORDER BY version`,
    "nex_migration_history for community migrations",
  );

  await q(
    `SELECT COUNT(*)::int AS n FROM nex_community_membership`,
    "membership row count",
  );
} finally {
  await client.end();
}
