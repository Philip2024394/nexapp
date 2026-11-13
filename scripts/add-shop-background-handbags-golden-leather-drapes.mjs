// scripts/add-shop-background-handbags-golden-leather-drapes.mjs
//
// Sandbox-only · adds a single shop background to the sealed
// nex_background_asset library (mig 337) + points Rosa's "Handbags
// direct" shop (slug: handbags-direct) at it.
//
// Owner directive 2026-11-13 · "handbag warehouse shop back ground image
// add this and also add to shop background themes libary ·
// Luxury Handbags in Golden Leather Drapes.png". Interpreted as Rosa's
// Handbags direct shop (watch warehouse is Tri; the filename handbag-themed
// confirms Rosa).
//
// Writes (idempotent):
//   · nex_background_asset row id='shop:handbags-golden-leather-drapes'
//   · UPDATE on nex_business WHERE slug='handbags-direct'
//     SET shop_cover_image_url = <new asset url>
//     (prior "/nex-native/rosa/shop-hero.png" is overwritten · can be
//      restored by re-running the seed-mock-contacts script with the
//      ON CONFLICT upsert.)
//
// Sandbox-only · hard-refuses to run if SANDBOX_DATABASE_URL does not
// reference `kdstoyyeygcopkogqsyv`.

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
  console.error("STOP · not sandbox");
  process.exit(2);
}
if (SANDBOX_DATABASE_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("STOP · contains production ref");
  process.exit(3);
}

const ASSET = {
  id: "shop:handbags-golden-leather-drapes",
  storageUrl: "/nex-native/backgrounds/handbags-golden-leather-drapes.png",
  previewUrl: "/nex-native/backgrounds/handbags-golden-leather-drapes.png",
  label: "Golden Leather Drapes",
  // Deep burnt-gold matching the leather + drape palette.
  tintHex: "#8B6F38",
  // Shop context only · chat theme flow keeps its own isolated pool
  // per mig 337 isolation rules. No chat-library collisions possible.
  contexts: ["shop"],
  categories: ["luxury", "fashion", "handbags"],
  // Shop backgrounds are gated by Shop (bisnis) tier per the existing
  // 279 seeded presets · stay consistent.
  tier: "bisnis",
  source: "owner-upload-2026-11-13",
  sortOrder: 50,
};

const SHOP_SLUG = "handbags-direct";

const client = new Client({ connectionString: SANDBOX_DATABASE_URL });
await client.connect();

const projectCheck = await client.query(
  "SELECT current_database() AS db, inet_server_addr()::text AS host",
);
console.log("Target DB:", projectCheck.rows[0]);

await client.query("BEGIN");
try {
  // 1 · Upsert the asset row.
  await client.query(
    `INSERT INTO nex_background_asset (
       id, storage_url, preview_url, label, tint_hex, categories, contexts,
       tier, is_active, sort_order, source, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6::text[], $7::text[], $8, true, $9, $10, now(), now())
     ON CONFLICT (id) DO UPDATE SET
       storage_url = EXCLUDED.storage_url,
       preview_url = EXCLUDED.preview_url,
       label       = EXCLUDED.label,
       tint_hex    = EXCLUDED.tint_hex,
       categories  = EXCLUDED.categories,
       contexts    = EXCLUDED.contexts,
       tier        = EXCLUDED.tier,
       sort_order  = EXCLUDED.sort_order,
       source      = EXCLUDED.source,
       updated_at  = now()`,
    [
      ASSET.id,
      ASSET.storageUrl,
      ASSET.previewUrl,
      ASSET.label,
      ASSET.tintHex,
      ASSET.categories,
      ASSET.contexts,
      ASSET.tier,
      ASSET.sortOrder,
      ASSET.source,
    ],
  );
  console.log(`✓ upserted library asset ${ASSET.id}`);

  // 2 · Point Rosa's shop at the new background + apply the tint.
  const updateResult = await client.query(
    `UPDATE nex_business
       SET shop_cover_image_url = $1,
           shop_cover_tint_hex  = $2,
           updated_at           = now()
     WHERE slug = $3
     RETURNING id, display_name, slug`,
    [ASSET.storageUrl, ASSET.tintHex, SHOP_SLUG],
  );
  if (updateResult.rowCount === 0) {
    throw new Error(`shop slug not found: ${SHOP_SLUG}`);
  }
  console.log("✓ pointed shop at new background:", updateResult.rows[0]);

  await client.query("COMMIT");

  // Verification · cross-check the write landed.
  const verify = await client.query(
    `SELECT b.slug, b.shop_cover_image_url, b.shop_cover_tint_hex,
            a.id AS asset_id, a.label, a.tier, a.contexts
     FROM nex_business b
     LEFT JOIN nex_background_asset a ON a.storage_url = b.shop_cover_image_url
     WHERE b.slug = $1`,
    [SHOP_SLUG],
  );
  console.log("\n=== Verification ===");
  console.log(JSON.stringify(verify.rows[0], null, 2));
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Rolled back:", err.message);
  process.exit(10);
} finally {
  await client.end();
}
