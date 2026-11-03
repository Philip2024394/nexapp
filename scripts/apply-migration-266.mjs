// scripts/apply-migration-266.mjs
//
// Owner-authorised applier for migration 266 · Ireland (ROI) zone seed.
// Target: sealed Supabase project `ijvqdvsvwtwxzcqmoqit`.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
if (!url) {
  console.error("ERR: DATABASE_URL not found in .env.local");
  process.exit(2);
}
if (!url.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: DATABASE_URL not pointing at ijvqdvsvwtwxzcqmoqit · aborting per CLAUDE.md §8");
  process.exit(3);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit via pooler");

try {
  // PRE check
  const pre = await client.query(
    "SELECT level, COUNT(*)::int AS n FROM nex_community_zone WHERE country='IE' GROUP BY level ORDER BY level",
  );
  console.log(`PRE  IE zones: ${JSON.stringify(pre.rows)}`);

  // Apply
  const sql = readFileSync(
    resolve("nex-supabase/migrations/266_nex_community_zone_seed_ie_ireland.sql"),
    "utf8",
  );
  await client.query(sql);
  console.log("APPLY 266 · OK");

  // POST check
  const post = await client.query(
    "SELECT level, COUNT(*)::int AS n FROM nex_community_zone WHERE country='IE' GROUP BY level ORDER BY level",
  );
  console.log(`POST IE zones: ${JSON.stringify(post.rows)}`);

  const counties = await client.query(
    "SELECT name, slug FROM nex_community_zone WHERE country='IE' AND level='city' ORDER BY name",
  );
  console.log(`POST 26 counties: ${counties.rows.map((r) => r.name).join(", ")}`);
  console.log(`     expected 26 · got ${counties.rowCount}`);

  const hist = await client.query(
    "SELECT version, description, applied_at FROM nex_migration_history WHERE version='266'",
  );
  console.log(`HIST  266 recorded: ${JSON.stringify(hist.rows)}`);
} finally {
  await client.end();
}
