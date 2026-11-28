// scripts/update-x-rated-utility-duffel-image-2026-11-28.mjs
//
// Owner directive 2026-11-28 (second pass on Utility Duffel) ·
// swap the Utility Duffel's image for the owner's new transparent-
// background X-Rated branded image, and rewrite the material line
// to "Canvas D365 water resistant with twin zipper".
//
// Idempotent · sandbox-only · hard-refuses prod.
//
// Writes `evidence/x-rated-seed/update-run-{timestamp}.json`.

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
  console.error("REFUSED · missing DATABASE_URL / NEXT_PUBLIC_NEX_SUPABASE_URL / NEX_SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (/ijvqdvsvwtwxzcqmoqit/.test(dbUrl) || /ijvqdvsvwtwxzcqmoqit/.test(supaUrl)) {
  console.error("REFUSED · points at PROD ijvqdvsvwtwxzcqmoqit · this script is sandbox-only");
  process.exit(1);
}
if (!/kdstoyyeygcopkogqsyv/.test(dbUrl) || !/kdstoyyeygcopkogqsyv/.test(supaUrl)) {
  console.error("REFUSED · must point at sandbox kdstoyyeygcopkogqsyv");
  process.exit(1);
}

const PRODUCT_ID = "7fe7b701-11b3-4949-a43a-47c7570998f7";
const BUCKET = "nex-business-assets";
const OBJECT_PATH = "x-rated-tool-belts/products/utility-duffel-s.png";
const SOURCE_IMAGE = "C:/Users/Victus/Downloads/tool_bag-removebg-preview.png";
const MAX_BYTES = 2 * 1024 * 1024;

// New spec payload per owner directive.
const NEW_MATERIALS = ["Canvas D365"];
const NEW_WATER_RESISTANCE = "water-resistant";
const NEW_FEATURE = "twin zipper";

async function compressIfNeeded(srcPath) {
  const raw = readFileSync(srcPath);
  console.log(`[image] source bytes=${raw.length}`);
  if (raw.length <= MAX_BYTES) {
    return { buf: raw, contentType: "image/png", bytes: raw.length, path: OBJECT_PATH };
  }
  const palette = await sharp(raw)
    .png({ palette: true, quality: 90, compressionLevel: 9, effort: 10 })
    .toBuffer();
  console.log(`[image] palette-compressed bytes=${palette.length}`);
  if (palette.length <= MAX_BYTES) {
    return { buf: palette, contentType: "image/png", bytes: palette.length, path: OBJECT_PATH };
  }
  const jpeg = await sharp(raw).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  console.log(`[image] jpeg fallback bytes=${jpeg.length}`);
  return {
    buf: jpeg,
    contentType: "image/jpeg",
    bytes: jpeg.length,
    path: OBJECT_PATH.replace(/\.png$/i, ".jpg"),
  };
}

async function main() {
  const { buf, contentType, bytes, path } = await compressIfNeeded(SOURCE_IMAGE);
  if (bytes > MAX_BYTES) {
    throw new Error(`compressed bytes ${bytes} still exceeds bucket cap ${MAX_BYTES}`);
  }

  const supa = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

  console.log(`[storage] uploading to ${BUCKET}/${path} (${contentType}, ${bytes} bytes)`);
  const up = await supa.storage.from(BUCKET).upload(path, buf, {
    contentType,
    upsert: true,
    cacheControl: "31536000",
  });
  if (up.error) throw new Error(`storage upload failed: ${up.error.message}`);
  const pub = supa.storage.from(BUCKET).getPublicUrl(path);
  const newImageUrl = pub.data.publicUrl;
  console.log(`[storage] public url = ${newImageUrl}`);

  const c = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const { rows: before } = await c.query(
    `SELECT id, name, image_url, spec FROM nex_product WHERE id = $1`,
    [PRODUCT_ID],
  );
  if (before.length === 0) {
    await c.end();
    throw new Error(`product ${PRODUCT_ID} not found`);
  }
  const prev = before[0];
  console.log(`[db] prev image_url=${prev.image_url}`);
  console.log(`[db] prev materials=${JSON.stringify(prev.spec?.materials)}`);
  console.log(`[db] prev features=${JSON.stringify(prev.spec?.additional?.features)}`);

  // Build the new spec jsonb · preserve condition, brand, dimensions,
  // size_label, water_resistance (unchanged · new value happens to equal
  // old value) · swap materials · prepend "twin zipper" to features so it
  // reads as a headline spec, then drop any pre-existing lowercase match.
  const prevFeatures = Array.isArray(prev.spec?.additional?.features)
    ? prev.spec.additional.features
    : [];
  const dedupedTail = prevFeatures.filter(
    (f) => typeof f === "string" && f.trim().toLowerCase() !== NEW_FEATURE,
  );
  const nextFeatures = [NEW_FEATURE, ...dedupedTail];

  const nextSpec = {
    ...(prev.spec ?? {}),
    materials: NEW_MATERIALS,
    additional: {
      ...(prev.spec?.additional ?? {}),
      water_resistance: NEW_WATER_RESISTANCE,
      features: nextFeatures,
    },
  };

  await c.query("BEGIN");
  try {
    await c.query(
      `UPDATE nex_product
          SET image_url = $2,
              spec = $3,
              updated_at = now()
        WHERE id = $1`,
      [PRODUCT_ID, newImageUrl, JSON.stringify(nextSpec)],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  }

  const { rows: after } = await c.query(
    `SELECT id, name, image_url, spec, updated_at FROM nex_product WHERE id = $1`,
    [PRODUCT_ID],
  );
  await c.end();

  const row = after[0];
  console.log(`[db] next image_url=${row.image_url}`);
  console.log(`[db] next materials=${JSON.stringify(row.spec.materials)}`);
  console.log(`[db] next features=${JSON.stringify(row.spec.additional?.features)}`);

  const outPath = resolve(
    __dirname,
    "..",
    "evidence",
    "x-rated-seed",
    `update-run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        product_id: PRODUCT_ID,
        image: {
          source: SOURCE_IMAGE,
          object_path: path,
          content_type: contentType,
          bytes,
          public_url: newImageUrl,
        },
        before: {
          image_url: prev.image_url,
          materials: prev.spec?.materials,
          water_resistance: prev.spec?.additional?.water_resistance,
          features: prevFeatures,
        },
        after: {
          image_url: row.image_url,
          materials: row.spec.materials,
          water_resistance: row.spec.additional?.water_resistance,
          features: row.spec.additional?.features,
          updated_at: row.updated_at,
        },
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
