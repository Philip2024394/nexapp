// scripts/seed-hammerexproducts.mjs
//
// Phase 0 + 1 + 2 of Hammerexproducts.nex live-business showcase.
//
// Does, in one idempotent run:
//   0a. Upgrade founder philip's tier to 'bisnis' (allows 5 businesses)
//   0b. Create nex_business row for 'hammerexproducts' slug
//   1a. Upload intro video + wallpaper to Supabase storage
//   1b. Create nex_chat_theme 'hammerex-products' with those URLs
//   1c. Point founder's chat_theme at the new theme (so cover-content-
//       loader picks it up via owner.chat_theme per sealed architecture)
//   2a. Seed 20 SAMPLE products marked spec.is_sample=true
//
// SAFE TO RE-RUN · every INSERT uses ON CONFLICT DO UPDATE or guard
// predicates. First run creates; later runs only touch rows if their
// descriptor changed. Does NOT drop or delete anything.
//
// Usage:
//   node scripts/seed-hammerexproducts.mjs
//
// Reads .env.local for NEX_POSTGRES_URL + NEX_SUPABASE_URL +
// NEX_SUPABASE_SERVICE_ROLE_KEY (also tries NEXT_PUBLIC_NEX_SUPABASE_URL).

import { readFileSync } from "node:fs";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

