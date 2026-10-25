// scripts/mock-personas/seed-personas.mjs
//
// Owner directive 2026-10-26 · seed 24 mock personas against the
// sealed Supabase project `ijvqdvsvwtwxzcqmoqit`.
//
// What it does, in order:
//   1. Hard-abort unless env points at ijvqdvsvwtwxzcqmoqit (safety).
//   2. Create storage bucket `nex-mock-personas` (public-read) if
//      absent · idempotent.
//   3. For each of the 24 personas:
//      a. Upload avatar PNG from tests/_persona-crops/<sourceCrop>
//         to <handle>.png in the bucket (upsert).
//      b. Create auth.users entry (admin.createUser) with email
//         `nex-<handle>@mock.nex.app` + a random password that is
//         thrown away · founder-POV impersonation does not need it.
//         Skip if user already exists (idempotent).
//      c. Upsert `nex_account` row (id = deterministic UUID,
//         supabase_user_id = auth user id, display_name, nex_handle,
//         locale, is_mock_persona=true).
//      d. Upsert `nex_account_profile` row (account_id,
//         avatar_url=public bucket URL, is_public=true,
//         is_discoverable=true, kind='social', location_label=city).
//
// Rerun-safe. Prints a summary of ok/skip/fail per persona.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { PERSONAS } from "./persona-manifest.mjs";

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
  console.error("ERR: env does not point at ijvqdvsvwtwxzcqmoqit · aborting");
  process.exit(3);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "nex-mock-personas";
const CROP_ROOT = resolve("tests/_persona-crops");

async function ensureBucket() {
  const { data: list, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`listBuckets: ${error.message}`);
  if (list.find((b) => b.name === BUCKET)) {
    console.log(`bucket ${BUCKET} already exists`);
    return;
  }
  const { error: cErr } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (cErr) throw new Error(`createBucket: ${cErr.message}`);
  console.log(`bucket ${BUCKET} CREATED (public=true)`);
}

async function uploadAvatar(p) {
  const buf = readFileSync(resolve(CROP_ROOT, p.sourceCrop));
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(p.avatarFile, buf, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`upload ${p.avatarFile}: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(p.avatarFile);
  return data.publicUrl;
}

async function ensureAuthUser(p) {
  const email = `nex-${p.handle}@mock.nex.app`;
  // Try list-and-find · listUsers() returns up to 50 by default; we
  // iterate pages until we find or exhaust.
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`listUsers p${page}: ${error.message}`);
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 100) break;
    page++;
    if (page > 20) break; // safety
  }
  const password = `nex-mock-${p.handle}-${Math.random().toString(36).slice(2, 12)}`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { is_mock_persona: true, handle: p.handle, display_name: p.displayName },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

const pgClient = new pg.Client({ connectionString: dbUrl });
await pgClient.connect();
console.log("CONNECTED to postgres");

async function upsertNexAccount(p, supabaseUserId) {
  // Idempotent: id is deterministic. ON CONFLICT updates display_name
  // + nex_handle + supabase_user_id in case we re-run after edits.
  await pgClient.query(
    `INSERT INTO nex_account
       (id, supabase_user_id, display_name, nex_handle, locale, tier, is_mock_persona)
     VALUES ($1, $2, $3, $4, $5, 'gratis', true)
     ON CONFLICT (id) DO UPDATE SET
       supabase_user_id = EXCLUDED.supabase_user_id,
       display_name     = EXCLUDED.display_name,
       nex_handle       = EXCLUDED.nex_handle,
       locale           = EXCLUDED.locale,
       is_mock_persona  = true`,
    [p.id, supabaseUserId, p.displayName, p.nexHandle, p.locale],
  );
}

async function upsertProfile(p, avatarUrl) {
  await pgClient.query(
    `INSERT INTO nex_account_profile
       (account_id, kind, avatar_url, location_label, profession, is_public, is_discoverable)
     VALUES ($1, 'exploring', $2, $3, $4, true, true)
     ON CONFLICT (account_id) DO UPDATE SET
       avatar_url      = EXCLUDED.avatar_url,
       location_label  = EXCLUDED.location_label,
       profession      = EXCLUDED.profession,
       is_public       = true,
       is_discoverable = true`,
    [p.id, avatarUrl, p.city, p.profession],
  );
}

try {
  await ensureBucket();
  const summary = [];
  for (const p of PERSONAS) {
    try {
      const avatarUrl = await uploadAvatar(p);
      const supabaseUserId = await ensureAuthUser(p);
      await upsertNexAccount(p, supabaseUserId);
      await upsertProfile(p, avatarUrl);
      summary.push({ handle: p.handle, status: "ok", id: p.id });
      console.log(`ok   nex-${p.handle.padEnd(10)} ${p.id} ${avatarUrl}`);
    } catch (e) {
      summary.push({ handle: p.handle, status: "fail", error: e.message });
      console.error(`FAIL nex-${p.handle}: ${e.message}`);
    }
  }
  const ok = summary.filter((s) => s.status === "ok").length;
  const fail = summary.filter((s) => s.status === "fail").length;
  console.log("");
  console.log(`SUMMARY · ok=${ok} fail=${fail}`);
  if (fail > 0) process.exit(1);
} finally {
  await pgClient.end();
}
console.log("DONE");
