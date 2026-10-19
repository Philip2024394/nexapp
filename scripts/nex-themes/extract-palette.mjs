// scripts/nex-themes/extract-palette.mjs
//
// NEX Theme Production · Phase A2 · palette extraction + token derivation.
// --------------------------------------------------------------------------
// Owner-authorised 2026-10-19. Isolated from production rendering.
//
// Honesty invariants:
//   · Extraction is a BASELINE algorithm (histogram bucket quantiser) using
//     only the already-installed `sharp` dep. No `node-vibrant` or similar
//     has been added · reported in the receipt. Quality is intentionally
//     scaffold-grade for A2 · a sharper quantiser may be proposed as a
//     Phase A3 dependency decision.
//   · Video intros use ffmpeg-static directly (already installed) to lift
//     ONE frame at ~2s. If ffmpeg fails for any reason the CLI reports the
//     failure honestly and refuses to fabricate a palette.
//   · The derived semantic tokens are a DETERMINISTIC mapping from the
//     extracted dominant colours · they are NOT a judgment that the result
//     is beautiful or usable. Quality gates land in Phase A3.
//   · Nothing in this file imports from src/, mutates any existing theme,
//     or has any runtime effect on production.
//
// Public API:
//   extractDominantColours(imagePath)         → [{ hex, rgb, weight }, ...]
//   extractFrameFromVideo(videoPath, outPath) → Promise<void>
//   deriveTokensFromColours(dominant, overrides) → ThemeDerivedTokens shape
//   deriveColourSystemFromTokens(tokens)      → ColourSystem shape

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";

const SAMPLE_SIZE = 64; // downscale images for fast quantisation
const QUANTISATION_BUCKETS = 32; // per channel · tuneable; low = coarser

/** Extract an N-colour dominant palette from a still image path. */
export async function extractDominantColours(imagePath) {
  const absPath = path.resolve(imagePath);
  await assertFileExists(absPath);
  const { data, info } = await sharp(absPath)
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets = new Map();
  const step = Math.floor(256 / QUANTISATION_BUCKETS);
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${Math.floor(r / step)}:${Math.floor(g / step)}:${Math.floor(b / step)}`;
    const entry = buckets.get(key);
    if (entry) {
      entry.count++;
      entry.rSum += r;
      entry.gSum += g;
      entry.bSum += b;
    } else {
      buckets.set(key, { count: 1, rSum: r, gSum: g, bSum: b });
    }
  }

  const total = (data.length / info.channels) || 1;
  const colours = Array.from(buckets.values())
    .map((b) => ({
      r: Math.round(b.rSum / b.count),
      g: Math.round(b.gSum / b.count),
      b: Math.round(b.bSum / b.count),
      weight: b.count / total,
    }))
    .sort((a, c) => c.weight - a.weight)
    .slice(0, 8)
    .map((c) => ({
      hex: rgbToHex(c.r, c.g, c.b),
      rgb: { r: c.r, g: c.g, b: c.b },
      weight: Number(c.weight.toFixed(4)),
    }));

  return colours;
}

/** Extract one frame from a video at ~2 seconds. Writes a JPG to outPath. */
export async function extractFrameFromVideo(videoPath, outPath) {
  const absVideo = path.resolve(videoPath);
  const absOut = path.resolve(outPath);
  await assertFileExists(absVideo);
  await fs.mkdir(path.dirname(absOut), { recursive: true });

  if (!ffmpegPath) {
    throw new Error(
      "extract-palette: ffmpeg-static resolved to null · cannot extract video frame · supply --intro as an image instead",
    );
  }

  await new Promise((resolve, reject) => {
    const args = [
      "-ss", "2",
      "-i", absVideo,
      "-frames:v", "1",
      "-q:v", "2",
      "-y",
      absOut,
    ];
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code} · stderr: ${stderr.slice(-400)}`));
    });
  });
}

