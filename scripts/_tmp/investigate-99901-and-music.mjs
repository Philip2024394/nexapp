// scripts/_tmp/investigate-99901-and-music.mjs
// Owner-authorised read-only investigation 2026-11-04.
// Resolves the UUID conflict between seed-nex-99901 (-aaaa- UUID)
// and path-b-publish Irish Pride (all-1s UUID) by querying the
// canonical Supabase (ijvqdvsvwtwxzcqmoqit) directly.
// Zero writes. Prints findings and exits.

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
  console.error("ERR: DATABASE_URL does not point at ijvqdvsvwtwxzcqmoqit · aborting read");
  process.exit(3);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit (read-only investigation)\n");

try {
  console.log("─── 1 · Any nex_account row with handle nex-99901? ───");
  const a1 = await client.query(
    "SELECT id, display_name, nex_handle, hq_role, is_mock_persona, tier, created_at FROM nex_account WHERE nex_handle = $1",
    ["nex-99901"],
  );
  console.table(a1.rows);

  console.log("\n─── 2 · Does the -aaaa- UUID row exist? ───");
  const a2 = await client.query(
    "SELECT id, display_name, nex_handle FROM nex_account WHERE id = $1",
    ["11111111-aaaa-4aaa-8aaa-111111111111"],
  );
  console.table(a2.rows);

  console.log("\n─── 3 · Does the all-1s UUID row exist? ───");
  const a3 = await client.query(
    "SELECT id, display_name, nex_handle FROM nex_account WHERE id = $1",
    ["11111111-1111-4111-8111-111111111111"],
  );
  console.table(a3.rows);

  console.log("\n─── 4 · nex_account_profile row for nex-99901 (if any) ───");
  const p1 = await client.query(
    `SELECT account_id, avatar_url, country_code, profession,
            array_length(interests, 1) AS interest_count,
            instagram_handle, tiktok_handle, facebook_handle, x_handle, youtube_handle
       FROM nex_account_profile
       WHERE account_id IN ($1, $2)`,
    [
      "11111111-aaaa-4aaa-8aaa-111111111111",
      "11111111-1111-4111-8111-111111111111",
    ],
  );
  console.table(p1.rows);

  console.log("\n─── 5 · nex_music_track totals by owner_account_id ───");
  const m1 = await client.query(
    `SELECT owner_account_id, COUNT(*)::int AS tracks
       FROM nex_music_track
       WHERE owner_account_id IN ($1, $2)
       GROUP BY owner_account_id`,
    [
      "11111111-aaaa-4aaa-8aaa-111111111111",
      "11111111-1111-4111-8111-111111111111",
    ],
  );
  console.table(m1.rows);

  console.log("\n─── 6 · All tracks owned by nex-99901 (-aaaa- UUID) ───");
  const m2 = await client.query(
    `SELECT id, title, visibility, rights_declaration, created_at
       FROM nex_music_track
       WHERE owner_account_id = $1
       ORDER BY created_at DESC NULLS LAST`,
    ["11111111-aaaa-4aaa-8aaa-111111111111"],
  );
  console.table(m2.rows);

  console.log("\n─── 7 · Any track titles mentioning Irish/Ireland/Pride anywhere ───");
  const m3 = await client.query(
    `SELECT owner_account_id, title, visibility
       FROM nex_music_track
       WHERE title ILIKE '%irish%' OR title ILIKE '%ireland%' OR title ILIKE '%pride%'
       ORDER BY created_at DESC NULLS LAST
       LIMIT 15`,
  );
  console.table(m3.rows);
} finally {
  await client.end();
  console.log("\nDONE (read-only · no writes performed)");
}
