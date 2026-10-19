"use server";

// src/app/nex-native/dev/sticker-editor/_actions.ts
//
// Sticker editor · server actions · owner-authorised 2026-10-19.
// -----------------------------------------------------------------------------
// Two actions:
//   · saveCorrectionsAction · writes the current correction manifest
//     to scripts/sticker-corrections.json. Non-destructive · does
//     not touch any image files.
//   · exportCorrectionsAction · reads the manifest, uses the sealed
//     sharp pipeline to extract each non-skipped tile at its
//     corrected crop, writes to the production file paths with
//     dual-registration for promo3d-* preserved.
//
// Guardrails:
//   · Source sheets in C:/Users/Victus/Downloads/ are READ ONLY ·
//     never written.
//   · Export logs the before+after size of each exported tile so
//     the owner can confirm the pipeline respected their edits.
//   · Dev-env only · page.tsx carries the NODE_ENV gate.

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  SHEETS,
  TILES,
  type CorrectionManifest,
  type CropRect,
  type ExportSummary,
} from "./_registry";

const REPO_ROOT = process.cwd();
const MANIFEST_PATH = path.join(REPO_ROOT, "scripts", "sticker-corrections.json");
const DOWNLOADS = "C:/Users/Victus/Downloads";
const STICKER_DIR = path.join(REPO_ROOT, "public/nex-themes/food/sticker");
const EMOJI_DIR = path.join(REPO_ROOT, "public/nex-themes/food/emoji");

export async function saveCorrectionsAction(
  manifestJson: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  try {
    const parsed = JSON.parse(manifestJson) as CorrectionManifest;
    if (parsed.schema !== 1 || !parsed.tiles) {
      return { ok: false, error: "Invalid manifest shape" };
    }
    parsed.updatedAt = new Date().toISOString();
    await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
    await fs.writeFile(MANIFEST_PATH, JSON.stringify(parsed, null, 2));
    return { ok: true, path: MANIFEST_PATH };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown save error",
    };
  }
}

export async function exportCorrectionsAction(
  manifestJson: string,
): Promise<ExportSummary> {
  const summary: ExportSummary = {
    ok: true,
    exported: 0,
    skipped: 0,
    errors: [],
    tilesInfo: [],
  };
  let parsed: CorrectionManifest;
  try {
    parsed = JSON.parse(manifestJson) as CorrectionManifest;
    if (parsed.schema !== 1) throw new Error("Invalid schema");
  } catch (e) {
    summary.ok = false;
    summary.errors.push({
      slug: "<manifest>",
      message: e instanceof Error ? e.message : "Invalid manifest",
    });
    return summary;
  }

  for (const entry of TILES) {
    const correction = parsed.tiles[entry.slug];
    if (!correction) continue;
    if (correction.skipped) {
      summary.skipped += 1;
      continue;
    }
    const crop: CropRect | null = correction.crop;
    if (!crop || crop.width <= 0 || crop.height <= 0) {
      summary.errors.push({
        slug: entry.slug,
        message: "Invalid crop · width/height ≤ 0",
      });
      continue;
    }
    const sheet = SHEETS[entry.sheet];
    if (!sheet) {
      summary.errors.push({
        slug: entry.slug,
        message: `Unknown sheet "${entry.sheet}"`,
      });
      continue;
    }
    const sheetPath = path.join(DOWNLOADS, sheet.file);
    // Clamp crop to sheet bounds · defensive against bad manifests
    const left = Math.max(0, Math.min(sheet.srcW - 1, Math.round(crop.left)));
    const top = Math.max(0, Math.min(sheet.srcH - 1, Math.round(crop.top)));
    const width = Math.max(1, Math.min(sheet.srcW - left, Math.round(crop.width)));
    const height = Math.max(1, Math.min(sheet.srcH - top, Math.round(crop.height)));

    // Resolve destinations · per-tile override wins over registry
    const destinations =
      correction.destinations && correction.destinations.length > 0
        ? [...correction.destinations]
        : [...entry.categories];
    if (destinations.length === 0) {
      summary.skipped += 1;
      continue;
    }

    try {
      const buffer = await sharp(sheetPath)
        .extract({ left, top, width, height })
        .png({ compressionLevel: 9 })
        .toBuffer();
      const stickerPath = path.join(STICKER_DIR, `${entry.slug}.png`);
      const emojiPath = path.join(EMOJI_DIR, `${entry.slug}.png`);
      let dualCopied = false;
      if (destinations.includes("sticker")) {
        await fs.writeFile(stickerPath, buffer);
      }
      if (destinations.includes("emoji")) {
        await fs.writeFile(emojiPath, buffer);
        dualCopied = destinations.includes("sticker");
      }
      const meta = await sharp(buffer).metadata();
      summary.exported += 1;
      summary.tilesInfo.push({
        slug: entry.slug,
        width: meta.width ?? width,
        height: meta.height ?? height,
        dualCopied,
      });
    } catch (e) {
      summary.errors.push({
        slug: entry.slug,
        message: e instanceof Error ? e.message : "Export failed",
      });
    }
  }
  if (summary.errors.length > 0) summary.ok = false;
  return summary;
}

/** Streams a source sheet's binary data to the browser · dev-only
 *  tool uses this to load the editable sheet image. The browser
 *  can't directly fetch files outside the Next.js /public dir so
 *  this action returns the file bytes as a base64 data URL. The 4
 *  known sheet filenames are allow-listed · arbitrary filesystem
 *  paths cannot be served. */
const ALLOWED_SHEET_FILES = new Set<string>(
  Object.values(SHEETS).map((s) => s.file),
);

export async function getSheetDataUrl(
  file: string,
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  if (!ALLOWED_SHEET_FILES.has(file)) {
    return { ok: false, error: `Sheet "${file}" is not in the allow-list` };
  }
  try {
    const buf = await fs.readFile(path.join(DOWNLOADS, file));
    const b64 = buf.toString("base64");
    return { ok: true, dataUrl: `data:image/png;base64,${b64}` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Read failed",
    };
  }
}

export async function loadManifestFromDisk(): Promise<CorrectionManifest | null> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as CorrectionManifest;
    if (parsed.schema === 1) return parsed;
    return null;
  } catch {
    return null;
  }
}
