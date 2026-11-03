// scripts/seed-nex-99901-ireland-persona.mjs
// Owner-authorised 2026-11-03 · option A.
//
// Creates nex_account(nex_handle='nex-99901') as a fresh Ireland test
// persona ("Padraig Murphy") with is_mock_persona=true + hq_role='admin'
// and auto-joins Co Wexford so the sealed .env.local
// NEX_DEV_IMPERSONATE_HANDLE=nex-99901 resolves to a usable account.

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

const ACCOUNT_ID = "11111111-aaaa-4aaa-8aaa-111111111111"; // deterministic UUID (variant/version bits valid)
const HANDLE = "nex-99901";
const DISPLAY_NAME = "Padraig Murphy";

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit");

try {
  // 1 · Verify Wexford county zone exists · we'll use its id for the
  //     membership row.
  const wex = await client.query(
    "SELECT id, name FROM nex_community_zone WHERE country='IE' AND level='city' AND slug='county-wexford' AND parent_zone_id IS NOT NULL",
  );
  if (wex.rows.length === 0) {
    console.error("ERR: Wexford county zone not found · run migration 266 first");
    process.exit(5);
  }
  const wexfordId = wex.rows[0].id;
  console.log(`Wexford county zone: ${wexfordId}`);

  // 2 · Resolve the Leinster province zone (needed for district_zone_id
  //     on the membership row · district walk-up for IE city → province).
  //     The membership row's hyperlocal_zone_id = Wexford county row;
  //     district_zone_id resolves to the parent province per sealed
  //     resolveDistrictFor logic. For IE level='city' the service
  //     treats county AS the district · so we point district_zone_id at
  //     the same Wexford row.

  // 3 · Insert / upsert the account.
  const existing = await client.query(
    "SELECT id, display_name, nex_handle, hq_role, is_mock_persona FROM nex_account WHERE nex_handle = $1",
    [HANDLE],
  );

  if (existing.rows.length > 0) {
    console.log("Account already exists · updating to admin + mock:", existing.rows[0]);
    await client.query(
      "UPDATE nex_account SET hq_role='admin', is_mock_persona=true WHERE nex_handle=$1",
      [HANDLE],
    );
  } else {
    await client.query(
      `INSERT INTO nex_account (
         id, display_name, nex_handle, is_mock_persona, hq_role, tier
       ) VALUES ($1, $2, $3, true, 'admin', 'gratis')`,
      [ACCOUNT_ID, DISPLAY_NAME, HANDLE],
    );
    console.log(`INSERTED nex_account ${HANDLE} · ${DISPLAY_NAME}`);
  }

  const after = await client.query(
    "SELECT id, display_name, nex_handle, hq_role, is_mock_persona, tier FROM nex_account WHERE nex_handle=$1",
    [HANDLE],
  );
  console.log("Account state:", after.rows[0]);
  const accountId = after.rows[0].id;

  // 4 · Insert / upsert the membership row.
  //     Table shape (migration 146 + 267):
  //       account_id · hyperlocal_zone_id · district_zone_id · status ·
  //       added_by_account_id · confirmed_at · notification_preference
  //     uq_membership_pair (sealed · 267) enforces one row per
  //     (account_id, hyperlocal_zone_id).
  const memExist = await client.query(
    "SELECT 1 FROM nex_community_membership WHERE account_id=$1 AND hyperlocal_zone_id=$2",
    [accountId, wexfordId],
  );
  if (memExist.rows.length === 0) {
    await client.query(
      `INSERT INTO nex_community_membership (
         account_id, hyperlocal_zone_id, district_zone_id, status,
         notification_preference,
         safety_pref, lost_found_pref, events_pref, voting_pref, life_news_pref,
         confirmed_at
       ) VALUES ($1, $2, $2, 'active',
         'all',
         'all', 'all', 'all', 'all', 'all',
         now())`,
      [accountId, wexfordId],
    );
    console.log("INSERTED Wexford membership");
  } else {
    console.log("Membership already exists · no-op");
  }

  const memRow = await client.query(
    "SELECT hyperlocal_zone_id, status, notification_preference FROM nex_community_membership WHERE account_id=$1",
    [accountId],
  );
  console.log("Memberships:", memRow.rows);
} finally {
  await client.end();
}
