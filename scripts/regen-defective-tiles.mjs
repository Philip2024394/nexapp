// scripts/regen-defective-tiles.mjs
//
// Per-tile crop override regeneration · owner-authorised 2026-10-19.
// -----------------------------------------------------------------------------
// Visually-identified defective tiles get their extraction window
// shifted by (shiftX, shiftY) pixels to cut off the bleed from
// neighboring cells. Only tiles listed here are touched · all other
// tiles stay as-is. A side-by-side before/after composite is written
// to scripts/before-after/<slug>.png so the owner can verify the
// shift cleared the bleed without clipping legitimate artwork.

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const STICKER_DIR = path.join(REPO_ROOT, "public/nex-themes/food/sticker");
const EMOJI_DIR = path.join(REPO_ROOT, "public/nex-themes/food/emoji");
const BEFORE_DIR = path.join(__dirname, "before-after");
fs.mkdirSync(BEFORE_DIR, { recursive: true });

/* Each override specifies:
 *   sheet · source PNG filename in C:/Users/Victus/Downloads/
 *   rows, cols · grid dimensions
 *   slug · the tile's slug
 *   row, col · its position in the grid (0-indexed)
 *   shiftX, shiftY · pixels to shift the extraction window
 *     positive shiftX = crop more from LEFT, less from RIGHT (clears left bleed)
 *     negative shiftX = crop more from RIGHT, less from LEFT (clears right bleed)
 *     positive shiftY = crop more from TOP, less from BOTTOM (clears top bleed)
 *     negative shiftY = crop more from BOTTOM, less from TOP (clears bottom bleed)
 *
 * The shift reduces tile size by |shiftX| horizontally and |shiftY|
 * vertically · for 256×256 cells, a 20-px shift leaves 236×256 or
 * 256×236 which is still visually comfortable.
 */
const OVERRIDES = [
  // ── promo3d sheet · 4 rows × 6 cols ──────────────────────────────
  { sheet: "Colorful 3D Food Promotion Sticker Sheet (2).png", rows: 4, cols: 6, slug: "promo3d-limited-offer", row: 0, col: 1, shiftX: 24, shiftY: 0 },
  { sheet: "Colorful 3D Food Promotion Sticker Sheet (2).png", rows: 4, cols: 6, slug: "promo3d-hot-deal",       row: 0, col: 2, shiftX: 24, shiftY: 0 },
  { sheet: "Colorful 3D Food Promotion Sticker Sheet (2).png", rows: 4, cols: 6, slug: "promo3d-new-item",       row: 0, col: 3, shiftX: 20, shiftY: 0 },
  { sheet: "Colorful 3D Food Promotion Sticker Sheet (2).png", rows: 4, cols: 6, slug: "promo3d-combo-deal",     row: 1, col: 3, shiftX: 0,  shiftY: 20 },
  { sheet: "Colorful 3D Food Promotion Sticker Sheet (2).png", rows: 4, cols: 6, slug: "promo3d-save-more",      row: 1, col: 4, shiftX: 20, shiftY: 18 },
  { sheet: "Colorful 3D Food Promotion Sticker Sheet (2).png", rows: 4, cols: 6, slug: "promo3d-time-limited",   row: 1, col: 5, shiftX: 20, shiftY: 18 },
  { sheet: "Colorful 3D Food Promotion Sticker Sheet (2).png", rows: 4, cols: 6, slug: "promo3d-free-fries",     row: 2, col: 5, shiftX: 0,  shiftY: 18 },
  // ── promo sheet · 4 rows × 6 cols ────────────────────────────────
  { sheet: "Glossy Fast-Food Promo Sticker Collection (1).png", rows: 4, cols: 6, slug: "promo-10-off", row: 0, col: 1, shiftX: 24, shiftY: 0 },
  { sheet: "Glossy Fast-Food Promo Sticker Collection (1).png", rows: 4, cols: 6, slug: "promo-20-off", row: 0, col: 3, shiftX: 24, shiftY: 0 },
];

const DOWNLOADS = "C:/Users/Victus/Downloads";

