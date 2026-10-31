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

/** NEX Ireland · DRAFT 2026-10-31.
 *  Design direction: emerald green primary · warm cream + complementary
 *  light surfaces · restrained gold accents · premium / polished (NOT
 *  a St Patrick's day pub). Owner approves refinement before marking
 *  this world as final. */
const IRELAND: WorldDefinition = {
  meta: {
    id: "ireland",
    displayName: "NEX Ireland",
    byline: "Irish Green · Golden Orange · White",
    glyph: "☘️",
  },
  // Owner-sealed 2026-11-01 · NEX Ireland "set colors main":
  //   Irish Green         #02AD04   (2, 173, 4)
  //   Golden Irish Orange #F5A623   (245, 166, 35)
  //   White               #FFFFFF
  // These three replace the earlier emerald/deep-emerald/gold draft.
  // Page backgroundBase stays cream (#FAF8F4) per the Trade Centre
  // match sealed 2026-11-01 (owner directive: pages are cream, chrome
  // uses the 3 set colors).
  palette: {
    primary: "#02AD04",             // Irish Green · the brand lead
    secondary: "#F5A623",            // Golden Irish Orange
    tertiary: "#F5A623",             // Golden Orange accent
    backgroundBase: "#FAF8F4",       // Trade Centre cream (page bg)
    surface: "#FFFFFF",              // White (card / chrome surface)
    surfaceSunken: "#F2EDDE",        // soft cream for subdued surfaces
    textPrimary: "#102013",
    textSecondary: "#3F5742",
    textMuted: "#7A8C7E",
    border: "rgba(2, 173, 4, 0.14)",
    borderAccent: "rgba(2, 173, 4, 0.4)",
    success: "#02AD04",              // Irish Green · earned/confirmed
    warning: "#F5A623",               // Golden Orange · attention
    danger: "#9B1C1C",
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
