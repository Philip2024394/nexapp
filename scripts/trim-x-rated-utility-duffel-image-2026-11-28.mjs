// scripts/trim-x-rated-utility-duffel-image-2026-11-28.mjs
//
// Owner directive 2026-11-28 (eleventh pass · Utility Duffel) ·
// "tool bag is not fitting in image window · make sure image is
// cropped to fit". The transparent-background PNG previously
// uploaded (utility-duffel-s.png) has significant transparent
// padding around the bag silhouette · when the card's
// `background-size: cover` paints it the actual subject reads
// small inside the window.
//
// Fix: run sharp's `.trim()` (alpha-aware) on the source PNG so
// the transparent padding is removed, then re-upload to the same
// storage path. Because the public URL is unchanged, no DB write
// is required · every consumer (cover card, product detail,
// cross-shop chat share) picks up the tighter crop on next cache
// miss.
//
// Idempotent · sandbox-only · hard-refuses prod.
//
// Writes `evidence/x-rated-seed/trim-run-{timestamp}.json`.

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
const OBJECT_PATH = "x-rated-tool-belts/products/utility-duffel-s.png";
const MAX_BYTES = 2 * 1024 * 1024;
// Owner-directed card window is `aspect-ratio: 1 / 1` (grid / detail)
// and `2.5 / 1` (Template 15 landscape banner). Trim to the bounding
// box of the non-transparent pixels, then pad back a small safety
// margin so the bag doesn't touch the card rim · 4 % of max side.
const SAFETY_MARGIN_PCT = 0.04;

async function main() {
  const supa = createClient(supaUrl, supaKey, {
    auth: { persistSession: false },
  });

  console.log(`[fetch] downloading ${BUCKET}/${OBJECT_PATH}`);
  const dl = await supa.storage.from(BUCKET).download(OBJECT_PATH);
  if (dl.error || !dl.data) {
    throw new Error(`storage download failed: ${dl.error?.message ?? "no data"}`);
  }
  const origBuf = Buffer.from(await dl.data.arrayBuffer());
  const origMeta = await sharp(origBuf).metadata();
  console.log(
    `[source] ${origBuf.length} bytes · ${origMeta.width}x${origMeta.height} · fmt=${origMeta.format}`,
  );

  // sharp.trim() in alpha mode removes rows/columns that are fully
  // transparent. Default threshold 10 is suitable for AI-background-
  // removed PNGs with clean edges.
  const trimmed = await sharp(origBuf).trim().toBuffer({ resolveWithObject: true });
  console.log(
    `[trim] ${trimmed.info.width}x${trimmed.info.height} · trimOffsetTop=${trimmed.info.trimOffsetTop} · trimOffsetLeft=${trimmed.info.trimOffsetLeft}`,
  );

  // Pad a small safety margin on all sides so the subject does not
  // touch the card rim after `background-size: cover`.
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
    .png({ palette: true, quality: 92, compressionLevel: 9, effort: 10 })
    .toBuffer({ resolveWithObject: true });
  console.log(
    `[pad] ${padded.info.width}x${padded.info.height} · bytes=${padded.data.length} · margin=${margin}px`,
  );

  let finalBuf = padded.data;
  let finalBytes = padded.data.length;
  let finalType = "image/png";
  let finalPath = OBJECT_PATH;
  if (finalBytes > MAX_BYTES) {
    const jpegOut = await sharp(padded.data)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    console.log(`[jpeg-fallback] bytes=${jpegOut.data.length}`);
    finalBuf = jpegOut.data;
    finalBytes = jpegOut.data.length;
    finalType = "image/jpeg";
    finalPath = OBJECT_PATH.replace(/\.png$/i, ".jpg");
    if (finalBytes > MAX_BYTES) {
      throw new Error(
        `trimmed+jpeg bytes ${finalBytes} still exceeds bucket cap ${MAX_BYTES}`,
      );
    }
  }

  console.log(
    `[storage] uploading to ${BUCKET}/${finalPath} (${finalType}, ${finalBytes} bytes)`,
  );
  const up = await supa.storage.from(BUCKET).upload(finalPath, finalBuf, {
    contentType: finalType,
    upsert: true,
    cacheControl: "31536000",
  });
  if (up.error) throw new Error(`storage upload failed: ${up.error.message}`);
  const pub = supa.storage.from(BUCKET).getPublicUrl(finalPath);
  const newImageUrl = pub.data.publicUrl;
  console.log(`[storage] public url = ${newImageUrl}`);

  // When path changed (PNG → JPG fallback) record an image_url
  // update so consumers keep working. In the PNG-stays-PNG path the
  // URL is unchanged and no DB write is necessary · the storage
  // object was replaced in place with `upsert: true`.
  let dbUpdated = false;
  if (finalPath !== OBJECT_PATH) {
    const c = new pg.Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    });
    await c.connect();
    await c.query("BEGIN");
    try {
      await c.query(
        `UPDATE nex_product SET image_url = $2, updated_at = now() WHERE id = $1`,
        [PRODUCT_ID, newImageUrl],
      );
      await c.query("COMMIT");
      dbUpdated = true;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      await c.end();
    }
  }

  const outPath = resolve(
    __dirname,
    "..",
    "evidence",
    "x-rated-seed",
    `trim-run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        product_id: PRODUCT_ID,
        source: {
          bucket: BUCKET,
          path: OBJECT_PATH,
          bytes: origBuf.length,
          width: origMeta.width,
          height: origMeta.height,
        },
        trim: {
          width: trimmed.info.width,
          height: trimmed.info.height,
          offset_top: trimmed.info.trimOffsetTop,
          offset_left: trimmed.info.trimOffsetLeft,
        },
        output: {
          path: finalPath,
          bytes: finalBytes,
          content_type: finalType,
          margin_px: margin,
          public_url: newImageUrl,
        },
        db_updated: dbUpdated,
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
