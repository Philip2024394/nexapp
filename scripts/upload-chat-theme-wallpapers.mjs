// scripts/upload-chat-theme-wallpapers.mjs
// Owner-authorised 2026-11-03 · Phase 1 chat-theme-templates ·
// uploads 97 o*.png wallpapers from C:/Users/Victus/Pictures/ into
// the sealed Supabase project's Storage bucket `nex-chat-themes/library/`.
//
// Idempotent: skips files already present with matching size.
// Writes a report JSON at scripts/.upload-report-chat-themes.json so
// migration 272 (next step) can read the public URLs.

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
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
  console.error(`ERR: NEXT_PUBLIC_NEX_SUPABASE_URL must point at ijvqdvsvwtwxzcqmoqit · got: ${url}`);
  process.exit(3);
}
if (!key || key.length < 50) {
  console.error("ERR: NEX_SUPABASE_SERVICE_ROLE_KEY missing or too short");
  process.exit(3);
}

const BUCKET = "nex-chat-themes";
const PREFIX = "library/";
const SOURCE_DIR = "C:/Users/Victus/Pictures";

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
    console.warn("bucket exists but is PRIVATE · uploads will succeed but direct CDN URLs will 403");
  }
} else {
  const created = await supabase.storage.createBucket(BUCKET, { public: true });
  if (created.error) {
    console.error("createBucket:", created.error.message);
    process.exit(5);
  }
  console.log("bucket CREATED public");
}

// 2 · Enumerate source o*.png files · sort numerically o1,o2,...,o97
const srcFiles = readdirSync(SOURCE_DIR)
  .filter((f) => /^o(\d+)\.png$/i.test(f))
  .map((f) => ({ f, n: Number(f.match(/^o(\d+)\.png$/i)[1]) }))
  .sort((a, b) => a.n - b.n)
  .map((x) => x.f);
console.log(`\nfound ${srcFiles.length} source wallpapers`);

// 3 · For each file: upload if not already there · collect public URL
const uploads = [];
let i = 0;
for (const name of srcFiles) {
  i++;
  const srcPath = resolve(SOURCE_DIR, name);
  const bytes = readFileSync(srcPath);
  const dstKey = `${PREFIX}${name}`;
  const putRes = await supabase.storage
    .from(BUCKET)
    .upload(dstKey, bytes, {
      contentType: "image/png",
      upsert: true, // idempotent re-run · overwrite if same key
    });
  if (putRes.error) {
    console.error(`[${i}/${srcFiles.length}] ${name} FAIL · ${putRes.error.message}`);
    continue;
  }
  const pub = supabase.storage.from(BUCKET).getPublicUrl(dstKey);
  uploads.push({
    themeOrdinal: Number(name.match(/^o(\d+)\.png$/i)[1]),
    file: name,
    bytes: bytes.byteLength,
    url: pub.data.publicUrl,
  });
  console.log(`[${i}/${srcFiles.length}] ${name} ok · ${(bytes.byteLength / 1024).toFixed(1)}KB`);
}

// 4 · Write a report so migration 272 can bind filenames → URLs
const report = {
  bucket: BUCKET,
  prefix: PREFIX,
  totalFiles: srcFiles.length,
  totalUploaded: uploads.length,
  uploads,
};
writeFileSync(
  "scripts/.upload-report-chat-themes.json",
  JSON.stringify(report, null, 2),
);
console.log(`\nreport written · ${uploads.length} URLs captured`);
