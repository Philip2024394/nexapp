// src/app/nex-native/chat-standard/_engine/bubble-material-resolver.ts
//
// Pure bubble-material resolver · sealed 2026-10-11 Final Parity Pass.
// --------------------------------------------------------------------
// Server-safe module (NO "use client" directive) that owns the
// per-material bubble background + border formulas the live Standard
// Experience shell paints. Extracted from `theme-engine.tsx` (which
// carries "use client") so BOTH the client-side engine AND the
// server-renderable preview surfaces (`preview-mini-phone.ts`,
// `_phone-tile.tsx`, `_category-grid.tsx`, `page.tsx`) can share the
// EXACT same resolver without duplication.
//
// `theme-engine.tsx` re-exports these to preserve its public API.
// Preview surfaces import from here directly.
//
// This file is purely functional · no React · no "use client" · safe
// to import from both server and client.

/** The subset of a resolved ColourSystem the bubble resolver consumes.
 *  Mirrors `Required<ColourSystem>` from theme-package types without
 *  importing the full engine type surface. */
export interface BubblePalette {
  primary: string;
  secondary: string;
  highlight: string;
  deep: string;
}

/** Convert a hex colour (#RGB · #RRGGBB · #RRGGBBAA) to an rgba()
 *  string. IDENTICAL to the former private `hexToRgba` inside
 *  `theme-engine.tsx`. The output uses NO spaces around commas so
 *  byte-equivalence with the previously-inlined function is preserved. */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean.split("").map((x) => x + x).join("")
      : clean.length === 6 || clean.length === 8
        ? clean.slice(0, 6)
        : "00afff";
  const n = parseInt(full, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Resolve a bubble background string for the given material.
 *  Pure function · the SAME inputs produce the SAME output.
 *  Covers every material the engine supports:
 *    solid · gradient · glow · parchment · frosting · water ·
 *    driftwood · ceramic · warm-liquid · neon-glass · glass (default). */
export function resolveBubbleBackground(
  material: string,
  c: BubblePalette,
  mine: boolean,
): string {
  switch (material) {
    case "solid":
      return mine ? c.primary : hexToRgba(c.secondary, 0.9);
    case "gradient":
      return mine
        ? `linear-gradient(135deg, ${hexToRgba(c.primary, 0.85)}, ${hexToRgba(c.deep, 0.9)})`
        : `linear-gradient(135deg, ${hexToRgba(c.secondary, 0.5)}, ${hexToRgba(c.deep, 0.7)})`;
    case "glow":
      return mine
        ? `radial-gradient(circle at 30% 30%, ${hexToRgba(c.primary, 0.75)}, ${hexToRgba(c.primary, 0.25)})`
        : `radial-gradient(circle at 30% 30%, ${hexToRgba(c.secondary, 0.45)}, ${hexToRgba(c.deep, 0.6)})`;
    case "parchment":
      return mine
        ? `
          radial-gradient(ellipse 72% 40% at 50% 10%, ${hexToRgba(c.highlight, 0.3)} 0%, transparent 60%),
          linear-gradient(180deg, ${hexToRgba(c.primary, 0.82)} 0%, ${hexToRgba(c.primary, 0.92)} 100%)
        `
        : `
          radial-gradient(ellipse 72% 40% at 50% 10%, ${hexToRgba(c.highlight, 0.4)} 0%, transparent 60%),
          linear-gradient(180deg, ${hexToRgba(c.highlight, 0.95)} 0%, ${hexToRgba(c.secondary, 0.85)} 100%)
        `;
    case "frosting":
      return mine
        ? `linear-gradient(145deg, ${hexToRgba(c.primary, 0.65)}, ${hexToRgba(c.highlight, 0.35)})`
        : `linear-gradient(145deg, ${hexToRgba(c.highlight, 0.7)}, ${hexToRgba(c.secondary, 0.4)})`;
    case "water":
      return mine
        ? `
          radial-gradient(ellipse 60% 50% at 25% 18%, ${hexToRgba(c.highlight, 0.45)} 0%, ${hexToRgba(c.highlight, 0.05)} 55%, transparent 75%),
          linear-gradient(170deg, ${hexToRgba(c.highlight, 0.22)} 0%, ${hexToRgba(c.highlight, 0)} 18%, transparent 32%),
          linear-gradient(180deg, ${hexToRgba(c.highlight, 0.14)} 0%, ${hexToRgba(c.primary, 0.52)} 55%, ${hexToRgba(c.deep, 0.68)} 100%)
        `
        : `
          radial-gradient(ellipse 60% 50% at 20% 15%, ${hexToRgba(c.highlight, 0.4)} 0%, ${hexToRgba(c.highlight, 0.04)} 55%, transparent 75%),
          linear-gradient(170deg, ${hexToRgba(c.highlight, 0.2)} 0%, ${hexToRgba(c.highlight, 0)} 18%, transparent 32%),
          linear-gradient(180deg, ${hexToRgba(c.highlight, 0.12)} 0%, ${hexToRgba(c.secondary, 0.48)} 55%, ${hexToRgba(c.deep, 0.68)} 100%)
        `;
    case "driftwood":
      return mine
        ? `linear-gradient(135deg, ${hexToRgba(c.secondary, 0.55)}, ${hexToRgba(c.deep, 0.8)})`
        : `linear-gradient(135deg, ${hexToRgba(c.highlight, 0.4)}, ${hexToRgba(c.secondary, 0.5)})`;
    case "ceramic":
      return mine
        ? `
          radial-gradient(ellipse 70% 50% at 50% 10%, ${hexToRgba(c.highlight, 0.4)} 0%, transparent 55%),
          linear-gradient(180deg, ${hexToRgba(c.secondary, 0.85)} 0%, ${hexToRgba(c.primary, 0.78)} 55%, ${hexToRgba(c.deep, 0.82)} 100%)
        `
        : `
          radial-gradient(ellipse 70% 50% at 50% 10%, ${hexToRgba(c.highlight, 0.5)} 0%, transparent 55%),
          linear-gradient(180deg, ${hexToRgba(c.highlight, 0.72)} 0%, ${hexToRgba(c.secondary, 0.72)} 55%, ${hexToRgba(c.deep, 0.78)} 100%)
        `;
    case "warm-liquid":
      return mine
        ? `
          radial-gradient(ellipse 85% 30% at 50% 8%, ${hexToRgba(c.highlight, 0.35)} 0%, transparent 65%),
          linear-gradient(180deg, ${hexToRgba(c.secondary, 0.5)} 0%, ${hexToRgba(c.primary, 0.9)} 25%, ${hexToRgba(c.deep, 0.95)} 100%)
        `
        : `
          radial-gradient(ellipse 85% 30% at 50% 8%, ${hexToRgba(c.highlight, 0.45)} 0%, transparent 65%),
          linear-gradient(180deg, ${hexToRgba(c.highlight, 0.42)} 0%, ${hexToRgba(c.secondary, 0.72)} 25%, ${hexToRgba(c.deep, 0.9)} 100%)
        `;
    case "neon-glass":
      return mine
        ? `
          radial-gradient(ellipse 70% 55% at 50% 55%, ${hexToRgba(c.primary, 0.5)} 0%, transparent 72%),
          linear-gradient(180deg, ${hexToRgba(c.deep, 0.95)} 0%, ${hexToRgba(c.deep, 0.9)} 100%)
        `
        : `
          radial-gradient(ellipse 70% 55% at 50% 55%, ${hexToRgba(c.secondary, 0.42)} 0%, transparent 72%),
          linear-gradient(180deg, ${hexToRgba(c.deep, 0.95)} 0%, ${hexToRgba(c.deep, 0.9)} 100%)
        `;
    case "glass":
    default:
      return mine ? hexToRgba(c.primary, 0.26) : hexToRgba(c.deep, 0.72);
  }
}

/** Resolve a bubble border string for the given material. */
export function resolveBubbleBorder(
  material: string,
  c: BubblePalette,
  mine: boolean,
): string {
  if (material === "water") {
    return mine
      ? `1px solid ${hexToRgba(c.highlight, 0.55)}`
      : `1px solid ${hexToRgba(c.secondary, 0.5)}`;
  }
  if (material === "parchment") {
    return `1px solid ${hexToRgba(c.deep, 0.3)}`;
  }
  if (material === "frosting") {
    return `1px solid ${hexToRgba(c.highlight, 0.5)}`;
  }
  if (material === "ceramic" || material === "warm-liquid") {
    return mine
      ? `1px solid ${hexToRgba(c.highlight, 0.42)}`
      : `1px solid ${hexToRgba(c.secondary, 0.5)}`;
  }
  if (material === "neon-glass") {
    return mine
      ? `2px solid ${hexToRgba(c.primary, 0.95)}`
      : `2px solid ${hexToRgba(c.secondary, 0.9)}`;
  }
  return mine
    ? `1px solid ${hexToRgba(c.primary, 0.85)}`
    : `1px solid rgba(150,160,180,0.55)`;
}