/** Pure deterministic mapping from dominant colours → ThemeDerivedTokens.
 *
 *  Phase A3.3 corrections to the derivation rules:
 *
 *  1. CTA accent · when the extracted accent fails ≥3:1 contrast against
 *     background (the composer send button's actual rendered backdrop),
 *     the accent is lifted via HSL luma manipulation that PRESERVES hue
 *     identity. Only L changes · H and S stay. This is a true contrast
 *     fix (not just a luminance-distance heuristic) · the correction
 *     iterates until the contrast gate passes.
 *
 *  2. Bubble vs wallpaper separation · when wallpaper statistics are
 *     supplied, incoming + outgoing bubble lumas are chosen OUTSIDE
 *     the wallpaper's dominant p25-p75 band (not just outside the
 *     average). Each generated bubble is contrast-checked against the
 *     wallpaper's dominant band · if the first candidate fails, it is
 *     pushed further until it passes or hits luma extremes.
 *
 *  3. Incoming/outgoing distinction · bubbles are deterministically
 *     separated in luma by ≥50 sRGB units AND use different hue bases
 *     (incoming inherits surface, outgoing inherits accent). Preserves
 *     theme identity · a pink theme still has pink outgoing bubbles
 *     and a navy theme still has navy outgoing bubbles.
 *
 *  Overrides preserved. Any deterministic correction flips provenance
 *  to "mixed".
 */
export function deriveTokensFromColours(introColours, wallpaperColours, overrides = {}, wallpaperStats = null) {
  const pool = dedupe([...introColours, ...wallpaperColours]);
  if (pool.length === 0) {
    throw new Error("deriveTokensFromColours: empty colour pool");
  }

  const sortedByBrightness = [...pool].sort((a, b) => luma(a) - luma(b));
  const darkest = sortedByBrightness[0];
  const lightest = sortedByBrightness[sortedByBrightness.length - 1];
  const sortedBySaturation = [...pool].sort((a, b) => saturation(b) - saturation(a));
  const vibrant1 = sortedBySaturation[0];
  const vibrant2 = sortedBySaturation[1] ?? sortedBySaturation[0];

  const extractedAccent = overrides.accent ?? vibrant1.hex;
  const accentSecondary = overrides.accentSecondary ?? vibrant2.hex;

  const background = darkest.hex;
  const surface = adjustLuma(darkest, +0.04);
  const surfaceElevated = adjustLuma(darkest, +0.09);

  // A3.3 · accent must clear ≥3:1 against background (its real
  // rendered backdrop for the composer CTA). When overridden, respect
  // the override · the user authored it on purpose.
  const accent = overrides.accent
    ? extractedAccent
    : liftColourForContrast(extractedAccent, background, 3.0);
  const accentWasLifted = !overrides.accent && accent !== extractedAccent;

  const extractedTextPrimary = lightest.hex;
  const textPrimary = ensureWcag(extractedTextPrimary, background, 4.5)
    ? extractedTextPrimary
    : canonicalInkFor(background);
  const textPrimaryFellBack = textPrimary !== extractedTextPrimary;

  const extractedTextSecondary = adjustLuma(lightest, -0.25);
  const textSecondary = ensureWcag(extractedTextSecondary, background, 4.5)
    ? extractedTextSecondary
    : (luma({ hex: background }) < 128 ? "#B5C3D6" : "#4C5A6E");

  const textOnAccent = overrides.textOnAccent ?? pickHighContrastInk(accent);

  // A3.3 · bubbles · HSL-based baseline derivation (new algorithm).
  // Wallpaper stats trigger an ADDITIONAL push outside the dominant
  // band. Provenance flips to "mixed" ONLY when wallpaper stats changed
  // the baseline values · the baseline HSL derivation itself is just
  // the new algorithm, not a correction, so it does not flip provenance.
  const extractedIncoming = adjustLuma(darkest, +0.06);
  const extractedOutgoing = mixHex(accent, background, 0.55);
  const bubblesBaseline = deriveBubbleColours({
    extractedIncoming,
    extractedOutgoing,
    accent,
    background,
    wallpaperStats: null,
  });
  const bubbles = deriveBubbleColours({
    extractedIncoming,
    extractedOutgoing,
    accent,
    background,
    wallpaperStats,
  });
  const incomingBubble = overrides.incomingBubble ?? bubbles.incoming;
  const outgoingBubble = overrides.outgoingBubble ?? bubbles.outgoing;
  const bubblesLifted = Boolean(
    wallpaperStats && (
      bubbles.incoming !== bubblesBaseline.incoming ||
      bubbles.outgoing !== bubblesBaseline.outgoing
    ),
  );

  const bubbleBorder = withAlpha(accent, 0.28);
  const composerSurface = adjustLuma(darkest, +0.03);
  const composerBorder = withAlpha(accent, 0.38);
  const iconColor = ensureWcag(adjustLuma(lightest, -0.1), background, 3.0)
    ? adjustLuma(lightest, -0.1)
    : canonicalInkFor(background);
  const focusColor = accent;
  const successColor = overrides.successColor ?? "#2ED37A";
  const dangerColor = overrides.dangerColor ?? "#E85D5D";

  const anyOverride = Boolean(
    overrides.accent || overrides.accentSecondary ||
    overrides.successColor || overrides.dangerColor ||
    overrides.textOnAccent ||
    overrides.incomingBubble || overrides.outgoingBubble,
  );
  const anyDeterministicFallback = textPrimaryFellBack || accentWasLifted || bubblesLifted;

  return {
    background,
    surface,
    surfaceElevated,
    accent,
    accentSecondary,
    textPrimary,
    textSecondary,
    textOnAccent,
    incomingBubble,
    outgoingBubble,
    bubbleBorder,
    composerSurface,
    composerBorder,
    iconColor,
    focusColor,
    successColor,
    dangerColor,
    source: (anyOverride || anyDeterministicFallback) ? "mixed" : "extracted",
  };
}

