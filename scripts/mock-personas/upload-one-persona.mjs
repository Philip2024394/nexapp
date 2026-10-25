// scripts/mock-personas/upload-one-persona.mjs
//
// Owner directive 2026-10-26 · upload a single replacement avatar
// for one persona. Reads the file from the local path and uploads
// to the sealed `nex-mock-personas` Supabase bucket as
// `<handle>.png` (upsert · overwrites prior image). Does NOT touch
// auth/nex_account/nex_account_profile rows — just the storage
// object. Safe to rerun.
//
// Usage · node scripts/mock-personas/upload-one-persona.mjs <handle> <localPath>

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnv() {
  const map = {};
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map[m[1]] = m[2];
  }
  return map;
}

const [handle, localPath] = process.argv.slice(2);
if (!handle || !localPath) {
  console.error("usage: upload-one-persona.mjs <handle> <localPath>");
  process.exit(2);
}

const env = readEnv();
const supabaseUrl = env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const serviceKey  = env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("ERR: missing env (NEXT_PUBLIC_NEX_SUPABASE_URL / NEX_SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(3);
}
if (!supabaseUrl.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: env does not point at ijvqdvsvwtwxzcqmoqit · aborting");
  process.exit(4);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "nex-mock-personas";
const key = `${handle}.png`;
const buf = readFileSync(localPath);
console.log(`uploading ${buf.length} bytes · ${localPath} → ${BUCKET}/${key}`);

const { error } = await supabase.storage
  .from(BUCKET)
  .upload(key, buf, { contentType: "image/png", upsert: true });
if (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(5);
}
const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
console.log(`ok · ${data.publicUrl}`);
