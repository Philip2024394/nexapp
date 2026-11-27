// src/app/nex-native/chat-themes-library/plain/_plain-palette.ts
//
// NEX Chat Themes · Plain Backgrounds palette.
// Owner directive 2026-11-27 · the Plain library shows ONE tile per
// main colour, cream (original NEX colour) first. Selecting a tile
// exposes a light-to-dark adjustment slider so the user picks the
// exact shade they want. The chat canvas then paints the whole
// background with that solid colour and picks a readable bubble
// accent based on luminance contrast.
//
// Convention:
//   theme id  =  "plain:<hueId>@<shade>"
//   shade     =  integer 0..100
//                0   = lightest (base mixed 100% toward white)
//                50  = base hue exactly
//                100 = darkest  (base mixed 100% toward black)
//
// This module is pure (no React, no server-only imports) so it can be
// consumed by both the server page and the client picker.

export interface PlainHue {
  readonly id: string;
  readonly label: string;
  /** Base hex at shade = 50. Lightness is derived from this value. */
  readonly baseHex: string;
}

/** Owner directive 2026-11-27 · cream (original NEX colour #FBF5E9)
 *  is the first-listed tile. Remaining tiles cover every main colour
 *  family with exactly one entry each. */
export const PLAIN_HUES: readonly PlainHue[] = [
  { id: "cream", label: "NEX Cream", baseHex: "#FBF5E9" },
  { id: "white", label: "White", baseHex: "#FFFFFF" },
  { id: "grey", label: "Grey", baseHex: "#9CA3AF" },
  { id: "black", label: "Black", baseHex: "#111111" },
  { id: "red", label: "Red", baseHex: "#E04848" },
  { id: "orange", label: "Orange", baseHex: "#FF7200" },
  { id: "yellow", label: "Yellow", baseHex: "#F5C518" },
  { id: "green", label: "Green", baseHex: "#16D66B" },
  { id: "teal", label: "Teal", baseHex: "#14B8A6" },
  { id: "blue", label: "Blue", baseHex: "#2D6CDF" },
  { id: "purple", label: "Purple", baseHex: "#8B5CF6" },
  { id: "pink", label: "Pink", baseHex: "#EC4899" },
  { id: "brown", label: "Brown", baseHex: "#8B5A2B" },
] as const;

const PLAIN_PREFIX = "plain:";
/** Owner directive 2026-11-27 (revised 8 · Scope B) · reserved hue
 *  token for free-hex background mode. The grammar becomes a sum
 *  type:
 *    `plain:<hueId>@<shade>`   — curated hue + light-to-dark shade
 *    `plain:hex@<RRGGBB>`      — freeform hex (6 upper-case chars)
 *  No other callers need to know about the hex branch · they go
 *  through `resolvePlainBackgroundHex` (updated below) which hides
 *  the two forms behind one return value. `parsePlainThemeId`
 *  continues to return null for the hex branch to preserve existing
 *  behaviour at all its call sites. */
const PLAIN_HEX_TOKEN = "hex";
const PLAIN_HEX_BODY_RE = /^[0-9A-Fa-f]{6}$/;

export function isPlainThemeId(themeId: string | null | undefined): boolean {
  return typeof themeId === "string" && themeId.startsWith(PLAIN_PREFIX);
}

export function buildPlainThemeId(hueId: string, shade: number): string {
  const safeShade = Math.max(0, Math.min(100, Math.round(shade)));
  return `${PLAIN_PREFIX}${hueId}@${safeShade}`;
}

/** Build a freeform-hex plain theme id. Accepts "#RRGGBB" or
 *  "RRGGBB". Invalid input falls back to the cream base (safe no-op
 *  rather than throwing · callers include UI handlers that must not
 *  break on a dirty paste). */
export function buildPlainHexThemeId(hex: string): string {
  const clean = hex.replace("#", "").trim().toUpperCase();
  if (!PLAIN_HEX_BODY_RE.test(clean)) return buildPlainThemeId("cream", 50);
  return `${PLAIN_PREFIX}${PLAIN_HEX_TOKEN}@${clean}`;
}

