// scripts/seed-hq-admin-nex-99901.mjs
// Grants hq_role='admin' to the sealed dev-impersonation persona
// nex-99901 so the HQ moderation surfaces can be walked in-browser.
// Owner-authorised 2026-11-03.

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
  console.error("ERR: DATABASE_URL not pointing at ijvqdvsvwtwxzcqmoqit");
  process.exit(3);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit");

try {
  // Confirm the account exists before touching it.
  const before = await client.query(
    "SELECT id, display_name, nex_handle, hq_role FROM nex_account WHERE nex_handle = 'nex-99901'",
  );
  if (before.rows.length === 0) {
    console.error("ERR: nex_account with handle nex-99901 not found");
    process.exit(4);
  }
  console.log("BEFORE:", before.rows[0]);

  const upd = await client.query(
    "UPDATE nex_account SET hq_role = 'admin' WHERE nex_handle = 'nex-99901' RETURNING id, nex_handle, hq_role",
  );
  console.log("AFTER :", upd.rows[0]);
} finally {
  await client.end();
}
