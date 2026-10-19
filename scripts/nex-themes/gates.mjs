// scripts/nex-themes/gates.mjs
//
// NEX Theme Production · Phase A3 · automated quality gates.
// --------------------------------------------------------------------------
// Owner-authorised 2026-10-19. Isolated from production rendering.
//
// Honesty invariants:
//   · Every gate returns `{ status: "pass" | "warn" | "fail", measurements,
//     reason }`. "pass" means the gate's AUTOMATED criterion was met · it
//     is NOT a certification that the theme is visually beautiful. Visual
//     judgment is a separate human-review step.
//   · Thresholds (WCAG AA ratio = 4.5 for body text, 3.0 for large text)
//     are the published W3C values · the gate reports both the raw ratio
//     and the threshold so a reviewer can audit the call.
//   · The wallpaper legibility gate samples real wallpaper regions · it
//     does NOT fabricate measurements. If the wallpaper can't be read for
//     any reason it returns status: "fail" with the error, not a happy
//     green stub.
//   · Gates NEVER mutate the theme or write to any live registry.
//
// Public API:
//   runAllGates({ tokens, introPath, wallpaperPath, packagePath, cliInputs })
//     → { gates: {...}, summary: { pass, warn, fail }, productionReady: bool }

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";

const SUPPORTED_IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const SUPPORTED_VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".m4v"]);
const WCAG_AA_BODY = 4.5;
const WCAG_AA_LARGE = 3.0;

// ─── Contrast math (pure, deterministic, testable) ───────────────────

export function hexToRgb(hex) {
  const h = String(hex).replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`hexToRgb: invalid hex "${hex}"`);
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** W3C relative luminance (sRGB · 0..1). */
export function relativeLuminance(rgb) {
  const chan = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
}

