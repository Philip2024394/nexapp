// scripts/mock-personas/upload-hendra-videos-w6.mjs
//
// Author · owner-authorised 2026-10-28 ("yes we must save to superbase").
//
// What it does (idempotent, DRY_RUN by default):
//
//   1 · Hard-abort unless env points at `ijvqdvsvwtwxzcqmoqit`.
//   2 · Ensure Supabase storage bucket `nex-live-uploaded` exists
//       (public-read · matches the DB default `storage_bucket`
//       column of `nex_uploaded_video` + the sealed DEV_BUCKET
//       constant in `src/lib/nex-native/live-broadcast/
//       dev-video-manifest.ts`). The bucket does not currently exist
//       in prod · creating it is first-time infra.
//   3 · Upload the 6 mp4 files from `public/dev/live-videos/` to
//       the bucket at path `hendra/<filename>`. Upsert so re-running
//       overwrites instead of failing.
//   4 · UPSERT 6 rows into `nex_uploaded_video` with:
//         - owner_account_id = Hendra UUID
//         - business_id      = Hendra's business UUID
//         - title            = watch title (<=120 chars)
//         - caption          = watchHeadline
//         - storage_bucket   = 'nex-live-uploaded'
//         - storage_object_path = 'hendra/<filename>'
//         - mime_type        = 'video/mp4'
//         - rights_declaration = 'owner_content'
//         - country_of_origin = 'ID'
//         - topic_tags       = from manifest (max 10)
//         - source           = 'owner_upload'
//         - visibility       = 'public'
//         - published_at     = publishedAtIso from manifest
//         - byte_size        = file size on disk
//         - duration_seconds = from manifest
//       IDs are deterministic (SHA-256 of stable seed) so re-running
//       hits the same rows via ON CONFLICT (id) DO UPDATE.
//
// Safety:
//   · Hard-abort unless NEXT_PUBLIC_NEX_SUPABASE_URL + DATABASE_URL
//     both contain `ijvqdvsvwtwxzcqmoqit`.
//   · DRY_RUN mode is the DEFAULT. Previews every operation.
//   · HENDRA_VIDEOS_UPLOAD_APPLY=1 required to execute.
//   · Scoped by HENDRA_UUID + HENDRA_BUSINESS_UUID constants.
//   · Does NOT touch any other persona.
//   · Does NOT create or modify nex_live_session, nex_watch_listing,
//     or any other table beyond `nex_uploaded_video`.
//
// Rollback (manual, run against ijvqdvsvwtwxzcqmoqit):
//
//   DELETE FROM nex_uploaded_video
//    WHERE owner_account_id = '4f112c32-46a3-4fa4-8b4a-1c5f50caed42'
//      AND storage_object_path LIKE 'hendra/snaptik_%';
//   -- storage objects can be deleted via the Supabase dashboard
//   -- or via @supabase/supabase-js storage.remove()
//
// Usage:
//
//   # Dry run (default · writes nothing):
//   node scripts/mock-personas/upload-hendra-videos-w6.mjs
//
//   # Execute writes (requires explicit opt-in):
//   HENDRA_VIDEOS_UPLOAD_APPLY=1 \
//     node scripts/mock-personas/upload-hendra-videos-w6.mjs

import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const HENDRA_UUID = "4f112c32-46a3-4fa4-8b4a-1c5f50caed42";
const HENDRA_BUSINESS_UUID = "b101041a-57ef-4c34-8904-40db75d13bc8";
const BUCKET = "nex-live-uploaded";

