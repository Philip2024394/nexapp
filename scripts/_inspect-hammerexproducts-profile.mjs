// scripts/_inspect-hammerexproducts-profile.mjs
//
// READ-ONLY inspection · no writes, no uploads, no mutations.
// Prints the current nex_business.profile jsonb for slug='hammerexproducts'
// so the pre-seed safeguard review can confirm what a merge needs to preserve.
//
// Delete after review.

import { readFileSync } from "node:fs";
import { Client } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

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

const pg = new Client({ connectionString: PG_URL, ssl: { rejectUnauthorized: false } });
await pg.connect();
try {
  const biz = await pg.query(
    `SELECT id, display_name, logo_url, cover_layout_id, business_category,
            profile, events_profile,
            jsonb_typeof(profile) AS profile_typeof,
            (profile IS NULL) AS profile_is_null
       FROM nex_business WHERE slug = 'hammerexproducts' LIMIT 1`,
  );
  if (!biz.rows[0]) {
    console.log(JSON.stringify({ exists: false, slug: "hammerexproducts" }, null, 2));
  } else {
    const r = biz.rows[0];
    console.log(JSON.stringify({
      exists: true,
      id: r.id,
      display_name: r.display_name,
      logo_url: r.logo_url,
      cover_layout_id: r.cover_layout_id,
      business_category: r.business_category,
      profile_is_null: r.profile_is_null,
      profile_typeof: r.profile_typeof,
      profile_keys: r.profile && typeof r.profile === "object" ? Object.keys(r.profile).sort() : null,
      profile: r.profile,
      events_profile_keys: r.events_profile && typeof r.events_profile === "object" ? Object.keys(r.events_profile).sort() : null,
    }, null, 2));
  }

  const acct = await pg.query(
    `SELECT a.id, a.display_name, a.chat_theme, a.tier,
            p.avatar_url, (p.account_id IS NOT NULL) AS profile_row_exists
       FROM nex_account a
       JOIN nex_business b ON b.owner_account_id = a.id
       LEFT JOIN nex_account_profile p ON p.account_id = a.id
      WHERE b.slug = 'nex-10842'
      LIMIT 1`,
  );
  console.log("---");
  console.log(JSON.stringify({
    founder: acct.rows[0] ? {
      id: acct.rows[0].id,
      display_name: acct.rows[0].display_name,
      chat_theme: acct.rows[0].chat_theme,
      tier: acct.rows[0].tier,
      has_account_profile_row: acct.rows[0].profile_row_exists,
      current_avatar_url: acct.rows[0].avatar_url,
    } : null,
  }, null, 2));

  const theme = await pg.query(
    `SELECT id, name, accent_hex, hero_image_url, intro_video_url
       FROM nex_chat_theme
      WHERE id IN ('hammerex-industrial', 'hammerex-products')
      ORDER BY id`,
  );
  console.log("---");
  console.log(JSON.stringify({ theme_rows: theme.rows }, null, 2));

  const products = await pg.query(
    `SELECT count(*)::int AS n,
            count(*) FILTER (WHERE sku LIKE 'HX-SAMPLE-%')::int AS n_sample_sku
       FROM nex_product p
       JOIN nex_business b ON b.id = p.business_id
      WHERE b.slug = 'hammerexproducts'`,
  );
  console.log("---");
  console.log(JSON.stringify({ products: products.rows[0] }, null, 2));
} finally {
  await pg.end();
}