/** W3C contrast ratio · result in [1.0 .. 21.0]. */
export function contrastRatio(hexA, hexB) {
  const la = relativeLuminance(hexToRgb(hexA));
  const lb = relativeLuminance(hexToRgb(hexB));
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

export function wcagLabel(ratio, isLargeText = false) {
  const threshold = isLargeText ? WCAG_AA_LARGE : WCAG_AA_BODY;
  if (ratio >= threshold) return "pass";
  if (ratio >= threshold * 0.9) return "warn";
  return "fail";
}

// ─── Gate 1 · Asset check ────────────────────────────────────────────

export async function gateAssetCheck({ introPath, wallpaperPath }) {
  const measurements = {};
  const errors = [];

  for (const [role, p] of [["intro", introPath], ["wallpaper", wallpaperPath]]) {
    try {
      const abs = path.resolve(p);
      await fs.access(abs);
      const ext = path.extname(abs).toLowerCase();
      const isImage = SUPPORTED_IMAGE_EXT.has(ext);
      const isVideo = SUPPORTED_VIDEO_EXT.has(ext);
      measurements[role] = {
        path: p,
        extension: ext,
        isImage,
        isVideo,
      };
      if (role === "wallpaper" && !isImage) {
        errors.push(`wallpaper must be an image (got "${ext}")`);
      }
      if (role === "intro" && !isImage && !isVideo) {
        errors.push(`intro must be an image or video (got "${ext}")`);
      }
      if (isImage) {
        const meta = await sharp(abs).metadata();
        measurements[role].width = meta.width;
        measurements[role].height = meta.height;
      }
    } catch (err) {
      errors.push(`${role}: ${err.message}`);
    }
  }

  return {
    id: "assetCheck",
    status: errors.length === 0 ? "pass" : "fail",
    measurements,
    reason: errors.length === 0 ? "All assets readable" : errors.join("; "),
  };
}

// ─── Gate 2 · Palette + token check ──────────────────────────────────

const REQUIRED_TOKENS = [
  "background", "surface", "surfaceElevated",
  "accent", "accentSecondary",
  "textPrimary", "textSecondary", "textOnAccent",
  "incomingBubble", "outgoingBubble", "bubbleBorder",
  "composerSurface", "composerBorder",
  "iconColor", "focusColor", "successColor", "dangerColor",
];

const VALID_SOURCES = new Set(["extracted", "overridden", "mixed"]);

export function gatePaletteCheck({ tokens }) {
  const missing = [];
  const invalid = [];
  for (const key of REQUIRED_TOKENS) {
    if (!(key in tokens)) {
      missing.push(key);
    } else if (!isValidHexOrRgba(tokens[key])) {
      invalid.push(`${key}=${tokens[key]}`);
    }
  }
  if (!tokens.source || !VALID_SOURCES.has(tokens.source)) {
    invalid.push(`source=${tokens.source ?? "(missing)"}`);
  }

  const errors = [...missing.map((m) => `missing ${m}`), ...invalid.map((i) => `invalid ${i}`)];

  return {
    id: "paletteCheck",
    status: errors.length === 0 ? "pass" : "fail",
    measurements: {
      requiredTokenCount: REQUIRED_TOKENS.length,
      presentTokenCount: REQUIRED_TOKENS.length - missing.length,
      provenance: tokens.source ?? null,
    },
    reason: errors.length === 0 ? "All 17 colour tokens + provenance present and well-formed" : errors.join("; "),
  };
}

function isValidHexOrRgba(value) {
  if (typeof value !== "string") return false;
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return true;
  if (/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/.test(value)) return true;
  return false;
}

// ─── Gate 3 · Contrast check (WCAG AA) ───────────────────────────────

export function gateContrastCheck({ tokens }) {
  // The pairs we actually render in chat UIs. Each row names what the
  // reviewer should imagine: this foreground sits on this background.
  const pairs = [
    { name: "textPrimary on background", fg: tokens.textPrimary, bg: tokens.background, large: false },
    { name: "textSecondary on background", fg: tokens.textSecondary, bg: tokens.background, large: false },
    { name: "textPrimary on surface", fg: tokens.textPrimary, bg: tokens.surface, large: false },
    { name: "textPrimary on incomingBubble", fg: tokens.textPrimary, bg: tokens.incomingBubble, large: false },
    { name: "textPrimary on outgoingBubble", fg: tokens.textPrimary, bg: tokens.outgoingBubble, large: false },
    { name: "textOnAccent on accent", fg: tokens.textOnAccent, bg: tokens.accent, large: false },
    { name: "textPrimary on composerSurface", fg: tokens.textPrimary, bg: tokens.composerSurface, large: false },
    { name: "iconColor on background", fg: tokens.iconColor, bg: tokens.background, large: true },
    { name: "accent on background (CTA fill visible)", fg: tokens.accent, bg: tokens.background, large: true },
  ];

  const results = pairs.map((p) => {
    const safeFg = toHex(p.fg);
    const safeBg = toHex(p.bg);
    const ratio = contrastRatio(safeFg, safeBg);
    const label = wcagLabel(ratio, p.large);
    return {
      pair: p.name,
      fg: safeFg,
      bg: safeBg,
      ratio: Number(ratio.toFixed(2)),
      threshold: p.large ? WCAG_AA_LARGE : WCAG_AA_BODY,
      largeText: p.large,
      label,
    };
  });

  const fails = results.filter((r) => r.label === "fail");
  const warns = results.filter((r) => r.label === "warn");
  const status = fails.length > 0 ? "fail" : warns.length > 0 ? "warn" : "pass";

  return {
    id: "contrastCheck",
    status,
    measurements: {
      pairsChecked: results.length,
      pass: results.length - fails.length - warns.length,
      warn: warns.length,
      fail: fails.length,
      results,
    },
    reason: status === "pass"
      ? "All 9 WCAG AA pairs pass"
      : `${fails.length} fail · ${warns.length} warn · see measurements.results`,
  };
}

function toHex(value) {
  if (typeof value !== "string") return "#000000";
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  // Convert rgba() → hex (ignore alpha for luminance math)
  const m = value.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    const h = (n) => Number(n).toString(16).padStart(2, "0");
    return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
  }
  return "#000000";
}

