// scripts/seed-dev-mock-accounts.mjs
//
// Owner directive 2026-10-25 · "create mock users for dev". Seeds 5
// deterministic NEX accounts (nex-99901..nex-99905) + their profile
// rows into the sealed Supabase project `ijvqdvsvwtwxzcqmoqit`. The
// 25 dev-manifest videos (dev-video-1..dev-video-25) rotate through
// these owners (5 videos per owner) so the Live Message panel can
// resolve the broadcaster's real NEX handle + display name +
// country + avatar initial.
//
// Idempotent · uses ON CONFLICT DO NOTHING on both inserts. Safe to
// re-run · never duplicates. The UUIDs are deterministic (recognisable
// `11111111-1111-...` through `55555555-5555-...` so cleanup is easy)
// so re-seeding is a no-op.
//
// Hard safety: aborts if DATABASE_URL does not point at
// `ijvqdvsvwtwxzcqmoqit` (per CLAUDE.md §8).

import { readFileSync } from "node:fs";
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
if (!url) {
  console.error("ERR: DATABASE_URL not found in .env.local");
  process.exit(2);
}
if (!url.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: DATABASE_URL does not point at ijvqdvsvwtwxzcqmoqit · aborting per CLAUDE.md §8");
  process.exit(3);
}

const MOCKS = [
  { id: "11111111-1111-4111-8111-111111111111", handle: "nex-99901", display: "Sari Dewi",      cc: "+62" },
  { id: "22222222-2222-4222-8222-222222222222", handle: "nex-99902", display: "Rizky Pratama",  cc: "+62" },
  { id: "33333333-3333-4333-8333-333333333333", handle: "nex-99903", display: "Budi Setiawan",  cc: "+62" },
  { id: "44444444-4444-4444-8444-444444444444", handle: "nex-99904", display: "Maya Putri",     cc: "+62" },
  { id: "55555555-5555-4555-8555-555555555555", handle: "nex-99905", display: "Dika Ananda",    cc: "+62" },
];

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit via pooler");

try {
  for (const m of MOCKS) {
    const existing = await client.query(
      "SELECT id, nex_handle FROM nex_account WHERE id = $1",
      [m.id],
    );
    if (existing.rowCount > 0) {
      console.log(`SKIP  ${m.handle} · already present as id=${existing.rows[0].id}`);
      continue;
    }
    await client.query(
      `INSERT INTO nex_account (id, display_name, nex_handle, phone_country_code)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [m.id, m.display, m.handle, m.cc],
    );
    // nex_account_profile · optional but we insert a minimal row so
    // getProfileByAccountId returns a row (avatar_url left null → the
    // panel renders the initial-letter fallback).
    await client.query(
      `INSERT INTO nex_account_profile (account_id, is_public, is_discoverable)
       VALUES ($1, true, false)
       ON CONFLICT (account_id) DO NOTHING`,
      [m.id],
    );
    console.log(`CREATED ${m.handle} · ${m.display} · ${m.id}`);
  }

  // Post-verify
  const verify = await client.query(
    `SELECT a.id, a.nex_handle, a.display_name, a.phone_country_code
       FROM nex_account a
      WHERE a.id = ANY($1::uuid[])
      ORDER BY a.nex_handle`,
    [MOCKS.map((m) => m.id)],
  );
  console.log("---VERIFY---");
  for (const row of verify.rows) {
    console.log(`  ${row.nex_handle} · ${row.display_name} · cc=${row.phone_country_code} · id=${row.id}`);
  }
  console.log(`TOTAL mock accounts live: ${verify.rowCount}`);
} catch (e) {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
} finally {
  await client.end();
}
console.log("DONE");
