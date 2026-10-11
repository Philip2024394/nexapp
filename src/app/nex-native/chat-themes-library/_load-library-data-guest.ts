// src/app/nex-native/chat-themes-library/_load-library-data-guest.ts
//
// Phase 0 · guest-mode theme library loader.
// ------------------------------------------
// Returns the merged theme collection the landing + category showcase
// need to render FOR A GUEST VIEWER. Carries NO account/session data:
//
//   · no tier · no trial · no viewer avatar
//   · no personalisation
//   · no analytics tie-in
//
// The sealed `loadLibraryData()` stays untouched · session-authenticated
// pages continue to call it. The landing page branches on
// resolveNexAppSessionOrGuest() and picks the right loader.

import "server-only";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { listLiveWorldsAsBrowserRows } from "./_live-worlds-adapter";
import type { BrowserThemeRow } from "./_theme-browser-client";
import { EXPLORE_CATEGORY_ID } from "@/lib/nex-native/theme-category/registry";
import { inferCategoryIdFromSignals } from "@/lib/nex-native/theme-category/keyword-resolver";

export interface GuestLibraryData {
  browserThemes: BrowserThemeRow[];
  /** Feature flags · same shape as the sealed authenticated loader so
   *  the landing render reads uniformly from both branches. */
  usePhoneTiles: boolean;
  useImmersivePreview: boolean;
}

export async function loadLibraryDataAsGuest(): Promise<GuestLibraryData> {
  const dbThemes = await chatThemeService.listActiveThemes();
  const liveWorldRows = listLiveWorldsAsBrowserRows();
  const liveWorldIds = new Set(liveWorldRows.map((r) => r.id));
  const dbRowsFiltered = dbThemes.filter((t) => !liveWorldIds.has(t.id));

  const browserThemes: BrowserThemeRow[] = [
    ...liveWorldRows,
    ...dbRowsFiltered.map((t) => ({
      id: t.id,
      name: t.name,
      tagline: t.tagline,
      accent_hex: t.accent_hex,
      bubble_rim_hex: t.bubble_rim_hex,
      composer_rim_hex: t.composer_rim_hex,
      tier: t.tier,
      category: t.category,
      category_id:
        inferCategoryIdFromSignals({ id: t.id, name: t.name, tagline: t.tagline }) ??
        EXPLORE_CATEGORY_ID,
      hero_image_url: t.hero_image_url,
      sort_order: t.sort_order,
      intro_video_url: t.intro_video_url,
      intro_poster_url: t.intro_poster_url,
      wallpaper_config: t.wallpaper_config,
    })),
  ];

  const usePhoneTiles = process.env.NEX_THEMES_PHONE_TILES !== "0";
  const useImmersivePreview =
    process.env.NEX_THEMES_IMMERSIVE_PREVIEW !== "0";

  return {
    browserThemes,
    usePhoneTiles,
    useImmersivePreview,
  };
}
