// scripts/upload-shop-theme-backgrounds.mjs
// Owner-authorised 2026-11-07 · bulk-upload the 154 shop background
// preset PNGs into the sealed Supabase project's Storage so there's a
// "data feed" copy alongside the Next.js static assets.
//
// SOURCE: public/nex-brand/shop-themes/*.png (154 files · already in
//         the repo, already serving at /nex-brand/shop-themes/*)
// TARGET: bucket `nex-brand-shop-themes` (new · public read)
//
// Idempotent: uploads use upsert:true so re-runs are safe.
// Does NOT modify the PRESETS array or PRESET_BACKGROUND_META
// whitelist · the Next.js static route remains the primary URL the
// app serves. This upload creates a parallel Supabase copy that can be
// read via a future `nex_shop_background_preset` table or by any
// client that prefers a Supabase CDN URL.
//
// Writes a report JSON at scripts/.upload-report-shop-themes.json
// mapping filename → public URL so follow-on migrations or scripts
// can bind filenames to URLs without re-querying Storage.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function readEnv(k) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === k) return m[2].replace(/^"|"$/g, "");
  }
  return null;
}

const url = readEnv("NEXT_PUBLIC_NEX_SUPABASE_URL");
const key = readEnv("NEX_SUPABASE_SERVICE_ROLE_KEY");
if (!url?.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error(
    `ERR: NEXT_PUBLIC_NEX_SUPABASE_URL must point at ijvqdvsvwtwxzcqmoqit · got: ${url}`,
  );
  process.exit(3);
}
if (!key || key.length < 50) {
  console.error("ERR: NEX_SUPABASE_SERVICE_ROLE_KEY missing or too short");
  process.exit(3);
}

const BUCKET = "nex-brand-shop-themes";
const SOURCE_DIR = "public/nex-brand/shop-themes";

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 1 · Ensure bucket exists (public read).
console.log(`\n── bucket ${BUCKET} ──`);
const list = await supabase.storage.listBuckets();
if (list.error) {
  console.error("listBuckets:", list.error.message);
  process.exit(4);
}
const existing = (list.data ?? []).find((b) => b.name === BUCKET);
if (existing) {
  console.log(`bucket exists · public=${existing.public}`);
  if (!existing.public) {
    console.warn(
      "bucket exists but is PRIVATE · uploads will succeed but direct CDN URLs will 403",
    );
  }
} else {
  const created = await supabase.storage.createBucket(BUCKET, {
    public: true,
  });
  if (created.error) {
    console.error("createBucket:", created.error.message);
    process.exit(5);
  }
  console.log("bucket CREATED public");
}

// 2 · Enumerate source PNGs · sorted alphabetically for deterministic output
const srcFiles = readdirSync(SOURCE_DIR)
  .filter((f) => /\.png$/i.test(f))
  .sort();
console.log(`\nfound ${srcFiles.length} source backgrounds`);

// 3 · For each file: upload with upsert · collect public URL
const uploads = [];
let ok = 0;
let failed = 0;
let i = 0;
for (const name of srcFiles) {
  i++;
  const srcPath = resolve(SOURCE_DIR, name);
  const bytes = readFileSync(srcPath);
  const dstKey = name; // no prefix · one-level bucket
  const putRes = await supabase.storage
    .from(BUCKET)
    .upload(dstKey, bytes, {
      contentType: "image/png",
      upsert: true,
    });
  if (putRes.error) {
    console.error(`[${i}/${srcFiles.length}] ${name} FAIL · ${putRes.error.message}`);
    failed++;
    continue;
  }
  const pub = supabase.storage.from(BUCKET).getPublicUrl(dstKey);
  uploads.push({
    file: name,
    staticUrl: `/nex-brand/shop-themes/${name}`,
    supabaseUrl: pub.data.publicUrl,
    bytes: bytes.byteLength,
  });
  ok++;
  if (i % 10 === 0 || i === srcFiles.length) {
    console.log(`[${i}/${srcFiles.length}] ${name} ok · ${(bytes.byteLength / 1024).toFixed(1)}KB`);
  }
}

// 4 · Write the report
const report = {
  meta: {
    generatedAt: new Date().toISOString(),
    bucket: BUCKET,
    sourceDir: SOURCE_DIR,
    totalFound: srcFiles.length,
    uploaded: ok,
    failed,
  },
  uploads,
};
const reportPath = "scripts/.upload-report-shop-themes.json";
writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

console.log(`\n── summary ──`);
console.log(`uploaded: ${ok}/${srcFiles.length}`);
console.log(`failed:   ${failed}`);
console.log(`report:   ${reportPath}`);
console.log(`bucket:   ${BUCKET} (public)`);
if (failed > 0) {
  process.exit(6);
}
