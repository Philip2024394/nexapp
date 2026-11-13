// scripts/seed-mock-contacts-for-99901.mjs
//
// Sandbox-only seed · adds 6 mock-persona contacts for 99901, each with
// a FULL profile (headline, bio, profession, skills, location, kind,
// daily_activity, looking_for, cover image, avatar, interests, locale,
// phone country+number, last-known-city) so the contacts page + any
// profile-click surfaces have proper content to render.
//
// Writes (idempotent · upserts on re-run):
//   · 6 mock-persona rows in nex_account        (+ enrich on re-run)
//   · 6 rows in nex_account_profile             (+ enrich on re-run)
//   · 6 friend edges to 99901 (status accepted) (no-op on re-run)
//
// Peer-conversations + messages are NOT seeded. Per the sealed
// 2026-11-09 device-only E2E architecture, `nex_peer_message` enforces
// `encrypted = true` on every new row. The server cannot produce valid
// ciphertext on behalf of a device, so any seed message would be
// undecryptable on the client.
//
// Sandbox-only. Hard-refuses to run if DATABASE_URL does not reference
// `kdstoyyeygcopkogqsyv`.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envRaw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");

function envValue(name) {
  const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v || null;
}

const SANDBOX_DATABASE_URL = envValue("SANDBOX_DATABASE_URL");
if (!SANDBOX_DATABASE_URL) {
  console.error("STOP · SANDBOX_DATABASE_URL missing from .env.local");
  process.exit(1);
}
if (!SANDBOX_DATABASE_URL.includes("kdstoyyeygcopkogqsyv")) {
  console.error("STOP · SANDBOX_DATABASE_URL does not reference sandbox kdstoyyeygcopkogqsyv");
  process.exit(2);
}
if (SANDBOX_DATABASE_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("STOP · SANDBOX_DATABASE_URL contains production ref");
  process.exit(3);
}

const OWNER_ID = "11111111-1111-4111-8111-111111111111"; // 99901

// Dicebear avatar (face) · Lorem Picsum cover image · both are free
// unauthenticated public services that return a stable image per seed.
const avatar = (seed) =>
  `https://api.dicebear.com/9.x/avataaars/png?seed=${seed}&radius=50`;
const cover = (seed) => `https://picsum.photos/seed/${seed}/900/360`;

