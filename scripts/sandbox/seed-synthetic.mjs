#!/usr/bin/env node
// scripts/sandbox/seed-synthetic.mjs
//
// Owner-authorised 2026-11-01 (NEX country programme · Ireland real-content wave).
// Seeds the SANDBOX Supabase project with the sealed single Ireland
// creator persona (Irish Pride · nex-99901) and the HQ admin so the
// `nex-ireland-preview` + `nex-indonesia-preview` Vercel deploys have
// the right state after a fresh re-run.
//
// Owner directive (verbatim 2026-11-01):
//   "6 tracks total should be in irish pride library and then seed and
//    connect ... we only want this mock account sewi dewi on the nex
//    ireland ... ireland accounts are on nex ireland"
//
// What this script does
// ---------------------
// 1. Upserts `nex_account` + `nex_account_profile` for Irish Pride
//    (production UUID 11111111-1111-4111-8111-111111111111 ·
//    nex_handle=nex-99901 · display_name='Irish Pride' · country=IE ·
//    city=Dublin · is_mock_persona=true · is_discoverable=true).
// 2. Upserts the HQ admin (`nex-90001`, hq_role='admin').
// 3. Upserts 6 music tracks under Irish Pride with media_url=sb://… and
//    1 nex_creator_active_music row pointing at Hotel California.
// 4. Does NOT seed businesses, products, uploaded_videos (none exist
//    now; the Ireland app shows the music feed only).
// 5. Does NOT touch Supabase Storage. The MP3 bytes live in the sandbox
//    `nex-music-media` bucket · copied once from production during the
//    2026-11-01 migration · see scripts/_tmp/migrate-dewi.mjs if you
//    need to re-run the storage copy.
//
// Hard rules (owner's D-D conditions · unchanged):
//   - Reads nothing from production.
//   - Refuses to run against production project `ijvqdvsvwtwxzcqmoqit`.
//   - Idempotent via ON CONFLICT DO UPDATE on every table.
//
// Usage:
//   SANDBOX_DATABASE_URL="postgresql://..." node scripts/sandbox/seed-synthetic.mjs
//   SANDBOX_DATABASE_URL="postgresql://..." node scripts/sandbox/seed-synthetic.mjs --dry-run

const PRODUCTION_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";
const DRY_RUN = process.argv.includes("--dry-run");

function die(msg, code = 1) {
  process.stderr.write(`\n[sandbox seed] ${msg}\n\n`);
  process.exit(code);
}

const dbUrl = process.env.SANDBOX_DATABASE_URL;
if (!dbUrl) {
  die(
    "SANDBOX_DATABASE_URL is not set. This script will NOT read NEX_POSTGRES_URL or DATABASE_URL to avoid accidental production targeting. Set SANDBOX_DATABASE_URL explicitly.",
  );
}
if (dbUrl.includes(PRODUCTION_PROJECT_ID)) {
  die(
    `SANDBOX_DATABASE_URL contains the production project ID '${PRODUCTION_PROJECT_ID}'. Refusing to seed into production.`,
  );
}

// Irish Pride · the single sealed Ireland mock persona.
// Owner directive 2026-11-01 · the production UUID is retained verbatim
// so the sandbox copies share identity with the (now-deleted) production
// account. Any future track inserts that reference this UUID stay stable.
const IRISH_PRIDE_UUID = "11111111-1111-4111-8111-111111111111";
const IRISH_PRIDE_HANDLE = "nex-99901";
const HQ_ADMIN_UUID = "57fa2ccf-5d35-4697-8ef5-50507c05f1c9";
const HQ_ADMIN_HANDLE = "nex-90001";

const ACCOUNTS = [
  {
    id: IRISH_PRIDE_UUID,
    nex_handle: IRISH_PRIDE_HANDLE,
    display_name: "Irish Pride",
    country: "IE",
    city: "Dublin",
    is_mock_persona: true,
    headline: "NEX IE · creator · Irish Pride",
    bio: "Irish folk + traditional covers. Dublin.",
  },
  {
    id: HQ_ADMIN_UUID,
    nex_handle: HQ_ADMIN_HANDLE,
    display_name: "HQ Admin",
    country: null,
    city: null,
    is_mock_persona: true,
    hq_role: "admin",
    headline: "NEX HQ · reviewer",
    bio: "Platform administrator persona for preview-deploy testing.",
  },
];

