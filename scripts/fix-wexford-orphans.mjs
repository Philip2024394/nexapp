// scripts/fix-wexford-orphans.mjs
// Repairs the orphan Wexford neighbourhoods created by migration 271.
// Mig 271's WITH clause looked up slug='wexford' but the real slug is
// 'county-wexford' (per migration 266). The INSERT ran with
// parent_zone_id=NULL. This script re-parents all 42 orphan
// neighbourhoods under the correct Wexford county zone.

import { readFileSync } from "node:fs";
import pg from "pg";

function readEnv(k) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === k) return m[2];
  }
  return null;
}

const client = new pg.Client({ connectionString: readEnv("DATABASE_URL") });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit");

try {
  const wex = await client.query(
    "SELECT id FROM nex_community_zone WHERE country='IE' AND level='city' AND slug='county-wexford' AND parent_zone_id IS NOT NULL",
  );
  if (wex.rows.length === 0) {
    console.error("ERR: Wexford county zone not found");
    process.exit(5);
  }
  const wexfordId = wex.rows[0].id;
  console.log(`Wexford county id: ${wexfordId}`);

  const upd = await client.query(
    "UPDATE nex_community_zone SET parent_zone_id=$1 WHERE country='IE' AND level='neighbourhood' AND parent_zone_id IS NULL RETURNING id, name",
    [wexfordId],
  );
  console.log(`\nRe-parented ${upd.rowCount} rows:`);
  console.table(upd.rows);
} finally {
  await client.end();
}
