// scripts/mock-personas/seed-hendra-full-wire.mjs
//
// Author · owner-authorised 2026-10-28 to CLOSE THE GAPS between the
// `watches-hendra` theme (shipped commit 072ca3f) and a Hendra persona
// that actually looks like a real user with the theme active.
//
// What it does (idempotent, DRY_RUN by default):
//
//   1 · Hard-abort unless env points at `ijvqdvsvwtwxzcqmoqit`.
//   2 · UPDATE nex_account for Hendra ONLY (handle=hendra, nex_handle=
//       nex-50014, id=4f112c32-46a3-4fa4-8b4a-1c5f50caed42):
//         chat_theme         = 'watches-hendra'
//         tier               = 'bisnis'
//         bisnis_expires_at  = now() + interval '365 days'
//         intro_video_url    = NULL  (deliberate · theme intro wins ·
//                              see "intro routing" note below)
//   3 · UPSERT nex_business for Hendra:
//         id                 = det("nex-business:hendra-watches")
//         owner_account_id   = HENDRA_UUID
//         display_name       = "Hendra's Watches"
//         slug               = 'hendra-watches'
//         business_category  = 'ecommerce'  (migration 065 CHECK list ·
//                              'watches' is NOT a CHECK-allowed value ·
//                              'ecommerce' matches Aisha's vintage-camera
//                              seeded pattern)
//         search_keywords    = ['luxury watches', 'rolex', 'omega',
//                              'patek philippe', 'chronograph', 'bogor']
//   4 · UPSERT 3 nex_product rows (all status='live'):
//         - Rolex Daytona-style chronograph · IDR 180,000,000
//         - Omega Seamaster-style diver     · IDR  85,000,000
//         - Patek Philippe Nautilus-style   · IDR 450,000,000
//       Prices expressed in minor-unit convention · for IDR this is
//       whole rupiah (IDR has no fractional subunit; see money
//       doctrine audit § 2026-10-27).
//
// What it does NOT do:
//
//   · Does NOT touch Vault state (LOCKED 2026-10-20).
//   · Does NOT upload any new storage object (asset is already at
//     /nex-themes/watches-hendra-wallpaper.png shipped commit 971272c).
//   · Does NOT create or modify nex_live_session or any Live-persistence
//     row (D1 migration gate · 219/221/222 not applied).
//   · Does NOT create nex_watch_listing rows (D2 migration gate ·
//     227-230 not applied to prod).
//   · Does NOT grant any theme-purchase ownership (Theme Commerce
//     DRAFT · migrations 191-196 held).
//   · Does NOT change any OTHER persona · scoped by hard-coded UUID.
//
// Safety:
//
//   · Hard-abort unless NEXT_PUBLIC_NEX_SUPABASE_URL + DATABASE_URL
//     both contain `ijvqdvsvwtwxzcqmoqit`.
//   · DRY_RUN mode is the DEFAULT. Prints every SQL statement + bind
//     parameters, writes nothing.
//   · HENDRA_SEED_APPLY=1 environment variable REQUIRED to actually
//     execute writes. Any other value (unset, 0, "false", "") stays
//     in dry-run.
//   · All UPSERTs use ON CONFLICT (…) DO UPDATE SET … so re-running
//     is safe.
//   · All ids are deterministic (SHA-256 of stable seed) · same input
//     → same uuid forever · never collides with real signups.
//   · Scoped by HENDRA_UUID + HENDRA_HANDLE constants · the script
//     cannot accidentally touch another persona.
//   · All writes wrapped in a single transaction · ROLLBACK on any
//     error · prints the failed statement + bind.
//
// Intro routing note:
//
//   `chat_theme='watches-hendra'` activates the WATCHES_HENDRA_PACKAGE,
//   whose `intro.videoUrl` points at /nex-themes/watches-hendra-intro
//   .mp4. The theme intro plays naturally. We deliberately leave
//   `intro_video_url` NULL on nex_account because:
//     a) The sealed intro-video doctrine (2026-10-19) caps personal
//        intro videos at 8 seconds and expects uploads via the
//        `nex-user-intros` Supabase Storage bucket; the mp4 is in the
//        theme bucket, not the user bucket, and likely longer than 8s.
//     b) The theme-intro channel is the correct home for a theme-
//        packaged video. Setting intro_video_url would also work but
//        double-wires the same asset through two code paths with
//        different sealed semantics.
//
// Rollback (manual, run against ijvqdvsvwtwxzcqmoqit):
//
//   BEGIN;
//     DELETE FROM nex_product
//      WHERE business_id = '<HENDRA_BUSINESS_UUID below>';
//     DELETE FROM nex_business
//      WHERE id = '<HENDRA_BUSINESS_UUID below>';
//     UPDATE nex_account
//        SET chat_theme = NULL,
//            tier = 'gratis',
//            bisnis_expires_at = NULL
//      WHERE id = '4f112c32-46a3-4fa4-8b4a-1c5f50caed42';
//   COMMIT;
//
// Usage:
//
//   # Dry run (default · writes nothing):
//   node scripts/mock-personas/seed-hendra-full-wire.mjs
//
//   # Execute writes (requires explicit opt-in):
//   HENDRA_SEED_APPLY=1 node scripts/mock-personas/seed-hendra-full-wire.mjs

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import pg from "pg";