// ─── Gate 4 · Bubble-vs-wallpaper separation ─────────────────────────
//
// Phase A3.1 correction · the pre-correction gate asked "is textPrimary
// readable on raw wallpaper?" which is the WRONG question · textPrimary
// renders INSIDE a bubble, not directly on the wallpaper.
//
// The ACTUAL compositing in _standard-experience.tsx (verified by
// reading the renderer):
//   · wallpaper → full-bleed background-image, NO scrim overlay
//     (the `wallpaperScrim: "default"` package field is declared but
//     is NOT currently read by the Standard Experience renderer)
//   · bubbles  → sit on top of wallpaper with their own fill colour
//     (incomingBubble / outgoingBubble)
//   · text     → sits INSIDE bubbles with textPrimary colour
//
// So the real quality questions this gate measures are:
//   (A) Can you SEE the bubble shape against the wallpaper?
//       (bubble fill vs wallpaper region · WCAG 3:1 for large shapes)
//   (B) Does textPrimary read on its ACTUAL rendered backgrounds?
//       (textPrimary vs incomingBubble / outgoingBubble · already
//        covered by gateContrastCheck · referenced here for context)
//
// Honest limitations:
//   · The sampling is on the raw wallpaper file. The real renderer
//     centre-crops with `background-size: cover` so the sampled
//     regions may not match the visible pixels at every viewport.
//   · Semi-transparent bubble materials (glass, water, etc.) will show
//     the wallpaper through them · this gate's "pass" verdict on
//     bubble vs wallpaper is a pessimistic approximation for those
//     cases (assumes bubble fill is opaque).
//   · When the measurement cannot be modelled reliably (e.g. wallpaper
//     with extreme regional variance), the gate returns "warn" with an
//     explicit "inconclusive" tag rather than claiming "pass".

