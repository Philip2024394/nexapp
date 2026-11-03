#!/usr/bin/env node
// One-shot migration of Dewi Sari → Irish Pride (nex-99901) from
// production storage + local dev-FS metadata into the sandbox project.
// Owner-authorised 2026-11-01 (NEX country programme · Ireland real-content wave).
//
// What it does:
//   1. Create nex-music-media bucket on sandbox (private)
//   2. Copy 5 Dewi MP3s from production storage → sandbox storage
//   3. Delete the placeholder sandbox Dewi (nex-80001) + content
//   4. Insert the real production UUID Dewi (nex-99901) with display_name
//      "Irish Pride", country IE, Dublin city
//   5. Insert her 5 real track rows (from .dev-music-data/tracks.json)
//      + 1 active music slot (from .dev-music-data/active-slots.json)
//   6. Verify sandbox state
//
// Does NOT touch production yet. The owner-authorised production
// delete runs AFTER sandbox verification (separate step).

import pg from "pg";
import { readFileSync } from "node:fs";

const DEWI_UUID = "11111111-1111-4111-8111-111111111111";

const FILES = [
  "audio-1793345575825-ebpnzova.mp3",
  "audio-1793340842898-ptkobfvz.mp3",
  "audio-1793397897054-7f1bcaf6.mp3",
  "audio-1793400833060-c9454888.mp3",
  "audio-1793401720920-b46ed9f0.mp3",
];

const PROD_SB_URL = process.env.PROD_SB_URL;
const PROD_SR = process.env.PROD_SR;
const SBX_SB_URL = process.env.SBX_SB_URL;
const SBX_SR = process.env.SBX_SR;
const SBX_DB = process.env.SBX_DB;

if (!PROD_SB_URL || !PROD_SR || !SBX_SB_URL || !SBX_SR || !SBX_DB) {
  throw new Error("missing env (PROD_SB_URL/PROD_SR/SBX_SB_URL/SBX_SR/SBX_DB)");
}
if (SBX_DB.includes("ijvqdvsvwtwxzcqmoqit")) {
  throw new Error("safeguard: SBX_DB points at production project ref");
}

function h(sr) {
  return { Authorization: "Bearer " + sr, apikey: sr };
}

// === PHASE 1 · create sandbox bucket ===
console.log("\nPHASE 1 · Create sandbox bucket nex-music-media");
{
  const res = await fetch(SBX_SB_URL + "/storage/v1/bucket", {
    method: "POST",
    headers: { ...h(SBX_SR), "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "nex-music-media",
      name: "nex-music-media",
      public: false,
      file_size_limit: 52428800,
      allowed_mime_types: ["audio/mpeg", "audio/mp4"],
    }),
  });
  const t = await res.text();
  console.log("  bucket create:", res.status, t.slice(0, 160));
}

// === PHASE 2 · copy 5 MP3s prod → sandbox ===
console.log("\nPHASE 2 · Copy 5 MP3s prod → sandbox");
for (const name of FILES) {
  const path = DEWI_UUID + "/" + name;
  const dl = await fetch(PROD_SB_URL + "/storage/v1/object/nex-music-media/" + path, { headers: h(PROD_SR) });
  if (!dl.ok) {
    console.log("  DOWNLOAD FAIL", name, dl.status, (await dl.text()).slice(0, 120));
    continue;
  }
  const bytes = Buffer.from(await dl.arrayBuffer());
  const ul = await fetch(SBX_SB_URL + "/storage/v1/object/nex-music-media/" + path, {
    method: "POST",
    headers: { ...h(SBX_SR), "Content-Type": "audio/mpeg", "x-upsert": "true" },
    body: bytes,
  });
  const t = await ul.text();
  console.log("  " + name + " · " + bytes.length + " bytes · upload " + ul.status + " " + t.slice(0, 80));
}