export function parsePlainThemeId(
  themeId: string | null | undefined,
): { readonly hueId: string; readonly shade: number } | null {
  if (!isPlainThemeId(themeId)) return null;
  const body = (themeId as string).slice(PLAIN_PREFIX.length);
  const at = body.indexOf("@");
  if (at === -1) return null;
  const hueId = body.slice(0, at);
  // Hex branch is handled by parsePlainHexThemeId · intentionally
  // return null here so existing consumers (accent resolver,
  // default-bubble-customization) continue to ignore unknown hue
  // ids and fall through to their own branches.
  if (hueId === PLAIN_HEX_TOKEN) return null;
  const shadeNum = Number.parseInt(body.slice(at + 1), 10);
  if (!PLAIN_HUES.some((h) => h.id === hueId)) return null;
  if (!Number.isFinite(shadeNum)) return null;
  const shade = Math.max(0, Math.min(100, shadeNum));
  return { hueId, shade };
}

/** Parse the freeform-hex branch · returns `{ hex: "#RRGGBB" }` on
 *  success. Null for hue-branch ids and malformed input. */
export function parsePlainHexThemeId(
  themeId: string | null | undefined,
): { readonly hex: string } | null {
  if (!isPlainThemeId(themeId)) return null;
  const body = (themeId as string).slice(PLAIN_PREFIX.length);
  const at = body.indexOf("@");
  if (at === -1) return null;
  if (body.slice(0, at) !== PLAIN_HEX_TOKEN) return null;
  const rest = body.slice(at + 1);
  if (!PLAIN_HEX_BODY_RE.test(rest)) return null;
  return { hex: `#${rest.toUpperCase()}` };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "").trim();
  const safe = h.length === 6 ? h : "000000";
  return {
    r: parseInt(safe.slice(0, 2), 16),
    g: parseInt(safe.slice(2, 4), 16),
    b: parseInt(safe.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number): string =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Resolve the actual hex for a plain hue at the given shade.
 *  shade 50 returns the base; shade < 50 blends toward white;
 *  shade > 50 blends toward black. Linear blend keeps the hue family
 *  identifiable across the whole slider range. */
export function resolvePlainHex(hueId: string, shade: number): string | null {
  const hue = PLAIN_HUES.find((h) => h.id === hueId);
  if (!hue) return null;
  const s = Math.max(0, Math.min(100, Math.round(shade)));
  const base = hexToRgb(hue.baseHex);
  if (s === 50) return hue.baseHex;
  if (s < 50) {
    // Blend toward white. t = 1 - s/50 (0 at base, 1 at pure white).
    const t = 1 - s / 50;
    return rgbToHex(
      base.r + (255 - base.r) * t,
      base.g + (255 - base.g) * t,
      base.b + (255 - base.b) * t,
    );
  }
  // s > 50 · blend toward black.
  const t = (s - 50) / 50;
  return rgbToHex(base.r * (1 - t), base.g * (1 - t), base.b * (1 - t));
}

/** Convenience: resolve the solid background hex from a full plain
 *  theme id. Returns null when the id is not a plain theme.
 *
 *  Owner directive 2026-11-27 (revised 8 · Scope B) · the hex branch
 *  of the grammar (`plain:hex@RRGGBB`) is checked first so callers
 *  only need this one function to cover both forms. */
export function resolvePlainBackgroundHex(
  themeId: string | null | undefined,
): string | null {
  const hexForm = parsePlainHexThemeId(themeId);
  if (hexForm) return hexForm.hex;
  const parsed = parsePlainThemeId(themeId);
  if (!parsed) return null;
  return resolvePlainHex(parsed.hueId, parsed.shade);
}

/** Perceived luminance (0..1) of a hex colour using the standard
 *  Rec. 709 weights. Used by the bubble-accent picker below. */
export function luminanceOfHex(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Pick a chat-bubble accent that reads well on top of a plain
 *  background. On light backgrounds we return the sealed NEX orange
 *  (`#FF7200`) because dark warm bubbles pop on cream/white/pastel.
 *  On dark backgrounds we return cream so bubbles stay airy and
 *  text stays legible. The bubble renderer still applies its sealed
 *  translucent alphas on top of the returned hex. */
export function pickBubbleAccentForPlainHex(hex: string): string {
  const L = luminanceOfHex(hex);
  if (L >= 0.6) return "#FF7200"; // light background -> NEX orange bubbles
  if (L <= 0.25) return "#FBF5E9"; // dark background  -> cream bubbles
  return "#FFFFFF"; // mid-tone -> clean white bubbles
}
