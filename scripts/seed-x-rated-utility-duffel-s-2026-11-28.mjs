// scripts/seed-x-rated-utility-duffel-s-2026-11-28.mjs
//
// Owner directive 2026-11-28 · seed the Black X-Rated Utility Duffel
// Bag (size S) as a real, live product in the X-Rated Tool Belts shop
// on the SANDBOX supabase project.
//
// Idempotent · re-runs are safe:
//   · image upload uses upsert:true
//   · section insert is guarded by (business_id, name) existence check
//   · product insert is guarded by (business_id, sku) existence check
//     (SKU convention observed in sandbox: XRTB-###)
//
// HARD REFUSALS:
//   · prod ref `ijvqdvsvwtwxzcqmoqit` detected → exit 2
//   · sandbox ref `kdstoyyeygcopkogqsyv` not detected → exit 3
//   · source image file missing → exit 4
//
// Writes evidence/x-rated-seed/seed-run-{timestamp}.json with the
// committed product row and verification URLs.

import pg from "pg";
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");

// ─── Load .env.local ────────────────────────────────────────────────
const env = (() => {
  const t = readFileSync(resolve(REPO, ".env.local"), "utf8");
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

const supaUrl = env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const dbUrl = env.DATABASE_URL;
const serviceKey = env.NEX_SUPABASE_SERVICE_ROLE_KEY;

if (!supaUrl || !dbUrl || !serviceKey) {
  console.error("REFUSED · missing NEXT_PUBLIC_NEX_SUPABASE_URL / DATABASE_URL / NEX_SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (/ijvqdvsvwtwxzcqmoqit/.test(supaUrl) || /ijvqdvsvwtwxzcqmoqit/.test(dbUrl)) {
  console.error("REFUSED · prod ref ijvqdvsvwtwxzcqmoqit detected in env");
  process.exit(2);
}
if (!/kdstoyyeygcopkogqsyv/.test(supaUrl) || !/kdstoyyeygcopkogqsyv/.test(dbUrl)) {
  console.error("REFUSED · expected sandbox ref kdstoyyeygcopkogqsyv in env");
  process.exit(3);
}

// ─── Constants ─────────────────────────────────────────────────────
const BIZ_ID = "22222222-2222-4222-8222-222222299902";
const SOURCE_IMAGE = "C:/Users/Victus/Downloads/Black XRATED BELTS Utility Duffel.png";
const BUCKET = "nex-business-assets";
const PRODUCT_NAME = "Black X-Rated Utility Duffel Bag";
const PRODUCT_DESCRIPTION =
`A compact, water-resistant utility duffel designed to store and transport your tool belt rig and tools.

Made using Cordura, Cordura 600D and polyester materials, the bag provides a practical storage solution for working professionals. An external pocket provides convenient storage for scaffolders' cards or site drawings.

Keep your tool belt rig neatly stored away at the end of the day or transport it easily from one job site to the next.`;
const PRICE_PENCE = 750;        // £7.50 GBP
const CURRENCY = "GBP";
const DEPARTMENT_ID = "tools_diy_construction"; // matches all 17 existing X-Rated products
const CATEGORY_ID = "bags_luggage";             // canonical NEX category for a duffel (also observed in sandbox)
const SHOP_SECTION_NAME = "Tool Rig Bag";       // per owner directive
const SKU = "XRTB-018";                         // next in sequence after XRTB-001..017
const STATUS = "live";                          // owner wants this on the storefront
const STOCK_STATUS = "in_stock";

const PRODUCT_SPEC = {
  condition: "new",
  brand: "X-Rated Tool Belts",
  materials: ["Cordura", "Cordura 600D", "polyester"],
  dimensions: { w: 30, h: 20, d: 12, unit: "cm" },
  additional: {
    water_resistance: "water-resistant",
    size_label: "S",
    features: [
      "external pocket for scaffolders' cards or site drawings",
      "compact for carrying tool belt rigs and tools",
      "keeps the tool belt rig neatly stored away",
      "convenient for transporting between job sites",
    ],
  },
};

if (!existsSync(SOURCE_IMAGE)) {
  console.error(`REFUSED · source image missing at ${SOURCE_IMAGE}`);
  process.exit(4);
}

// ─── Phase A · compress image ──────────────────────────────────────
console.log("[A] compressing source image");
const srcStat = statSync(SOURCE_IMAGE);
console.log(`    source ${(srcStat.size / 1024 / 1024).toFixed(2)} MB (3.3 MB observed)`);

const compressedBuf = await sharp(SOURCE_IMAGE)
  // Keep transparency · palette+quality quantization brings PNG size
  // from ~3.3 MB to ~200–500 KB without visible quality loss.
  .png({ palette: true, quality: 90, compressionLevel: 9, effort: 10 })
  .toBuffer();
console.log(`    compressed ${(compressedBuf.length / 1024).toFixed(1)} KB`);

if (compressedBuf.length > 2_097_152) {
  console.warn(`[WARN] compressed image ${compressedBuf.length} bytes still exceeds nex-business-assets 2 MB cap`);
  console.warn("       falling back to JPEG with white background");
  const jpegBuf = await sharp(SOURCE_IMAGE)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  console.log(`    jpeg fallback ${(jpegBuf.length / 1024).toFixed(1)} KB`);
  if (jpegBuf.length > 2_097_152) {
    console.error("REFUSED · neither PNG palette nor JPEG fallback fits 2 MB bucket cap");
    process.exit(5);
  }
  compressedBuf.length = jpegBuf.length;
  // eslint-disable-next-line no-global-assign
  globalThis.__finalImage = { buf: jpegBuf, contentType: "image/jpeg", ext: "jpg" };
} else {
  globalThis.__finalImage = { buf: compressedBuf, contentType: "image/png", ext: "png" };
}

const finalImage = globalThis.__finalImage;

// ─── Phase B · upload to storage ───────────────────────────────────
console.log(`[B] uploading to bucket ${BUCKET}`);
const sb = createClient(supaUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const imageKey = `x-rated-tool-belts/products/utility-duffel-s.${finalImage.ext}`;
const { error: upErr } = await sb.storage
  .from(BUCKET)
  .upload(imageKey, finalImage.buf, {
    contentType: finalImage.contentType,
    upsert: true,
    cacheControl: "31536000",
  });
if (upErr) {
  console.error(`REFUSED · storage upload failed · ${upErr.message}`);
  process.exit(6);
}
const { data: pubData } = sb.storage.from(BUCKET).getPublicUrl(imageKey);
const imageUrl = pubData.publicUrl;
console.log(`    ${imageUrl}`);

// ─── Phase C · DB transaction ──────────────────────────────────────
console.log("[C] opening DB transaction");
const c = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("BEGIN");

let summary = { imageUrl, imageBytes: finalImage.buf.length, imageContentType: finalImage.contentType };

try {
  // C1 · verify biz exists (defensive)
  const { rows: bizRows } = await c.query(
    "SELECT id, slug, display_name, owner_account_id FROM nex_business WHERE id = $1",
    [BIZ_ID],
  );
  if (!bizRows[0]) throw new Error(`business ${BIZ_ID} not found in sandbox`);
  summary.business = bizRows[0];

  // C2 · upsert section "Tool Rig Bag"
  let sectionId;
  const { rows: existingSec } = await c.query(
    "SELECT id FROM nex_product_section WHERE business_id = $1 AND name = $2 LIMIT 1",
    [BIZ_ID, SHOP_SECTION_NAME],
  );
  if (existingSec[0]) {
    sectionId = existingSec[0].id;
    console.log(`    section exists · ${sectionId}`);
    summary.section = { id: sectionId, name: SHOP_SECTION_NAME, created: false };
  } else {
    const { rows: newSec } = await c.query(
      `INSERT INTO nex_product_section (business_id, name, sort_order)
       VALUES ($1, $2, 0)
       RETURNING id`,
      [BIZ_ID, SHOP_SECTION_NAME],
    );
    sectionId = newSec[0].id;
    console.log(`    section created · ${sectionId}`);
    summary.section = { id: sectionId, name: SHOP_SECTION_NAME, created: true };
  }

  // C3 · insert product (guarded by unique (business_id, sku))
  const { rows: existingProd } = await c.query(
    "SELECT id FROM nex_product WHERE business_id = $1 AND sku = $2 LIMIT 1",
    [BIZ_ID, SKU],
  );
  let productId;
  if (existingProd[0]) {
    productId = existingProd[0].id;
    console.log(`    product with SKU ${SKU} already exists · ${productId} · updating in place`);
    const { rows: updated } = await c.query(
      `UPDATE nex_product SET
         name = $1, description = $2, price_pence = $3, currency = $4,
         status = $5, image_url = $6, stock_status = $7,
         department_id = $8, category_id = $9, section_id = $10, spec = $11,
         updated_at = now()
       WHERE id = $12
       RETURNING *`,
      [
        PRODUCT_NAME, PRODUCT_DESCRIPTION, PRICE_PENCE, CURRENCY,
        STATUS, imageUrl, STOCK_STATUS,
        DEPARTMENT_ID, CATEGORY_ID, sectionId, JSON.stringify(PRODUCT_SPEC),
        productId,
      ],
    );
    summary.product = { ...updated[0], __action: "updated_in_place" };
  } else {
    const { rows: inserted } = await c.query(
      `INSERT INTO nex_product (
         business_id, name, description, price_pence, currency, status,
         image_url, stock_status, sku, department_id, category_id,
         section_id, spec
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13
       ) RETURNING *`,
      [
        BIZ_ID, PRODUCT_NAME, PRODUCT_DESCRIPTION, PRICE_PENCE, CURRENCY, STATUS,
        imageUrl, STOCK_STATUS, SKU, DEPARTMENT_ID, CATEGORY_ID,
        sectionId, JSON.stringify(PRODUCT_SPEC),
      ],
    );
    productId = inserted[0].id;
    console.log(`    product inserted · ${productId}`);
    summary.product = { ...inserted[0], __action: "inserted" };
  }

  await c.query("COMMIT");
  console.log("[C] COMMIT ok");
} catch (e) {
  await c.query("ROLLBACK");
  await c.end();
  console.error(`REFUSED · DB tx rolled back · ${e.message}`);
  process.exit(7);
}

// ─── Phase D · verification read-back ──────────────────────────────
console.log("[D] verification read-back");
const { rows: verify } = await c.query(
  `SELECT p.id, p.name, p.price_pence, p.currency, p.status,
          p.image_url, p.sku, p.department_id, p.category_id,
          p.section_id, s.name AS section_name, p.spec
     FROM nex_product p
     LEFT JOIN nex_product_section s ON s.id = p.section_id
    WHERE p.business_id = $1 AND p.sku = $2`,
  [BIZ_ID, SKU],
);
summary.verify_read_back = verify[0] ?? null;
await c.end();

// Public storefront + product detail URLs (sandbox dev server at :3008)
summary.sandbox_urls = {
  storefront_shop: `http://localhost:3008/nex-native/x-rated-tool-belts`,
  product_detail: `http://localhost:3008/nex-native/x-rated-tool-belts/${summary.product.id}`,
  manage_orders_list: `http://localhost:3008/nex-native/manage/products`,
};

const evidenceDir = resolve(REPO, "evidence", "x-rated-seed");
mkdirSync(evidenceDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = resolve(evidenceDir, `seed-run-${stamp}.json`);
writeFileSync(outPath, JSON.stringify(summary, null, 2));
console.log(`[done] evidence · ${outPath}`);
console.log(`[done] product id · ${summary.product.id}`);
