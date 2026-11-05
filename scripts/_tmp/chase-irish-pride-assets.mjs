// scripts/_tmp/chase-irish-pride-assets.mjs
// Owner-authorised read-only investigation 2026-11-04.
// Probes canonical Supabase for:
//   · All music-ish tables + row counts (sometimes tracks live in
//     draft/staging tables rather than nex_music_track)
//   · Storage listings for nex-music-media + nex-avatars under both
//     nex-99901 UUID candidates
//   · Any existing images that could serve as Irish Pride's avatar

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

const dbUrl = readEnv("DATABASE_URL");
const supabaseUrl = readEnv("NEXT_PUBLIC_NEX_SUPABASE_URL");
const serviceKey = readEnv("NEX_SUPABASE_SERVICE_ROLE_KEY");

if (!dbUrl?.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: wrong DATABASE_URL");
  process.exit(3);
}

const PERSONA = "11111111-aaaa-4aaa-8aaa-111111111111";
const PHANTOM = "11111111-1111-4111-8111-111111111111";

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit\n");

try {
  console.log("─── 1 · Any public tables with 'music' in the name ───");
  const t1 = await client.query(
    `SELECT table_name,
            (xpath('/row/c/text()', query_to_xml(
              format('SELECT COUNT(*) AS c FROM %I', table_name),
              false, true, '')))[1]::text AS row_count
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name ILIKE '%music%'
      ORDER BY table_name`,
  );
  console.table(t1.rows);

  console.log("\n─── 2 · nex_music_track row count overall ───");
  const t2 = await client.query("SELECT COUNT(*)::int AS c FROM nex_music_track");
  console.log(`  total tracks: ${t2.rows[0].c}`);

  console.log("\n─── 3 · Scanning first 10 rows (any owner) if any ───");
  const t3 = await client.query(
    `SELECT id, owner_account_id, title, visibility, created_at
       FROM nex_music_track
       ORDER BY created_at DESC NULLS LAST
       LIMIT 10`,
  );
  console.table(t3.rows);
} finally {
  await client.end();
  console.log();
}

// ─── Storage probing via Supabase REST ──────────────────────────
async function listStorage(bucket, prefix = "") {
  const url = new URL(`/storage/v1/object/list/${bucket}`, supabaseUrl);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ prefix, limit: 100, offset: 0 }),
  });
  if (!res.ok) {
    return { error: `${res.status} ${await res.text()}` };
  }
  return { items: await res.json() };
}

console.log("─── 4 · Storage: nex-music-media bucket root ───");
const sm1 = await listStorage("nex-music-media", "");
console.log(sm1.error ? `  error: ${sm1.error}` : `  ${sm1.items?.length ?? 0} entries`);
if (sm1.items) {
  for (const o of sm1.items.slice(0, 20)) console.log(`    ${o.name}`);
}

console.log("\n─── 5 · Storage: nex-music-media under PERSONA uuid ───");
const sm2 = await listStorage("nex-music-media", PERSONA);
console.log(sm2.error ? `  error: ${sm2.error}` : `  ${sm2.items?.length ?? 0} entries`);
if (sm2.items) for (const o of sm2.items.slice(0, 20)) console.log(`    ${o.name}`);

console.log("\n─── 6 · Storage: nex-music-media under PHANTOM uuid ───");
const sm3 = await listStorage("nex-music-media", PHANTOM);
console.log(sm3.error ? `  error: ${sm3.error}` : `  ${sm3.items?.length ?? 0} entries`);
if (sm3.items) for (const o of sm3.items.slice(0, 20)) console.log(`    ${o.name}`);

console.log("\n─── 7 · Storage: nex-avatars under PERSONA uuid ───");
const sa1 = await listStorage("nex-avatars", PERSONA);
console.log(sa1.error ? `  error: ${sa1.error}` : `  ${sa1.items?.length ?? 0} entries`);
if (sa1.items) for (const o of sa1.items.slice(0, 20)) console.log(`    ${o.name}`);

console.log("\n─── 8 · Storage: nex-avatars under PHANTOM uuid ───");
const sa2 = await listStorage("nex-avatars", PHANTOM);
console.log(sa2.error ? `  error: ${sa2.error}` : `  ${sa2.items?.length ?? 0} entries`);
if (sa2.items) for (const o of sa2.items.slice(0, 20)) console.log(`    ${o.name}`);

console.log("\nDONE (read-only · no writes)");