export async function gateBubbleWallpaperSeparation({ wallpaperPath, tokens }) {
  try {
    const abs = path.resolve(wallpaperPath);
    const { data, info } = await sharp(abs)
      .resize(96, 96, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const regions = {
      topLeft: sampleRegion(data, info, 0, 0, 32, 32),
      topRight: sampleRegion(data, info, 64, 0, 32, 32),
      bottomLeft: sampleRegion(data, info, 0, 64, 32, 32),
      bottomRight: sampleRegion(data, info, 64, 64, 32, 32),
      centre: sampleRegion(data, info, 32, 32, 32, 32),
    };

    // Measure variance across sampled regions · if wallpaper is wildly
    // variable, mark the result inconclusive rather than claiming pass.
    const regionLumas = Object.values(regions).map((hex) => {
      const { r, g, b } = hexToRgb(hex);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    });
    const minL = Math.min(...regionLumas);
    const maxL = Math.max(...regionLumas);
    const varianceSpan = maxL - minL;
    const inconclusive = varianceSpan > 160; // high dynamic range wallpaper

    const measurements = {
      regions,
      wallpaperVarianceSpan: Number(varianceSpan.toFixed(1)),
      inconclusive,
      incomingBubbleVsWallpaper: {},
      outgoingBubbleVsWallpaper: {},
    };

    const fails = [];
    const warns = [];
    const incomingHex = toHex(tokens.incomingBubble);
    const outgoingHex = toHex(tokens.outgoingBubble);

    for (const [region, avgHex] of Object.entries(regions)) {
      const incomingRatio = contrastRatio(incomingHex, avgHex);
      const outgoingRatio = contrastRatio(outgoingHex, avgHex);
      const incomingLabel = incomingRatio >= 3.0 ? "pass" : incomingRatio >= 2.7 ? "warn" : "fail";
      const outgoingLabel = outgoingRatio >= 3.0 ? "pass" : outgoingRatio >= 2.7 ? "warn" : "fail";
      measurements.incomingBubbleVsWallpaper[region] = {
        wallpaperAvg: avgHex,
        bubble: incomingHex,
        ratio: Number(incomingRatio.toFixed(2)),
        label: incomingLabel,
      };
      measurements.outgoingBubbleVsWallpaper[region] = {
        wallpaperAvg: avgHex,
        bubble: outgoingHex,
        ratio: Number(outgoingRatio.toFixed(2)),
        label: outgoingLabel,
      };
      if (incomingLabel === "fail") fails.push(`in:${region}`);
      else if (incomingLabel === "warn") warns.push(`in:${region}`);
      if (outgoingLabel === "fail") fails.push(`out:${region}`);
      else if (outgoingLabel === "warn") warns.push(`out:${region}`);
    }

    let status;
    let reason;
    if (inconclusive) {
      status = "warn";
      reason = `inconclusive · wallpaper has high regional variance (span ${varianceSpan.toFixed(1)}) · a static gate cannot reliably rate bubble separation · human review required`;
    } else if (fails.length > 0) {
      status = "fail";
      reason = `${fails.length} region(s) fail bubble/wallpaper separation at WCAG 3:1 large-shape threshold · ${fails.join(", ")}`;
    } else if (warns.length > 0) {
      status = "warn";
      reason = `${warns.length} region(s) within 10% of threshold · ${warns.join(", ")}`;
    } else {
      status = "pass";
      reason = "Both bubble variants achieve ≥3:1 separation vs. wallpaper on all 5 regions";
    }

    return {
      id: "bubbleWallpaperSeparation",
      status,
      measurements,
      reason,
    };
  } catch (err) {
    return {
      id: "bubbleWallpaperSeparation",
      status: "fail",
      measurements: {},
      reason: `bubble/wallpaper separation sampling failed: ${err.message}`,
    };
  }
}

// Backward-compat alias so existing callers that reference the old name
// still work · marked deprecated · remove in a future phase.
/** @deprecated use gateBubbleWallpaperSeparation */
export const gateWallpaperLegibility = gateBubbleWallpaperSeparation;

// ─── Gate 6 · Wallpaper quality (A3.4) ───────────────────────────────
//
// Phase A3.4 · owner-authorised path (c) for high-variance wallpapers.
//
// Some wallpapers (Pink Dream · teddy-bear scene with sunset + bedroom
// mix) span a wide luma range · the pixels run from ~55 to ~220 sRGB
// luma in different regions. Mathematically, there is NO single bubble
// colour (short of pure white or pure black) that can achieve ≥3:1
// contrast against EVERY region of such a wallpaper.
//
// Rather than silently tune bubbles toward extremes (which would damage
// theme identity), this gate explicitly FLAGS the wallpaper as the
// issue. It emits a clear recommendation to replace or regenerate the
// wallpaper · the generator does not re-derive the theme in response.
//
// Threshold: luma span (max - min of sampled percentiles) ≥ 100 sRGB
// units triggers the flag. Measured on the same 96×96 sharp sample used
// by other wallpaper-aware gates.
//
// This gate is INFORMATIONAL for low-variance wallpapers (pass) and
// FAIL for high-variance ones. It never changes bubble derivation.
// Owner decides whether to swap the wallpaper or accept the finding.

export async function gateWallpaperQuality({ wallpaperPath }) {
  try {
    const abs = path.resolve(wallpaperPath);
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
    const min = lumas[0] ?? 0;
    const max = lumas[lumas.length - 1] ?? 0;
    const span = max - min;
    const p25 = lumas[Math.floor(lumas.length * 0.25)] ?? 0;
    const p75 = lumas[Math.floor(lumas.length * 0.75)] ?? 0;
    const dominantSpan = p75 - p25;

    // A3.4 · the discriminating measure is p25-p75 (where most pixels
    // live), not raw min-max (which is ~255 for any photographic image
    // with shadows + highlights). A wallpaper whose dominant 50% of
    // pixels spans > 90 luma units is genuinely high-variance in a way
    // that defeats consistent bubble separation.
    let status;
    let reason;
    if (dominantSpan >= 90) {
      status = "fail";
      reason = `wallpaper's dominant 50% of pixels spans ${dominantSpan.toFixed(0)} sRGB luma units (p25 ${p25.toFixed(0)}, p75 ${p75.toFixed(0)}) · high-variance wallpapers cannot support consistent bubble/wallpaper separation at ≥3:1 across all regions · recommend replacement or regeneration with a lower-variance image · generator does NOT re-derive bubbles to compensate (would damage theme identity)`;
    } else if (dominantSpan >= 60) {
      status = "warn";
      reason = `wallpaper dominant-span ${dominantSpan.toFixed(0)} sRGB units · moderate variance · bubble separation may be weak in bright or dark regions · human review recommended`;
    } else {
      status = "pass";
      reason = `wallpaper dominant-span ${dominantSpan.toFixed(0)} sRGB units · within consistent-separation range`;
    }

    return {
      id: "wallpaperQuality",
      status,
      measurements: {
        lumaMin: Number(min.toFixed(1)),
        lumaMax: Number(max.toFixed(1)),
        lumaSpan: Number(span.toFixed(1)),
        dominantSpanP25toP75: Number(dominantSpan.toFixed(1)),
      },
      reason,
    };
  } catch (err) {
    return {
      id: "wallpaperQuality",
      status: "fail",
      measurements: {},
      reason: `wallpaper quality sampling failed: ${err.message}`,
    };
  }
}

function sampleRegion(data, info, x0, y0, w, h) {
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * info.width + x) * info.channels;
      rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
      count++;
    }
  }
  const r = Math.round(rSum / count);
  const g = Math.round(gSum / count);
  const b = Math.round(bSum / count);
  const toHex2 = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}

