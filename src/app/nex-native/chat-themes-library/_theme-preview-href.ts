// src/app/nex-native/chat-themes-library/_theme-preview-href.ts
//
// Single source for the per-theme preview URL · Step 1D helper.
// -------------------------------------------------------------
// Step 1B sealed the rule that every "preview this theme" link in
// the library tree must flow through ONE builder. The Step 1D NEX
// Space redesign adds two new per-theme links (Featured hero +
// Popular strip tiles) on the landing itself, so this file hoists
// the builder out of `_theme-browser-client.tsx` into a pure helper
// both the landing and the browser client can import.
//
// The sealed Section J regression continues to forbid raw
// `/nex-native/themes/${id}` template literals in landing / showcase /
// grid source · callers import `themePreviewHref` from here instead.

export function themePreviewHref(themeId: string): string {
  return `/nex-native/themes/${encodeURIComponent(themeId)}`;
}
