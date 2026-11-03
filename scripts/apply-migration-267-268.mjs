// scripts/apply-migration-267-268.mjs
// Applies 267 (membership multi + added_by) and 268 (member flag table).

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
if (!url?.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: DATABASE_URL not pointing at ijvqdvsvwtwxzcqmoqit");
  process.exit(3);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit");

const migs = [
  "267_nex_community_membership_multi_added_by.sql",
  "268_nex_community_member_flag.sql",
];

try {
  for (const m of migs) {
    console.log(`\n── Applying ${m} ──`);
    const sql = readFileSync(resolve("nex-supabase/migrations", m), "utf8");
    await client.query(sql);
    console.log(`OK ${m}`);
  }

  // Verify
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_community_membership'
        AND column_name IN ('added_by_account_id','status')
      ORDER BY column_name`,
  );
  console.log(`\nmembership new columns: ${JSON.stringify(cols.rows)}`);

  const tbl = await client.query(
    `SELECT COUNT(*)::int AS n FROM information_schema.tables
      WHERE table_schema='public' AND table_name='nex_community_member_flag'`,
  );
  console.log(`nex_community_member_flag table exists: ${tbl.rows[0].n === 1}`);

  const hist = await client.query(
    "SELECT version, description FROM nex_migration_history WHERE version IN ('267','268') ORDER BY version",
  );
  console.log(`history: ${JSON.stringify(hist.rows)}`);
} finally {
  await client.end();
}
