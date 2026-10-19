// scripts/reslice-theme-assets.mjs
//
// NEX · bounding-box re-slice for theme emoji + sticker sheets.
// Owner-authorised 2026-10-19.
// -----------------------------------------------------------------------------
// Why · the grid-based slicer we built earlier assumed each tile's
// visual content stays within its cell boundary. In practice the
// owner's source sheets have content that drifts a few pixels past
// the grid lines (shadows, hats, decorations) + varies in natural
// height per tile. The old slicer either cropped (fit:cover) or
// let-boxed content inside a uniform rectangle. Neither captured
// the TRUE outer rim of each illustrated character.
//
// This script:
//   1. Walks every grid cell at precise Math.round boundaries · no
//      cumulative drift.
//   2. Samples the 4 corners of each cell to estimate the background
//      colour (sheets have gradient/opaque backgrounds, not alpha).
//   3. Finds the content bounding box by scanning pixel-by-pixel for
//      colour distance > CONTENT_DELTA from the background estimate.
//   4. Expands the box by PADDING_PX on all sides (clamped to the
//      cell boundary) so the outer rim of the character isn't
//      shaved.
//   5. Extracts THAT tight region (not the cell) at the sheet's
//      native resolution · aspect ratio stays natural per tile.
//   6. Resizes so the long side ≤ MAX_SIDE for sane file sizes but
//      preserves aspect.
//   7. Writes PNG + records the output aspect ratio keyed by slug.
//
// Output: console.log a `{slug: aspectRatio}` map we can paste into
// theme-asset-fallback.ts in place of the sheet-wide constant ratios.

import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const CONTENT_DELTA = 36;    // RGB euclidean distance from background
/* Owner directive 2026-10-19 · "small line of image under each
 * emoji" · the 4px padding I was adding around each cropped
 * character showed as a background-coloured strip on the picker's
 * dark backdrop. Set to 0 so each tile crops right to the character
 * edge · the content-delta detection already keeps 1-2 soft-edge
 * pixels around the shape, so visually the rim is preserved without
 * a visible background band. */
const PADDING_PX = 0;
const MAX_SIDE = 400;        // cap output long-side for file size
const CORNER_SAMPLE = 10;    // NxN patch at each corner for bg sample

function sampleBackground(buf, info) {
  const { width, height, channels } = info;
  const corners = [
    [0, 0],
    [width - CORNER_SAMPLE, 0],
    [0, height - CORNER_SAMPLE],
    [width - CORNER_SAMPLE, height - CORNER_SAMPLE],
  ];
  let r = 0, g = 0, b = 0, n = 0;
  for (const [cx, cy] of corners) {
    for (let y = cy; y < cy + CORNER_SAMPLE; y++) {
      for (let x = cx; x < cx + CORNER_SAMPLE; x++) {
        const idx = (y * width + x) * channels;
        r += buf[idx];
        g += buf[idx + 1];
        b += buf[idx + 2];
        n++;
      }
    }
  }
  return { r: r / n, g: g / n, b: b / n };
}

