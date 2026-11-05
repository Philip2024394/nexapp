// scripts/_tmp/verify-profile-and-redirect-live.mjs
// Owner-authorised read-only probe 2026-11-04.
// Confirms:
//   1. Canonical Supabase (ijvqdvsvwtwxzcqmoqit) is live and has Irish Pride
//   2. nex_account + nex_account_profile rows are populated end-to-end
//   3. Post-save redirect target in _actions.ts points at /creator/join

import { readFileSync } from "node:fs";
import pg from "pg";

function readEnv(k, file = ".env.local") {
  const raw = readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === k) return m[2];
  }
  return null;
}

const url = readEnv("DATABASE_URL");
if (!url?.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ABORT · DATABASE_URL does not point at canonical");
  process.exit(3);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to canonical Supabase ijvqdvsvwtwxzcqmoqit\n");

try {
  console.log("─── 1 · nex_account row for nex-99901 ───");
  const a = await client.query(
    `SELECT id, nex_handle, display_name, phone_country_code, phone_national_number,
            is_mock_persona, hq_role, tier, created_at
       FROM nex_account WHERE nex_handle = $1`,
    ["nex-99901"],
  );
  console.table(a.rows);

  console.log("\n─── 2 · nex_account_profile row for nex-99901 ───");
  const p = await client.query(
    `SELECT account_id, country_code, address, profession,
            interests, avatar_url, headline, bio,
            instagram_handle, tiktok_handle, facebook_handle, x_handle, youtube_handle,
            updated_at
       FROM nex_account_profile
       WHERE account_id = $1`,
    ["11111111-aaaa-4aaa-8aaa-111111111111"],
  );
  if (p.rows.length === 0) {
    console.log("  NO ROW yet · profile has never been saved from the UI");
  } else {
    for (const row of p.rows) {
      for (const [k, v] of Object.entries(row)) {
        const shown =
          typeof v === "string" && v.length > 80 ? v.slice(0, 77) + "..." : v;
        console.log(`  ${k.padEnd(28)} = ${JSON.stringify(shown)}`);
      }
    }
  }

  console.log("\n─── 3 · Avatar URL reachability (public) ───");
  if (p.rows[0]?.avatar_url) {
    const res = await fetch(p.rows[0].avatar_url, { method: "HEAD" });
    console.log(`  ${res.status} ${res.statusText} · ${p.rows[0].avatar_url}`);
  } else {
    console.log("  no avatar_url set");
  }

  console.log("\n─── 4 · Music tracks owned by Irish Pride ───");
  const m = await client.query(
    `SELECT COUNT(*)::int AS tracks FROM nex_music_track
      WHERE owner_account_id = $1`,
    ["11111111-aaaa-4aaa-8aaa-111111111111"],
  );
  console.log(`  ${m.rows[0].tracks} tracks owned`);
} finally {
  await client.end();
}

console.log("\n─── 5 · Post-save redirect target in _actions.ts ───");
const act = readFileSync(
  "src/app/nex-native/settings/profile/edit/_actions.ts",
  "utf8",
);
const match = act.match(/redirect\(`\/nex-native\/creator\/join\?from=[^`]+`\)/);
console.log(match ? `  FOUND · ${match[0]}` : "  NOT FOUND · redirect target changed");

console.log("\n─── 6 · Dev env target ───");
const envUrl = readEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", ".env.development.local");
const envHandle = readEnv("NEX_DEV_IMPERSONATE_HANDLE", ".env.development.local");
console.log(`  .env.development.local NEXT_PUBLIC_NEX_SUPABASE_URL = ${envUrl ?? "(falls through to .env.local canonical)"}`);
console.log(`  .env.development.local NEX_DEV_IMPERSONATE_HANDLE = ${envHandle}`);
console.log(`  .env.local            DATABASE_URL points at ijvqdvsvwtwxzcqmoqit = ${url.includes("ijvqdvsvwtwxzcqmoqit")}`);

console.log("\nDONE (read-only · no writes)");
