// scripts/mock-personas/crop-persona-grids.mjs
//
// One-shot cropper · slices the two downloaded persona grids into
// 30 individual square avatar PNGs each. Owner directive 2026-10-26
// · "I install sharp + auto-crop the grids".
//
// Grids:
//   · Diverse Portrait Avatar Grid.png                (1536 × 1024)
//   · Diverse Southeast Asian Portrait Gallery.png    (1536 × 1024)
// Layout per visual inspection: 6 columns × 5 rows = 30 tiles each.
//
// Writes to tests/_persona-crops/{grid}/row<r>-col<c>.png so the
// owner can review before I promote any into the Supabase bucket.
// Nothing from this script touches the DB or Supabase · pure local
// image slicing.

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

const OUT_ROOT = resolve("tests/_persona-crops");

const COLS = 6;
const ROWS = 5;

for (const g of GRIDS) {
  const meta = await sharp(g.file).metadata();
  const cellW = Math.floor(meta.width / COLS);
  const cellH = Math.floor(meta.height / ROWS);
  // Square-crop each cell by taking a centred square of side = min(cellW, cellH).
  const side = Math.min(cellW, cellH);
  const outDir = resolve(OUT_ROOT, g.label);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  console.log(
    `${basename(g.file)} · ${meta.width}×${meta.height} · cell=${cellW}×${cellH} · square=${side}`,
  );
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
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
console.log("DONE");
