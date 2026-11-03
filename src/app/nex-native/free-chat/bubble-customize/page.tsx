// src/app/nex-native/free-chat/bubble-customize/page.tsx
//
// NEX · Free Chat · bubble-customize server shell.
// Owner-authorised 2026-11-02.
// -----------------------------------------------------------------------------
// Route landed after the user picks a theme on /nex-native/free-chat and
// taps "Keep Theme". Reads the themeId from the query param · falls
// back to the wallpaper cookie if absent · 404s when the theme is not
// resolvable. Server-reads any saved customization + computes theme
// defaults so the client has stable initial state before hydration.

import type * as React from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import {
  FREE_CHAT_THEMES,
  resolveFreeChatWallpaperUrl,
  defaultBubbleCustomizationForTheme,
} from "../_types";
import { readBubbleCustomization } from "../_customize-actions";
import { LIBRARY_THEMES } from "../../chat-themes-library/_catalog";
import { CustomizeClient } from "./_customize-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_WALLPAPER = "nex-free-chat-wallpaper";

interface PageProps {
  readonly searchParams: Promise<{ readonly themeId?: string }>;
}

export default async function BubbleCustomizePage({
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const sp = await searchParams;
  const cookieJar = await cookies();

  // Resolve the themeId · query param wins, cookie fallback, else null.
  let themeId = typeof sp.themeId === "string" ? sp.themeId : null;
  if (!themeId) {
    themeId = cookieJar.get(COOKIE_WALLPAPER)?.value ?? null;
  }
  if (!themeId) {
    // No theme picked yet · send user back to pick one first.
    redirect("/nex-native/free-chat?show-themes=1");
  }

  // Owner directive 2026-11-03 · the Ireland picker now mixes
  // FREE_CHAT_THEMES (nex-default, theme-1..5, ireland-1..5) with daily
  // LIBRARY_THEMES spotlights (library-*, theme-o*). Previously only
  // the FREE_CHAT lookup fired · spotlight picks 404'd. Resolve from
  // either pool · label falls back to the LIBRARY entry.
  const freeTheme = FREE_CHAT_THEMES.find((t) => t.id === themeId);
  const libraryTheme = freeTheme
    ? null
    : LIBRARY_THEMES.find((t) => t.id === themeId);
  if (!freeTheme && !libraryTheme) {
    notFound();
  }

  const wallpaperUrl = resolveFreeChatWallpaperUrl(themeId);
  const defaults = defaultBubbleCustomizationForTheme(themeId);
  const saved = await readBubbleCustomization(themeId);
  const initial = saved ?? defaults;
  // Only the plain `nex-default` tile exposes the Background picker ·
  // every wallpaper tile (free or library) already carries its own backdrop.
  const supportsBackgroundPicker = freeTheme?.isDefault === true;
  const themeLabel = freeTheme?.label ?? libraryTheme?.label ?? "Theme";

  return (
    <CustomizeClient
      themeId={themeId}
      wallpaperUrl={wallpaperUrl}
      themeLabel={themeLabel}
      initial={initial}
      defaults={defaults}
      supportsBackgroundPicker={supportsBackgroundPicker}
    />
  );
}