/** Analyse a wallpaper image · return luma percentiles + dominant-band
 *  statistics + the 5 region averages used by the bubble-separation
 *  gate. A3.4 adds `regionAverages` so bubble derivation reacts to the
 *  SAME compositional measurements the gate uses · otherwise a bubble
 *  can clear the p25-p75 pixel band but still fail against region
 *  averages (Crispy Chicken case · dark fried-chicken crust pixels
 *  pulled p25 below region-average-of-bright-highlights).
 */
export async function analyseWallpaperLuma(wallpaperPath) {
  const abs = path.resolve(wallpaperPath);
  await assertFileExists(abs);
  const { data, info } = await sharp(abs)
    .resize(96, 96, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const lumas = [];
  const chans = info.channels;
  for (let i = 0; i < data.length; i += chans) {
    lumas.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
  }
  lumas.sort((a, b) => a - b);
  const pick = (p) => lumas[Math.min(lumas.length - 1, Math.max(0, Math.floor(lumas.length * p)))];
  const avg = lumas.reduce((s, l) => s + l, 0) / Math.max(1, lumas.length);

  // Mirror the 5 sampling regions used by gateBubbleWallpaperSeparation
  // · same 32×32 patches on the same 96×96 cover-resize. Averaging per
  // region gives the derivation the SAME surface it will be measured
  // against · a region average that overlaps the bubble is a legitimate
  // separation concern the derivation can act on.
  function sampleRegionLuma(x0, y0, w, h) {
    let sum = 0, count = 0;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const i = (y * info.width + x) * info.channels;
        sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        count++;
      }
    }
    return sum / Math.max(1, count);
  }
  const regionAverages = [
    sampleRegionLuma(0, 0, 32, 32),
    sampleRegionLuma(64, 0, 32, 32),
    sampleRegionLuma(0, 64, 32, 32),
    sampleRegionLuma(64, 64, 32, 32),
    sampleRegionLuma(32, 32, 32, 32),
  ];

  return {
    min: lumas[0] ?? 0,
    p25: pick(0.25),
    median: pick(0.5),
    p75: pick(0.75),
    max: lumas[lumas.length - 1] ?? 0,
    average: avg,
    // The "dominant band" is where most of the wallpaper lives · bubbles
    // need to sit outside this band to achieve visual separation.
    dominantBand: { lo: pick(0.25), hi: pick(0.75) },
    // A3.4 · 5 region averages mirroring the separation gate.
    regionAverages,
  };
}

