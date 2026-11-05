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
const r = await client.query(
  `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='nex_account_profile'
     ORDER BY ordinal_position`,
);
console.table(r.rows);
await client.end();