function findContentBounds(buf, info, bg) {
  const { width, height, channels } = info;
  let minX = width, maxX = -1, minY = height, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const dr = buf[idx] - bg.r;
      const dg = buf[idx + 1] - bg.g;
      const db = buf[idx + 2] - bg.b;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist > CONTENT_DELTA) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    // All background · return the full cell so we don't lose the tile.
    return { left: 0, top: 0, width, height };
  }
  minX = Math.max(0, minX - PADDING_PX);
  minY = Math.max(0, minY - PADDING_PX);
  maxX = Math.min(width - 1, maxX + PADDING_PX);
  maxY = Math.min(height - 1, maxY + PADDING_PX);
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function sliceSheet(sheetPath, rows, cols, slugs, outDir) {
  const sheetMeta = await sharp(sheetPath).metadata();
  const srcW = sheetMeta.width;
  const srcH = sheetMeta.height;
  const colBoundaries = Array.from({ length: cols + 1 }, (_, i) =>
    Math.round((i * srcW) / cols),
  );
  const rowBoundaries = Array.from({ length: rows + 1 }, (_, i) =>
    Math.round((i * srcH) / rows),
  );
  const aspectBySlug = {};
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const slug = slugs[r][c];
      if (!slug) continue;
      const cellLeft = colBoundaries[c];
      const cellTop = rowBoundaries[r];
      const cellW = colBoundaries[c + 1] - cellLeft;
      const cellH = rowBoundaries[r + 1] - cellTop;

      /* Owner directive 2026-10-19 · "small defeat image under"
         (orange strip visible in error.png screenshot) · the custom
         corner-sample + pixel-walk approach failed on sheets with
         GRADIENT backgrounds (fast-food sheet goes lighter→darker
         vertically). The gradient's non-corner pixels differ from
         the corner sample so they get flagged as "content" and
         pulled into the bounding box, leaving a horizontal strip of
         background in each tile.
         New approach · sharp.trim() auto-detects the background from
         the top-left pixel and iteratively trims similar-colored
         edges. It handles gradient backgrounds correctly because it
         compares each edge pixel against its own near-edge sample,
         not a single global background estimate. Threshold=48 keeps
         real art edges while discarding gradient fade. */
      /* Owner directive 2026-10-19 · "same error images cut" (error
         2.png screenshot showed yellow blob leaking from neighbor
         cell into promo3d-hot-deal) · the source sheet designer
         placed content that extends past the mathematical grid
         boundary, so a pixel-perfect extract picks up a sliver of
         the neighbor's art. Inset each cell by SAFE_INSET pixels
         before extracting · this loses any content that was drawn
         touching the cell boundary (uncommon · most content sits
         centrally) but excludes neighbor bleed (which lives right
         at the boundary). */
      const SAFE_INSET = 16;
      const insetLeft = cellLeft + SAFE_INSET;
      const insetTop = cellTop + SAFE_INSET;
      const insetW = Math.max(1, cellW - SAFE_INSET * 2);
      const insetH = Math.max(1, cellH - SAFE_INSET * 2);

      const outPath = path.join(outDir, `${slug}.png`);
      let outMeta;
      try {
        outMeta = await sharp(sheetPath)
          .extract({
            left: insetLeft,
            top: insetTop,
            width: insetW,
            height: insetH,
          })
          .trim({ threshold: 48 })
          .resize({
            width: MAX_SIDE,
            height: MAX_SIDE,
            fit: "inside",
            withoutEnlargement: true,
          })
          .png({ compressionLevel: 9 })
          .toFile(outPath);
      } catch {
        outMeta = await sharp(sheetPath)
          .extract({
            left: insetLeft,
            top: insetTop,
            width: insetW,
            height: insetH,
          })
          .resize({
            width: MAX_SIDE,
            height: MAX_SIDE,
            fit: "inside",
            withoutEnlargement: true,
          })
          .png({ compressionLevel: 9 })
          .toFile(outPath);
      }
      const ar = outMeta.width / outMeta.height;
      aspectBySlug[slug] = Number(ar.toFixed(4));
    }
  }
  return aspectBySlug;
}

const EMOJI_DIR = path.join(REPO_ROOT, "public/nex-themes/food/emoji");
const STICKER_DIR = path.join(REPO_ROOT, "public/nex-themes/food/sticker");
const DOWNLOADS = "C:/Users/Victus/Downloads";

