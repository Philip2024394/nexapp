// src/app/nex-native/chat-themes-library/_sealed-free-themes.ts
//
// NEX Themes · sealed free-theme allowlist · owner-sealed 2026-10-18.
// -------------------------------------------------------------------
// Owner rule (verbatim): "we have only 2 free themes · all other are
// paid themes".
//
// The underlying `nex_chat_theme.tier = 'gratis'` DB field is NOT a
// reliable "is free forever" signal · many legacy rows are gratis
// but should be sold as premium in the Neon Marketplace. This file
// is the SINGLE SOURCE OF TRUTH for which theme IDs count as the
// 2 free-forever themes.
//
// Everything else is bucketed as premium regardless of the DB tier
// field · consumers filter via `isSealedFreeTheme(id)` below.
//
// To change which 2 themes are free, edit the SEALED_FREE_THEME_IDS
// array below · nothing else. The marketplace page re-renders on
// next build / dev-server reload.

/** The two authoritative NEX free themes · ordered as they should
 *  appear in the Free Themes grid.
 *
 *  Current pair (owner-sealed · lowest-sort-order IDs from the
 *  nex_chat_theme table):
 *    - "default" · "Theme 0" · sort_order 0 · the fallback NEX theme
 *    - "theme-0" · "Joker"   · sort_order 0 · the sealed Joker chat
 *                              master layout reference
 *
 *  Owner can swap either entry · the array is a strict length-2
 *  tuple to catch accidental additions at compile time. */
export const SEALED_FREE_THEME_IDS: readonly [string, string] = [
  "default",
  "theme-0",
] as const;

const FREE_SET = new Set<string>(SEALED_FREE_THEME_IDS);

/** True when `themeId` is in the sealed free-themes pair. Case-
 *  sensitive · theme ids are stored lowercase in the DB. */
export function isSealedFreeTheme(themeId: string): boolean {
  return FREE_SET.has(themeId);
}