// Irish Pride · the 6 sealed tracks. IDs are preserved verbatim from
// the production/local-dev state so the active-slot FK stays valid
// across re-runs. media_url references point at paths that must exist
// in the sandbox `nex-music-media` bucket (bucket name is schema-level,
// not seedable from here · see migrate-dewi.mjs for the one-shot copy
// from production).
const IRISH_PRIDE_TRACKS = [
  {
    id: "acfb6f29-9ac2-4673-aa2c-e201b3335b61",
    title: "Dirty Old Town",
    artist: "Traditional (Irish) · cover by The Irish Girls",
    media_path: "audio-1793397897054-7f1bcaf6.mp3",
    duration_ms: 86988,
    byte_size: 1391849,
    bitrate_kbps: 128,
    rights_declaration: "licensed",
    rights_notes:
      "Cover of 'Dirty Old Town' (Ewan MacColl, 1949) performed by The Irish Girls. Not published; visibility=private.",
    visibility: "private",
  },
  {
    id: "4cc8e6e9-9520-40ae-ac9a-74cbcbc80d2f",
    title: "Tell Me Ma",
    artist: "Sham Rock (Irish traditional · remastered)",
    media_path: "audio-1793400833060-c9454888.mp3",
    duration_ms: 231419,
    byte_size: 9257933,
    bitrate_kbps: 320,
    rights_declaration: "licensed",
    rights_notes:
      "'Tell Me Ma' (Irish traditional, popular 19th-century ballad). This remastered recording by Sham Rock. Not published; visibility=private.",
    visibility: "private",
  },
  {
    id: "93b1a638-c8b6-491c-9844-02b90a06b179",
    title: "Nosey Bridie",
    artist: "Irish traditional · 18+ parody",
    media_path: "audio-1793401720920-b46ed9f0.mp3",
    duration_ms: 326609,
    byte_size: 13065541,
    bitrate_kbps: 320,
    rights_declaration: "licensed",
    rights_notes:
      "Irish traditional pub song · 18+ parody lyrics. Not published; visibility=private.",
    visibility: "private",
  },
  {
    id: "b6b68909-4f4c-4281-aaf7-e24f8d58a9ad",
    title: "Hotel California (Irish Style)",
    artist: "Eagles (Irish rock cover · The Irish Boys)",
    media_path: "audio-1793345575825-ebpnzova.mp3",
    duration_ms: 390400,
    byte_size: 2846031,
    bitrate_kbps: 128,
    rights_declaration: "licensed",
    rights_notes:
      "Cover of 'Hotel California' (Eagles, 1976) in Irish style by The Irish Boys.",
    visibility: "shared_live",
  },
  {
    id: "5ab54fd6-8cb1-4b74-9c62-50e5afc49026",
    title: "Stand By Me Irish Style",
    artist: "Ben E. King (Irish folk cover)",
    media_path: "audio-1793340842898-ptkobfvz.mp3",
    duration_ms: 240000,
    byte_size: 2162667,
    bitrate_kbps: 128,
    rights_declaration: "licensed",
    rights_notes:
      "Cover of 'Stand By Me' (Ben E. King, 1961) in Irish folk style.",
    visibility: "shared_live",
  },
  {
    id: "d81d6a0e-83e8-4cfa-a7a0-54c3a9bb3b32",
    title: "Taking One for the Team",
    artist: "Irish pub folk · drinking song",
    media_path: "audio-1793405961958-69d91c74.mp3",
    duration_ms: 265000,
    byte_size: 9480496,
    bitrate_kbps: 320,
    rights_declaration: "licensed",
    rights_notes: "Original Irish pub drinking song. Not published.",
    visibility: "private",
  },
];

// The ACTIVE track Irish Pride is currently live-feeding with.
// Hotel California (Irish Style) is the active slot per owner directive.
const ACTIVE_SLOT_TRACK_ID = "b6b68909-4f4c-4281-aaf7-e24f8d58a9ad";

if (DRY_RUN) {
  process.stdout.write(`[sandbox seed] DRY RUN · would seed:\n`);
  process.stdout.write(`  Accounts    : ${ACCOUNTS.length}\n`);
  for (const a of ACCOUNTS)
    process.stdout.write(
      `    ${a.id} · ${a.nex_handle} · ${a.display_name} · ${a.country ?? "—"}\n`,
    );
  process.stdout.write(`  Music tracks: ${IRISH_PRIDE_TRACKS.length}\n`);
  for (const t of IRISH_PRIDE_TRACKS)
    process.stdout.write(`    ${t.title} · ${t.visibility}\n`);
  process.stdout.write(`  Active slot : Hotel California (Irish Style)\n`);
  process.exit(0);
}

const pgMod = await import("pg").catch(() => null);
if (!pgMod) die("pg module not installed.");
const { Client } = pgMod.default ?? pgMod;

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
process.stdout.write("[sandbox seed] Connected.\n");