async function regenerate() {
  const flags = [];
  for (const ov of OVERRIDES) {
    const sheetPath = path.join(DOWNLOADS, ov.sheet);
    const meta = await sharp(sheetPath).metadata();
    const colB = Array.from({ length: ov.cols + 1 }, (_, i) => Math.round((i * meta.width) / ov.cols));
    const rowB = Array.from({ length: ov.rows + 1 }, (_, i) => Math.round((i * meta.height) / ov.rows));
    const cellLeft = colB[ov.col];
    const cellTop = rowB[ov.row];
    const cellW = colB[ov.col + 1] - cellLeft;
    const cellH = rowB[ov.row + 1] - cellTop;

    // Apply shift · positive = push extraction right/down
    const extractLeft = cellLeft + Math.max(0, ov.shiftX);
    const extractTop = cellTop + Math.max(0, ov.shiftY);
    const extractW = cellW - Math.abs(ov.shiftX);
    const extractH = cellH - Math.abs(ov.shiftY);

    if (extractW < 100 || extractH < 100) {
      flags.push({ slug: ov.slug, reason: "shift would reduce tile to < 100px · flag for manual correction" });
      continue;
    }

    // Backup current tile for before/after
    const stickerPath = path.join(STICKER_DIR, `${ov.slug}.png`);
    const beforeBuf = fs.readFileSync(stickerPath);

    // Regenerate the sticker
    await sharp(sheetPath)
      .extract({ left: extractLeft, top: extractTop, width: extractW, height: extractH })
      .png({ compressionLevel: 9 })
      .toFile(stickerPath);

    // Dual-copy promo3d to emoji dir
    if (ov.slug.startsWith("promo3d-")) {
      fs.copyFileSync(stickerPath, path.join(EMOJI_DIR, `${ov.slug}.png`));
    }

    // Build before/after side-by-side composite
    const afterBuf = fs.readFileSync(stickerPath);
    const SIDE = 220;
    const beforeTile = await sharp(beforeBuf)
      .resize({ width: SIDE, height: SIDE, fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    const afterTile = await sharp(afterBuf)
      .resize({ width: SIDE, height: SIDE, fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    const beforeMeta = await sharp(beforeTile).metadata();
    const afterMeta = await sharp(afterTile).metadata();

    const PAD = 20;
    const LABEL_H = 36;
    const canvasW = PAD * 3 + SIDE * 2;
    const canvasH = PAD * 2 + LABEL_H + SIDE + 24;

    const header = `<svg width="${canvasW - PAD*2}" height="${LABEL_H}">
      <text x="0" y="22" font-family="Arial" font-size="16" font-weight="800" fill="#F2F5F8">${ov.slug}</text>
      <text x="0" y="36" font-family="Arial" font-size="11" fill="#B5C3D6">shiftX=${ov.shiftX} shiftY=${ov.shiftY}</text>
    </svg>`;
    const beforeLabel = `<svg width="${SIDE}" height="22">
      <text x="${SIDE/2}" y="16" text-anchor="middle" font-family="Arial" font-size="12" fill="#B5C3D6">BEFORE</text>
    </svg>`;
    const afterLabel = `<svg width="${SIDE}" height="22">
      <text x="${SIDE/2}" y="16" text-anchor="middle" font-family="Arial" font-size="12" fill="#16D66B" font-weight="800">AFTER</text>
    </svg>`;

    const canvas = await sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { r: 2, g: 9, b: 20, alpha: 1 } }
    })
      .composite([
        { input: Buffer.from(header), left: PAD, top: PAD },
        { input: beforeTile, left: PAD + Math.round((SIDE - beforeMeta.width)/2), top: PAD + LABEL_H + Math.round((SIDE - beforeMeta.height)/2) },
        { input: afterTile,  left: PAD*2 + SIDE + Math.round((SIDE - afterMeta.width)/2), top: PAD + LABEL_H + Math.round((SIDE - afterMeta.height)/2) },
        { input: Buffer.from(beforeLabel), left: PAD, top: PAD + LABEL_H + SIDE + 2 },
        { input: Buffer.from(afterLabel),  left: PAD*2 + SIDE, top: PAD + LABEL_H + SIDE + 2 },
      ])
      .png()
      .toFile(path.join(BEFORE_DIR, `${ov.slug}.png`));

    console.log("regenerated", ov.slug, "shift(" + ov.shiftX + "," + ov.shiftY + ") · before/after at", BEFORE_DIR);
  }
  if (flags.length) {
    console.log("\n⚠ FLAGGED FOR MANUAL CORRECTION:");
    for (const f of flags) console.log("  " + f.slug + " · " + f.reason);
  }
}

await regenerate();