/** Deterministic UUID (same algo as persona-manifest). */
function deterministicUuid(seed) {
  const h = createHash("sha256").update(`nex-hendra-video:${seed}`).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,
    `8${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join("-");
}

// The 6 videos · metadata mirrors the DEV_VIDEO_MANIFEST entries
// (dev-video-hendra-10 .. 15). Keep in sync when the manifest changes.
const VIDEOS = [
  {
    manifestId: "dev-video-hendra-10",
    filename: "snaptik_7690132468275498253_v3.mp4",
    title: "Dual-Time Watch · World Map + Classic",
    caption: "Dual-Dial Watch · World Map + Classic",
    topicTags: ["watch", "dual-time", "world-map"],
    publishedAtIso: "2026-10-28T08:00:00Z",
    durationSeconds: 12,
  },
  {
    manifestId: "dev-video-hendra-11",
    filename: "snaptik_7691193978569395470_v3.mp4",
    title: "Nordgreen Infinity Petite · Blue",
    caption: "Nordgreen · Infinity Petite · Blue",
    topicTags: ["watch", "nordgreen", "infinity-petite"],
    publishedAtIso: "2026-10-28T08:05:00Z",
    durationSeconds: 13,
  },
  {
    manifestId: "dev-video-hendra-12",
    filename: "snaptik_7691568982611987725_v3.mp4",
    title: "Jewelry Watch · Green MOP · 12 Gem Markers",
    caption: "Luxury Jewelry Watch · Green MOP · 12 Gem Markers",
    topicTags: ["watch", "jewelry", "gem-set"],
    publishedAtIso: "2026-10-28T08:10:00Z",
    durationSeconds: 11,
  },
  {
    manifestId: "dev-video-hendra-13",
    filename: "snaptik_7693088304782134542_v3.mp4",
    title: "Rose Gold Pavé Diamond Chronograph · Skeleton",
    caption: "Rose Gold Pavé Diamond Chronograph · Skeleton Dial",
    topicTags: ["watch", "chronograph", "diamonds", "rose-gold"],
    publishedAtIso: "2026-10-28T08:15:00Z",
    durationSeconds: 16,
  },
  {
    manifestId: "dev-video-hendra-14",
    filename: "snaptik_7696085218729544973_v3.mp4",
    title: "Yellow Gold Cushion Chronograph · Blue Dial",
    caption: "Yellow Gold Cushion Chronograph · Blue Dial",
    topicTags: ["watch", "chronograph", "cushion"],
    publishedAtIso: "2026-10-28T08:20:00Z",
    durationSeconds: 7,
  },
  {
    manifestId: "dev-video-hendra-15",
    filename: "snaptik_7673852249835097357_v3.mp4",
    title: "Yellow Gold Chronograph · Green Dial · Open-Heart",
    caption: "Yellow Gold Chronograph · Green Dial · Open-Heart",
    topicTags: ["watch", "chronograph", "open-heart", "diamonds"],
    publishedAtIso: "2026-10-28T08:25:00Z",
    durationSeconds: 12,
  },
];

/* ─── Env + safety ─────────────────────────────────────────────────── */

function readEnv() {
  const map = {};
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map[m[1]] = m[2];
  }
  return map;
}

const env = readEnv();
const supabaseUrl = env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const serviceKey  = env.NEX_SUPABASE_SERVICE_ROLE_KEY;
const dbUrl       = env.DATABASE_URL;
if (!supabaseUrl || !serviceKey || !dbUrl) {
  console.error("ERR: missing env (NEXT_PUBLIC_NEX_SUPABASE_URL / NEX_SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL)");
  process.exit(2);
}
if (!supabaseUrl.includes("ijvqdvsvwtwxzcqmoqit") || !dbUrl.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: env does not point at ijvqdvsvwtwxzcqmoqit · aborting (safety gate)");
  process.exit(3);
}

const APPLY = process.env.HENDRA_VIDEOS_UPLOAD_APPLY === "1";

console.log("");
console.log(`== upload-hendra-videos-w6 ==`);
console.log(`mode             : ${APPLY ? "APPLY (will upload + insert)" : "DRY_RUN (no writes)"}`);
console.log(`supabase project : ${supabaseUrl}`);
console.log(`bucket           : ${BUCKET}`);
console.log(`hendra account   : ${HENDRA_UUID}  (nex-50014 / Hendra Gunawan · tier=bisnis)`);
console.log(`hendra business  : ${HENDRA_BUSINESS_UUID}  (hendra-watches)`);
console.log(`videos           : ${VIDEOS.length}`);
console.log("");

// Resolve byte_size for every file
for (const v of VIDEOS) {
  const path = `public/dev/live-videos/${v.filename}`;
  const stat = statSync(path);
  v.byteSize = stat.size;
  v.rowId = deterministicUuid(v.manifestId);
  console.log(`→ ${v.manifestId}`);
  console.log(`    file         : ${path}`);
  console.log(`    bytes        : ${v.byteSize}`);
  console.log(`    rowId        : ${v.rowId}`);
  console.log(`    storage path : hendra/${v.filename}`);
  console.log(`    title        : ${v.title}`);
  console.log("");
}

if (!APPLY) {
  console.log("DRY_RUN · the following operations would execute:");
  console.log(`  1. storage.createBucket('${BUCKET}', { public: true }) if absent`);
  console.log(`  2. storage.from('${BUCKET}').upload('hendra/<filename>', buffer, { upsert: true }) × ${VIDEOS.length}`);
  console.log(`  3. INSERT ... ON CONFLICT(id) DO UPDATE on nex_uploaded_video × ${VIDEOS.length}`);
  console.log("");
  console.log("Nothing written. To apply:");
  console.log("  HENDRA_VIDEOS_UPLOAD_APPLY=1 node scripts/mock-personas/upload-hendra-videos-w6.mjs");
  console.log("");
  process.exit(0);
}

/* ─── Apply mode ───────────────────────────────────────────────────── */

const supa = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureBucket() {
  const { data: list, error } = await supa.storage.listBuckets();
  if (error) throw new Error(`listBuckets: ${error.message}`);
  if (list.find((b) => b.name === BUCKET)) {
    console.log(`bucket ${BUCKET} already exists`);
    return;
  }
  const { error: cErr } = await supa.storage.createBucket(BUCKET, { public: true });
  if (cErr) throw new Error(`createBucket: ${cErr.message}`);
  console.log(`bucket ${BUCKET} CREATED (public=true)`);
}

async function uploadOne(v) {
  const buf = readFileSync(`public/dev/live-videos/${v.filename}`);
  const dest = `hendra/${v.filename}`;
  const { error } = await supa.storage.from(BUCKET).upload(dest, buf, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (error) throw new Error(`upload ${dest}: ${error.message}`);
  console.log(`  uploaded ${dest} (${v.byteSize} bytes)`);
}

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
console.log("CONNECTED to postgres · beginning transaction");

try {
  await ensureBucket();
  for (const v of VIDEOS) await uploadOne(v);

  await client.query("BEGIN");
  for (const v of VIDEOS) {
    const sql = `
      INSERT INTO nex_uploaded_video
        (id, owner_account_id, business_id, title, caption,
         storage_bucket, storage_object_path, duration_seconds, byte_size,
         mime_type, rights_declaration, country_of_origin, topic_tags,
         source, visibility, published_at, is_ai_generated)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'video/mp4',
         'owner_content', 'ID', $10::text[],
         'owner_upload', 'public', $11, false)
      ON CONFLICT (id) DO UPDATE SET
        title              = EXCLUDED.title,
        caption            = EXCLUDED.caption,
        storage_bucket     = EXCLUDED.storage_bucket,
        storage_object_path= EXCLUDED.storage_object_path,
        duration_seconds   = EXCLUDED.duration_seconds,
        byte_size          = EXCLUDED.byte_size,
        topic_tags         = EXCLUDED.topic_tags,
        visibility         = EXCLUDED.visibility,
        published_at       = EXCLUDED.published_at
      RETURNING id, title, visibility, storage_bucket, storage_object_path
    `;
    const binds = [
      v.rowId,
      HENDRA_UUID,
      HENDRA_BUSINESS_UUID,
      v.title,
      v.caption,
      BUCKET,
      `hendra/${v.filename}`,
      v.durationSeconds,
      v.byteSize,
      v.topicTags,
      v.publishedAtIso,
    ];
    const res = await client.query(sql, binds);
    console.log(`  row:`, JSON.stringify(res.rows[0]));
  }
  await client.query("COMMIT");
  console.log("");
  console.log("DONE · transaction committed · 6 rows upserted · 6 videos uploaded");
  console.log("");
  console.log("Verify in-browser:");
  console.log(`  Public URL example: ${supabaseUrl}/storage/v1/object/public/${BUCKET}/hendra/${VIDEOS[0].filename}`);
} catch (e) {
  await client.query("ROLLBACK");
  console.error("");
  console.error(`ROLLBACK · ${e.message}`);
  process.exit(1);
} finally {
  await client.end();
}
