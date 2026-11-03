// scripts/apply-migration-273.mjs
// Applies 273 (nex_account_profile Ireland fields) to the sealed
// Supabase project ijvqdvsvwtwxzcqmoqit. Strips the DRAFT apply-guard
// before executing · sealed convention.

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
if (!url?.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: wrong project");
  process.exit(3);
}

function stripDraftGuard(sql, v) {
  const re = new RegExp(
    `-- Apply guard\\s*\\nDO \\$\\$ BEGIN\\s*\\n\\s*RAISE EXCEPTION 'Migration ${v} is DRAFT[^']*';\\s*\\nEND \\$\\$;`,
    "m",
  );
  return sql.replace(re, `-- (DRAFT guard stripped · ${v})`);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit");
try {
  const sqlRaw = readFileSync(
    resolve("nex-supabase/migrations/273_nex_account_profile_ireland_fields.sql"),
    "utf8",
  );
  await client.query(stripDraftGuard(sqlRaw, "273"));
  console.log("OK 273");

  const r = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'nex_account_profile'
        AND column_name IN ('country_code','address','interests','instagram_handle','tiktok_handle','facebook_handle','x_handle','youtube_handle')
      ORDER BY column_name`,
  );
  console.log("new columns present:", r.rows.map((x) => x.column_name).join(", "));

  const c = await client.query(
    "SELECT conname FROM pg_constraint WHERE conname LIKE 'nex_account_profile_%' ORDER BY conname",
  );
  console.log("constraints:");
  c.rows.forEach((row) => console.log("  " + row.conname));
} finally {
  await client.end();
}
