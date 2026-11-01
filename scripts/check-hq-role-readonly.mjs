#!/usr/bin/env node
// Read-only diagnostic · prints hq_role for owner handle + mock personas.
// Loads DATABASE_URL from .env.development.local.
import { readFileSync } from "node:fs";
import pg from "pg";

const envText = readFileSync(".env.development.local", "utf8");
const envMap = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const url = envMap.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}
const projectRef = (url.match(/@([a-z0-9-]+)\.pooler/) || [])[1] ||
  (url.match(/\/\/([a-z0-9-]+)\.supabase/) || [])[1] ||
  "(unknown)";
console.log("project pooler/host ref:", projectRef);

const client = new pg.Client({ connectionString: url });
await client.connect();

async function main() {
  const col = await client.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name='nex_account' and column_name='hq_role'",
  );
  console.log("hq_role column present:", col.rowCount > 0);
  if (col.rowCount === 0) {
    console.log("(migration 206 not applied on this project)");
    return;
  }

  const owner = await client.query(
    "select nex_handle, hq_role, is_mock_persona from public.nex_account where nex_handle = 'nex-10842' limit 1",
  );
  console.log("nex-10842:", owner.rows[0] || "(not found)");

  const mocks = await client.query(
    "select nex_handle, hq_role, is_mock_persona from public.nex_account where nex_handle in ('nex-99901','nex-99902','nex-99903','nex-99904','nex-99905') order by nex_handle",
  );
  console.log("mock personas:");
  for (const r of mocks.rows) console.log(" ", r);

  const anyAdmin = await client.query(
    "select nex_handle, is_mock_persona from public.nex_account where hq_role = 'admin' order by nex_handle",
  );
  console.log("any accounts with hq_role='admin':", anyAdmin.rowCount);
  for (const r of anyAdmin.rows) console.log(" ", r);
}

try {
  await main();
} finally {
  await client.end();
}
