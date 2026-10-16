// src/lib/nex-native/selected-theme-cookie.ts
//
// NEX · "chosen free theme" cookie · 2026-10-15 · owner-authorised.
// -----------------------------------------------------------------------------
// Carries which free NEX-brand theme a guest selected before signup,
// so `createNexAccountAction` can redirect them straight back to it
// instead of the default pick-theme → welcome → contacts chain.
//
// Same cookie pattern as sealed `nex_welcome_intent`:
//   · httpOnly · path "/" · sameSite "lax"
//   · 24-hour max-age (long enough for signup, short enough to
//     avoid stale redirects)
//   · HARDCODED whitelist of accepted values (only the two free NEX
//     theme ids) so an attacker can't make the cookie point at an
//     arbitrary URL via a crafted guest flow
//
// Zero migration · pure cookie-based state.

export const SELECTED_THEME_COOKIE = "nex_selected_theme";

/** The ONLY theme ids this cookie is permitted to carry. Any other
 *  value is treated as absent (cookie ignored). This hard-blocks an
 *  arbitrary-redirect attack vector. */
export const SELECTED_THEME_WHITELIST = ["nex-bubbles", "nex-flat"] as const;

export type SelectedThemeId = (typeof SELECTED_THEME_WHITELIST)[number];

/** Narrow an untrusted string to a known SelectedThemeId or null. */
export function parseSelectedThemeId(
  value: string | null | undefined,
): SelectedThemeId | null {
  if (typeof value !== "string") return null;
  return (SELECTED_THEME_WHITELIST as readonly string[]).includes(value)
    ? (value as SelectedThemeId)
    : null;
}

/** Compose the redirect target for a given selected theme. Guards
 *  against drift between the cookie key and the live route. */
export function selectedThemeHref(id: SelectedThemeId): string {
  return `/nex-native/themes/${encodeURIComponent(id)}`;
}
