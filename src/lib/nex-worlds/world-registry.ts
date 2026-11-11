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
  // Owner-sealed 2026-11-10 · NEX Ireland light-theme palette.
  // Supersedes the 2026-11-01 Emerald/Forest/Gold seal (and every
  // earlier Irish Green iteration). From now on NEX Ireland is a
  // warm, light-ivory surface with Amber as the single accent.
  //
  //   Warm Ivory #FFF9E9 — main chat background (backgroundBase)
  //   Pale Ivory #F5EDD3 — sidebar + panels (surfaceSunken ·
  //                       mirrored to WORLD_DRAWER_BG.ireland in
  //                       _world-stylesheet.tsx)
  //   NEX Amber  #D4A24F — accent · primary buttons · outgoing
  //                       message bubbles (palette.primary /
  //                       secondary / tertiary all unified to this)
  //   Pure White #FFFFFF — incoming message bubbles + card
  //                       surfaces (palette.surface)
  //
  // Text stays dark-on-ivory. Border rgba retinted to Amber so
  // card outlines feel coherent with the new accent.
  palette: {
    primary: "#D4A24F",              // NEX Amber · primary buttons, outgoing bubble rim
    secondary: "#D4A24F",            // NEX Amber · accent (hover / link / secondary CTA)
    tertiary: "#D4A24F",             // NEX Amber · doubled with secondary
    // Owner directive 2026-11-11 · main chat background unified with
    // the side-drawer tone · both now paint Pale Ivory so the drawer
    // feels like part of the same surface rather than a different
    // layer sitting on top. Earlier spec used Warm Ivory #FFF9E9 for
    // the canvas; that two-tone look has been retired.
    backgroundBase: "#F5EDD3",       // Pale Ivory · main chat background (= drawer bg)
    surface: "#FFFFFF",              // Pure White · card surfaces + incoming bubbles
    surfaceSunken: "#F5EDD3",        // Pale Ivory · panels / sunken surfaces
    textPrimary: "#2A1F0F",          // dark warm brown · readable on ivory
    textSecondary: "#5A4A2E",        // mid warm brown · secondary ink
    textMuted: "#8A7A5E",            // soft brown · muted ink
    border: "rgba(212, 162, 79, 0.18)",   // Amber-tinted divider
    borderAccent: "rgba(212, 162, 79, 0.45)", // Amber-tinted active border
    success: "#02AD04",              // unchanged (Irish Green reserved for state only)
    warning: "#F5A623",              // unchanged
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
