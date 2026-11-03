#!/usr/bin/env node
// scripts/generate-library-previews.mjs
//
// Generate watermarked preview versions of every chat-themes-library
// wallpaper. Owner-authorised 2026-11-03.
// -----------------------------------------------------------------------------
// Source wallpapers live in `public/nex-themes/library/*.png`. For each
// source we emit a corresponding preview at `public/nex-themes/library/
// preview/<name>.png` with:
//
//   · Resized to a max dimension of 1080 (preserves aspect ratio).
//   · Tiled diagonal "NEX" wordmark baked into the pixels at ~14%
//     opacity in Ireland Gold (#C6A15B). Hard to crop out, needs AI
//     inpainting to remove, reads as brand not degradation.
//
// Run · `node scripts/generate-library-previews.mjs`
//
// After running, flip the LibraryTheme catalog's wallpaperUrl entries
// to point at the `preview/` paths · the clean 4K originals stay on
// disk for the post-purchase signed-URL endpoint (Phase 2).

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(__dirname, "../public/nex-themes/library");
const OUT_DIR = resolve(SRC_DIR, "preview");

const MAX_DIM = 1080;
const WATERMARK_OPACITY = 0.14;
const WATERMARK_ANGLE = -30; // degrees · diagonal rise
const WATERMARK_COLOR = "#C6A15B"; // Ireland Gold
const WATERMARK_TEXT = "NEX";
const WATERMARK_FONT_PX = 72;
const WATERMARK_TILE_X = 220; // horizontal spacing between wordmarks
const WATERMARK_TILE_Y = 170; // vertical spacing

/** Build the watermark SVG · one tiled layer sized to the output image. */
function buildWatermarkSvg(width, height) {
  // Compute enough rows / cols to over-cover the diagonal rotation.
  const extra = Math.ceil(Math.hypot(width, height) / 2);
  const cols = Math.ceil((width + extra * 2) / WATERMARK_TILE_X) + 1;
  const rows = Math.ceil((height + extra * 2) / WATERMARK_TILE_Y) + 1;
  const nodes = [];
  const alpha = WATERMARK_OPACITY.toFixed(2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * WATERMARK_TILE_X - extra;
      const y = r * WATERMARK_TILE_Y - extra + (c % 2 === 0 ? 0 : WATERMARK_TILE_Y / 2);
      nodes.push(
        `<text x="${x}" y="${y}" fill="${WATERMARK_COLOR}" fill-opacity="${alpha}" font-family="'Inter', 'Arial', sans-serif" font-weight="800" font-size="${WATERMARK_FONT_PX}" letter-spacing="4">${WATERMARK_TEXT}</text>`,
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <g transform="rotate(${WATERMARK_ANGLE} ${width / 2} ${height / 2})">
      ${nodes.join("\n")}
    </g>
  </svg>`;
}

async function processOne(src, outDir) {
  const inPath = join(SRC_DIR, src);
  const outPath = join(outDir, src);
  const img = sharp(inPath, { failOnError: false });
  const meta = await img.metadata();
  const w0 = meta.width ?? 1080;
  const h0 = meta.height ?? 1080;
  // Fit within MAX_DIM preserving aspect.
  const scale = Math.min(1, MAX_DIM / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const resized = await img.resize({ width: w, height: h, fit: "inside" }).png().toBuffer();
  const watermark = Buffer.from(buildWatermarkSvg(w, h));

  const out = await sharp(resized)
    .composite([{ input: watermark, blend: "over" }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(outPath, out);
  return { src, w, h, bytes: out.byteLength };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const files = (await readdir(SRC_DIR)).filter(
    (f) => extname(f).toLowerCase() === ".png" && !f.startsWith("preview"),
  );
  if (files.length === 0) {
    console.log("No PNGs found under", SRC_DIR);
    return;
  }
  console.log(`Processing ${files.length} wallpapers → ${OUT_DIR}`);
  let total = 0;
  for (const f of files) {
    try {
      const r = await processOne(f, OUT_DIR);
      total += r.bytes;
      console.log(`  ✓ ${r.src} · ${r.w}×${r.h} · ${(r.bytes / 1024).toFixed(0)} KB`);
    } catch (err) {
      console.error(`  ✗ ${f} ·`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`\nDone. Total output: ${(total / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
