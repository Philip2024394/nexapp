#!/usr/bin/env node
// scripts/mp4-faststart.mjs
//
// Lossless MP4 faststart remux · sealed 2026-10-12 for the Joker
// motion clips. Moves the `moov` atom from the end of the file to
// after `ftyp` (+ any `uuid` metadata) so the browser can begin
// playback without downloading the entire `mdat` block first.
//
// Equivalent to `ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4`
// but has zero external dependencies — plain Node fs + Buffer.
//
// Algorithm (qt-faststart):
//   1. Walk top-level boxes · find positions of ftyp / uuid / mdat / moov
//   2. Load moov into memory
//   3. Walk moov → trak → mdia → minf → stbl → stco (32-bit offsets) or
//      co64 (64-bit offsets). Each entry points at an absolute file
//      position inside mdat. Since mdat shifts forward by sizeof(moov)
//      when we move moov before it, we add sizeof(moov) to every entry.
//   4. Write new file: ftyp + uuid + moov (patched) + mdat
//
// Usage: node scripts/mp4-faststart.mjs <input.mp4> [<input2.mp4> ...]
//        Writes `<input>.faststart.mp4` next to each input · move the
//        output over the input manually once you've confirmed it plays.

import { readFileSync, writeFileSync, statSync } from "node:fs";

function readU32(buf, off) {
  return buf.readUInt32BE(off);
}
function readU64(buf, off) {
  const hi = buf.readUInt32BE(off);
  const lo = buf.readUInt32BE(off + 4);
  return hi * 2 ** 32 + lo;
}

function* walkTopLevel(buf) {
  let off = 0;
  while (off < buf.length) {
    if (off + 8 > buf.length) return;
    let size = readU32(buf, off);
    const type = buf.toString("latin1", off + 4, off + 8);
    let headerLen = 8;
    if (size === 1) {
      size = readU64(buf, off + 8);
      headerLen = 16;
    } else if (size === 0) {
      size = buf.length - off;
    }
    yield { off, size, type, headerLen };
    off += size;
  }
}

/** Patch chunk-offset tables inside moov · recursive walk. */
function patchChunkOffsets(moov, delta) {
  // Walk every child box recursively · stco/co64 live inside stbl.
  // Container boxes we need to descend into: moov, trak, mdia, minf,
  // stbl. Everything else is a leaf for our purposes.
  const containers = new Set(["moov", "trak", "mdia", "minf", "stbl"]);
  const walk = (start, end) => {
    let off = start;
    while (off + 8 <= end) {
      let size = moov.readUInt32BE(off);
      const type = moov.toString("latin1", off + 4, off + 8);
      let headerLen = 8;
      if (size === 1) {
        size = Number(moov.readBigUInt64BE(off + 8));
        headerLen = 16;
      } else if (size === 0) {
        size = end - off;
      }
      const dataStart = off + headerLen;
      const dataEnd = off + size;
      if (containers.has(type)) {
        walk(dataStart, dataEnd);
      } else if (type === "stco") {
        // Full box: 4 bytes version/flags + 4 bytes entry count
        const entries = moov.readUInt32BE(dataStart + 4);
        let e = dataStart + 8;
        for (let i = 0; i < entries; i++) {
          const v = moov.readUInt32BE(e);
          moov.writeUInt32BE(v + delta, e);
          e += 4;
        }
      } else if (type === "co64") {
        const entries = moov.readUInt32BE(dataStart + 4);
        let e = dataStart + 8;
        for (let i = 0; i < entries; i++) {
          const hi = moov.readUInt32BE(e);
          const lo = moov.readUInt32BE(e + 4);
          const total = hi * 2 ** 32 + lo + delta;
          moov.writeUInt32BE(Math.floor(total / 2 ** 32), e);
          moov.writeUInt32BE(total >>> 0, e + 4);
          e += 8;
        }
      }
      off += size;
    }
  };
  // Skip the moov box header (first 8 bytes) and walk its children.
  walk(8, moov.length);
}

function faststart(inputPath) {
  const outputPath = inputPath.replace(/\.mp4$/i, ".faststart.mp4");
  const buf = readFileSync(inputPath);
  const beforeMoov = []; // ftyp, uuid, free, etc.
  let moovBox = null;
  let mdatBox = null;

  for (const box of walkTopLevel(buf)) {
    if (box.type === "moov") moovBox = box;
    else if (box.type === "mdat") mdatBox = box;
    else beforeMoov.push(box);
  }

  if (!moovBox || !mdatBox) {
    console.error(`! ${inputPath}: missing moov or mdat; skipping`);
    return;
  }

  if (moovBox.off < mdatBox.off) {
    console.log(`✓ ${inputPath}: moov already at front — no-op`);
    return;
  }

  // Delta = how far mdat shifts forward when moov moves before it.
  // The new layout is: beforeMoov... + moov + mdat, so mdat's new
  // start = sum(beforeMoov sizes) + moov.size. The old mdat start
  // was sum(beforeMoov sizes). Delta = moov.size.
  const delta = moovBox.size;

  // Copy moov into a fresh buffer so we can patch offsets.
  const moov = Buffer.from(buf.slice(moovBox.off, moovBox.off + moovBox.size));
  patchChunkOffsets(moov, delta);

  // Assemble the new file.
  const chunks = [];
  for (const b of beforeMoov) chunks.push(buf.slice(b.off, b.off + b.size));
  chunks.push(moov);
  chunks.push(buf.slice(mdatBox.off, mdatBox.off + mdatBox.size));
  const out = Buffer.concat(chunks);

  if (out.length !== buf.length) {
    console.error(
      `! ${inputPath}: size mismatch after remux (${out.length} vs ${buf.length}); aborting`,
    );
    return;
  }

  writeFileSync(outputPath, out);
  const kb = (out.length / 1024).toFixed(0);
  console.log(`✓ ${inputPath}: moov moved to front → ${outputPath} (${kb} KB)`);
}

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.error("usage: node scripts/mp4-faststart.mjs <input.mp4> [...]");
  process.exit(1);
}
for (const p of inputs) {
  if (!statSync(p).isFile()) {
    console.error(`! ${p}: not a file; skipping`);
    continue;
  }
  faststart(p);
}
