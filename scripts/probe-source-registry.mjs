// scripts/probe-source-registry.mjs · list all sources + their kinds
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
const c = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows: cols } = await c.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='nex' AND table_name='source_registry'
  ORDER BY ordinal_position
`);
console.log("source_registry columns:", cols.map((r) => r.column_name));
const colList = cols.map((r) => r.column_name).join(", ");
const { rows } = await c.query(`SELECT ${colList} FROM nex.source_registry ORDER BY source_id`);
console.log("\nAll sources:");
for (const r of rows) console.log(r);
await c.end();
