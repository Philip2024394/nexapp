// src/app/nex-native/free-chat/_types.ts
//
// NEX · Free Chat · shared types for the standalone surface.
// Owner-authorised 2026-10-21 (iteration 53).
//
// `OutgoingDeliveryStatus` was previously inlined in page.tsx. Moved
// to this shared module so the client canvas and the server page both
// reference the same union without a cyclic import.

/** Owner directive 2026-10-21 (iteration 37) · outgoing bubble
 *  delivery indicator REPLACED tick checkmarks with a single
 *  colour-coded DOT:
 *    delivered · orange dot · reached recipient's device, not read yet
 *    read      · green dot  · recipient opened the chat
 *  Peer bubbles never render a dot (dots only confirm YOUR sends). */
export type OutgoingDeliveryStatus = "delivered" | "read";

// ─── Free-chat first-visit theme catalog (shared) ────────────────
//
// Owner directive 2026-10-21 (iteration 54) · THEMES moved out of the
// client canvas so the server page can resolve the initial wallpaper
// URL from the cookie-stored themeId and paint it on the <main>
// background BEFORE hydration · prevents the flash-of-navy on return
// visitors who had already picked a wallpaper.
export interface FreeChatTheme {
  readonly id: string;
  readonly label: string;
  readonly wallpaperUrl: string | null;
  readonly placeholderLabel: string | null;
  /** Owner directive 2026-10-21 (iteration 59) · the first tile is the
   *  NEX default · plain navy page with no wallpaper · marked with
   *  this flag so the tile renders a NEX-branded navy preview + "NEX"
   *  label instead of the generic numbered placeholder. */
  readonly isDefault?: boolean;
  /** Owner directive 2026-10-21 · per-theme bubble accent · both peer
   *  and self chat bubbles tint to this colour when the theme is
   *  applied · bubble shape, radius and glass design are unchanged.
   *  Hex `#RRGGBB` · the free-chat canvas synthesises fill + rim
   *  alpha layers from this one value. */
  readonly accentHex: string;
}

export const FREE_CHAT_THEMES: readonly FreeChatTheme[] = [
  { id: "nex-default", label: "NEX", wallpaperUrl: null, placeholderLabel: null, isDefault: true, accentHex: "#00AFFF" },
  { id: "theme-1", label: "Theme 1", wallpaperUrl: "/nex-themes/free-chat-theme-1.png", placeholderLabel: null, accentHex: "#D4A24C" },
  { id: "theme-2", label: "Theme 2", wallpaperUrl: "/nex-themes/free-chat-theme-2.png", placeholderLabel: null, accentHex: "#FF4FD7" },
  { id: "theme-3", label: "Theme 3", wallpaperUrl: "/nex-themes/free-chat-theme-3.png", placeholderLabel: null, accentHex: "#16D66B" },
  { id: "theme-5", label: "Theme 5", wallpaperUrl: "/nex-themes/free-chat-theme-5.png", placeholderLabel: null, accentHex: "#FF7200" },
];

/** Resolve a theme id to its accent hex · defaults to NEX cyan when
 *  the id is null or unknown. */
export function resolveFreeChatAccentHex(themeId: string | null | undefined): string {
  if (!themeId) return "#00AFFF";
  const match = FREE_CHAT_THEMES.find((t) => t.id === themeId);
  return match?.accentHex ?? "#00AFFF";
}

/** Convert a `#RRGGBB` hex to an rgba() string with the given alpha
 *  (0..1). Used by the bubble renderer to synthesise glass fill +
 *  rim tints from a single accent. */
export function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "").trim();
  const safe = h.length === 6 ? h : "00AFFF";
  const r = parseInt(safe.slice(0, 2), 16);
  const g = parseInt(safe.slice(2, 4), 16);
  const b = parseInt(safe.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Resolve a theme id (from cookie) to its wallpaper URL. Returns null
 *  when no theme is selected OR the theme is a placeholder slot. */
export function resolveFreeChatWallpaperUrl(
  themeId: string | null | undefined,
): string | null {
  if (!themeId) return null;
  const match = FREE_CHAT_THEMES.find((t) => t.id === themeId);
  return match?.wallpaperUrl ?? null;
}

/** Full `background` CSS value for the free-chat <main> given a resolved
 *  wallpaperUrl. Used by both the server page (initial paint) and the
 *  client canvas (post-hydration state updates) so the layer stack
 *  stays byte-identical. */
export function freeChatBackgroundCss(
  wallpaperUrl: string | null,
  navyFallback: string = "#020914",
): string {
  if (!wallpaperUrl) return navyFallback;
  return `linear-gradient(rgba(2, 9, 20, 0.35), rgba(2, 9, 20, 0.55)), url("${wallpaperUrl}") center / cover no-repeat, ${navyFallback}`;
}
