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

  const theme = FREE_CHAT_THEMES.find((t) => t.id === themeId);
  if (!theme) {
    notFound();
  }

  const wallpaperUrl = resolveFreeChatWallpaperUrl(themeId);
  const defaults = defaultBubbleCustomizationForTheme(themeId);
  const saved = await readBubbleCustomization(themeId);
  const initial = saved ?? defaults;
  // Only the plain `nex-default` tile exposes the Background picker ·
  // every wallpaper tile already carries its own backdrop.
  const supportsBackgroundPicker = theme.isDefault === true;

  return (
    <CustomizeClient
      themeId={themeId}
      wallpaperUrl={wallpaperUrl}
      themeLabel={theme.label}
      initial={initial}
      defaults={defaults}
      supportsBackgroundPicker={supportsBackgroundPicker}
    />
  );
}
