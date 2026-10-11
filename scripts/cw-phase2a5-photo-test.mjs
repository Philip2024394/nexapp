// scripts/cw-phase2a5-photo-test.mjs
//
// Phase 2A.5 photo-upload smoke test. Exercises the same sharp +
// Supabase storage path the service uses, then verifies DB CHECKs,
// bucket allowlist, and public URL retrieval. Cleans up at the end.

import fs from "node:fs";
import pg from "pg";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}

const supabase = createClient(
  env.NEXT_PUBLIC_NEX_SUPABASE_URL,
  env.NEX_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const pgClient = new pg.Client({ connectionString: env.DATABASE_URL });
await pgClient.connect();

const results = [];
const pass = (step, info) => { results.push({step,status:"PASS",info}); console.log(`[${step}] PASS · ${info}`); };
const fail = (step, info) => { results.push({step,status:"FAIL",info}); console.log(`[${step}] FAIL · ${info}`); };
const SUFFIX = `p2a5-${Date.now().toString(36)}`;
console.log(`== Phase 2A.5 photo pipeline · ${SUFFIX} ==\n`);

const { rows: accs } = await pgClient.query(`SELECT id, display_name FROM nex_account ORDER BY created_at DESC LIMIT 1;`);
const [author] = accs;
const { rows: [zone] } = await pgClient.query(
  `SELECT id, name FROM nex_community_zone WHERE country=$1 AND level=$2 AND slug=$3;`,
  ["ID", "kecamatan", "mantrijeron"],
);
console.log(`Author: ${author.id.slice(0,8)}  Zone: ${zone.name}\n`);

// Seed membership + a card
await pgClient.query(
  `INSERT INTO nex_community_membership (account_id, hyperlocal_zone_id, district_zone_id, notification_preference, safety_pref, lost_found_pref, events_pref, voting_pref, life_news_pref)
   VALUES ($1,$2,$2,'urgent_only','urgent_only','urgent_only','off','off','off')
   ON CONFLICT (account_id) DO NOTHING;`,
  [author.id, zone.id],
);
const { rows: [card] } = await pgClient.query(
  `INSERT INTO nex_community_card (kind, hyperlocal_zone_id, district_zone_id, author_account_id, title, status, expires_at)
   VALUES ('lost_found',$1,$1,$2,$3,'active', now() + interval '60 days')
   RETURNING id;`,
  [zone.id, author.id, `${SUFFIX} test`],
);
await pgClient.query(
  `INSERT INTO nex_community_lost_found_detail (card_id, lost_or_found, subject_kind) VALUES ($1,'lost','pet');`,
  [card.id],
);
pass("1", `Card seeded · ${card.id.slice(0,8)}`);

// --- Pipeline step 1: sharp (strip EXIF via rotate(), resize, encode webp)
const rawJpeg = await sharp({
  create: { width: 1200, height: 800, channels: 3, background: { r: 20, g: 150, b: 200 } },
}).jpeg({ quality: 85 }).toBuffer();
pass("2", `Synthetic JPEG · ${rawJpeg.length}B`);

const processed = await sharp(rawJpeg)
  .rotate()
  .resize({ width: 1600, height: 1600, fit: "inside" })
  .webp({ quality: 82 })
  .toBuffer({ resolveWithObject: true });
pass("3", `WebP encoded · ${processed.data.length}B · ${processed.info.width}x${processed.info.height}`);

// --- Pipeline step 2: upload to bucket
const storagePath = `${card.id}/0-${Date.now()}.webp`;
const up = await supabase.storage.from("nex-community-photos").upload(storagePath, processed.data, {
  contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable", upsert: false,
});
if (up.error) { fail("4", `upload: ${up.error.message}`); process.exit(2); }
pass("4", `Uploaded to bucket · path=${storagePath}`);

// --- Pipeline step 3: insert photo row (DB CHECK enforces size)
const { rows: [photoRow] } = await pgClient.query(
  `INSERT INTO nex_community_card_photo (card_id, storage_path, display_order, bytes, width_px, height_px)
   VALUES ($1,$2,0,$3,$4,$5) RETURNING id, display_order;`,
  [card.id, storagePath, processed.data.length, processed.info.width, processed.info.height],
);
pass("5", `Photo row inserted · display_order=${photoRow.display_order}`);

// --- Pipeline step 4: public URL fetch
const publicUrl = `${env.NEXT_PUBLIC_NEX_SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/public/nex-community-photos/${storagePath}`;
const r = await fetch(publicUrl);
if (r.status === 200 && r.headers.get("content-type")?.startsWith("image/")) {
  const buf = await r.arrayBuffer();
  pass("6", `Public URL serves · HTTP 200 · ${buf.byteLength}B · ${r.headers.get("content-type")}`);
} else {
  fail("6", `public URL HTTP ${r.status}`);
}

// --- DB enforces 2-photo cap: trying display_order=2 should fail
try {
  await pgClient.query(
    `INSERT INTO nex_community_card_photo (card_id, storage_path, display_order, bytes) VALUES ($1,'x/2.webp',2,1000);`,
    [card.id],
  );
  fail("7", `display_order=2 accepted`);
} catch (e) {
  if (e.code === "23514") pass("7", `display_order=2 rejected by CHECK (23514)`);
  else fail("7", `wrong code: ${e.code}`);
}

// --- DB enforces 2 MB cap
try {
  await pgClient.query(
    `INSERT INTO nex_community_card_photo (card_id, storage_path, display_order, bytes) VALUES ($1,'x/oversize.webp',1,2097153);`,
    [card.id],
  );
  fail("8", `oversize bytes accepted`);
} catch (e) {
  if (e.code === "23514") pass("8", `oversize bytes rejected by CHECK (23514)`);
  else fail("8", `wrong code: ${e.code}`);
}

// --- Bucket rejects an unsupported MIME at the storage layer
const badUpload = await supabase.storage.from("nex-community-photos").upload(`${card.id}/bad.gif`, Buffer.from([0]), {
  contentType: "image/gif", upsert: false,
});
if (badUpload.error) pass("9", `Bucket rejects image/gif · ${badUpload.error.message.slice(0,80)}`);
else fail("9", `bucket accepted image/gif`);

console.log(`\n== Summary · PASS=${results.filter(r=>r.status==="PASS").length} FAIL=${results.filter(r=>r.status==="FAIL").length} ==`);

// Cleanup
await supabase.storage.from("nex-community-photos").remove([storagePath]);
await pgClient.query(`DELETE FROM nex_community_card WHERE id=$1;`, [card.id]);
console.log(`Cleanup · bucket object removed · card cascaded (detail + photo rows)`);
await pgClient.end();
if (results.some(r => r.status === "FAIL")) process.exit(2);
