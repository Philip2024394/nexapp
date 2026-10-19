// scripts/contact-sheets.mjs
//
// Build labelled contact sheets of the sliced food emoji + sticker
// tiles so defective tiles (lines crossing art, bleed strips) can be
// visually inspected and listed by slug. One PNG per source sheet.
//
// Output: scripts/contact-sheets/<group>.png
// Each tile shown at a uniform display size with its slug under it.

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const STICKER_DIR = path.join(REPO_ROOT, "public/nex-themes/food/sticker");
const OUT_DIR = path.join(__dirname, "contact-sheets");
fs.mkdirSync(OUT_DIR, { recursive: true });

const TILE_W = 180;    // display size per tile (uniform for inspection)
const TILE_H = 180;
const LABEL_H = 28;
const CELL_W = TILE_W + 10;
const CELL_H = TILE_H + LABEL_H + 10;
const CANVAS_PAD = 20;
const CANVAS_BG = { r: 2, g: 9, b: 20, alpha: 1 }; // match picker bg

const GROUPS = {
  "promo3d (3D promo sheet · 4 rows × 6 cols)": [
    ["promo3d-special-offer","promo3d-limited-offer","promo3d-hot-deal","promo3d-new-item","promo3d-best-price","promo3d-dont-miss-out"],
    ["promo3d-premium-quality","promo3d-fresh-ingredients","promo3d-special-menu","promo3d-combo-deal","promo3d-save-more","promo3d-time-limited"],
    ["promo3d-pizza-special","promo3d-hot-food","promo3d-customer-favorite","promo3d-freshly-made","promo3d-free-drink","promo3d-free-fries"],
    ["promo3d-free-dessert","promo3d-free-water","promo3d-free-delivery","promo3d-free-rice","promo3d-free-sauce","promo3d-birthday-special"],
  ],
  "promo (glossy promo sheet · 4 rows × 6 cols)": [
    ["promo-5-off","promo-10-off","promo-15-off","promo-20-off","promo-25-off","promo-30-off"],
    ["promo-buy1-get1","promo-free-drink","promo-free-fries","promo-free-dessert","promo-free-water","promo-free-delivery"],
    ["promo-free-rice","promo-free-sauce","promo-half-price","promo-special-offer","promo-limited-time","promo-hot-deal"],
    ["promo-fresh-ingredients","promo-chefs-special","promo-best-choice","promo-tasty-food","promo-good-food","promo-premium-quality"],
  ],
  "3d (3D sticker pack · 5 rows × 5 cols)": [
    ["3d-cool","3d-thanks","3d-great","3d-preparing","3d-packaged"],
    ["3d-picked-up","3d-wait","3d-ok","3d-we-can","3d-sure"],
    ["3d-sold-out","3d-new-try","3d-delicious","3d-fresh","3d-enjoy"],
    ["3d-refreshing","3d-spicy","3d-tasty","3d-sweet","3d-hot"],
    ["3d-healthy","3d-good-food","3d-freshly-made","3d-chefs-choice","3d-eat-well"],
  ],
  "glossy (glossy chef sheet · 3 rows × 5 cols)": [
    ["glossy-cool","glossy-thanks","glossy-great","glossy-preparing","glossy-packaged"],
    ["glossy-picked-up","glossy-wait","glossy-ok","glossy-we-can","glossy-sure"],
    ["glossy-sold-out","glossy-new-try","glossy-delicious","glossy-fresh","glossy-enjoy"],
  ],
};

async function buildSheet(label, grid) {
  const rows = grid.length;
  const cols = Math.max(...grid.map((r) => r.length));
  const canvasW = CANVAS_PAD * 2 + cols * CELL_W;
  const canvasH = CANVAS_PAD * 2 + 40 + rows * CELL_H;

  const composites = [];

  // Header label SVG (sheet name at the top).
  const header = `<svg width="${canvasW - CANVAS_PAD * 2}" height="30">
    <text x="0" y="22" font-family="Arial, sans-serif" font-size="18"
      font-weight="800" fill="#F2F5F8">${label}</text>
  </svg>`;
  composites.push({
    input: Buffer.from(header),
    left: CANVAS_PAD,
    top: CANVAS_PAD,
  });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const slug = grid[r][c];
      const tilePath = path.join(STICKER_DIR, `${slug}.png`);
      if (!fs.existsSync(tilePath)) continue;

      // Fit the tile into TILE_W × TILE_H preserving aspect.
      const tileBuf = await sharp(tilePath)
        .resize({
          width: TILE_W,
          height: TILE_H,
          fit: "inside",
          withoutEnlargement: false,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      const tileMeta = await sharp(tileBuf).metadata();
      const cellLeft = CANVAS_PAD + c * CELL_W;
      const cellTop = CANVAS_PAD + 40 + r * CELL_H;
      const tileLeft = cellLeft + Math.round((TILE_W - tileMeta.width) / 2);
      const tileTop = cellTop + Math.round((TILE_H - tileMeta.height) / 2);

      composites.push({ input: tileBuf, left: tileLeft, top: tileTop });

      // Label under the tile (SVG text).
      const label = `<svg width="${CELL_W}" height="${LABEL_H}">
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" rx="4"/>
        <text x="${CELL_W / 2}" y="18" text-anchor="middle"
          font-family="Arial, sans-serif" font-size="11"
          font-weight="700" fill="#F2F5F8">${slug}</text>
      </svg>`;
      composites.push({
        input: Buffer.from(label),
        left: cellLeft,
        top: cellTop + TILE_H + 2,
      });
    }
  }

  const outPath = path.join(OUT_DIR, label.split(" ")[0] + ".png");
  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: CANVAS_BG,
    },
  })
    .composite(composites)
    .png()
    .toFile(outPath);

  console.log("wrote", outPath);
}

for (const [label, grid] of Object.entries(GROUPS)) {
  await buildSheet(label, grid);
}