// === PHASES 3+4 · DB ops ===
const c = new pg.Client({ connectionString: SBX_DB, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("BEGIN");
try {
  console.log("\nPHASE 3 · Replace sandbox Dewi");
  const existing = await c.query("SELECT id FROM public.nex_account WHERE nex_handle = $1", ["nex-80001"]);
  const placeholderId = existing.rows[0]?.id ?? null;
  if (placeholderId) {
    await c.query("DELETE FROM public.nex_creator_active_music WHERE owner_account_id = $1", [placeholderId]);
    await c.query("DELETE FROM public.nex_music_track WHERE owner_account_id = $1", [placeholderId]);
    await c.query("DELETE FROM public.nex_uploaded_video WHERE owner_account_id = $1", [placeholderId]);
    await c.query(
      "DELETE FROM public.nex_product WHERE business_id IN (SELECT id FROM public.nex_business WHERE owner_account_id = $1)",
      [placeholderId],
    );
    await c.query("DELETE FROM public.nex_business WHERE owner_account_id = $1", [placeholderId]);
    await c.query("DELETE FROM public.nex_account_profile WHERE account_id = $1", [placeholderId]);
    await c.query("DELETE FROM public.nex_account WHERE id = $1", [placeholderId]);
    console.log("  placeholder nex-80001 purged");
  } else {
    console.log("  no placeholder nex-80001 (ok)");
  }

  await c.query(
    `INSERT INTO public.nex_account
       (id, nex_handle, display_name, is_mock_persona,
        last_known_country_iso, last_known_city_label, tier)
     VALUES ($1, 'nex-99901', 'Irish Pride', true, 'IE', 'Dublin', 'gratis')
     ON CONFLICT (id) DO UPDATE SET
       nex_handle = EXCLUDED.nex_handle,
       display_name = EXCLUDED.display_name,
       is_mock_persona = EXCLUDED.is_mock_persona,
       last_known_country_iso = EXCLUDED.last_known_country_iso,
       last_known_city_label = EXCLUDED.last_known_city_label`,
    [DEWI_UUID],
  );
  await c.query(
    `INSERT INTO public.nex_account_profile
       (account_id, is_discoverable, headline, bio, created_at, updated_at)
     VALUES ($1, true, 'NEX IE · creator · Irish Pride', 'Irish folk + traditional covers. Dublin.', now(), now())
     ON CONFLICT (account_id) DO UPDATE SET
       is_discoverable = EXCLUDED.is_discoverable,
       headline = EXCLUDED.headline,
       bio = EXCLUDED.bio,
       updated_at = now()`,
    [DEWI_UUID],
  );
  console.log("  nex-99901 Irish Pride inserted");

  console.log("\nPHASE 4 · Insert 5 real tracks + 1 active slot");
  const tracksJson = JSON.parse(readFileSync(".dev-music-data/tracks.json", "utf8")).tracks;
  const dewiTracks = tracksJson.filter((t) => t.owner_account_id === DEWI_UUID);
  console.log("  found " + dewiTracks.length + " Dewi tracks in local FS");

  for (const t of dewiTracks) {
    await c.query(
      `INSERT INTO public.nex_music_track
         (id, owner_account_id, business_id, source_type, title, artist, album, duration_ms,
          media_url, source_url, cover_image_url, background_image_url, byte_size, mime_type, bitrate_kbps,
          rights_declaration, rights_notes, visibility, view_count, like_count, share_count,
          created_at, updated_at)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, $7,
               $8, $9, $10, $11, $12, $13, $14,
               $15, $16, $17, 0, 0, 0,
               now(), now())
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, visibility = EXCLUDED.visibility, updated_at = now()`,
      [
        t.id,
        t.owner_account_id,
        t.source_type || "uploaded_audio",
        t.title,
        t.artist || "Irish Pride",
        t.album ?? null,
        t.duration_ms ?? null,
        t.media_url ?? null,
        t.source_url ?? null,
        t.cover_image_url ?? null,
        t.background_image_url ?? null,
        t.byte_size ?? null,
        t.mime_type || "audio/mpeg",
        t.bitrate_kbps ?? null,
        t.rights_declaration || "owner_content",
        t.rights_notes ?? null,
        t.visibility || "shared_live",
      ],
    );
    console.log("  + " + t.title);
  }

  const slotsJson = JSON.parse(readFileSync(".dev-music-data/active-slots.json", "utf8")).slots;
  const dewiSlot = slotsJson.find((s) => s.owner_account_id === DEWI_UUID);
  if (dewiSlot) {
    await c.query(
      `INSERT INTO public.nex_creator_active_music
         (owner_account_id, track_id, publish_as_mode, publish_generation,
          rights_declaration_frozen, published_at, unpublished_at)
       VALUES ($1, $2, $3, $4, $5, now(), NULL)
       ON CONFLICT (owner_account_id) DO UPDATE SET
         track_id = EXCLUDED.track_id,
         publish_generation = public.nex_creator_active_music.publish_generation + 1,
         publish_as_mode = EXCLUDED.publish_as_mode,
         rights_declaration_frozen = EXCLUDED.rights_declaration_frozen,
         published_at = now(),
         unpublished_at = NULL`,
      [
        DEWI_UUID,
        dewiSlot.track_id,
        dewiSlot.publish_as_mode || "cover_audio",
        dewiSlot.publish_generation || 1,
        dewiSlot.rights_declaration_frozen || "owner_content",
      ],
    );
    const title = dewiTracks.find((t) => t.id === dewiSlot.track_id)?.title ?? "<unknown>";
    console.log("  + active slot → " + title);
  }

  await c.query("COMMIT");
  console.log("\nPHASE 5 · Verify sandbox");
  const v = await c.query(
    `SELECT a.nex_handle, a.display_name, a.last_known_country_iso, p.is_discoverable,
            (SELECT count(*)::int FROM public.nex_music_track WHERE owner_account_id = a.id) AS tracks,
            (SELECT title FROM public.nex_music_track t
               JOIN public.nex_creator_active_music s ON s.track_id = t.id
              WHERE s.owner_account_id = a.id AND s.unpublished_at IS NULL) AS active_track
       FROM public.nex_account a
  LEFT JOIN public.nex_account_profile p ON p.account_id = a.id
      WHERE a.id = $1`,
    [DEWI_UUID],
  );
  console.log("  " + JSON.stringify(v.rows[0]));
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  await c.end();
}

// Storage verify
console.log("\nStorage verify · sandbox nex-music-media objects for Dewi:");
const list = await fetch(SBX_SB_URL + "/storage/v1/object/list/nex-music-media", {
  method: "POST",
  headers: { ...h(SBX_SR), "Content-Type": "application/json" },
  body: JSON.stringify({ prefix: DEWI_UUID + "/", limit: 20 }),
});
const lb = await list.json();
if (Array.isArray(lb)) for (const o of lb) console.log("  " + o.name + " · " + (o.metadata?.size ?? "—") + " bytes");
else console.log("  " + JSON.stringify(lb));
