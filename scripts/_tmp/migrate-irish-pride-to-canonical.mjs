// scripts/_tmp/migrate-irish-pride-to-canonical.mjs
// Owner-authorised one-way migration 2026-11-04.
// Copies Irish Pride (nex-99901) assets from Ireland preview
// (kdstoyyeygcopkogqsyv · UUID 11111111-1111-4111-8111-111111111111)
// → canonical (ijvqdvsvwtwxzcqmoqit · UUID 11111111-aaaa-4aaa-8aaa-111111111111).
//
// Scope:
//   1. Copy Storage objects:
//        · nex-avatars/[preview]/avatar.png
//        · nex-music-media/[preview]/audio-*.mp3           (6)
//        · nex-music-media/[preview]/cover-*.png           (6)
//        · nex-music-media/[preview]/background-*.png      (6)
//      Target bucket + path uses the canonical -aaaa- UUID segment.
//      Cover image (cover.png in nex-avatars) is also copied so a
//      later `cover_image_url` column add can wire straight up.
//   2. INSERT 6 nex_music_track rows into canonical with:
//        · same id (zero collisions verified in preflight)
//        · owner_account_id rewritten to canonical UUID
//        · sb:// media/cover/background URLs rewritten (UUID segment)
//   3. UPSERT canonical nex_account_profile with:
//        · avatar_url  = canonical public URL
//        · headline    = preview row's headline
//        · bio         = preview row's bio
//        · country_code = 'IE' (sensible default)
//      Does NOT touch profession/interests/socials · those get set
//      via the profile edit UI.
//
// Safety:
//   · Preflight asserts target DB is ijvqdvsvwtwxzcqmoqit
//   · Preflight asserts canonical Irish Pride row exists + is mock
//   · Dry-run mode via DRY_RUN=1 env var · no writes performed
//   · Idempotent: Storage upserts, music track inserts gated by
//     ON CONFLICT DO NOTHING, profile row via UPSERT

import { readFileSync } from "node:fs";
import pg from "pg";

const DRY_RUN = process.env.DRY_RUN === "1";

function readEnv(k) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === k) return m[2];
  }
  return null;
}

const PREVIEW_DB =
  "postgresql://postgres:adminphilip240176.@db.kdstoyyeygcopkogqsyv.supabase.co:5432/postgres";
const PREVIEW_URL = "https://kdstoyyeygcopkogqsyv.supabase.co";
const PREVIEW_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtkc3RveXlleWdjb3Brb2dxc3l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzQyMDA1MCwiZXhwIjoyMTA4OTk2MDUwfQ.jxQICmJgddzJXAkPH8XliRCQS9cBUlZhlNbsUPq1ioA";

const CANON_DB = readEnv("DATABASE_URL");
const CANON_URL = readEnv("NEXT_PUBLIC_NEX_SUPABASE_URL");
const CANON_SERVICE_KEY = readEnv("NEX_SUPABASE_SERVICE_ROLE_KEY");

if (!CANON_DB?.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ABORT · canonical DB URL does not point at ijvqdvsvwtwxzcqmoqit");
  process.exit(3);
}

const PREVIEW_UUID = "11111111-1111-4111-8111-111111111111";
const CANON_UUID = "11111111-aaaa-4aaa-8aaa-111111111111";