// ─── Load .env.local ────────────────────────────────────────────────
const env = (() => {
  const t = readFileSync(path.join(REPO_ROOT, ".env.local"), "utf8");
  const out = {};
  for (const line of t.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
})();

const PG_URL = env.NEX_POSTGRES_URL;
if (!PG_URL || !/ijvqdvsvwtwxzcqmoqit/.test(PG_URL)) {
  console.error("NEX_POSTGRES_URL must point at Supabase ijvqdvsvwtwxzcqmoqit");
  process.exit(1);
}
const SUPABASE_URL =
  env.NEXT_PUBLIC_NEX_SUPABASE_URL || env.NEX_SUPABASE_URL;
const SERVICE_KEY = env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Need NEX_SUPABASE_URL + NEX_SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const ASSET_VIDEO = "C:/Users/Victus/Downloads/Industrial_tool_backpacks_on_floor_20261013221844.mp4";
const ASSET_WALLPAPER = "C:/Users/Victus/Pictures/plasterers max.png";
const ASSET_LOGO = "C:/Users/Victus/Downloads/Hammerex Chrome and Orange Logo.png";
const BUSINESS_SLUG = "hammerexproducts";
const BUSINESS_NAME = "Hammerexproducts";
const BUSINESS_DESCRIPTION =
  "⚠️ SAMPLE SHOWCASE · built on the NEX premium business platform. Industrial construction tool backpacks, site organisers, and premium hard-wearing field equipment. Not a real offer · product data is placeholder.";
const THEME_ID = "hammerex-products";
const THEME_NAME = "Hammerex Products";
const THEME_ACCENT = "#FF7800";
const THEME_BUBBLE_RIM = "#FF7800";
const THEME_COMPOSER_RIM = "#FF7800";
const COVER_LAYOUT_ID = "product";
const BUSINESS_CATEGORY = "product-brand";

// ─── Supabase storage client ───────────────────────────────────────
const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function uploadAsset(bucket, localPath, destName, contentType) {
  const data = readFileSync(localPath);
  const { error } = await sb.storage
    .from(bucket)
    .upload(destName, data, { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`upload ${bucket}/${destName}: ${error.message}`);
  const { data: urlData } = sb.storage.from(bucket).getPublicUrl(destName);
  return urlData.publicUrl;
}

// ─── Seed catalog ─────────────────────────────────────────────────
// 20 clearly-labelled sample construction products. Original
// descriptions · no real manufacturer SKUs or verified specs.
const SAMPLE_PRODUCTS = [
  { name: "HX Tradie Tool Backpack · 45L", description: "SAMPLE. Reinforced carry pack sized for mixed hand-tool loads. Padded straps, laser-cut MOLLE panels, high-visibility interior lining. Field-finish quality for daily site rotation.", price_pence_idr: 185_000_000 },
  { name: "HX Site Organiser Tote · 32L", description: "SAMPLE. Open-top tool tote with reinforced corners and quick-grab external pockets. Daily carry format for electrical and finishing trades.", price_pence_idr: 95_000_000 },
  { name: "HX Hard Hat · Vented Industrial", description: "SAMPLE. High-impact composite shell with cross-ventilation ports. 4-point ratchet suspension, sweatband-washable interior.", price_pence_idr: 42_000_000 },
  { name: "HX Impact Gloves · Cut Level 5", description: "SAMPLE. Reinforced knuckle shell with cut-resistant palm lining. Touchscreen-compatible fingertips. Sold per pair.", price_pence_idr: 18_500_000 },
  { name: "HX Steel-Toe Site Boot · Size 42", description: "SAMPLE. Full-grain leather upper with vulcanised anti-slip outsole. Composite toe cap. Mid-ankle support.", price_pence_idr: 125_000_000 },
  { name: "HX Rolling Tool Case · 68L", description: "SAMPLE. Multi-tier rolling case with 2 removable upper trays and lower deep storage. Puncture-resistant wheels for site surfaces.", price_pence_idr: 265_000_000 },
  { name: "HX Pouch Belt · Carpenter 6-Pocket", description: "SAMPLE. Full-grain leather tool belt with reinforced hammer loop and 6 structured pockets. Adjustable waist 28-44 inch.", price_pence_idr: 48_000_000 },
  { name: "HX Knee Pads · Professional Gel Core", description: "SAMPLE. Dual-strap gel-core knee pads with slip-resistant front plate. Comfort fit for floor-finishing and tiling work.", price_pence_idr: 22_000_000 },
  { name: "HX Safety Goggles · Clear Anti-Fog", description: "SAMPLE. Full-wrap polycarbonate lens with anti-fog coating. Adjustable headstrap. Over-glasses fit.", price_pence_idr: 15_500_000 },
  { name: "HX Respirator Mask · Half-Face P2", description: "SAMPLE. Reusable P2-filter respirator with replaceable twin cartridges. Low-profile exhale valve.", price_pence_idr: 38_000_000 },
  { name: "HX Site Headlamp · 350 Lumen", description: "SAMPLE. USB-C rechargeable headlamp with adjustable flood/spot beam. 3-mode brightness.", price_pence_idr: 24_000_000 },
  { name: "HX Measuring Tape · 8m Magnetic Hook", description: "SAMPLE. 8-metre steel blade with magnetic hook tip and anti-impact rubber case.", price_pence_idr: 9_500_000 },
  { name: "HX Spirit Level · 1200mm", description: "SAMPLE. Milled-face aluminium spirit level with 3 vials. Rubber end caps.", price_pence_idr: 32_000_000 },
  { name: "HX Hammer · Framing 20oz", description: "SAMPLE. Smooth-face framing hammer with anti-vibration grip and milled claw.", price_pence_idr: 18_000_000 },
  { name: "HX Utility Knife · Auto-Load", description: "SAMPLE. Auto-load folding utility knife with 5-blade internal magazine. Belt clip.", price_pence_idr: 12_500_000 },
  { name: "HX Chalk Line · 30m Nylon", description: "SAMPLE. 30-metre nylon chalk-line reel with cast-aluminium body. High-visibility blue chalk included.", price_pence_idr: 11_000_000 },
  { name: "HX Site Flashlight · Waterproof", description: "SAMPLE. IP68-rated handheld flashlight with magnetic base. 500 lumen high beam.", price_pence_idr: 28_000_000 },
  { name: "HX Earmuffs · 28dB SNR", description: "SAMPLE. Over-ear hearing protection with adjustable headband. 28dB noise reduction rating.", price_pence_idr: 19_500_000 },
  { name: "HX High-Vis Vest · Class 2", description: "SAMPLE. Mesh-back high-visibility vest with reflective tape. Front zip closure.", price_pence_idr: 14_500_000 },
  { name: "HX Tool Lanyard · Dual Clip", description: "SAMPLE. Coiled dual-clip tool lanyard rated 2.3kg. Prevents drop loss at height.", price_pence_idr: 8_500_000 },
];

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  const pg = new Client({ connectionString: PG_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  try {
    // ─── 0a. Find founder account ──────────────────────────────────
    const ownerRow = await pg.query(`
      SELECT a.id, a.display_name, a.chat_theme, a.tier
        FROM nex_account a
        JOIN nex_business b ON b.owner_account_id = a.id
       WHERE b.slug = 'nex-10842'
      LIMIT 1
    `);
    if (!ownerRow.rows[0]) throw new Error("founder account not found via nex-10842");
    const owner = ownerRow.rows[0];
    console.log(`[0a] founder · ${owner.display_name} · ${owner.id} · tier=${owner.tier} · chat_theme=${owner.chat_theme}`);

    // ─── 1a. Upload assets to storage ──────────────────────────────
    // Storage uploads happen BEFORE opening the DB transaction so
    // the Postgres tx window is as short as possible. Supabase
    // Storage uploads cannot participate in a PG tx; a partial
    // upload leaves well-known paths with upsert:true semantics,
    // so a re-run safely overwrites them (no orphans).
    console.log(`[1a] uploading intro video → nex-theme-intro/${THEME_ID}.mp4`);
    const introUrl = await uploadAsset(
      "nex-theme-intro",
      ASSET_VIDEO,
      `${THEME_ID}.mp4`,
      "video/mp4",
    );
    console.log(`      ${introUrl}`);
    console.log(`[1a] uploading wallpaper → nex-chat-theme-hero/${THEME_ID}.png`);
    const wallpaperUrl = await uploadAsset(
      "nex-chat-theme-hero",
      ASSET_WALLPAPER,
      `${THEME_ID}.png`,
      "image/png",
    );
    console.log(`      ${wallpaperUrl}`);
    // Business logo · reuses the sealed onboarding-logo bucket
    // (nex-peer-chat-attachments → business-logo/{slug}/logo.png)
    // so the file lives alongside production-uploaded seller logos.
    console.log(`[1a] uploading logo → nex-peer-chat-attachments/business-logo/${BUSINESS_SLUG}/logo.png`);
    const logoUrl = await uploadAsset(
      "nex-peer-chat-attachments",
      ASSET_LOGO,
      `business-logo/${BUSINESS_SLUG}/logo.png`,
      "image/png",
    );
    console.log(`      ${logoUrl}`);

    // ─── Open the DB transaction · all PG writes below are atomic ──
    // Any failure between BEGIN and COMMIT triggers ROLLBACK in the
    // catch · no partial DB state persists. Storage objects uploaded
    // above remain (deterministic paths, idempotent re-run).
    //
    // Hoisted to the outer scope so the post-COMMIT summary logger
    // (which lives OUTSIDE the inner tx-try's block scope) can read
    // these values without a ReferenceError.
    let businessId;
    let productCountQuery;

    await pg.query("BEGIN");
    try {
    // ─── 0b. Upgrade tier to bisnis so philip can own 2+ businesses ─
    if (owner.tier !== "bisnis") {
      await pg.query(
        `UPDATE nex_account SET tier='bisnis', bisnis_expires_at='9999-12-31'::timestamptz WHERE id=$1`,
        [owner.id],
      );
      console.log(`[0b] upgraded ${owner.display_name} tier gratis → bisnis`);
    } else {
      console.log(`[0b] founder already on bisnis tier`);
    }

    // ─── 1b. Create / update chat theme ────────────────────────────
    await pg.query(
      `
      INSERT INTO nex_chat_theme
        (id, name, tagline, accent_hex, bubble_rim_hex, composer_rim_hex,
         tier, category, hero_image_url, intro_video_url, is_active, sort_order,
         wallpaper_config, layout_style, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6,
         'bisnis', 'premium', $7, $8, true, 1000,
         '{}'::jsonb, 'bubbles', now(), now())
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name,
        tagline=EXCLUDED.tagline,
        accent_hex=EXCLUDED.accent_hex,
        bubble_rim_hex=EXCLUDED.bubble_rim_hex,
        composer_rim_hex=EXCLUDED.composer_rim_hex,
        hero_image_url=EXCLUDED.hero_image_url,
        intro_video_url=EXCLUDED.intro_video_url,
        updated_at=now()
      `,
      [
        THEME_ID,
        THEME_NAME,
        "Industrial construction aesthetic · orange + black",
        THEME_ACCENT,
        THEME_BUBBLE_RIM,
        THEME_COMPOSER_RIM,
        wallpaperUrl,
        introUrl,
      ],
    );
    console.log(`[1b] chat theme ${THEME_ID} upserted`);

    // ─── 1c. Set founder's chat_theme ──────────────────────────────
    if (owner.chat_theme !== THEME_ID) {
      await pg.query(
        `UPDATE nex_account SET chat_theme=$1 WHERE id=$2`,
        [THEME_ID, owner.id],
      );
      console.log(`[1c] founder chat_theme ${owner.chat_theme} → ${THEME_ID}`);
    } else {
      console.log(`[1c] founder already on theme ${THEME_ID}`);
    }

    // ─── 1d. Set founder's account_profile avatar to the Hammerex logo ──
    // Shown wherever the viewer sees their own identity (dashboard,
    // chat cards, settings), via nex_account_profile.avatar_url (M045).
    await pg.query(
      `
      INSERT INTO nex_account_profile (account_id, avatar_url)
      VALUES ($1, $2)
      ON CONFLICT (account_id) DO UPDATE SET avatar_url = EXCLUDED.avatar_url
      `,
      [owner.id, logoUrl],
    );
    console.log(`[1d] founder avatar_url set → logo`);

    // ─── 2a. Create / update business row ─────────────────────────
    const existing = await pg.query(
      `SELECT id, cover_layout_id FROM nex_business WHERE slug=$1`,
      [BUSINESS_SLUG],
    );
    if (existing.rows[0]) {
      businessId = existing.rows[0].id;
      await pg.query(
        `UPDATE nex_business SET
           display_name=$1,
           description=$2,
           cover_layout_id=$3,
           business_category=$4,
           logo_url=$5,
           market_reach='both',
           updated_at=now()
         WHERE id=$6`,
        [BUSINESS_NAME, BUSINESS_DESCRIPTION, COVER_LAYOUT_ID, BUSINESS_CATEGORY, logoUrl, businessId],
      );
      console.log(`[0c] business ${BUSINESS_SLUG} already existed · updated · id=${businessId}`);
    } else {
      const ins = await pg.query(
        `INSERT INTO nex_business
           (owner_account_id, display_name, slug, description, cover_layout_id,
            business_category, logo_url, market_reach, accepts_cod, accepts_pickup)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'both', true, true)
         RETURNING id`,
        [owner.id, BUSINESS_NAME, BUSINESS_SLUG, BUSINESS_DESCRIPTION, COVER_LAYOUT_ID, BUSINESS_CATEGORY, logoUrl],
      );
      businessId = ins.rows[0].id;
      console.log(`[0c] created business ${BUSINESS_SLUG} · id=${businessId}`);
    }

    // ─── 2a-package. Store PROPOSED Rp 2M service package record ──
    // Lives in nex_business.profile jsonb so it travels with the
    // business without a schema migration. status='proposed' means
    // this is NOT a published commercial claim · it's the shape of
    // the offer we intend to publish once founder-approved.
    const servicePackage = {
      service_package: {
        status: "proposed",
        price_idr: 2_000_000,
        currency: "IDR",
        type: "one_time_setup",
        name: "NEX Premium Business Setup",
        inclusions: [
          "Business profile + slug",
          "Theme + logo treatment",
          "Business introduction block",
          "Chat wallpaper (custom per business)",
          "NEX Chat enabled",
          "Up to 50 product entries loaded by NEX",
          "1 round of revisions within 14 days",
        ],
        separately_billed: [
          "Hosting (recurring)",
          "Ongoing support",
          "Custom code or bespoke features",
          "Third-party integrations",
          "Additional products beyond 50",
          "Change requests beyond included revision round",
        ],
        proposed_at: new Date().toISOString(),
        proposed_by: "founder-managed",
        notes:
          "Price is PROPOSED only · not a published commercial agreement. Terms subject to founder approval before any customer billing.",
      },
      is_founder_showcase: true,
      founder_notice:
        "This business is the first live NEX premium showcase · managed by the founder until a real business owner is assigned.",
    };
    // Shallow jsonb merge · preserves any pre-existing top-level keys
    // (Rev 6 §5 primary/secondary classification, future owner-set
    // keys, etc.) while overriding service_package / is_founder_showcase
    // / founder_notice with the seed's authoritative values. Safe when
    // profile is NULL (COALESCE → {}) and idempotent on re-runs.
    await pg.query(
      `UPDATE nex_business
         SET profile = COALESCE(profile, '{}'::jsonb) || $1::jsonb
       WHERE id = $2`,
      [servicePackage, businessId],
    );
    console.log(`[2a-pkg] service package record merged into nex_business.profile · status=proposed`);

    // ─── 2b. Seed products ─────────────────────────────────────────
    let inserted = 0, updated = 0;
    for (const [i, p] of SAMPLE_PRODUCTS.entries()) {
      const sku = `HX-SAMPLE-${String(i + 1).padStart(3, "0")}`;
      const spec = {
        is_sample: true,
        sample_notice:
          "SAMPLE data · for showcase only · no real stock, no real price, no verified specifications",
        source: "nexapp-seed-hammerexproducts.mjs",
      };
      const probe = await pg.query(
        `SELECT id FROM nex_product WHERE business_id=$1 AND sku=$2`,
        [businessId, sku],
      );
      if (probe.rows[0]) {
        await pg.query(
          `UPDATE nex_product SET name=$1, description=$2, price_pence=$3, spec=$4, status='live', updated_at=now() WHERE id=$5`,
          [p.name, p.description, p.price_pence_idr, spec, probe.rows[0].id],
        );
        updated++;
      } else {
        await pg.query(
          `INSERT INTO nex_product
             (id, business_id, name, description, price_pence, currency, status, sku, spec, created_at, updated_at)
           VALUES
             (gen_random_uuid(), $1, $2, $3, $4, 'IDR', 'live', $5, $6, now(), now())`,
          [businessId, p.name, p.description, p.price_pence_idr, sku, spec],
        );
        inserted++;
      }
    }
    console.log(`[2a] products · inserted=${inserted} · updated=${updated} · total=${SAMPLE_PRODUCTS.length}`);

    // ─── Final sanity (inside tx; read-only but counts post-write state) ──
    productCountQuery = await pg.query(
      `SELECT count(*)::int AS n FROM nex_product WHERE business_id=$1 AND status='live'`,
      [businessId],
    );

    // Commit the whole DB transaction atomically.
    await pg.query("COMMIT");
    } catch (err) {
      // Any PG error between BEGIN and COMMIT lands here. ROLLBACK
      // discards every write in this transaction (0b, 1b, 1c, 1d,
      // 2a, 2a-pkg, 2b). Re-throw so the top-level handler reports
      // non-zero exit · the storage objects uploaded above remain
      // at their deterministic paths (safe idempotent re-run).
      try { await pg.query("ROLLBACK"); } catch { /* best-effort */ }
      throw err;
    }
    console.log(`\n═══ SEEDED ═══`);
    console.log(`business       : ${BUSINESS_NAME}`);
    console.log(`slug           : ${BUSINESS_SLUG}`);
    console.log(`id             : ${businessId}`);
    console.log(`owner          : ${owner.display_name} (${owner.id})`);
    console.log(`cover layout   : ${COVER_LAYOUT_ID}`);
    console.log(`chat theme     : ${THEME_ID}`);
    console.log(`intro video    : ${introUrl}`);
    console.log(`wallpaper      : ${wallpaperUrl}`);
    console.log(`live products  : ${productCountQuery.rows[0].n}`);
    console.log(`shop link      : https://nexapp-mu.vercel.app/nex-native/${BUSINESS_SLUG}?commerce=1`);
  } finally {
    await pg.end();
  }
}

main().catch((e) => {
  console.error("FATAL:", e.stack || e.message);
  process.exit(1);
});
