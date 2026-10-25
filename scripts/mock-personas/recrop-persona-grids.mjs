// scripts/mock-personas/recrop-persona-grids.mjs
//
// Owner directive 2026-10-26 · "write local re-crop script, I review
// first". The original crop-persona-grids.mjs took a centred 204×204
// square from each 256×204 cell — but the source grids have inter-
// row gutters (~15% of cell height). The extracted tiles therefore
// had baked-in whitespace at TOP and BOTTOM, visible in every
// persona avatar (Hendra, Bayu, Melati, …) and NOT fixable by CSS.
//
// This script re-crops with inner margins to skip the gutters and
// tighten on the face. Outputs to tests/_persona-crops-v2/ for
// owner review BEFORE anything hits the Supabase bucket.
//
// Nothing from this script touches the DB, Supabase storage, or
// production data. Pure local image slicing. Rerun-safe.
//
// Tune: inner-margin fractions below. Default 15 % vertical, 10 %
// horizontal — matches the visual padding observed in Hendra's
// previous image.

import sharp from "sharp";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";

const GRIDS = [
  {
    label: "diverse-global",
    file: "c:/Users/Victus/Downloads/Diverse Portrait Avatar Grid.png",
  },
  {
    label: "diverse-se-asian",
    file: "c:/Users/Victus/Downloads/Diverse Southeast Asian Portrait Gallery.png",
  },
];

const OUT_ROOT = resolve("tests/_persona-crops-v2");
const COLS = 6;
const ROWS = 5;

// Inner-margin fractions · percentage of each cell edge to discard
// before extracting the square. Vertical margin trims the inter-row
// gutters; horizontal margin tightens on the face.
const V_MARGIN = 0.15; // 15 % trim from top AND bottom of cell
const H_MARGIN = 0.10; // 10 % trim from left AND right of cell

for (const g of GRIDS) {
  if (!existsSync(g.file)) {
    console.error(`SKIP ${g.label}: source grid missing · ${g.file}`);
    continue;
  }
  const meta = await sharp(g.file).metadata();
  const cellW = Math.floor(meta.width / COLS);
  const cellH = Math.floor(meta.height / ROWS);

  // Compute inner safe area per cell after the margin trim.
  const hTrim = Math.floor(cellH * V_MARGIN);
  const wTrim = Math.floor(cellW * H_MARGIN);
  const innerW = cellW - 2 * wTrim;
  const innerH = cellH - 2 * hTrim;
  // Final square = largest square that fits inside the inner safe area
  // (likely limited by innerH since cells are wider than tall).
  const side = Math.min(innerW, innerH);

  const outDir = resolve(OUT_ROOT, g.label);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  console.log(
    `${basename(g.file)} · ${meta.width}×${meta.height} · cell=${cellW}×${cellH} · inner=${innerW}×${innerH} · square=${side}`,
  );

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // Position the square centred within the cell's inner safe
      // area (which is already centred within the cell).
      const left = c * cellW + Math.floor((cellW - side) / 2);
      const top = r * cellH + Math.floor((cellH - side) / 2);
      const outPath = resolve(outDir, `row${r + 1}-col${c + 1}.png`);
      await sharp(g.file)
        .extract({ left, top, width: side, height: side })
        .resize(512, 512, { fit: "cover" })
        .toFile(outPath);
    }
  }
  console.log(`  wrote ${ROWS * COLS} crops to ${outDir}`);
}
console.log("DONE · review tests/_persona-crops-v2/ before uploading");