function rewriteSb(sbUrl) {
  if (!sbUrl || !sbUrl.startsWith("sb://")) return sbUrl;
  return sbUrl.replace(PREVIEW_UUID, CANON_UUID);
}
function publicCanonUrl(bucket, path) {
  return `${CANON_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// ─── Storage copy helpers ────────────────────────────────────────
async function listPreview(bucket, prefix) {
  const url = new URL(`/storage/v1/object/list/${bucket}`, PREVIEW_URL);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: PREVIEW_SERVICE_KEY,
      Authorization: `Bearer ${PREVIEW_SERVICE_KEY}`,
    },
    body: JSON.stringify({ prefix, limit: 100, offset: 0 }),
  });
  if (!res.ok) throw new Error(`list ${bucket}/${prefix}: ${res.status}`);
  return await res.json();
}
async function downloadPreview(bucket, path) {
  const url = `${PREVIEW_URL}/storage/v1/object/${bucket}/${path}`;
  const res = await fetch(url, {
    headers: {
      apikey: PREVIEW_SERVICE_KEY,
      Authorization: `Bearer ${PREVIEW_SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`download ${bucket}/${path}: ${res.status}`);
  const ct = res.headers.get("content-type") ?? "application/octet-stream";
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, contentType: ct };
}
async function uploadCanonical(bucket, path, buf, contentType) {
  if (DRY_RUN) {
    console.log(`    [dry-run] would PUT ${bucket}/${path} (${buf.length} bytes, ${contentType})`);
    return;
  }
  const url = `${CANON_URL}/storage/v1/object/${bucket}/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      apikey: CANON_SERVICE_KEY,
      Authorization: `Bearer ${CANON_SERVICE_KEY}`,
      "x-upsert": "true",
      "Cache-Control": "max-age=3600",
    },
    body: buf,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`upload ${bucket}/${path}: ${res.status} ${txt}`);
  }
}

// ─── Preflight ──────────────────────────────────────────────────
const canonClient = new pg.Client({ connectionString: CANON_DB });
await canonClient.connect();
console.log(`CONNECTED canonical${DRY_RUN ? " (DRY RUN)" : ""}`);

const check = await canonClient.query(
  "SELECT id, nex_handle, display_name, is_mock_persona FROM nex_account WHERE id = $1",
  [CANON_UUID],
);
if (check.rows.length === 0) {
  console.error("ABORT · canonical Irish Pride row not found at expected UUID");
  process.exit(4);
}
if (!check.rows[0].is_mock_persona) {
  console.error("ABORT · canonical target is NOT flagged is_mock_persona");
  process.exit(5);
}
console.log(`Target: ${check.rows[0].nex_handle} · ${check.rows[0].display_name}`);

// ─── Step 1 · Storage copy ──────────────────────────────────────
console.log("\n─── Step 1 · Storage copy ───");

async function copyBucketPrefix(bucket) {
  const items = await listPreview(bucket, PREVIEW_UUID);
  console.log(`  bucket=${bucket} items=${items.length}`);
  for (const it of items) {
    const srcPath = `${PREVIEW_UUID}/${it.name}`;
    const dstPath = `${CANON_UUID}/${it.name}`;
    const { buf, contentType } = await downloadPreview(bucket, srcPath);
    await uploadCanonical(bucket, dstPath, buf, contentType);
    console.log(`    ok · ${srcPath}  →  ${dstPath}  (${buf.length} B, ${contentType})`);
  }
}
await copyBucketPrefix("nex-avatars");
await copyBucketPrefix("nex-music-media");

// ─── Step 2 · Insert music tracks ───────────────────────────────
console.log("\n─── Step 2 · nex_music_track insert ───");
const previewClient = new pg.Client({ connectionString: PREVIEW_DB });
await previewClient.connect();
let tracks;
try {
  tracks = (
    await previewClient.query(
      `SELECT * FROM nex_music_track WHERE owner_account_id = $1 ORDER BY created_at`,
      [PREVIEW_UUID],
    )
  ).rows;
} finally {
  await previewClient.end();
}
console.log(`  fetched ${tracks.length} tracks from preview`);

const insertSql = `
  INSERT INTO nex_music_track (
    id, owner_account_id, business_id, source_type, title, artist, album,
    duration_ms, media_url, source_url, cover_image_url, background_image_url,
    byte_size, mime_type, bitrate_kbps, rights_declaration, rights_notes,
    visibility, view_count, like_count, share_count, created_at, updated_at, removed_at
  ) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id, title
`;
let inserted = 0;
for (const t of tracks) {
  const vals = [
    t.id,
    CANON_UUID, // rewrite owner
    t.business_id,
    t.source_type,
    t.title,
    t.artist,
    t.album,
    t.duration_ms,
    rewriteSb(t.media_url),
    t.source_url,
    rewriteSb(t.cover_image_url),
    rewriteSb(t.background_image_url),
    t.byte_size,
    t.mime_type,
    t.bitrate_kbps,
    t.rights_declaration,
    t.rights_notes,
    t.visibility,
    t.view_count,
    t.like_count,
    t.share_count,
    t.created_at,
    t.updated_at,
    t.removed_at,
  ];
  if (DRY_RUN) {
    console.log(`    [dry-run] would INSERT ${t.id} · ${t.title}`);
    continue;
  }
  const r = await canonClient.query(insertSql, vals);
  if (r.rows.length > 0) {
    console.log(`    inserted · ${r.rows[0].id} · ${r.rows[0].title}`);
    inserted += 1;
  } else {
    console.log(`    skipped (conflict) · ${t.id} · ${t.title}`);
  }
}
console.log(`  inserted ${inserted}/${tracks.length}`);

// ─── Step 3 · Upsert Irish Pride profile ────────────────────────
console.log("\n─── Step 3 · nex_account_profile upsert ───");
const avatarPublic = publicCanonUrl("nex-avatars", `${CANON_UUID}/avatar.png`);
const headline = "NEX IE · creator · Irish Pride";
const bio = "Irish folk + traditional covers. Dublin.";
if (DRY_RUN) {
  console.log(`    [dry-run] would UPSERT profile · avatar_url=${avatarPublic}`);
} else {
  const r = await canonClient.query(
    `INSERT INTO nex_account_profile (account_id, avatar_url, headline, bio, country_code, is_public, is_discoverable)
     VALUES ($1, $2, $3, $4, 'IE', true, true)
     ON CONFLICT (account_id) DO UPDATE
        SET avatar_url      = EXCLUDED.avatar_url,
            headline        = COALESCE(nex_account_profile.headline, EXCLUDED.headline),
            bio             = COALESCE(nex_account_profile.bio, EXCLUDED.bio),
            country_code    = COALESCE(nex_account_profile.country_code, EXCLUDED.country_code),
            is_public       = COALESCE(nex_account_profile.is_public, EXCLUDED.is_public),
            is_discoverable = COALESCE(nex_account_profile.is_discoverable, EXCLUDED.is_discoverable),
            updated_at      = now()
     RETURNING account_id, avatar_url, headline, bio, country_code`,
    [CANON_UUID, avatarPublic, headline, bio],
  );
  console.log(`    ok · ${r.rows[0].account_id}`);
  console.log(`         avatar_url  = ${r.rows[0].avatar_url}`);
  console.log(`         headline    = ${r.rows[0].headline}`);
  console.log(`         bio         = ${r.rows[0].bio}`);
  console.log(`         country     = ${r.rows[0].country_code}`);
}

await canonClient.end();
console.log(`\nDONE ${DRY_RUN ? "(DRY RUN · no writes)" : ""}`);
