#!/usr/bin/env node
// scripts/audit-wholesale-350-351-pg-contradiction-check.mjs
//
// Resolves the contradiction between the PostgREST probe (tables exist)
// and the pg_catalog probe (tables not found). Read-only.

import pg from "pg";
import fs from "node:fs";
import path from "node:path";

function loadEnv(p) {
  if (!fs.existsSync(p)) return;
  for (const raw of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line
      .slice(i + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnv(path.resolve(process.cwd(), ".env.local"));

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl.includes("kdstoyyeygcopkogqsyv")) {
  console.error("REFUSED non-sandbox");
  process.exit(3);
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const whoami = (
  await client.query(
    `SELECT current_database() AS db, current_user AS usr,
            current_schema() AS schema,
            current_setting('search_path') AS search_path,
            inet_server_addr()::text AS server_addr,
            version() AS version`,
  )
).rows[0];

const findAllByName = (
  await client.query(
    `SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE c.relname IN ('nex_wholesale_buyer_approval','nex_wholesale_quote')
       ORDER BY n.nspname, c.relname`,
  )
).rows;

const anyNexWholesaleAnywhere = (
  await client.query(
    `SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE c.relname LIKE 'nex_wholesale%'
       ORDER BY n.nspname, c.relname`,
  )
).rows;

const publicNexTables = (
  await client.query(
    `SELECT c.relname
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relkind='r'
         AND c.relname LIKE 'nex_%'
       ORDER BY c.relname LIMIT 50`,
  )
).rows.map((r) => r.relname);

const result = {
  whoami,
  find_by_name: findAllByName,
  any_nex_wholesale_anywhere: anyNexWholesaleAnywhere,
  public_nex_tables_sample: publicNexTables,
};

await client.end();
console.log(JSON.stringify(result, null, 2));
