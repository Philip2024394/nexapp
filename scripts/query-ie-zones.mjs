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
try {
  const r = await client.query(
    "SELECT id, name, slug, level, parent_zone_id, country FROM nex_community_zone WHERE country='IE' AND slug ILIKE '%wex%'",
  );
  console.log("wex matches:");
  console.table(r.rows);

  const counts = await client.query(
    "SELECT level, count(*)::int AS c FROM nex_community_zone WHERE country='IE' GROUP BY level ORDER BY level",
  );
  console.log("\nIE level counts:");
  console.table(counts.rows);
} finally {
  await client.end();
}
