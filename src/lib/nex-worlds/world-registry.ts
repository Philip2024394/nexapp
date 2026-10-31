// src/lib/nex-worlds/world-registry.ts
//
// Owner-authorised 2026-10-31 · NEX World Engine · Stage 1.
// Central registry of every world the application knows about.
//
// Rules:
//   · `nex-original` is the baseline · its palette MUST mirror the
//     current app chrome colours (no visual change for existing users).
//   · `ireland` + `indonesia` are first-pass skeleton palettes · they
//     are intentionally recognisable but need a designer refinement
//     pass. Mark them as DRAFT in HQ until finalised.
//   · To add a new world: extend `WorldId` in world-types.ts + add
//     another WORLD_REGISTRY entry. No DB migration needed · the
//     active_world_id column accepts any text (validation is here).

import type { WorldDefinition, WorldId } from "./world-types";

/** Baseline · zero visual change for existing users. Values below are
 *  taken from the sealed NEX chrome: deep navy backgrounds, cyan
 *  accents, white ink. Match the palette already used across
 *  `/nex-native/profile/[handle]/page.tsx` NEX constant. */
const NEX_ORIGINAL: WorldDefinition = {
  meta: {
    id: "nex-original",
    displayName: "NEX Original",
    byline: "The founding NEX identity · navy + cyan",
    glyph: "🌐",
  },
  palette: {
    primary: "#00AFFF",
    secondary: "#1DA1F2",
    tertiary: "#F2C94C",
    backgroundBase: "#020914",
    surface: "#061322",
    surfaceSunken: "#030B18",
    textPrimary: "#F2F5F8",
    textSecondary: "#B5C3D6",
    textMuted: "#7D9BC0",
    border: "rgba(0, 175, 255, 0.14)",
    borderAccent: "rgba(0, 175, 255, 0.35)",
    success: "#1F8F4F",
    warning: "#B45309",
    danger: "#C8102E",
  },
};

/** NEX Ireland · owner-sealed 2026-11-01 (narrow premium palette update).
 *  Design direction: a sophisticated, premium Irish identity — emerald
 *  chrome, forest buttons, gold premium accent, sage ink — NOT a
 *  St Patrick's day pub. Cream page background preserved per the
 *  Trade Centre match. */
const IRELAND: WorldDefinition = {
  meta: {
    id: "ireland",
    displayName: "NEX Ireland",
    byline: "Emerald · Forest · Gold · Sage",
    glyph: "☘️",
  },
  // Owner-sealed 2026-11-01 (narrow premium palette update) ·
  // NEX Ireland "set colors main":
  //   Emerald #123D2B — drawer background, chrome surface
  //                     (emitted via WORLD_DRAWER_BG.ireland in
  //                      _world-stylesheet.tsx)
  //   Forest  #1B5138 — primary buttons, interactive accents
  //                     (palette.primary below)
  //   Gold    #C6A15B — premium accent, "Premium Irish experience"
  //                     tagline (palette.secondary + palette.tertiary)
  //   Sage    #AFC5B5 — button text / primary ink
  //                     (emitted via WORLD_PRIMARY_INK.ireland in
  //                      _world-stylesheet.tsx — country-scoped,
  //                      NOT a WorldPalette field)
  //
  // Supersedes the earlier 2026-11-01 Irish Green #02AD04 /
  // Golden Orange #F5A623 / White seal.
  //
  // Narrow-update scope · ONLY primary/secondary/tertiary change here.
  // Preserved as-is per owner directive: cream backgroundBase, white
  // surfaces, text colours, border rgba (still tinted on the earlier
  // Irish Green until a wider pass is authorised), success/warning/danger.
  palette: {
    primary: "#1B5138",              // Forest · primary buttons, interactive accents
    secondary: "#C6A15B",            // Gold · premium accent (hover/link/secondary CTA)
    tertiary: "#C6A15B",             // Gold · doubled with secondary (continues the earlier Ireland pattern)
    backgroundBase: "#FAF8F4",       // Trade Centre cream (page bg · unchanged)
    surface: "#FFFFFF",              // White (unchanged)
    surfaceSunken: "#F2EDDE",        // soft cream (unchanged)
    textPrimary: "#102013",          // unchanged
    textSecondary: "#3F5742",        // unchanged
    textMuted: "#7A8C7E",            // unchanged
    border: "rgba(2, 173, 4, 0.14)", // unchanged per narrow scope (still Irish-Green tinted)
    borderAccent: "rgba(2, 173, 4, 0.4)", // unchanged per narrow scope (still Irish-Green tinted)
    success: "#02AD04",              // unchanged per narrow scope (still Irish Green)
    warning: "#F5A623",              // unchanged per narrow scope (still Golden Orange)
    danger: "#9B1C1C",               // unchanged
  },
};

/** NEX Indonesia · DRAFT 2026-10-31.
 *  Design direction: an Indonesian-inspired palette · professional,
 *  modern, welcoming · NOT the Ireland design with recoloured hex.
 *  First-pass values draw from the Garuda red-and-white, with warm
 *  turmeric gold + batik-indigo surface accents. Owner approves
 *  refinement before marking this world as final. */
const INDONESIA: WorldDefinition = {
  meta: {
    id: "indonesia",
    displayName: "NEX Indonesia",
    byline: "Garuda red · gold · indigo",
    glyph: "🇮🇩",
  },
  palette: {
    primary: "#C8102E",             // Garuda red
    secondary: "#E0A020",            // turmeric gold
    tertiary: "#3B4C8C",             // batik indigo
    backgroundBase: "#FFFFFF",
    surface: "#FFF7EF",
    surfaceSunken: "#F7ECD6",
    textPrimary: "#17110A",
    textSecondary: "#4A3E2E",
    textMuted: "#8A7B64",
    border: "rgba(200, 16, 46, 0.12)",
    borderAccent: "rgba(200, 16, 46, 0.4)",
    success: "#2E7D47",
    warning: "#B45309",
    danger: "#9B1C1C",
  },
};

export const WORLD_REGISTRY: Readonly<Record<WorldId, WorldDefinition>> = {
  "nex-original": NEX_ORIGINAL,
  ireland: IRELAND,
  indonesia: INDONESIA,
};

/** List registered worlds in display order. HQ renders this. */
export const ALL_WORLDS: readonly WorldDefinition[] = [
  NEX_ORIGINAL,
  IRELAND,
  INDONESIA,
];

/** Default fallback when the DB has no active_world row OR the stored
 *  id is unknown (migration drift / renamed world). */
export const DEFAULT_WORLD_ID: WorldId = "nex-original";

/** Narrow an untrusted string to a known WorldId · or null. */
export function parseWorldId(input: unknown): WorldId | null {
  if (typeof input !== "string") return null;
  return input in WORLD_REGISTRY ? (input as WorldId) : null;
}

export function getWorldDefinition(id: WorldId): WorldDefinition {
  return WORLD_REGISTRY[id];
}

export function getDefaultWorld(): WorldDefinition {
  return WORLD_REGISTRY[DEFAULT_WORLD_ID];
}
