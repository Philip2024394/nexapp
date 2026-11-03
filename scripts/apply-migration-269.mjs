import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

function readEnv(k) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === k) return m[2];
  }
  return null;
}

const url = readEnv("DATABASE_URL");
if (!url?.includes("ijvqdvsvwtwxzcqmoqit")) process.exit(3);

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const sql = readFileSync(
    resolve("nex-supabase/migrations/269_nex_hq_action_log_community_actions.sql"),
    "utf8",
  );
  await client.query(sql);
  console.log("OK 269");
  const r = await client.query(
    "SELECT version, description FROM nex_migration_history WHERE version='269'",
  );
  console.log(JSON.stringify(r.rows));
} finally {
  await client.end();
}
