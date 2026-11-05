// scripts/mock-personas/seed-ireland-contacts.mjs
// Owner-authorised 2026-11-04 later-same-day.
//
// Seeds 6 Irish mock-persona contacts (nex-99911 … nex-99916) and
// friend-accepted edges with nex-99901 (Padraig Murphy, sealed 2026-11-03
// Ireland dev viewer).
//
// Idempotent · ON CONFLICT clauses let this script be re-run safely.
// Mirrors nex-supabase/migrations/277_seed_ireland_mock_contacts.sql ·
// the migration is the versioned record · this script applies the same
// inserts via the pooler for local dev convenience.
//
// Target database: canonical NEX Supabase ijvqdvsvwtwxzcqmoqit (sealed
// 2026-10-12 · CLAUDE.md §8). The script hard-checks the DATABASE_URL
// host before running and refuses any other project.
//
// Usage:
//   node scripts/mock-personas/seed-ireland-contacts.mjs

import { readFileSync } from "node:fs";
import pg from "pg";

function readEnv(k) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === k) return m[2];
  }
  return null;
}

const url = readEnv("DATABASE_URL");
if (!url?.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: DATABASE_URL not pointing at ijvqdvsvwtwxzcqmoqit");
  process.exit(3);
}

const VIEWER_ID = "11111111-aaaa-4aaa-8aaa-111111111111";
const VIEWER_HANDLE = "nex-99901";

const CONTACTS = [
  {
    id: "11111111-aaaa-4aaa-8aaa-111111111112",
    handle: "nex-99911",
    displayName: "Aoife Byrne",
    kind: "professional",
    profession: "Graphic designer",
    headline: "Brand + identity in Dublin 2",
    bio: "Freelance graphic designer working with Dublin cafés and small galleries. Partial to a strong serif.",
    location: "Dublin, Ireland",
  },
  {
    id: "11111111-aaaa-4aaa-8aaa-111111111113",
    handle: "nex-99912",
    displayName: "Síle O'Brien",
    kind: "business_owner",
    profession: "Barista · roaster",
    headline: "3rd-wave coffee in Cork city",
    bio: "Barista at a small roastery on the quays. Fáilte if you want to talk origins and brew ratios.",
    location: "Cork, Ireland",
  },
  {
    id: "11111111-aaaa-4aaa-8aaa-111111111114",
    handle: "nex-99913",
    displayName: "Rónán Fitzgerald",
    kind: "professional",
    profession: "Photographer",
    headline: "Wedding + landscape · Connemara base",
    bio: "Documenting weddings around the west and landscape work whenever the light turns up.",
    location: "Galway, Ireland",
  },
  {
    id: "11111111-aaaa-4aaa-8aaa-111111111115",
    handle: "nex-99914",
    displayName: "Cillian Walsh",
    kind: "professional",
    profession: "Software engineer",
    headline: "Backend · Dublin · open-source",
    bio: "Backend engineer, mostly Postgres + Go. Weekends on an open-source CLI project.",
    location: "Dublin, Ireland",
  },
  {
    id: "11111111-aaaa-4aaa-8aaa-111111111116",
    handle: "nex-99915",
    displayName: "Niamh Kavanagh",
    kind: "business_owner",
    profession: "Pub manager",
    headline: "Running the Treaty for 6 years",
    bio: "Running the Treaty Bar in town. Trad on Thursdays, quiz on Tuesdays.",
    location: "Limerick, Ireland",
  },
  {
    id: "11111111-aaaa-4aaa-8aaa-111111111117",
    handle: "nex-99916",
    displayName: "Eoin Gallagher",
    kind: "professional",
    profession: "Musician · trad fiddle",
    headline: "Sessions · lessons · recording",
    bio: "Fiddle player and teacher. Sessions around the southeast · open to collaboration.",
    location: "Wexford, Ireland",
  },
];

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit");

try {
  // Verify the viewer exists first so the friend edges have somewhere to
  // anchor. nex-99901 is sealed; if it's missing, bail loudly.
  const viewer = await client.query(
    "SELECT id, display_name, nex_handle FROM nex_account WHERE nex_handle=$1",
    [VIEWER_HANDLE],
  );
  if (viewer.rows.length === 0) {
    console.error(`ERR: viewer ${VIEWER_HANDLE} missing · run seed-nex-99901-ireland-persona.mjs first`);
    process.exit(5);
  }
  console.log(`Viewer: ${viewer.rows[0].display_name} (${viewer.rows[0].id})`);

  await client.query("BEGIN");

  for (const c of CONTACTS) {
    // 1 · Account
    // Owner directive 2026-11-04 later-same-day · each Ireland mock
    // persona ships with chat_theme='gold' active (gratis/free tier ·
    // allowed by CHECK constraint from migration 021). Same theme
    // across all six so the chat bubble vocabulary stays consistent
    // when the viewer hops between Irish contacts.
    await client.query(
      `INSERT INTO nex_account (id, display_name, nex_handle, is_mock_persona, tier, chat_theme)
       VALUES ($1, $2, $3, true, 'gratis', 'gold')
       ON CONFLICT (nex_handle) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             is_mock_persona = true,
             chat_theme = 'gold'`,
      [c.id, c.displayName, c.handle],
    );

    // 2 · Profile
    await client.query(
      `INSERT INTO nex_account_profile (
         account_id, kind, profession, headline, bio, location_label,
         is_public, is_discoverable
       ) VALUES ($1, $2, $3, $4, $5, $6, true, true)
       ON CONFLICT (account_id) DO UPDATE
         SET kind            = EXCLUDED.kind,
             profession      = EXCLUDED.profession,
             headline        = EXCLUDED.headline,
             bio             = EXCLUDED.bio,
             location_label  = EXCLUDED.location_label,
             is_public       = true,
             is_discoverable = true,
             updated_at      = now()`,
      [c.id, c.kind, c.profession, c.headline, c.bio, c.location],
    );

    // 3 · Friend edge · viewer always `a` because its UUID is lex-less
    await client.query(
      `INSERT INTO nex_friend_edge (
         a_account_id, b_account_id, requested_by, status
       ) VALUES ($1, $2, $1, 'accepted')
       ON CONFLICT (a_account_id, b_account_id) DO UPDATE
         SET status     = 'accepted',
             updated_at = now()`,
      [VIEWER_ID, c.id],
    );

    console.log(`✓ ${c.handle} · ${c.displayName} · ${c.profession}`);
  }

  await client.query("COMMIT");

  // Verify end state
  const check = await client.query(
    `SELECT a.nex_handle, a.display_name, p.profession, p.location_label, e.status
       FROM nex_friend_edge e
       JOIN nex_account a
         ON a.id = CASE WHEN e.a_account_id=$1 THEN e.b_account_id ELSE e.a_account_id END
       LEFT JOIN nex_account_profile p ON p.account_id = a.id
       WHERE (e.a_account_id=$1 OR e.b_account_id=$1) AND e.status='accepted'
       ORDER BY a.nex_handle`,
    [VIEWER_ID],
  );
  console.log(`\nAccepted friends of ${VIEWER_HANDLE}: ${check.rows.length}`);
  for (const r of check.rows) {
    console.log(`  ${r.nex_handle} · ${r.display_name} · ${r.profession ?? "—"} · ${r.location_label ?? "—"}`);
  }
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("SEED FAILED:", err);
  process.exit(7);
} finally {
  await client.end();
}
