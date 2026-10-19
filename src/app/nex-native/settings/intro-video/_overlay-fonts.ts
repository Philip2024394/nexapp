// src/app/nex-native/settings/intro-video/_overlay-fonts.ts
//
// Intro-video overlay typography · owner-authorised 2026-10-19.
// -----------------------------------------------------------------------------
// 5 curated web fonts for the intro-video title overlay picker.
// Loaded via a single Google Fonts CSS <link> injected at mount time
// (see `loadIntroOverlayFonts` in _intro-video-client.tsx) · this
// avoids the Turbopack `next/font/google` multi-weight bug while
// keeping the same visual family set the owner picked.

export type IntroOverlayFontId =
  | "classic"
  | "elegant"
  | "strong"
  | "casual"
  | "neon";

export interface IntroOverlayFont {
  id: IntroOverlayFontId;
  label: string;
  /** CSS font-family stack · falls back to system-ui if Google Fonts
   *  fails to load. */
  fontFamily: string;
  /** Extra per-font cosmetic overrides (weight / letter-spacing /
   *  text-transform) applied on top of the shared overlay styles. */
  previewStyle: React.CSSProperties;
}

export const INTRO_OVERLAY_FONTS: readonly IntroOverlayFont[] = [
  {
    id: "classic",
    label: "Classic",
    fontFamily: `"Inter", system-ui, -apple-system, sans-serif`,
    previewStyle: { fontWeight: 900 },
  },
  {
    id: "elegant",
    label: "Elegant",
    fontFamily: `"Playfair Display", Georgia, "Times New Roman", serif`,
    previewStyle: { fontWeight: 900, letterSpacing: "0.005em" },
  },
  {
    id: "strong",
    label: "Strong",
    fontFamily: `"Montserrat", Impact, "Arial Black", sans-serif`,
    previewStyle: {
      fontWeight: 900,
      letterSpacing: "-0.015em",
      textTransform: "uppercase",
    },
  },
  {
    id: "casual",
    label: "Casual",
    fontFamily: `"Caveat", "Permanent Marker", cursive`,
    previewStyle: { fontWeight: 700, letterSpacing: "0.005em" },
  },
  {
    id: "neon",
    label: "Neon",
    fontFamily: `"Bebas Neue", "Trebuchet MS", sans-serif`,
    previewStyle: {
      fontWeight: 400,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
    },
  },
];

export function fontById(id: IntroOverlayFontId): IntroOverlayFont {
  return INTRO_OVERLAY_FONTS.find((f) => f.id === id) ?? INTRO_OVERLAY_FONTS[0];
}

/** Google Fonts v2 URL carrying all 5 families in one request. Loaded
 *  lazily on client-side mount via <link rel="stylesheet"> so the
 *  settings page is the only surface paying the download cost. */
export const INTRO_OVERLAY_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Inter:wght@700;900",
    "family=Playfair+Display:wght@700;900",
    "family=Montserrat:wght@800;900",
    "family=Caveat:wght@700",
    "family=Bebas+Neue",
  ].join("&") +
  "&display=swap";

// ─── Size presets ──────────────────────────────────────────────────
// Base pt values · the TitleOverlay already multiplies by position
// (hero 24 / center 20 / footer 15). The size preset becomes a
// multiplier on top so each position stays readable at all 4 sizes.

export type IntroOverlaySizeId = "s" | "m" | "l" | "xl";

export interface IntroOverlaySize {
  id: IntroOverlaySizeId;
  label: string;
  /** Multiplier applied to the position-based base font size. */
  multiplier: number;
}

export const INTRO_OVERLAY_SIZES: readonly IntroOverlaySize[] = [
  { id: "s", label: "S", multiplier: 0.75 },
  { id: "m", label: "M", multiplier: 1 },
  { id: "l", label: "L", multiplier: 1.35 },
  { id: "xl", label: "XL", multiplier: 1.75 },
];

export function sizeById(id: IntroOverlaySizeId): IntroOverlaySize {
  return INTRO_OVERLAY_SIZES.find((s) => s.id === id) ?? INTRO_OVERLAY_SIZES[1];
}
