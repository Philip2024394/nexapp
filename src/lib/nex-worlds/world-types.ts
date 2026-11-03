// src/lib/nex-worlds/world-types.ts
//
// Owner-authorised 2026-10-31 · NEX World Engine · Stage 1 types.
//
// A "world" is an app-wide visual identity (palette + accents +
// surfaces) that applies to the NEX chrome. It is NOT the same as a
// chat theme (sealed commerce product · wallpaper / bubbles / FX for
// chat only). Worlds are a separate layer.
//
// Hard rules (sealed · do not weaken):
//   · Worlds supply PALETTE tokens only. The sealed chrome tokens in
//     `src/lib/nex-native/design-tokens.ts` (one font stack, in-header
//     badge size, mobile text sizes) are NEVER overridden by a world.
//   · Worlds do NOT control a user's country / language / currency /
//     legal settings. Those live elsewhere.
//   · Worlds do NOT modify or compete with the chat-theme system.

/** Stable world identifier · Owner directive 2026-11-03 · Ireland is
 *  the sole supported world. The nex-original + indonesia options
 *  were retired in this pass. The type is retained as a single-member
 *  union rather than a plain string literal so every call site keeps
 *  its typed guarantee. */
export type WorldId = "ireland";

/** The subset of a world a renderer actually consumes. Each colour is
 *  a CSS value (hex, rgb(), rgba(), or a gradient). CSS custom
 *  property names mirror the keys in snake-case (e.g. `backgroundBase`
 *  → `--nex-world-background-base`). */
export interface WorldPalette {
  /** Primary brand accent · buttons, highlights, selected rings. */
  readonly primary: string;
  /** Secondary accent · hover, link, secondary CTA. */
  readonly secondary: string;
  /** Tertiary pop · special features, celebratory moments. */
  readonly tertiary: string;
  /** App root background · the colour behind every page. */
  readonly backgroundBase: string;
  /** Elevated surface (cards, sheets, drawers). */
  readonly surface: string;
  /** Deeper surface for grouped sections / modals. */
  readonly surfaceSunken: string;
  /** Primary text on backgroundBase + surface. */
  readonly textPrimary: string;
  /** Secondary / dim text. */
  readonly textSecondary: string;
  /** Muted / disabled text. */
  readonly textMuted: string;
  /** Border / divider lines. */
  readonly border: string;
  /** Soft accent border for inputs + cards (translucent primary). */
  readonly borderAccent: string;
  /** Success / "earned" (badges, confirmations). */
  readonly success: string;
  /** Warning (amber, degraded state). */
  readonly warning: string;
  /** Error / destructive (destructive action, failed state). */
  readonly danger: string;
}

/** Static metadata a world advertises (name, byline, flag emoji for
 *  listing in HQ). Not a visual override. */
export interface WorldMetadata {
  readonly id: WorldId;
  readonly displayName: string;
  readonly byline: string;
  /** Optional emoji / glyph · purely for the HQ listing + preview. */
  readonly glyph: string;
}

/** Complete world definition. */
export interface WorldDefinition {
  readonly meta: WorldMetadata;
  readonly palette: WorldPalette;
}

/** Convert camelCase palette keys to CSS custom property names:
 *   `backgroundBase` → `--nex-world-background-base` */
export function cssVarNameForPaletteKey(key: keyof WorldPalette): string {
  const kebab = key.replace(/([A-Z])/g, "-$1").toLowerCase();
  return `--nex-world-${kebab}`;
}

/** Flatten a world's palette into a `{ [cssVarName]: value }` map for
 *  injection into a root style tag or React style prop. */
export function paletteToCssVars(
  palette: WorldPalette,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(palette) as Array<keyof WorldPalette>) {
    out[cssVarNameForPaletteKey(key)] = palette[key];
  }
  return out;
}