const CONTACTS = [
  {
    id: "11111111-1111-4111-8111-111111111112",
    handle: "nex-99902",
    display: "Aoife Byrne",
    headline: "Ceramics studio · Dublin",
    bio: "Throwing pots + sea-glass glaze experiments out of a converted warehouse in Stoneybatter. Open for commissions · teaching one Saturday a month.",
    profession: "Ceramist",
    kind: "business_owner",
    dailyActivity: "self_employed",
    skills: ["wheel-throwing", "glaze-formulation", "sea-glass", "studio-management", "small-batch-production"],
    lookingFor: ["commissions", "gallery-stockists", "collaborators"],
    locationLabel: "Dublin, Ireland",
    lastCity: "Dublin",
    interests: ["ceramics", "irish-craft", "studio-life", "making", "coastal"],
    avatar: avatar("aoife-byrne-ceramics"),
    cover: cover("aoife-studio-dublin"),
    phoneNat: "871112233",
  },
  {
    // Owner directive 2026-11-13 · swapped the Galway field-recordist
    // persona for an Indonesian hand-craft business owner. First mock
    // to carry a real `business` entry · shop badge + public shop URL
    // now resolve via nex_business (not fabricated in the UI layer).
    id: "11111111-1111-4111-8111-111111111113",
    handle: "nex-99903",
    display: "Rosa",
    headline: "Hand Craft · Indonesia",
    bio: "Hand-stitched handbags from Yogyakarta — small batch, natural leathers, traditional motifs. Direct to buyer, no middle shops.",
    profession: "Hand Craft",
    kind: "business_owner",
    dailyActivity: "self_employed",
    skills: ["handmade-handbags", "leatherwork", "hand-stitching", "pattern-making", "small-batch"],
    lookingFor: ["retail-partners", "international-orders", "collaborators"],
    locationLabel: "Indonesia",
    lastCity: "Indonesia",
    // Owner directive 2026-11-13 · locale + country overrides so Rosa
    // reads as an Indonesian persona end-to-end · default Ireland
    // values apply to every entry that OMITS these fields.
    locale: "id",
    phoneCountry: "+62",
    countryIso: "ID",
    interests: ["handmade", "indonesia", "handbags", "craft", "leatherwork"],
    avatar: avatar("rosa-handcraft-handbags"),
    cover: cover("rosa-yogyakarta-studio"),
    phoneNat: "81223456789",
    // Shop data · creates a nex_business row owned by this persona.
    // `resolveShopBadges` lights up the 🏪 marker on contact rows + the
    // public shop URL at /nex-native/handbags-direct starts resolving.
    business: {
      displayName: "Handbags direct",
      slug: "handbags-direct",
    },
  },
  {
    id: "11111111-1111-4111-8111-111111111114",
    handle: "nex-99904",
    display: "Niamh Walsh",
    headline: "Screen printer · Cork",
    bio: "Risograph + screen prints, mostly maps of places that don't exist. Running a small print house on Barrack Street. Workshops on the last Friday of each month.",
    profession: "Printmaker",
    kind: "business_owner",
    dailyActivity: "self_employed",
    skills: ["screen-printing", "risograph", "map-illustration", "colour-separation", "workshop-teaching"],
    lookingFor: ["gallery-shows", "workshop-partners", "commissions"],
    locationLabel: "Cork, Ireland",
    lastCity: "Cork",
    interests: ["printmaking", "risograph", "cork", "cartography", "colour"],
    avatar: avatar("niamh-walsh-printer"),
    cover: cover("niamh-cork-studio"),
    phoneNat: "863334455",
  },
  {
    id: "11111111-1111-4111-8111-111111111115",
    handle: "nex-99905",
    display: "Fionn Kelly",
    headline: "Session musician · Limerick",
    bio: "Fiddle, banjo, occasional whistle. Tuesdays at Dolan's with the regulars. Open to booking for weddings, funerals and quiet Sunday pubs.",
    profession: "Trad musician",
    kind: "professional",
    dailyActivity: "self_employed",
    skills: ["fiddle", "tenor-banjo", "tin-whistle", "session-leading", "tune-collection"],
    lookingFor: ["bookings", "recording-sessions", "duo-partners"],
    locationLabel: "Limerick, Ireland",
    lastCity: "Limerick",
    interests: ["fiddle", "trad-sessions", "limerick", "irish-music", "folk"],
    avatar: avatar("fionn-kelly-fiddle"),
    cover: cover("fionn-limerick-session"),
    phoneNat: "874445566",
  },
  {
    // Owner directive 2026-11-13 · swapped the Belfast textile persona
    // for an Indonesian watch dealer. Second mock to carry a real
    // `business` entry · shop badge + public shop URL now resolve via
    // nex_business (/nex-native/watch-warehouse).
    id: "11111111-1111-4111-8111-111111111116",
    handle: "nex-99906",
    display: "Tri",
    headline: "Watch Dealer · Indonesia",
    bio: "Vintage and modern watches direct from Jakarta — Seiko, Casio, G-Shock, Timex and a rotating case of pre-owned mechanicals. Warehouse pricing, worldwide shipping.",
    profession: "Watch Dealer",
    kind: "business_owner",
    dailyActivity: "self_employed",
    skills: ["watch-sourcing", "authentication", "vintage-trade", "warehouse-logistics", "worldwide-shipping"],
    lookingFor: ["bulk-buyers", "international-orders", "collector-partners"],
    locationLabel: "Indonesia",
    lastCity: "Indonesia",
    // Indonesia overrides · same pattern as Rosa (nex-99903).
    locale: "id",
    phoneCountry: "+62",
    countryIso: "ID",
    interests: ["watches", "vintage", "indonesia", "collectibles", "trade"],
    avatar: avatar("tri-watch-dealer"),
    cover: cover("tri-jakarta-warehouse"),
    phoneNat: "81234567890",
    // Shop · nex_business row · public URL /nex-native/watch-warehouse.
    business: {
      displayName: "watch warehouse",
      slug: "watch-warehouse",
    },
  },
  {
    id: "11111111-1111-4111-8111-111111111117",
    handle: "nex-99907",
    display: "Eamon Nolan",
    headline: "Boat builder · Dingle",
    bio: "Currachs, small clinker tenders and the odd restoration job out of a shed on the pier. Open to apprentices who can hold a plane the right way up.",
    profession: "Boat builder",
    kind: "business_owner",
    dailyActivity: "self_employed",
    skills: ["clinker-construction", "currach-making", "wooden-boat-restoration", "steam-bending", "rigging"],
    lookingFor: ["apprentices", "restoration-contracts", "timber-suppliers"],
    locationLabel: "Dingle, Ireland",
    lastCity: "Dingle",
    interests: ["boat-building", "wooden-boats", "dingle", "maritime", "craft"],
    avatar: avatar("eamon-nolan-boats"),
    cover: cover("eamon-dingle-pier"),
    phoneNat: "866667788",
  },
];

