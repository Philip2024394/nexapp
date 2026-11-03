#!/usr/bin/env node
// One-shot cleanup + image migration for Irish Pride (nex-99901) on sandbox.
// 1. Delete the 2 duplicate track rows my latest seed inserted (wrong IDs).
// 2. Copy all 12 cover+background PNG files from production `nex-music-media`
//    into sandbox `nex-music-media` at identical paths so the sb:// refs
//    on existing track rows resolve.
// 3. Set a reasonable profile avatar + cover for Irish Pride · reuse the
//    Hotel California cover PNG as the avatar (same artwork).

import pg from "pg";

const DEWI = "11111111-1111-4111-8111-111111111111";

const PROD_SB_URL = process.env.PROD_SB_URL;
const PROD_SR = process.env.PROD_SR;
const SBX_SB_URL = process.env.SBX_SB_URL;
const SBX_SR = process.env.SBX_SR;
const SBX_DB = process.env.SBX_DB;

if (SBX_DB.includes("ijvqdvsvwtwxzcqmoqit")) {
  throw new Error("safeguard: SBX_DB points at production project ref");
}
function h(sr) { return { Authorization: "Bearer " + sr, apikey: sr }; }

const c = new pg.Client({ connectionString: SBX_DB, ssl: { rejectUnauthorized: false } });
await c.connect();

// === 1. Delete the 2 duplicate rows (the ones with cover=NULL) ===
console.log("1. Delete duplicate track rows with cover_image_url IS NULL");
const dup = await c.query(
  `DELETE FROM public.nex_music_track
    WHERE owner_account_id = $1 AND cover_image_url IS NULL
    RETURNING id, title`,
  [DEWI],
);
for (const r of dup.rows) console.log("   deleted " + r.id + " (" + r.title + ")");

// === 2. Enumerate PNG paths referenced by surviving tracks ===
const r = await c.query(
  `SELECT title, cover_image_url, background_image_url
     FROM public.nex_music_track WHERE owner_account_id = $1`,
  [DEWI],
);
const pngPaths = new Set();
for (const row of r.rows) {
  for (const ref of [row.cover_image_url, row.background_image_url]) {
    if (!ref) continue;
    const match = /^sb:\/\/([^/]+)\/(.+)$/.exec(ref);
    if (!match) continue;
    const path = match[1] + "/" + match[2];
    pngPaths.add(path);
  }
}
console.log("\n2. Copy " + pngPaths.size + " PNG files prod → sandbox");
for (const path of pngPaths) {
  const dl = await fetch(PROD_SB_URL + "/storage/v1/object/nex-music-media/" + path, { headers: h(PROD_SR) });
  if (!dl.ok) {
    console.log("   DL FAIL " + path + " · " + dl.status);
    continue;
  }
  const bytes = Buffer.from(await dl.arrayBuffer());
  const ul = await fetch(SBX_SB_URL + "/storage/v1/object/nex-music-media/" + path, {
    method: "POST",
    headers: { ...h(SBX_SR), "Content-Type": "image/png", "x-upsert": "true" },
    body: bytes,
  });
  console.log("   " + path + " · " + bytes.length + " bytes · " + ul.status);
}

// === 3. Set Irish Pride profile avatar + cover ===
// Use the Hotel California cover as her avatar (the same artwork · recognisable)
// and the Hotel California background as her profile cover banner.
const AVATAR_REF = "sb://" + DEWI + "/cover-1793345575825-ebpnzova.png";
const COVER_REF = "sb://" + DEWI + "/background-1793345575825-ebpnzova.png";

console.log("\n3. Set Irish Pride profile avatar + cover");
const up = await c.query(
  `UPDATE public.nex_account_profile
      SET avatar_url = $2,
          cover_image_url = $3,
          updated_at = now()
    WHERE account_id = $1
    RETURNING avatar_url, cover_image_url`,
  [DEWI, AVATAR_REF, COVER_REF],
);
console.log("   avatar  : " + up.rows[0].avatar_url);
console.log("   cover   : " + up.rows[0].cover_image_url);

// === 4. Verify sandbox counts + bucket objects ===
console.log("\n4. Verify");
const vt = await c.query(`SELECT count(*)::int AS n FROM public.nex_music_track WHERE owner_account_id = $1`, [DEWI]);
console.log("   tracks remaining  : " + vt.rows[0].n);
const list = await fetch(SBX_SB_URL + "/storage/v1/object/list/nex-music-media", {
  method: "POST",
  headers: { ...h(SBX_SR), "Content-Type": "application/json" },
  body: JSON.stringify({ prefix: DEWI + "/", limit: 100 }),
});
const lb = await list.json();
if (Array.isArray(lb)) {
  const mp3s = lb.filter((o) => o.name.endsWith(".mp3")).length;
  const pngs = lb.filter((o) => o.name.endsWith(".png")).length;
  console.log("   sandbox bucket    : " + mp3s + " mp3s · " + pngs + " pngs");
}

await c.end();