// ─── A3.3 helpers · HSL colour manipulation ──────────────────────────

function rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d > 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)); break;
      case gn: h = ((bn - rn) / d + 2); break;
      case bn: h = ((rn - gn) / d + 4); break;
    }
    h *= 60;
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function hslToHex(hsl) {
  const { r, g, b } = hslToRgb(hsl);
  return rgbToHex(r, g, b);
}

/** Lift (or darken) a colour so its contrast against `against` reaches
 *  `minRatio`. Preserves hue · modifies L only · tries both directions
 *  and returns whichever reaches the target with the smaller L shift. */
function liftColourForContrast(hex, againstHex, minRatio) {
  if (contrastRatioHex(hex, againstHex) >= minRatio) return hex;
  const hsl = rgbToHsl(hexToRgb(hex));
  const stepsLight = [];
  const stepsDark = [];
  for (let delta = 0.05; delta <= 1.0; delta += 0.05) {
    const lighter = Math.min(0.98, hsl.l + delta);
    const darker = Math.max(0.02, hsl.l - delta);
    stepsLight.push({ delta, candidate: hslToHex({ h: hsl.h, s: hsl.s, l: lighter }) });
    stepsDark.push({ delta, candidate: hslToHex({ h: hsl.h, s: hsl.s, l: darker }) });
  }
  const firstPassLight = stepsLight.find((s) => contrastRatioHex(s.candidate, againstHex) >= minRatio);
  const firstPassDark = stepsDark.find((s) => contrastRatioHex(s.candidate, againstHex) >= minRatio);
  if (firstPassLight && firstPassDark) {
    return firstPassLight.delta <= firstPassDark.delta ? firstPassLight.candidate : firstPassDark.candidate;
  }
  return firstPassLight?.candidate ?? firstPassDark?.candidate ?? "#FFFFFF";
}

/** Choose incoming + outgoing bubble colours.
 *
 *  A3.3 rules (corrected 2026-10-19 after a first attempt made bubbles
 *  too light and broke textPrimary-on-bubble contrast):
 *
 *    · For a DARK-BG theme (bg luma < 128), both bubbles stay in the
 *      DARK band so textPrimary (which is light for a dark theme)
 *      continues to clear WCAG against them.
 *        - incoming  → neutralised surface (hue stripped, luma near
 *                      surface) · reads as "someone else's bubble"
 *        - outgoing  → accent-tinted dark (accent hue, dark luma) ·
 *                      reads as "mine · identified by brand colour"
 *      Distinction is primarily HUE (neutral grey vs accent-coloured)
 *      with a small luma delta for extra separation.
 *
 *    · For a LIGHT-BG theme (bg luma ≥ 128), both bubbles stay in the
 *      LIGHT band, same logic inverted.
 *
 *    · When wallpaperStats are supplied AND the wallpaper's dominant
 *      band OVERLAPS the chosen bubble lumas by more than 30 units,
 *      bubbles are nudged further toward the extreme (darker for dark
 *      themes, lighter for light themes) to improve separation.
 *
 *    · The owner's criterion ("hue AND/OR luminance") does NOT require
 *      a specific luma delta between incoming and outgoing · hue alone
 *      is sufficient when it is clearly recognisable. We still apply
 *      a mild luma delta (~15-25 units) because that reads naturally
 *      in chat (your messages are typically visually weightier).
 */