const FAST_FOOD_EMOJI_SLUGS = [
  ["burger","double-burger","triple-burger","chicken-burger","hot-dog","pizza-slice"],
  ["pizza","taco","burrito","fries","onion-rings","chicken-nuggets"],
  ["chicken-pieces","chicken-wings","chicken-strips","nachos","nachos-cheese","waffle-fries"],
  ["salad-bowl","mac-and-cheese","chili-bowl","strawberry-shake","chocolate-shake","soft-serve"],
  ["cookie","brownie","donut","pie-slice","cupcake","smoothie"],
];
const CHEF_EMOJI_SLUGS = [
  ["chef-thumbs-up","chef-ok-sign","chef-tongue-out","chef-with-knife","chef-tasting-spoon","chef-cool-shades"],
  ["chef-wok-flame","chef-chopping","chef-stirring-pot","chef-serving-plate","chef-silver-dome","chef-flame-pan"],
  ["chef-salad","chef-rolling-dough","chef-with-fish","chef-with-lobster","chef-with-pasta","chef-grating"],
  ["chef-with-wine","chef-with-burger","chef-with-shrimp","chef-with-cake","chef-with-beer","chef-at-grill"],
];
const GLOSSY_STICKER_SLUGS = [
  ["glossy-cool","glossy-thanks","glossy-great","glossy-preparing","glossy-packaged"],
  ["glossy-picked-up","glossy-wait","glossy-ok","glossy-we-can","glossy-sure"],
  ["glossy-sold-out","glossy-new-try","glossy-delicious","glossy-fresh","glossy-enjoy"],
];
const POP_STICKER_SLUGS = [
  ["3d-cool","3d-thanks","3d-great","3d-preparing","3d-packaged"],
  ["3d-picked-up","3d-wait","3d-ok","3d-we-can","3d-sure"],
  ["3d-sold-out","3d-new-try","3d-delicious","3d-fresh","3d-enjoy"],
  ["3d-refreshing","3d-spicy","3d-tasty","3d-sweet","3d-hot"],
  ["3d-healthy","3d-good-food","3d-freshly-made","3d-chefs-choice","3d-eat-well"],
];
const GLOSSY_PROMO_SLUGS = [
  ["promo-5-off","promo-10-off","promo-15-off","promo-20-off","promo-25-off","promo-30-off"],
  ["promo-buy1-get1","promo-free-drink","promo-free-fries","promo-free-dessert","promo-free-water","promo-free-delivery"],
  ["promo-free-rice","promo-free-sauce","promo-half-price","promo-special-offer","promo-limited-time","promo-hot-deal"],
  ["promo-fresh-ingredients","promo-chefs-special","promo-best-choice","promo-tasty-food","promo-good-food","promo-premium-quality"],
];
const POP_PROMO_SLUGS = [
  ["promo3d-special-offer","promo3d-limited-offer","promo3d-hot-deal","promo3d-new-item","promo3d-best-price","promo3d-dont-miss-out"],
  ["promo3d-premium-quality","promo3d-fresh-ingredients","promo3d-special-menu","promo3d-combo-deal","promo3d-save-more","promo3d-time-limited"],
  ["promo3d-pizza-special","promo3d-hot-food","promo3d-customer-favorite","promo3d-freshly-made","promo3d-free-drink","promo3d-free-fries"],
  ["promo3d-free-dessert","promo3d-free-water","promo3d-free-delivery","promo3d-free-rice","promo3d-free-sauce","promo3d-birthday-special"],
];

const SHEETS = [
  { file: "Glossy Fast-Food Icon Sticker Sheet (1).png", rows: 5, cols: 6, slugs: FAST_FOOD_EMOJI_SLUGS, outDir: EMOJI_DIR, label: "fast-food emoji" },
  { file: "Glossy Chef Emoji Sticker Sheet (1).png", rows: 4, cols: 6, slugs: CHEF_EMOJI_SLUGS, outDir: EMOJI_DIR, label: "chef emoji" },
  { file: "Glossy Chef’s Food Sticker Grid (2).png", rows: 3, cols: 5, slugs: GLOSSY_STICKER_SLUGS, outDir: STICKER_DIR, label: "glossy stickers" },
  { file: "Colorful 3D Food Sticker Pack.png", rows: 5, cols: 5, slugs: POP_STICKER_SLUGS, outDir: STICKER_DIR, label: "3D stickers" },
  { file: "Glossy Fast-Food Promo Sticker Collection.png", rows: 4, cols: 6, slugs: GLOSSY_PROMO_SLUGS, outDir: STICKER_DIR, label: "glossy promo" },
  { file: "Colorful 3D Food Promotion Sticker Sheet.png", rows: 4, cols: 6, slugs: POP_PROMO_SLUGS, outDir: STICKER_DIR, label: "3D promo" },
];

const allAspects = {};
for (const sheet of SHEETS) {
  const sheetPath = path.join(DOWNLOADS, sheet.file);
  const got = await sliceSheet(sheetPath, sheet.rows, sheet.cols, sheet.slugs, sheet.outDir);
  Object.assign(allAspects, got);
  console.log(`sliced ${sheet.label} (${Object.keys(got).length} tiles)`);
}

console.log("\n=== aspect ratios ===");
console.log(JSON.stringify(allAspects, null, 2));
