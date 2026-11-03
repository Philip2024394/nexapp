// src/lib/nex-worlds/world-registry.ts
//
// Owner-authorised 2026-11-03 · Ireland-only consolidation.
// --------------------------------------------------------
// NEX Ireland is the sole supported product. The nex-original and
// Indonesia worlds that previously lived here were retired in this
// pass per owner directive "DECISION: NEX IRELAND ONLY".
//
// Why keep the registry at all?
//   · Downstream code (_world-stylesheet.tsx, world-resolver.ts, HQ
//     landing, feed components) call `getWorldDefinition("ireland")`
//     + iterate `ALL_WORLDS`. Keeping the one-entry map preserves
//     those call sites without an app-wide refactor.
//   · If a second world is ever added back, extend `WorldId` in
//     world-types.ts + add another entry here. Nothing else changes.
//
// Historical note:
//   · nex-original · navy + cyan baseline (retired 2026-11-03)
//   · indonesia    · Garuda red + gold + indigo (retired 2026-11-03)

import type { WorldDefinition, WorldId } from "./world-types";

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

export const WORLD_REGISTRY: Readonly<Record<WorldId, WorldDefinition>> = {
  ireland: IRELAND,
};

/** List registered worlds in display order. HQ renders this. */
export const ALL_WORLDS: readonly WorldDefinition[] = [IRELAND];

/** Default fallback. Ireland is the only supported world. */
export const DEFAULT_WORLD_ID: WorldId = "ireland";

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