const HENDRA_UUID = "4f112c32-46a3-4fa4-8b4a-1c5f50caed42";
const HENDRA_HANDLE = "hendra";
const HENDRA_NEX_HANDLE = "nex-50014";
const HENDRA_DISPLAY_NAME = "Hendra Gunawan";

/** Deterministic UUID (same algo as persona-manifest · stable across runs). */
function deterministicUuid(seed) {
  const h = createHash("sha256").update(`nex-mock-persona:${seed}`).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,
    `8${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join("-");
}

const HENDRA_BUSINESS_UUID = deterministicUuid("business:hendra-watches");
const HENDRA_PRODUCT_UUIDS = {
  daytona:  deterministicUuid("product:hendra-watches:daytona-01"),
  seamaster: deterministicUuid("product:hendra-watches:seamaster-01"),
  nautilus: deterministicUuid("product:hendra-watches:nautilus-01"),
};

/* ─── Env + safety ─────────────────────────────────────────────────── */

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
const dbUrl       = env.DATABASE_URL;
if (!supabaseUrl || !dbUrl) {
  console.error("ERR: missing env (NEXT_PUBLIC_NEX_SUPABASE_URL / DATABASE_URL)");
  process.exit(2);
}
if (!supabaseUrl.includes("ijvqdvsvwtwxzcqmoqit") || !dbUrl.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: env does not point at ijvqdvsvwtwxzcqmoqit · aborting (safety gate)");
  process.exit(3);
}

const APPLY = process.env.HENDRA_SEED_APPLY === "1";

console.log("");
console.log(`== seed-hendra-full-wire ==`);
console.log(`mode              : ${APPLY ? "APPLY (will write)" : "DRY_RUN (no writes)"}`);
console.log(`supabase          : ${supabaseUrl}`);
console.log(`hendra account    : ${HENDRA_UUID}  (nex-${HENDRA_HANDLE} / ${HENDRA_NEX_HANDLE})`);
console.log(`hendra business   : ${HENDRA_BUSINESS_UUID}  (slug=hendra-watches)`);
console.log(`hendra products   :`);
for (const [k, v] of Object.entries(HENDRA_PRODUCT_UUIDS)) {
  console.log(`  ${k.padEnd(10)}  ${v}`);
}
console.log("");

/* ─── Statements (parameterised · bind values are logged) ─────────── */

const STATEMENTS = [
  {
    label: "1 · UPDATE nex_account · activate watches-hendra theme + bisnis tier",
    sql: `
      UPDATE nex_account
         SET chat_theme        = $2,
             tier              = 'bisnis',
             bisnis_expires_at = now() + interval '365 days'
       WHERE id = $1
         AND is_mock_persona = true
       RETURNING id, display_name, nex_handle, chat_theme, tier, bisnis_expires_at
    `,
    binds: [HENDRA_UUID, "watches-hendra"],
    expectRows: 1,
  },
  {
    label: "2 · UPSERT nex_business · Hendra's Watches shop",
    sql: `
      INSERT INTO nex_business
        (id, owner_account_id, display_name, slug, business_category, search_keywords)
      VALUES
        ($1, $2, $3, $4, $5, $6::text[])
      ON CONFLICT (id) DO UPDATE SET
        display_name      = EXCLUDED.display_name,
        slug              = EXCLUDED.slug,
        business_category = EXCLUDED.business_category,
        search_keywords   = EXCLUDED.search_keywords,
        updated_at        = now()
      RETURNING id, slug, display_name, business_category
    `,
    binds: [
      HENDRA_BUSINESS_UUID,
      HENDRA_UUID,
      "Hendra's Watches",
      "hendra-watches",
      "ecommerce",
      ["luxury watches", "rolex", "omega", "patek philippe", "chronograph", "bogor"],
    ],
    expectRows: 1,
  },
  {
    label: "3a · UPSERT nex_product · Rolex Daytona-style chronograph",
    sql: `
      INSERT INTO nex_product
        (id, business_id, name, description, price_pence, currency, status)
      VALUES
        ($1, $2, $3, $4, $5, 'IDR', 'live')
      ON CONFLICT (id) DO UPDATE SET
        business_id = EXCLUDED.business_id,
        name        = EXCLUDED.name,
        description = EXCLUDED.description,
        price_pence = EXCLUDED.price_pence,
        currency    = EXCLUDED.currency,
        status      = EXCLUDED.status,
        updated_at  = now()
      RETURNING id, name, price_pence, currency, status
    `,
    binds: [
      HENDRA_PRODUCT_UUIDS.daytona,
      HENDRA_BUSINESS_UUID,
      "Daytona-style Chronograph · pre-owned",
      "Steel & gold Daytona-style chronograph · black dial · tachymetre bezel · pre-owned, serviced, box included. Price on request for trade-in.",
      180_000_000,
    ],
    expectRows: 1,
  },
  {
    label: "3b · UPSERT nex_product · Omega Seamaster-style diver",
    sql: `
      INSERT INTO nex_product
        (id, business_id, name, description, price_pence, currency, status)
      VALUES
        ($1, $2, $3, $4, $5, 'IDR', 'live')
      ON CONFLICT (id) DO UPDATE SET
        business_id = EXCLUDED.business_id,
        name        = EXCLUDED.name,
        description = EXCLUDED.description,
        price_pence = EXCLUDED.price_pence,
        currency    = EXCLUDED.currency,
        status      = EXCLUDED.status,
        updated_at  = now()
      RETURNING id, name, price_pence, currency, status
    `,
    binds: [
      HENDRA_PRODUCT_UUIDS.seamaster,
      HENDRA_BUSINESS_UUID,
      "Seamaster-style Diver · blue dial",
      "Stainless steel Seamaster-style diver · blue sunburst dial · ceramic bezel · 300m water resistance · pre-owned with full set.",
      85_000_000,
    ],
    expectRows: 1,
  },
  {
    label: "3c · UPSERT nex_product · Nautilus-style sport",
    sql: `
      INSERT INTO nex_product
        (id, business_id, name, description, price_pence, currency, status)
      VALUES
        ($1, $2, $3, $4, $5, 'IDR', 'live')
      ON CONFLICT (id) DO UPDATE SET
        business_id = EXCLUDED.business_id,
        name        = EXCLUDED.name,
        description = EXCLUDED.description,
        price_pence = EXCLUDED.price_pence,
        currency    = EXCLUDED.currency,
        status      = EXCLUDED.status,
        updated_at  = now()
      RETURNING id, name, price_pence, currency, status
    `,
    binds: [
      HENDRA_PRODUCT_UUIDS.nautilus,
      HENDRA_BUSINESS_UUID,
      "Nautilus-style Sport · tiffany-blue dial",
      "Flagship-tier Nautilus-style sport piece · tiffany-blue dial · integrated bracelet · dealer catalogue reference. Serious inquiries only · condition verification in person.",
      450_000_000,
    ],
    expectRows: 1,
  },
];

/* ─── Pretty-print SQL + binds ─────────────────────────────────────── */

function previewStatement(s) {
  console.log("");
  console.log(`→ ${s.label}`);
  const flatSql = s.sql.trim().split(/\n/).map((l) => "    " + l.trim()).join("\n");
  console.log(flatSql);
  console.log(`    -- binds:`);
  s.binds.forEach((b, i) => {
    const bs = Array.isArray(b) ? `[${b.map((x) => `'${x}'`).join(", ")}]` : JSON.stringify(b);
    console.log(`    --   $${i + 1} = ${bs}`);
  });
}

/* ─── Dry-run · print and exit ─────────────────────────────────────── */

if (!APPLY) {
  console.log("DRY_RUN · the following statements would execute:");
  for (const s of STATEMENTS) previewStatement(s);
  console.log("");
  console.log("");
  console.log("Nothing written. To apply:");
  console.log("  HENDRA_SEED_APPLY=1 node scripts/mock-personas/seed-hendra-full-wire.mjs");
  console.log("");
  process.exit(0);
}

/* ─── Apply mode · one transaction, print-then-execute, rollback on ─ */
/* ─── any error, print the failing statement for diagnosis. ────────── */

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
console.log("CONNECTED to postgres · beginning transaction");

try {
  await client.query("BEGIN");
  for (const s of STATEMENTS) {
    previewStatement(s);
    const res = await client.query(s.sql, s.binds);
    const n = res.rowCount ?? 0;
    console.log(`    -- rowCount: ${n}`);
    if (s.expectRows && n !== s.expectRows) {
      throw new Error(
        `expected rowCount ${s.expectRows} on "${s.label}" · got ${n}`,
      );
    }
    if (res.rows?.length) {
      console.log(`    -- returned: ${JSON.stringify(res.rows[0])}`);
    }
  }
  await client.query("COMMIT");
  console.log("");
  console.log("DONE · transaction committed");
  console.log("");
  console.log("Verify in-browser:");
  console.log(`  Hendra's shop         : /nex-native/hendra-watches`);
  console.log(`  Hendra's theme preview: /nex-native/themes/watches-hendra`);
  console.log(`  Chat with Hendra      : /nex-native/chat/peer/${HENDRA_UUID}`);
  console.log(`  Hendra's directory tile: visible after re-visiting /nex-native/directory`);
} catch (e) {
  await client.query("ROLLBACK");
  console.error("");
  console.error(`ROLLBACK · ${e.message}`);
  process.exit(1);
} finally {
  await client.end();
}