function deriveBubbleColours({ extractedIncoming, extractedOutgoing, accent, background, wallpaperStats }) {
  const bgLuma = sRgbLuma(background);
  const isDarkTheme = bgLuma < 128;

  // Baseline bubble colours · hue comes from surface for incoming
  // (neutralised) and from accent for outgoing (identity-preserving).
  const neutralBase = isDarkTheme
    ? shiftLumaTo(background, Math.max(bgLuma + 12, 20))
    : shiftLumaTo(background, Math.min(bgLuma - 12, 230));

  let incoming = neutralBase;
  let outgoing = (() => {
    // Mix accent + background to create an accent-tinted bubble that
    // sits in the same luma band as the incoming bubble (so textPrimary
    // works on both).
    const target = sRgbLuma(incoming) + (isDarkTheme ? 18 : -18);
    const accentHue = rgbToHsl(hexToRgb(accent)).h;
    const bgSat = rgbToHsl(hexToRgb(background)).s;
    // Build an outgoing hex by taking accent hue + moderate saturation
    // + target luma. Binary-search L to hit the target luma.
    const sat = Math.max(0.25, Math.min(0.5, bgSat + 0.2));
    return shiftLumaTo(hslToHex({ h: accentHue, s: sat, l: 0.4 }), target);
  })();

  // If wallpaper statistics are available and the bubble lumas overlap
  // the wallpaper's dominant band by >30 units, push bubbles further
  // toward the extreme.
  if (wallpaperStats) {
    const band = wallpaperStats.dominantBand;
    const overlap = (hex) => {
      const l = sRgbLuma(hex);
      return l >= band.lo - 30 && l <= band.hi + 30;
    };
    if (overlap(incoming)) {
      const target = isDarkTheme ? Math.max(band.lo - 20, 10) : Math.min(band.hi + 20, 245);
      incoming = shiftLumaTo(incoming, target);
    }
    if (overlap(outgoing)) {
      const target = isDarkTheme ? Math.max(band.lo - 10, 15) : Math.min(band.hi + 10, 240);
      outgoing = shiftLumaTo(outgoing, target);
    }

    // A3.4 · theme-specific feedback loop · if the bubble ALSO fails
    // the 3:1 region-average check (same measurement the separation
    // gate uses) against ≥2 of the 5 sampled regions, apply ONE
    // additional minimal luma push of 15 sRGB units toward the extreme.
    // This targets cases like Crispy Chicken where the pixel-level
    // dominant band is misleading because dark fried-crust pixels pull
    // p25 down below the uniformly-warm region averages. Hue preserved.
    if (Array.isArray(wallpaperStats.regionAverages)) {
      const failsAgainstRegions = (hex) => {
        const bubbleHex = toHexFromLuma(hex);
        let fails = 0;
        for (const regionL of wallpaperStats.regionAverages) {
          // Approximate region hex from luma for contrast calculation ·
          // the gate uses actual region colour; using region luma here
          // is a conservative approximation (same light vs dark check).
          const regionHex = lumaToGreyHex(regionL);
          if (contrastRatioHex(bubbleHex, regionHex) < 3.0) fails++;
        }
        return fails;
      };
      if (failsAgainstRegions(outgoing) >= 2) {
        const current = sRgbLuma(outgoing);
        const target = isDarkTheme
          ? Math.max(current - 15, 8)
          : Math.min(current + 15, 247);
        outgoing = shiftLumaTo(outgoing, target);
      }
      if (failsAgainstRegions(incoming) >= 2) {
        const current = sRgbLuma(incoming);
        const target = isDarkTheme
          ? Math.max(current - 15, 8)
          : Math.min(current + 15, 247);
        incoming = shiftLumaTo(incoming, target);
      }
    }
  }

  return { incoming, outgoing };
}

function toHexFromLuma(hex) { return hex; }
function lumaToGreyHex(l) {
  const n = Math.max(0, Math.min(255, Math.round(l)));
  const h = n.toString(16).padStart(2, "0");
  return `#${h}${h}${h}`;
}

/** Push a colour's luma above or below a wallpaper band by `margin`
 *  sRGB units. Preserves hue via HSL manipulation. */
function pushLumaOutsideBand(hex, band, direction, margin) {
  const current = sRgbLuma(hex);
  const target = direction === "above" ? band.hi + margin : band.lo - margin;
  const clampedTarget = Math.max(10, Math.min(240, target));
  if (direction === "above" && current >= clampedTarget) return hex;
  if (direction === "below" && current <= clampedTarget) return hex;
  return shiftLumaTo(hex, clampedTarget);
}

