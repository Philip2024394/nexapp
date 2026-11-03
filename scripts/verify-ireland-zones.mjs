// scripts/verify-ireland-zones.mjs
// Read-only check that suggestZonesForOnboarding equivalent query
// returns 26 Irish counties on the sealed project.

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
if (!url?.includes("ijvqdvsvwtwxzcqmoqit")) process.exit(3);

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const r = await client.query(
    `SELECT id, name, slug, level, country, parent_zone_id, archived_at
       FROM nex_community_zone
      WHERE country='IE' AND level='city' AND archived_at IS NULL
      ORDER BY name`,
  );
  console.log(`IE level=city rows: ${r.rowCount}`);
  r.rows.forEach((row) => console.log(`  ${row.name.padEnd(12)} slug=${row.slug}`));

  const totals = await client.query(
    `SELECT level, COUNT(*)::int AS n
       FROM nex_community_zone
      WHERE country='IE'
      GROUP BY level
      ORDER BY level`,
  );
  console.log(`\nAll IE rows by level:`);
  totals.rows.forEach((row) => console.log(`  ${row.level.padEnd(10)} ${row.n}`));
} finally {
  await client.end();
}
