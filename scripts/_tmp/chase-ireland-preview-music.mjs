// scripts/_tmp/chase-ireland-preview-music.mjs
// Owner-authorised read-only probe 2026-11-04.
// Checks whether the Irish Pride music tracks live in the retired
// Ireland preview Supabase (kdstoyyeygcopkogqsyv) rather than canonical.

import pg from "pg";

const PREVIEW_DB =
  "postgresql://postgres:adminphilip240176.@db.kdstoyyeygcopkogqsyv.supabase.co:5432/postgres";

const PERSONA = "11111111-aaaa-4aaa-8aaa-111111111111";
const PHANTOM = "11111111-1111-4111-8111-111111111111";

const client = new pg.Client({ connectionString: PREVIEW_DB });
try {
  await client.connect();
  console.log("CONNECTED to kdstoyyeygcopkogqsyv (Ireland preview · read-only)\n");

  console.log("─── 1 · nex_account rows with handle nex-99901 ───");
  const a1 = await client.query(
    "SELECT id, nex_handle, display_name FROM nex_account WHERE nex_handle = 'nex-99901'",
  );
  console.table(a1.rows);

  console.log("\n─── 2 · nex_music_track total + sample ───");
  try {
    const m0 = await client.query("SELECT COUNT(*)::int AS c FROM nex_music_track");
    console.log(`  total tracks: ${m0.rows[0].c}`);
    const m1 = await client.query(
      "SELECT id, owner_account_id, title, visibility, created_at FROM nex_music_track ORDER BY created_at DESC LIMIT 10",
    );
    console.table(m1.rows);

    console.log("\n─── 3 · Tracks owned by either nex-99901 UUID candidate ───");
    const m2 = await client.query(
      `SELECT owner_account_id, COUNT(*)::int AS c
         FROM nex_music_track
         WHERE owner_account_id IN ($1, $2)
         GROUP BY owner_account_id`,
      [PERSONA, PHANTOM],
    );
    console.table(m2.rows);

    console.log("\n─── 4 · Irish/Ireland/Pride-titled tracks ───");
    const m3 = await client.query(
      `SELECT id, owner_account_id, title FROM nex_music_track
         WHERE title ILIKE '%irish%' OR title ILIKE '%ireland%' OR title ILIKE '%pride%'
         LIMIT 20`,
    );
    console.table(m3.rows);
  } catch (e) {
    console.log(`  nex_music_track query failed: ${e.message}`);
  }
} catch (e) {
  console.error(`CONNECTION FAILED: ${e.message}`);
  process.exit(2);
} finally {
  await client.end().catch(() => {});
  console.log("\nDONE (read-only)");
}
