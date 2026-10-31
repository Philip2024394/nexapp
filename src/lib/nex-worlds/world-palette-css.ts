// src/lib/nex-worlds/world-palette-css.ts
//
// Owner-authorised 2026-10-31 · NEX World Engine · Stage 5.
//
// Static CSS-variable references + fallbacks for every world palette
// token. Import this module ANYWHERE a hex literal would have gone.
// The returned string is a `var(--nex-world-x, <fallback>)` CSS value
// that resolves to:
//   · The active world's token when the layout has mounted
//     <WorldStylesheet /> (sealed · lives in every /nex-native page)
//   · The fallback (nex-original) when a surface is rendered outside
//     the nex-native route tree (e.g. a shared card dropped into
//     /admin or a storybook preview)
//
// Why NOT re-export the palette as hex literals from the registry:
//   The registry is a server-only module (it reads from the DB-based
//   resolver chain). This module is pure CSS-string generation · it
//   can safely be imported from client components. No runtime
//   dependency on the DB · the strings resolve via CSS at paint time.
//
// Usage:
//   import { NEX_W } from "@/lib/nex-worlds/world-palette-css";
//   <div style={{ background: NEX_W.backgroundBase, color: NEX_W.textPrimary }} />

import { WORLD_REGISTRY, DEFAULT_WORLD_ID } from "./world-registry";
import type { WorldPalette } from "./world-types";
import { cssVarNameForPaletteKey } from "./world-types";

/** Build the `var(--nex-world-x, fallback)` string for a palette key.
 *  Fallback = the DEFAULT_WORLD_ID ('nex-original') palette value, so
 *  pre-wired surfaces outside the nex-native stage still render. */
function w(key: keyof WorldPalette): string {
  const fallback = WORLD_REGISTRY[DEFAULT_WORLD_ID].palette[key];
  return `var(${cssVarNameForPaletteKey(key)}, ${fallback})`;
}

/** The single table of world palette references. Each value is a
 *  CSS string · safe to drop into any `style={}` / CSS-in-JS /
 *  stylesheet string template. */
export const NEX_W = {
  primary: w("primary"),
  secondary: w("secondary"),
  tertiary: w("tertiary"),
  backgroundBase: w("backgroundBase"),
  surface: w("surface"),
  surfaceSunken: w("surfaceSunken"),
  textPrimary: w("textPrimary"),
  textSecondary: w("textSecondary"),
  textMuted: w("textMuted"),
  border: w("border"),
  borderAccent: w("borderAccent"),
  success: w("success"),
  warning: w("warning"),
  danger: w("danger"),
} as const;

export type NexWorldPaletteKey = keyof typeof NEX_W;
