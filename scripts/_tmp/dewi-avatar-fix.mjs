#!/usr/bin/env node
// Fix Irish Pride's profile image + enable Ireland flare (shamrock).
// 1. Create public bucket `nex-avatars` on sandbox (mirrors production).
// 2. Copy her avatar PNG + cover PNG from `nex-music-media` (private)
//    into `nex-avatars` (public) at predictable paths.
// 3. Update her profile row: avatar_url + cover_image_url to the public URLs.
// 4. Set phone_country_code='+353' so isIrishAccount() returns true →
//    all 3 shamrock-burst wire-sites fire for her (profile FollowButton,
//    nex-feed music viewer, live-commerce viewer).

import pg from "pg";

const DEWI = "11111111-1111-4111-8111-111111111111";

const SBX_SB_URL = process.env.SBX_SB_URL;
const SBX_SR = process.env.SBX_SR;
const SBX_DB = process.env.SBX_DB;

if (SBX_DB.includes("ijvqdvsvwtwxzcqmoqit")) {
  throw new Error("safeguard: SBX_DB points at production project ref");
}
function h(sr) { return { Authorization: "Bearer " + sr, apikey: sr }; }

// 1. Create nex-avatars bucket (public). Idempotent · 409 OK on re-run.
console.log("1. Create sandbox bucket nex-avatars (public)");
const bk = await fetch(SBX_SB_URL + "/storage/v1/bucket", {
  method: "POST",
  headers: { ...h(SBX_SR), "Content-Type": "application/json" },
  body: JSON.stringify({
    id: "nex-avatars",
    name: "nex-avatars",
    public: true,
    file_size_limit: 5242880,
    allowed_mime_types: ["image/png", "image/jpeg", "image/webp"],
  }),
});
console.log("   status:", bk.status, (await bk.text()).slice(0, 120));

// 2. Download Dewi's avatar + cover from nex-music-media (private)
//    and re-upload into nex-avatars (public) at predictable paths.
async function moveToPublic(sourcePath, destPath) {
  const dl = await fetch(SBX_SB_URL + "/storage/v1/object/nex-music-media/" + sourcePath, { headers: h(SBX_SR) });
  if (!dl.ok) throw new Error("DL fail " + sourcePath + " · " + dl.status);
  const bytes = Buffer.from(await dl.arrayBuffer());
  const ul = await fetch(SBX_SB_URL + "/storage/v1/object/nex-avatars/" + destPath, {
    method: "POST",
    headers: { ...h(SBX_SR), "Content-Type": "image/png", "x-upsert": "true" },
    body: bytes,
  });
  if (!ul.ok) throw new Error("UL fail " + destPath + " · " + ul.status + " " + (await ul.text()).slice(0, 100));
  return bytes.length;
}

console.log("\n2. Copy avatar + cover PNGs private → public bucket");
const avatarSize = await moveToPublic(
  DEWI + "/cover-1793345575825-ebpnzova.png",
  DEWI + "/avatar.png",
);
console.log("   avatar.png · " + avatarSize + " bytes");
const coverSize = await moveToPublic(
  DEWI + "/background-1793345575825-ebpnzova.png",
  DEWI + "/cover.png",
);
console.log("   cover.png  · " + coverSize + " bytes");

const AVATAR_URL = SBX_SB_URL + "/storage/v1/object/public/nex-avatars/" + DEWI + "/avatar.png";
const COVER_URL = SBX_SB_URL + "/storage/v1/object/public/nex-avatars/" + DEWI + "/cover.png";

// Verify both are publicly reachable
const headAvatar = await fetch(AVATAR_URL, { method: "HEAD" });
const headCover = await fetch(COVER_URL, { method: "HEAD" });
console.log("   avatar HEAD " + headAvatar.status + " · size " + headAvatar.headers.get("content-length"));
console.log("   cover  HEAD " + headCover.status + " · size " + headCover.headers.get("content-length"));

// 3. Update profile row with the public URLs
const c = new pg.Client({ connectionString: SBX_DB, ssl: { rejectUnauthorized: false } });
await c.connect();
console.log("\n3. Update Irish Pride profile · set direct public URLs");
const up = await c.query(
  `UPDATE public.nex_account_profile
      SET avatar_url = $2, cover_image_url = $3, updated_at = now()
    WHERE account_id = $1
    RETURNING avatar_url, cover_image_url`,
  [DEWI, AVATAR_URL, COVER_URL],
);
console.log("   avatar_url:", up.rows[0].avatar_url);
console.log("   cover_url :", up.rows[0].cover_image_url);

// 4. Set phone_country_code='+353' so Ireland shamrock flare fires
console.log("\n4. Set phone_country_code='+353' · enables shamrock bursts");
const ph = await c.query(
  `UPDATE public.nex_account
      SET phone_country_code = '+353', phone_national_number = '19012345'
    WHERE id = $1
    RETURNING nex_handle, phone_country_code, phone_national_number`,
  [DEWI],
);
console.log("   " + JSON.stringify(ph.rows[0]));

await c.end();
console.log("\nDone.");
