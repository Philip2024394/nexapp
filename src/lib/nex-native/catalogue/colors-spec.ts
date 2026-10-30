// src/lib/nex-native/catalogue/colors-spec.ts
//
// Owner-authorised 2026-10-31: "shop upload pages for color variants
// must allow user to pick standard colors that we display[...] but also
// have palette color picker. each color selected owner can add image
// for that color of the product and see price field where they can
// leave the existing price or add price for that color[...] if they
// add images, user sees color images as thumbnails that open in main
// image and price updates; if not, color circle shows + price updates
// if different." Build-now · pricing/premium gate later.
//
// Storage: nex_product.spec.__colors jsonb (sixth reserved substrate
// key alongside __market / __delivery / __identity / __wholesale /
// __returns). No new migration · same pattern as its siblings.
//
// Design notes:
//   · Independent of the generic `nex_product_variant` axis="colour"
//     path. A product can carry EITHER colour variants in the sealed
//     variant table OR this richer color substrate. The two are
//     complementary: variants capture size/style/pack-size axes; this
//     substrate specifically models COLOUR with per-color image + price
//     because colour selection on the shop surface wants a visual
//     swatch, not a text label.
//   · Entries carry both `name` (seller-authored, free text) and `hex`
//     (normalised uppercase #RRGGBB) so the shop can render either a
//     swatch (hex) or a thumbnail (image_url).
//   · image_url is OPTIONAL. When absent the swatch is the hex circle.
//     When present the swatch IS the image thumbnail.
//   · price_pence_override is OPTIONAL. When absent the product base
//     price applies.
//
// Compliance posture (sealed):
//   · The seller supplies the colour name and the image. NEX does not
//     verify colour accuracy or that the image depicts the labelled
//     colour. UI copy says "declared"; no "verified" claims.

import { z } from "zod";

const HEX_COLOR = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "hex must be #RRGGBB");

export const ColorEntry = z.object({
  /** Seller-authored label · "Red", "Burgundy", "Ocean teal". */
  name: z.string().min(1).max(60),
  /** Normalised #RRGGBB uppercase · the storage canonical form. */
  hex: HEX_COLOR,
  /** Per-colour price override. Null means the product base price
   *  applies. Integer pence like every other NEX price. */
  price_pence_override: z.number().int().nonnegative().optional(),
  /** Image URL to show as the colour's swatch + main-image preview.
   *  Uploaded via /api/nex-native/product/upload-image (shared route).
   *  When absent the swatch renders as the hex circle only. */
  image_url: z.string().url().max(1024).optional(),
  /** Position-based ordering · same convention as variants. */
  position: z.number().int().nonnegative(),
});

export const ColorsSpec = z.object({
  entries: z.array(ColorEntry).max(20),
});

export type ColorEntryT = z.infer<typeof ColorEntry>;
export type ColorsT = z.infer<typeof ColorsSpec>;

export const COLORS_SPEC_KEY = "__colors";

export function extractColors(spec: unknown): ColorsT | null {
  if (!spec || typeof spec !== "object") return null;
  const c = (spec as Record<string, unknown>)[COLORS_SPEC_KEY];
  if (!c || typeof c !== "object") return null;
  const parsed = ColorsSpec.safeParse(c);
  return parsed.success ? parsed.data : null;
}

export function mergeColorsIntoSpec(
  spec: Record<string, unknown>,
  colors: ColorsT,
): Record<string, unknown> {
  return { ...spec, [COLORS_SPEC_KEY]: colors };
}

/** Normalise seller input into canonical uppercase #RRGGBB form.
 *  Accepts #RGB shorthand, bare "RGB"/"RRGGBB", and already-normalised
 *  values. Returns null for anything that doesn't look like a colour. */
export function normaliseHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9A-Fa-f]{3}$/.test(raw)) {
    const [r, g, b] = raw.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) {
    return `#${raw}`.toUpperCase();
  }
  return null;
}

// ─── Standard palette · 24 named NEX swatches ────────────────────────
//
// The upload page shows these as a quick-pick strip above the custom
// hex picker. Hex values are deliberate · they map to colours a seller
// would describe in copy. The names are English baseline; locale-
// specific display names can layer on the UI later without changing
// the storage format (which is hex, not name).

export interface StandardSwatch {
  readonly name: string;
  readonly hex: string;
}

export const STANDARD_COLOR_PALETTE: readonly StandardSwatch[] = [
  { name: "Black",       hex: "#000000" },
  { name: "White",       hex: "#FFFFFF" },
  { name: "Grey",        hex: "#808080" },
  { name: "Silver",      hex: "#C0C0C0" },
  { name: "Beige",       hex: "#D7B997" },
  { name: "Cream",       hex: "#F5F0DC" },
  { name: "Brown",       hex: "#6B3A1F" },
  { name: "Tan",         hex: "#C19A6B" },
  { name: "Red",         hex: "#D01E2A" },
  { name: "Burgundy",    hex: "#660A1F" },
  { name: "Pink",        hex: "#F7A1C2" },
  { name: "Rose",        hex: "#E25B7B" },
  { name: "Orange",      hex: "#FF7A1F" },
  { name: "Peach",       hex: "#FFB899" },
  { name: "Yellow",      hex: "#F4C92F" },
  { name: "Mustard",     hex: "#C19A2C" },
  { name: "Olive",       hex: "#6B7A2F" },
  { name: "Green",       hex: "#1F9A4C" },
  { name: "Mint",        hex: "#A5E8C8" },
  { name: "Teal",        hex: "#118A8A" },
  { name: "Blue",        hex: "#1E6FD9" },
  { name: "Navy",        hex: "#0F2A5C" },
  { name: "Purple",      hex: "#6B3DAE" },
  { name: "Lavender",    hex: "#C7B5E8" },
];
