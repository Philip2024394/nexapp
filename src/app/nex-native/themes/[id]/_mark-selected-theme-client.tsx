"use client";

// src/app/nex-native/themes/[id]/_mark-selected-theme-client.tsx
//
// NEX · "remember which free theme the guest viewed" client beacon.
// -----------------------------------------------------------------------------
// 2026-10-15 · owner-authorised. Mounted ONCE on NEX-brand theme
// previews (nex-bubbles · nex-flat) so a guest's choice survives
// through signup and the completed account returns to the SAME
// theme instead of being bounced to the default pick-theme page.
//
// Fires a single POST to /api/nex-native/select-theme on mount.
// The route handler validates the id against a hard whitelist and
// writes the `nex_selected_theme` cookie (httpOnly · 24h). The
// `createNexAccountAction` reads + consumes that cookie after a
// successful signup.
//
// Renders nothing · pure side-effect.

import * as React from "react";

export interface MarkSelectedThemeClientProps {
  readonly themeId: string;
}

export function MarkSelectedThemeClient({
  themeId,
}: MarkSelectedThemeClientProps): null {
  React.useEffect(() => {
    // Fire-and-forget · failures are non-fatal (if cookie set fails
    // the signup still works, user just lands on pick-theme as
    // before).
    const url = `/api/nex-native/select-theme?id=${encodeURIComponent(themeId)}`;
    fetch(url, { method: "POST", credentials: "same-origin" }).catch(() => {
      /* intentionally swallowed */
    });
  }, [themeId]);
  return null;
}
