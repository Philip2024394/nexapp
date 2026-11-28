// scripts/add-x-rated-utility-duffel-gallery-image-2-2026-11-28.mjs
//
// Owner directive 2026-11-28 (twelfth pass · Utility Duffel) ·
// "this is the second image for tool bag" · source file
// `C:/Users/Victus/Downloads/XRATED BELTS Heavy-Duty Gear Bag.png`.
//
// The product (Black X-Rated Utility Duffel Bag · 7fe7b701-...)
// currently has gallery_urls = NULL. This adds the owner's second
// image as the first gallery entry so the product page shows a
// clickable thumb strip beneath the main image.
//
// Pipeline:
//   · Download the local PNG (2.87 MB · 1331x1180 · soft edges).
//   · sharp.trim() to drop any fully-transparent border rows.
//   · Extend 4 % safety margin on all sides so the bag doesn't
//     touch the card rim.
//   · PNG palette-encode (quality 90 · effort 10) · ~775 KB · well
//     under the 2 MB bucket cap.
//   · Upload to `x-rated-tool-belts/products/utility-duffel-s-gallery-2.png`.
//   · UPDATE nex_product.gallery_urls = ARRAY[new_url]::text[].
//
// Idempotent · sandbox-only · hard-refuses prod.
//
// Writes `evidence/x-rated-seed/gallery-add-run-{timestamp}.json`.

import pg from "pg";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envRaw = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
const env = Object.fromEntries(
  envRaw
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((l) => !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);

const dbUrl = env.DATABASE_URL;
const supaUrl = env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const supaKey = env.NEX_SUPABASE_SERVICE_ROLE_KEY;

if (!dbUrl || !supaUrl || !supaKey) {
  console.error(
    "REFUSED · missing DATABASE_URL / NEXT_PUBLIC_NEX_SUPABASE_URL / NEX_SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}
if (/ijvqdvsvwtwxzcqmoqit/.test(dbUrl) || /ijvqdvsvwtwxzcqmoqit/.test(supaUrl)) {
  console.error(
    "REFUSED · points at PROD ijvqdvsvwtwxzcqmoqit · this script is sandbox-only",
  );
  process.exit(1);
}
if (!/kdstoyyeygcopkogqsyv/.test(dbUrl) || !/kdstoyyeygcopkogqsyv/.test(supaUrl)) {
  console.error("REFUSED · must point at sandbox kdstoyyeygcopkogqsyv");
  process.exit(1);
}

const PRODUCT_ID = "7fe7b701-11b3-4949-a43a-47c7570998f7";
const BUCKET = "nex-business-assets";
const OBJECT_PATH =
  "x-rated-tool-belts/products/utility-duffel-s-gallery-2.png";
const SOURCE_IMAGE =
  "C:/Users/Victus/Downloads/XRATED BELTS Heavy-Duty Gear Bag.png";
const MAX_BYTES = 2 * 1024 * 1024;
const SAFETY_MARGIN_PCT = 0.04;

async function main() {
  const supa = createClient(supaUrl, supaKey, {
    auth: { persistSession: false },
  });

  const origBuf = readFileSync(SOURCE_IMAGE);
  const origMeta = await sharp(origBuf).metadata();
  console.log(
    `[source] ${origBuf.length} bytes · ${origMeta.width}x${origMeta.height} · hasAlpha=${origMeta.hasAlpha}`,
  );

  const trimmed = await sharp(origBuf)
    .trim()
    .toBuffer({ resolveWithObject: true });
  console.log(
    `[trim] ${trimmed.info.width}x${trimmed.info.height} · offsetTop=${trimmed.info.trimOffsetTop} · offsetLeft=${trimmed.info.trimOffsetLeft}`,
  );

  const maxSide = Math.max(trimmed.info.width, trimmed.info.height);
  const margin = Math.round(maxSide * SAFETY_MARGIN_PCT);
  const padded = await sharp(trimmed.data)
    .extend({
      top: margin,
      bottom: margin,
      left: margin,
      right: margin,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ palette: true, quality: 90, compressionLevel: 9, effort: 10 })
    .toBuffer({ resolveWithObject: true });
  console.log(
    `[pad] ${padded.info.width}x${padded.info.height} · bytes=${padded.data.length} · margin=${margin}px`,
  );

  if (padded.data.length > MAX_BYTES) {
    throw new Error(
      `padded bytes ${padded.data.length} exceeds bucket cap ${MAX_BYTES}`,
    );
  }

  console.log(
    `[storage] uploading to ${BUCKET}/${OBJECT_PATH} (image/png, ${padded.data.length} bytes)`,
  );
  const up = await supa.storage.from(BUCKET).upload(OBJECT_PATH, padded.data, {
    contentType: "image/png",
    upsert: true,
    cacheControl: "31536000",
  });
  if (up.error) throw new Error(`storage upload failed: ${up.error.message}`);
  const pub = supa.storage.from(BUCKET).getPublicUrl(OBJECT_PATH);
  const newImageUrl = pub.data.publicUrl;
  console.log(`[storage] public url = ${newImageUrl}`);

  const c = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  let dbResult;
  await c.query("BEGIN");
  try {
    const existing = await c.query(
      `SELECT gallery_urls FROM nex_product WHERE id = $1 FOR UPDATE`,
      [PRODUCT_ID],
    );
    if (existing.rows.length === 0) {
      throw new Error(`product ${PRODUCT_ID} not found`);
    }
    const current = existing.rows[0].gallery_urls;
    const currentList = Array.isArray(current) ? current : [];
    const alreadyPresent = currentList.includes(newImageUrl);
    const nextList = alreadyPresent ? currentList : [...currentList, newImageUrl];
    await c.query(
      `UPDATE nex_product SET gallery_urls = $2::text[], updated_at = now() WHERE id = $1`,
      [PRODUCT_ID, nextList],
    );
    await c.query("COMMIT");
    dbResult = { before: current, after: nextList, idempotent: alreadyPresent };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }

  const outPath = resolve(
    __dirname,
    "..",
    "evidence",
    "x-rated-seed",
    `gallery-add-run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        product_id: PRODUCT_ID,
        source: {
          path: SOURCE_IMAGE,
          bytes: origBuf.length,
          width: origMeta.width,
          height: origMeta.height,
        },
        trim: {
          width: trimmed.info.width,
          height: trimmed.info.height,
        },
        output: {
          bucket: BUCKET,
          path: OBJECT_PATH,
          bytes: padded.data.length,
          content_type: "image/png",
          width: padded.info.width,
          height: padded.info.height,
          margin_px: margin,
          public_url: newImageUrl,
        },
        db: dbResult,
      },
      null,
      2,
    ),
  );
  console.log(`[done] ${outPath}`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