/** Shift a hex to a target sRGB luma while preserving hue. */
function shiftLumaTo(hex, targetLuma) {
  const hsl = rgbToHsl(hexToRgb(hex));
  // Binary-search HSL.L for the target sRGB luma · 20 iterations is
  // more than enough precision for a 0-255 luma scale.
  let lo = 0, hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const trial = hslToHex({ h: hsl.h, s: hsl.s, l: mid });
    const trialLuma = sRgbLuma(trial);
    if (trialLuma < targetLuma) lo = mid; else hi = mid;
  }
  return hslToHex({ h: hsl.h, s: hsl.s, l: (lo + hi) / 2 });
}

function sRgbLuma(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatioHex(hexA, hexB) {
  const l1 = relLuma(hexA);
  const l2 = relLuma(hexB);
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

// ─── Phase A3.1 helpers · deterministic WCAG fallback rules ──────────

function ensureWcag(hexFg, hexBg, threshold) {
  const l1 = relLuma(hexFg);
  const l2 = relLuma(hexBg);
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  const ratio = (light + 0.05) / (dark + 0.05);
  return ratio >= threshold;
}

function relLuma(hex) {
  const { r, g, b } = hexToRgb(hex);
  const ch = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function canonicalInkFor(hexBg) {
  return luma({ hex: hexBg }) < 128 ? "#F2F5F8" : "#0A0A0A";
}

function pickHighContrastInk(hex) {
  // Try pure white and pure black · pick whichever gives higher contrast.
  const bgLum = relLuma(hex);
  const whiteContrast = (1.0 + 0.05) / (bgLum + 0.05);
  const blackContrast = (bgLum + 0.05) / (0.0 + 0.05);
  return whiteContrast > blackContrast ? "#FFFFFF" : "#0A0A0A";
}

/** Map the derived tokens back to the ColourSystem shape every existing
 *  package already declares. Keeps the generated package compatible with
 *  the pre-A1 engine.
 *
 *  A3.3 correction · `highlight` is used by the Standard Experience
 *  renderer as the DEFAULT TEXT COLOUR (see `_standard-experience.tsx`
 *  line "color: colours.highlight"). The A2 derivation mistakenly
 *  mapped `highlight: tokens.textOnAccent` which, when the accent is
 *  bright, resolves to BLACK · producing unreadable black text on a
 *  dark stage. The correct map is `textPrimary` which the Phase A3.1
 *  WCAG-fallback rule already guarantees is readable on background. */
export function deriveColourSystemFromTokens(tokens) {
  return {
    primary: tokens.accent,
    secondary: tokens.accentSecondary,
    highlight: tokens.textPrimary,
    glow: withAlpha(tokens.accent, 0.45),
    deep: tokens.background,
  };
}

// ─── colour math helpers ────────────────────────────────────────────

function rgbToHex(r, g, b) {
  const h = (n) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function luma(colour) {
  const rgb = colour.rgb ?? hexToRgb(colour.hex ?? colour);
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function saturation(colour) {
  const rgb = colour.rgb ?? hexToRgb(colour.hex ?? colour);
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  return max === 0 ? 0 : (max - min) / max;
}

function adjustLuma(colour, delta) {
  const rgb = colour.rgb ?? hexToRgb(colour.hex ?? colour);
  const scale = (c) => Math.max(0, Math.min(255, Math.round(c + delta * 255)));
  return rgbToHex(scale(rgb.r), scale(rgb.g), scale(rgb.b));
}

function mixHex(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const mix = (ca, cb) => Math.round(ca * t + cb * (1 - t));
  return rgbToHex(mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b));
}

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

function contrastInkFor(hex) {
  return luma({ hex }) > 140 ? "#0A0A0A" : "#FFFFFF";
}

function dedupe(colours) {
  const seen = new Set();
  const out = [];
  for (const c of colours) {
    if (seen.has(c.hex)) continue;
    seen.add(c.hex);
    out.push(c);
  }
  return out;
}

async function assertFileExists(absPath) {
  try {
    await fs.access(absPath);
  } catch {
    throw new Error(`extract-palette: input file not found · ${absPath}`);
  }
}