// ─── Gate 5 · Package schema + typecheck ─────────────────────────────

export async function gatePackageCheck({ packagePath }) {
  try {
    const abs = path.resolve(packagePath);
    await fs.access(abs);
    const source = await fs.readFile(abs, "utf8");

    const missing = [];
    const required = [
      "export const", "ThemePackage", "identity:", "colours:",
      "personality:", "derivedTokens:",
    ];
    for (const marker of required) {
      if (!source.includes(marker)) missing.push(marker);
    }

    if (missing.length > 0) {
      return {
        id: "packageCheck",
        status: "fail",
        measurements: { bytes: source.length },
        reason: `missing markers: ${missing.join(", ")}`,
      };
    }

    const tsResult = await runTypecheck(abs);

    return {
      id: "packageCheck",
      status: tsResult.ok ? "pass" : "fail",
      measurements: { bytes: source.length, typecheck: tsResult.ok ? "ok" : "failed" },
      reason: tsResult.ok
        ? "Package compiles cleanly and declares the expected ThemePackage shape"
        : `typecheck failed: ${tsResult.stderr.slice(-400)}`,
    };
  } catch (err) {
    return {
      id: "packageCheck",
      status: "fail",
      measurements: {},
      reason: `package check failed: ${err.message}`,
    };
  }
}

function runTypecheck(filePath) {
  return new Promise((resolve) => {
    // On Windows, `spawn("npx", ...)` with shell:false fails with
    // EINVAL because npx is a .cmd shim. Resolve the real tsc binary
    // from node_modules/.bin instead · deterministic across platforms.
    const tscBin = process.platform === "win32"
      ? path.resolve(process.cwd(), "node_modules", ".bin", "tsc.cmd")
      : path.resolve(process.cwd(), "node_modules", ".bin", "tsc");
    const proc = spawn(tscBin, ["--noEmit", filePath], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32", // required for .cmd on Windows
    });
    let stderr = "";
    let stdout = "";
    proc.stdout.on("data", (c) => { stdout += c.toString(); });
    proc.stderr.on("data", (c) => { stderr += c.toString(); });
    proc.on("close", (code) => {
      resolve({ ok: code === 0, stdout, stderr: stderr || stdout });
    });
    proc.on("error", (err) => {
      resolve({ ok: false, stdout: "", stderr: err.message });
    });
  });
}

// ─── Orchestrator ────────────────────────────────────────────────────

export async function runAllGates({ tokens, introPath, wallpaperPath, packagePath, cliInputs }) {
  const gates = {
    assetCheck: await gateAssetCheck({ introPath, wallpaperPath }),
    paletteCheck: gatePaletteCheck({ tokens }),
    contrastCheck: gateContrastCheck({ tokens }),
    bubbleWallpaperSeparation: await gateBubbleWallpaperSeparation({ wallpaperPath, tokens }),
    wallpaperQuality: await gateWallpaperQuality({ wallpaperPath }),
    packageCheck: await gatePackageCheck({ packagePath }),
  };

  const summary = { pass: 0, warn: 0, fail: 0 };
  for (const g of Object.values(gates)) {
    summary[g.status] = (summary[g.status] ?? 0) + 1;
  }

  return {
    gates,
    summary,
    productionReady: false, // ALWAYS false in A3 · requires human visual review
    productionReadyReason:
      "Automated gates run · but human visual review of the Playwright screenshots is REQUIRED before any theme is treated as production-ready. Automated contrast/legibility math is necessary, not sufficient.",
  };
}
