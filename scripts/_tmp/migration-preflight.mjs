// scripts/_tmp/migration-preflight.mjs
// Owner-authorised 2026-11-04 · READ-ONLY pre-flight for the
// Ireland-preview → canonical migration. Reports schema shape on
// both projects and fetches the 6 Irish Pride music tracks + the
// profile row so we know exactly what to migrate.

import { readFileSync } from "node:fs";
import pg from "pg";

function canonicalDb() {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) return m[1];
  }
  return null;
}

const PREVIEW_DB =
  "postgresql://postgres:adminphilip240176.@db.kdstoyyeygcopkogqsyv.supabase.co:5432/postgres";
const CANONICAL_DB = canonicalDb();
if (!CANONICAL_DB?.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: canonical DB URL not found/wrong");
  process.exit(3);
}

const PREVIEW_UUID = "11111111-1111-4111-8111-111111111111";
const CANONICAL_UUID = "11111111-aaaa-4aaa-8aaa-111111111111";

async function musicCols(client, label) {
  const r = await client.query(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_music_track'
      ORDER BY ordinal_position`,
  );
  console.log(`\n─── ${label} · nex_music_track columns (${r.rows.length}) ───`);
  console.table(r.rows);
  return r.rows.map((x) => x.column_name);
}

async function main() {
  const cPrev = new pg.Client({ connectionString: PREVIEW_DB });
  const cCanon = new pg.Client({ connectionString: CANONICAL_DB });
  await Promise.all([cPrev.connect(), cCanon.connect()]);
  console.log("CONNECTED to both projects (read-only)");

  try {
    const prevCols = await musicCols(cPrev, "PREVIEW");
    const canonCols = await musicCols(cCanon, "CANONICAL");

    const onlyInPreview = prevCols.filter((c) => !canonCols.includes(c));
    const onlyInCanonical = canonCols.filter((c) => !prevCols.includes(c));
    console.log("\n─── Schema diff ───");
    console.log(`  only in PREVIEW:    ${onlyInPreview.join(", ") || "(none)"}`);
    console.log(`  only in CANONICAL:  ${onlyInCanonical.join(", ") || "(none)"}`);
    const shared = prevCols.filter((c) => canonCols.includes(c));
    console.log(`  shared:             ${shared.length} cols`);

    console.log("\n─── Irish Pride 6 tracks (preview · all columns) ───");
    const tracks = await cPrev.query(
      `SELECT * FROM nex_music_track WHERE owner_account_id = $1 ORDER BY created_at`,
      [PREVIEW_UUID],
    );
    console.log(`  fetched ${tracks.rows.length} rows`);
    for (const r of tracks.rows) {
      console.log(`  · ${r.id} · ${r.title}`);
      for (const [k, v] of Object.entries(r)) {
        const show =
          typeof v === "string" && v.length > 120 ? v.slice(0, 117) + "..." : v;
        console.log(`      ${k.padEnd(28)} = ${JSON.stringify(show)}`);
      }
    }

    console.log("\n─── Any id collision on canonical? ───");
    const ids = tracks.rows.map((r) => r.id);
    const collide = await cCanon.query(
      `SELECT id FROM nex_music_track WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    console.log(`  colliding ids on canonical: ${collide.rows.length} (expect 0)`);
    if (collide.rows.length > 0) console.table(collide.rows);

    console.log("\n─── Canonical Irish Pride profile row (post-rename) ───");
    const prof = await cCanon.query(
      `SELECT * FROM nex_account_profile WHERE account_id = $1`,
      [CANONICAL_UUID],
    );
    console.log(`  rows: ${prof.rows.length}`);
    if (prof.rows[0]) console.log(prof.rows[0]);
  } finally {
    await Promise.all([cPrev.end(), cCanon.end()]);
    console.log("\nDONE (read-only)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
