// scripts/_tmp/rename-nex-99901-to-irish-pride.mjs
// Owner-authorised 2026-11-04 · one-shot rename of the mock persona
// `nex-99901` display_name from "Padraig Murphy" to "Irish Pride" so
// the chat identity matches the music library + sealed free-chat
// comments ("Irish Pride" is the known chat-name for this persona).
//
// Scope: single UPDATE on nex_account.display_name, gated by
// nex_handle='nex-99901' AND is_mock_persona=true (so this cannot
// touch any real customer account).

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
  console.error("ERR: DATABASE_URL not pointing at ijvqdvsvwtwxzcqmoqit · aborting");
  process.exit(3);
}

const HANDLE = "nex-99901";
const OLD_NAME = "Padraig Murphy";
const NEW_NAME = "Irish Pride";

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit");

try {
  const before = await client.query(
    "SELECT id, nex_handle, display_name, is_mock_persona FROM nex_account WHERE nex_handle = $1",
    [HANDLE],
  );
  console.log("\nBEFORE:");
  console.table(before.rows);

  if (before.rows.length === 0) {
    console.error(`ERR: no row for ${HANDLE}`);
    process.exit(4);
  }
  if (!before.rows[0].is_mock_persona) {
    console.error(`ERR: ${HANDLE} is NOT flagged is_mock_persona · refusing to touch a real account`);
    process.exit(5);
  }

  const upd = await client.query(
    `UPDATE nex_account
        SET display_name = $1
      WHERE nex_handle = $2
        AND is_mock_persona = true
      RETURNING id, nex_handle, display_name, is_mock_persona`,
    [NEW_NAME, HANDLE],
  );
  console.log("\nAFTER:");
  console.table(upd.rows);
  console.log(`\nUpdated ${upd.rowCount} row(s). "${OLD_NAME}" → "${NEW_NAME}".`);
} finally {
  await client.end();
}