const client = new Client({ connectionString: SANDBOX_DATABASE_URL });
await client.connect();

const projectCheck = await client.query(
  "SELECT current_database() AS db, inet_server_addr()::text AS host",
);
console.log("Target DB:", projectCheck.rows[0]);
const ownerCheck = await client.query("SELECT nex_handle FROM nex_account WHERE id=$1", [OWNER_ID]);
if (ownerCheck.rowCount !== 1) {
  console.error("STOP · owner 99901 not found in target DB");
  process.exit(10);
}
console.log("Owner found:", ownerCheck.rows[0]);

await client.query("BEGIN");
try {
  for (const c of CONTACTS) {
    // Owner directive 2026-11-13 · locale / phone country / country ISO
    // are now per-contact with Ireland defaults, so Rosa (Indonesia)
    // reads correctly while the five Irish personas stay unchanged.
    const locale = c.locale ?? "en";
    const phoneCountry = c.phoneCountry ?? "+353";
    const countryIso = c.countryIso ?? "IE";
    await client.query(
      `INSERT INTO nex_account (
         id, display_name, nex_handle, tier, is_mock_persona,
         locale, phone_country_code, phone_national_number,
         last_known_city_label, last_known_country_iso, last_known_source, last_known_set_at,
         social_intents, world_intro_enabled, created_at
       ) VALUES (
         $1, $2, $3, 'gratis', true,
         $4, $5, $6,
         $7, $8, 'manual_city', now(),
         ARRAY['business','new_friends']::text[], true, now()
       )
       ON CONFLICT (id) DO UPDATE SET
         display_name              = EXCLUDED.display_name,
         nex_handle                = EXCLUDED.nex_handle,
         locale                    = EXCLUDED.locale,
         phone_country_code        = EXCLUDED.phone_country_code,
         phone_national_number     = EXCLUDED.phone_national_number,
         last_known_city_label     = EXCLUDED.last_known_city_label,
         last_known_country_iso    = EXCLUDED.last_known_country_iso,
         last_known_source         = EXCLUDED.last_known_source,
         last_known_set_at         = EXCLUDED.last_known_set_at,
         social_intents            = EXCLUDED.social_intents,
         world_intro_enabled       = EXCLUDED.world_intro_enabled`,
      [c.id, c.display, c.handle, locale, phoneCountry, c.phoneNat, c.lastCity, countryIso],
    );

    await client.query(
      `INSERT INTO nex_account_profile (
         account_id, kind, headline, bio, profession, skills,
         location_label, looking_for, daily_activity,
         avatar_url, avatar_face_verified, cover_image_url,
         is_public, is_discoverable, interests, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9,
         $10, true, $11,
         true, true, $12, now(), now()
       )
       ON CONFLICT (account_id) DO UPDATE SET
         kind                 = EXCLUDED.kind,
         headline             = EXCLUDED.headline,
         bio                  = EXCLUDED.bio,
         profession           = EXCLUDED.profession,
         skills               = EXCLUDED.skills,
         location_label       = EXCLUDED.location_label,
         looking_for          = EXCLUDED.looking_for,
         daily_activity       = EXCLUDED.daily_activity,
         avatar_url           = EXCLUDED.avatar_url,
         avatar_face_verified = EXCLUDED.avatar_face_verified,
         cover_image_url      = EXCLUDED.cover_image_url,
         is_public            = EXCLUDED.is_public,
         is_discoverable      = EXCLUDED.is_discoverable,
         interests            = EXCLUDED.interests,
         updated_at           = now()`,
      [
        c.id,
        c.kind,
        c.headline,
        c.bio,
        c.profession,
        c.skills,
        c.locationLabel,
        c.lookingFor,
        c.dailyActivity,
        c.avatar,
        c.cover,
        c.interests,
      ],
    );

    // friend_edge · canonical ordering requires a < b. OWNER_ID (…111) is
    // lexicographically less than every peer id (…112-117), so OWNER_ID is 'a'.
    await client.query(
      `INSERT INTO nex_friend_edge (a_account_id, b_account_id, requested_by, status, created_at, updated_at)
       VALUES ($1, $2, $1, 'accepted', now(), now())
       ON CONFLICT (a_account_id, b_account_id) DO NOTHING`,
      [OWNER_ID, c.id],
    );

    // Owner directive 2026-11-13 · activate shops for seeded mocks like
    // real users · when a persona carries `business`, seed a nex_business
    // row owned by them. Minimum columns only (id/owner/display/slug) ·
    // later migrations added many optional columns (logo, description,
    // address, hours, payment methods etc.) that default to NULL and
    // can be populated by the owner later from the Shop Settings surface.
    // Idempotent on re-run via ON CONFLICT on the unique slug.
    if (c.business) {
      await client.query(
        `INSERT INTO nex_business (owner_account_id, display_name, slug)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           owner_account_id = EXCLUDED.owner_account_id,
           updated_at = now()`,
        [c.id, c.business.displayName, c.business.slug],
      );
    }
  }

  await client.query("COMMIT");

  const verify = await client.query(
    `SELECT a.nex_handle, a.display_name, a.locale, a.phone_country_code || a.phone_national_number AS phone,
            a.last_known_city_label,
            p.profession, p.kind, p.daily_activity,
            array_length(p.skills, 1) AS skill_count,
            array_length(p.looking_for, 1) AS looking_count,
            array_length(p.interests, 1) AS interest_count,
            (p.avatar_url IS NOT NULL) AS has_avatar,
            (p.cover_image_url IS NOT NULL) AS has_cover,
            b.display_name AS shop_name,
            b.slug         AS shop_slug
     FROM nex_account a
     JOIN nex_account_profile p ON p.account_id = a.id
     LEFT JOIN nex_business b ON b.owner_account_id = a.id
     WHERE a.id = ANY($1)
     ORDER BY a.nex_handle`,
    [CONTACTS.map((c) => c.id)],
  );
  console.log("\n=== Verification ===");
  for (const r of verify.rows) {
    console.log(JSON.stringify(r));
  }
  console.log(`\n✓ Seeded ${CONTACTS.length} contacts with full profiles for 99901 in sandbox.`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Rolled back:", err.message);
  process.exit(20);
} finally {
  await client.end();
}