async function hasColumn(table, column) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 AND column_name=$2 LIMIT 1`,
    [table, column],
  );
  return r.rowCount > 0;
}

const hasHqRole = await hasColumn("nex_account", "hq_role");
const hasMock = await hasColumn("nex_account", "is_mock_persona");
const hasHandle = await hasColumn("nex_account", "nex_handle");
const hasCountry = await hasColumn("nex_account", "last_known_country_iso");

process.stdout.write(
  `[sandbox seed] Schema check · hq_role=${hasHqRole} is_mock_persona=${hasMock} nex_handle=${hasHandle} country=${hasCountry}\n\n`,
);

// === Accounts + profiles ===
for (const a of ACCOUNTS) {
  const cols = ["id", "display_name"];
  const vals = [a.id, a.display_name];
  if (hasHandle) {
    cols.push("nex_handle");
    vals.push(a.nex_handle);
  }
  if (hasMock) {
    cols.push("is_mock_persona");
    vals.push(a.is_mock_persona);
  }
  if (hasHqRole && a.hq_role) {
    cols.push("hq_role");
    vals.push(a.hq_role);
  }
  if (hasCountry) {
    if (a.country) {
      cols.push("last_known_country_iso");
      vals.push(a.country);
    }
    if (a.city) {
      cols.push("last_known_city_label");
      vals.push(a.city);
    }
  }
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
  const updateCols = cols
    .filter((col) => col !== "id" && col !== "nex_handle")
    .map((col) => `${col} = EXCLUDED.${col}`)
    .join(", ");
  const sql = `
    INSERT INTO public.nex_account (${cols.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateCols}
  `;
  try {
    await client.query(sql, vals);
    process.stdout.write(
      `  + account ${a.nex_handle} · ${a.display_name} · ${a.country ?? "—"}\n`,
    );
  } catch (err) {
    process.stderr.write(`  ! FAILED account ${a.nex_handle}: ${err.message}\n`);
  }
}

process.stdout.write(
  `\n[sandbox seed] Writing nex_account_profile rows · is_discoverable=true\n`,
);
for (const a of ACCOUNTS) {
  try {
    await client.query(
      `
      INSERT INTO public.nex_account_profile
        (account_id, is_discoverable, headline, bio, created_at, updated_at)
      VALUES ($1, true, $2, $3, now(), now())
      ON CONFLICT (account_id) DO UPDATE
        SET is_discoverable = EXCLUDED.is_discoverable,
            headline = EXCLUDED.headline,
            bio = EXCLUDED.bio,
            updated_at = now()
    `,
      [a.id, a.headline, a.bio],
    );
    process.stdout.write(`  + profile ${a.nex_handle}\n`);
  } catch (err) {
    process.stderr.write(`  ! FAILED profile ${a.nex_handle}: ${err.message}\n`);
  }
}

// === Irish Pride tracks + active slot ===
process.stdout.write(
  `\n[sandbox seed] Upserting ${IRISH_PRIDE_TRACKS.length} tracks for Irish Pride\n`,
);
for (const t of IRISH_PRIDE_TRACKS) {
  const mediaUrl = `sb://${IRISH_PRIDE_UUID}/${t.media_path}`;
  try {
    await client.query(
      `
      INSERT INTO public.nex_music_track
        (id, owner_account_id, business_id, source_type, title, artist, album, duration_ms,
         media_url, source_url, cover_image_url, background_image_url, byte_size, mime_type, bitrate_kbps,
         rights_declaration, rights_notes, visibility, view_count, like_count, share_count,
         created_at, updated_at)
      VALUES ($1, $2, NULL, 'uploaded_audio', $3, $4, NULL, $5,
              $6, NULL, NULL, NULL, $7, 'audio/mpeg', $8,
              $9, $10, $11, 0, 0, 0,
              now(), now())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        artist = EXCLUDED.artist,
        duration_ms = EXCLUDED.duration_ms,
        media_url = EXCLUDED.media_url,
        byte_size = EXCLUDED.byte_size,
        bitrate_kbps = EXCLUDED.bitrate_kbps,
        rights_declaration = EXCLUDED.rights_declaration,
        rights_notes = EXCLUDED.rights_notes,
        visibility = EXCLUDED.visibility,
        updated_at = now()
    `,
      [
        t.id,
        IRISH_PRIDE_UUID,
        t.title,
        t.artist,
        t.duration_ms,
        mediaUrl,
        t.byte_size,
        t.bitrate_kbps,
        t.rights_declaration,
        t.rights_notes,
        t.visibility,
      ],
    );
    process.stdout.write(`  + ${t.title} · ${t.visibility}\n`);
  } catch (err) {
    process.stderr.write(`  ! FAILED track ${t.title}: ${err.message}\n`);
  }
}

process.stdout.write(`\n[sandbox seed] Upserting active slot · Hotel California\n`);
try {
  await client.query(
    `
    INSERT INTO public.nex_creator_active_music
      (owner_account_id, track_id, publish_as_mode, publish_generation,
       rights_declaration_frozen, published_at, unpublished_at)
    VALUES ($1, $2, 'cover_audio', 1, 'licensed', now(), NULL)
    ON CONFLICT (owner_account_id) DO UPDATE SET
      track_id = EXCLUDED.track_id,
      publish_as_mode = EXCLUDED.publish_as_mode,
      publish_generation = public.nex_creator_active_music.publish_generation + 1,
      rights_declaration_frozen = EXCLUDED.rights_declaration_frozen,
      published_at = now(),
      unpublished_at = NULL
  `,
    [IRISH_PRIDE_UUID, ACTIVE_SLOT_TRACK_ID],
  );
  process.stdout.write(`  + active slot → Hotel California (Irish Style)\n`);
} catch (err) {
  process.stderr.write(`  ! FAILED active slot: ${err.message}\n`);
}

await client.end();
process.stdout.write(`\n[sandbox seed] Done.\n`);
