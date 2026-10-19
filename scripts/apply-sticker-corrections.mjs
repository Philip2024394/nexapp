// scripts/apply-sticker-corrections.mjs
//
// Replay the Visual Sticker Editor's saved manifest from the command
// line. Reads scripts/sticker-corrections.json and rebuilds each
// non-skipped tile via the same sharp extraction pipeline the server
// action uses.
//
// Guardrails:
//   · Source sheets in C:/Users/Victus/Downloads/ are READ ONLY.
//   · Only tile PNGs listed in the manifest are rewritten.
//   · Dual-registration for promo3d-* (copy to emoji dir) is preserved.
//
// Run:
//   node scripts/apply-sticker-corrections.mjs

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(REPO_ROOT, "scripts", "sticker-corrections.json");
const DOWNLOADS = "C:/Users/Victus/Downloads";
const STICKER_DIR = path.join(REPO_ROOT, "public/nex-themes/food/sticker");
const EMOJI_DIR = path.join(REPO_ROOT, "public/nex-themes/food/emoji");

// Allow-listed sheet filenames (mirror of _registry.ts).
const SHEETS = {
  promo3d: "Colorful 3D Food Promotion Sticker Sheet (2).png",
  promo: "Glossy Fast-Food Promo Sticker Collection (1).png",
  glossy: "Glossy Chef’s Food Sticker Grid (3).png",
  cakegirl: "Cute Cake Girl Emoji Sticker Sheet.png",
  glossy3d: "Glossy 3D Emoji Sticker Collection.png",
};

async function main() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error("No manifest at", MANIFEST_PATH);
    console.error("Open /nex-native/dev/sticker-editor and press Save first.");
    process.exit(1);
  }
  const raw = await fs.readFile(MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(raw);
  if (manifest.schema !== 1) {
    console.error("Unsupported manifest schema:", manifest.schema);
    process.exit(1);
  }
  let exported = 0;
  let skipped = 0;
  const errors = [];
  for (const slug of Object.keys(manifest.tiles)) {
    const t = manifest.tiles[slug];
    if (t.skipped) {
      skipped += 1;
      continue;
    }
    const sheetFile = SHEETS[t.sheet];
    if (!sheetFile) {
      errors.push({ slug, reason: `Unknown sheet ${t.sheet}` });
      continue;
    }
    if (!t.crop || t.crop.width <= 0 || t.crop.height <= 0) {
      errors.push({ slug, reason: "Invalid crop" });
      continue;
    }
    const sheetPath = path.join(DOWNLOADS, sheetFile);
    const left = Math.max(0, Math.round(t.crop.left));
    const top = Math.max(0, Math.round(t.crop.top));
    const width = Math.max(1, Math.round(t.crop.width));
    const height = Math.max(1, Math.round(t.crop.height));
    // Destination fallback: promo3d-* → both, everything else → sticker.
    const defaults = slug.startsWith("promo3d-")
      ? ["sticker", "emoji"]
      : ["sticker"];
    const destinations =
      Array.isArray(t.destinations) && t.destinations.length > 0
        ? t.destinations
        : defaults;
    try {
      const buffer = await sharp(sheetPath)
        .extract({ left, top, width, height })
        .png({ compressionLevel: 9 })
        .toBuffer();
      if (destinations.includes("sticker")) {
        await fs.writeFile(path.join(STICKER_DIR, `${slug}.png`), buffer);
      }
      if (destinations.includes("emoji")) {
        await fs.writeFile(path.join(EMOJI_DIR, `${slug}.png`), buffer);
      }
      exported += 1;
      console.log(`  · ${slug} · ${width}×${height} → ${destinations.join("+")}`);
    } catch (e) {
      errors.push({ slug, reason: e.message });
    }
  }
  console.log(`\nExported ${exported} · skipped ${skipped} · errors ${errors.length}`);
  if (errors.length) {
    console.log("\nErrors:");
    for (const err of errors) console.log(`  · ${err.slug} · ${err.reason}`);
    process.exit(1);
  }
}

await main();
