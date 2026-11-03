// scripts/query-dev-handles.mjs
// One-shot read · lists dev / mock personas so we can pick the right
// one to grant admin to.

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

const url = readEnv("DATABASE_URL");
if (!url?.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: wrong project");
  process.exit(3);
}

const envHandle = readEnv("NEX_DEV_IMPERSONATE_HANDLE");
console.log(`NEX_DEV_IMPERSONATE_HANDLE in .env.local = ${envHandle ?? "(unset)"}`);

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const q1 = await client.query(
    "SELECT id, display_name, nex_handle, hq_role, is_mock_persona FROM nex_account WHERE nex_handle ILIKE 'nex-9%' ORDER BY nex_handle LIMIT 20",
  );
  console.log("\nnex-9xxxx handles:");
  console.table(q1.rows);

  const q2 = await client.query(
    "SELECT id, display_name, nex_handle, hq_role FROM nex_account WHERE hq_role IS NOT NULL LIMIT 20",
  );
  console.log("\nExisting hq_role accounts:");
  console.table(q2.rows);

  const q3 = await client.query(
    "SELECT count(*)::int AS c FROM nex_account",
  );
  console.log(`\nTotal nex_account rows: ${q3.rows[0].c}`);
} finally {
  await client.end();
}
