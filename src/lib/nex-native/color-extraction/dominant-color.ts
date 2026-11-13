// src/lib/nex-native/color-extraction/dominant-color.ts
//
// Client-side dominant-colour extractor · owner directive 2026-11-12.
// -----------------------------------------------------------------------
// Owner wants the shop theme accent to adapt to the background image.
// Approach picked (2026-11-12): extract in the browser on preview load
// then prompt the owner to accept the suggestion — no server extractor,
// no new DB column, no library dependency. The accepted hex still flows
// through the existing `applyShopTintAction` → `shop_cover_tint_hex`
// path so the DB-wired rule is honoured end-to-end.
//
// Algorithm:
//   1. Load the image via a cross-origin `<img>` tag
//   2. Draw it downscaled (64×64) to an offscreen <canvas>
//   3. Walk pixels, skipping near-white (lightness > 0.92) and near-
//      black (lightness < 0.08) so the extractor doesn't get dragged
//      toward the background mat colour
//   4. Average the remaining RGB values
//   5. Clamp the result so it stays saturated enough to read as a tint
//      against text (push toward the nearest saturated hue if too grey)
//
// Returns a 6-digit upper-case hex or `null` if the image fails to
// load / is tainted / has no non-neutral pixels. Non-throwing.

const SAMPLE_SIZE = 64;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lightness(r: number, g: number, b: number): number {
  // Relative luminance · perceptual average
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/** Boost saturation slightly if the extracted colour is too grey to
 *  read as a tint. Keeps hue, raises distance between max and min. */
function boostSaturation(r: number, g: number, b: number): [number, number, number] {
  const sat = saturation(r, g, b);
  if (sat >= 0.35) return [r, g, b];
  const target = 0.5;
  const factor = (target - sat) / (1 - sat + 0.0001);
  const avg = (r + g + b) / 3;
  return [
    r + (r - avg) * factor,
    g + (g - avg) * factor,
    b + (b - avg) * factor,
  ];
}

/** Load an image and extract its dominant colour. Returns hex or null. */
export async function extractDominantColor(imageUrl: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!imageUrl) return null;

  const img = await loadImage(imageUrl);
  if (!img) return null;

  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  } catch {
    // CORS-tainted canvas · can't read pixels. Fail silently so the
    // UI falls back to the current / default tint.
    return null;
  }

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
  } catch {
    return null;
  }

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;
    if (a < 200) continue; // ignore transparent pixels
    const L = lightness(r, g, b);
    if (L > 0.92 || L < 0.08) continue; // ignore near-white + near-black
    rSum += r;
    gSum += g;
    bSum += b;
    count++;
  }

  if (count < 16) return null;

  const [r, g, b] = boostSaturation(rSum / count, gSum / count, bSum / count);
  return rgbToHex(r, g, b);
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
