// src/app/nex-native/chat-themes-library/_live-worlds-adapter.ts
//
// Live-world → Theme-Library adapter · sealed 2026-10-06.
//
// Standard Experience worlds (ocean · coffee · botanical-cafe ·
// midnight-cafe · french-cafe) are code-registered in
// `src/app/nex-native/chat-standard/_live-worlds.ts` as full
// `ThemePackage` objects, NOT in the `nex_chat_theme` DB table.
// Before this adapter they were invisible in the Theme Library because
// the Library's data loader queried only `chatThemeService.listActiveThemes()`.
//
// This adapter maps each registered `ThemePackage` into the shape the
// Library's client expects (`BrowserThemeRow`) so the Library can
// present DB themes AND code-registered live-worlds as ONE collection.
//
// Load-bearing architectural rules:
//
//   · Code remains the authoritative source for Standard Experience
//     worlds. The DB `nex_chat_theme` table is NOT augmented with
//     rows for live-worlds (no migration · no duplication · no drift
//     between code and DB).
//   · The adapter is derivation-only · changes to a world's
//     `ThemePackage` automatically propagate to the Library.
//   · Any future live-world added to `LIVE_WORLD_PACKAGES` appears in
//     the Library automatically · no code change in the Library.
//   · No theme-id branches · the mapping is a pure function of the
//     `ThemePackage` fields.
//   · Universal theme handoff (`themePreviewHref(theme.id)` sealed in
//     4974edc9) applies identically to live-worlds · they resolve to
//     `/nex-native/themes/${theme.id}` like every other theme.

import {
  LIVE_WORLD_IDS,
  LIVE_WORLD_PACKAGES,
  type LiveWorldId,
} from "../chat-standard/_live-worlds";
import {
  NEX_DEFAULT_PALETTE,
  type MiniPhonePalette,
} from "../chat-standard/_engine/preview-mini-phone";
import {
  EXPLORE_CATEGORY_ID,
  isRegisteredCategory,
  resolveCategoryId,
} from "@/lib/nex-native/theme-category/registry";
import { inferCategoryIdFromSignals } from "@/lib/nex-native/theme-category/keyword-resolver";
import type { BrowserThemeRow } from "./_theme-browser-client";

/** Convert a single live-world `ThemePackage` into the shape the
 *  Theme Library's client expects. Pure function · no I/O · derived
 *  entirely from the package. */
export function liveWorldAsBrowserRow(id: LiveWorldId): BrowserThemeRow {
  const pkg = LIVE_WORLD_PACKAGES[id];
  const introVideoUrl =
    pkg.intro && pkg.intro.kind === "standard" ? pkg.intro.videoUrl : null;
  return {
    id: pkg.identity.id,
    name: pkg.identity.name,
    tagline: pkg.identity.tagline ?? null,
    accent_hex: pkg.colours.primary,
    // Prefer the engine's secondary/highlight as the bubble/composer
    // rim so themes with a distinct secondary pop a little · fall back
    // to the primary for themes where the two match.
    bubble_rim_hex: pkg.colours.secondary ?? pkg.colours.primary,
    composer_rim_hex: pkg.colours.highlight ?? pkg.colours.primary,
    // Standard Experience worlds are core NEX capability · free for
    // every account. Never gated behind the Bisnis premium tier.
    tier: "gratis",
    category: "standard",
    // Step 1A (sealed 2026-10-06) · visual-family / showcase membership
    // derived from the ThemePackage. `resolveCategoryId` guarantees we
    // always emit a valid registered category id · typos default to
    // "explore" and are caught at CI by the registry test suite.
    //
    // Step 1E (2026-10-11) · keyword-rule FALLBACK · when a package
    // declares no categoryId OR declares the universal "explore"
    // bucket, run the sealed keyword resolver against the package's
    // id / name / tagline / conceptOneLine. If it finds a specific
    // match (cake → Bakery · bike → Rentals · etc) we promote the
    // row into that room. Explicit non-explore declarations always
    // win so sealed packages don't shift under us.
    category_id: resolveCategoryIdForPackage(pkg),
    hero_image_url: pkg.wallpaperUrl ?? null,
    // Sort live-worlds before DB themes · DB themes typically carry
    // positive sort_order values · a negative value puts live-worlds
    // ahead of them deterministically without having to reach into
    // the DB to inspect.
    sort_order: -1,
    intro_video_url: introVideoUrl,
    intro_poster_url: null,
    wallpaper_config: null,
    // Sealed 2026-10-11 · live-worlds hand the preview layer the FULL
    // ColourSystem the engine resolves. This is the byte-level ground
    // truth · a mini-phone with this palette paints identical bubbles
    // / composer / send button to the live chat.
    palette: paletteFromPackageColours(pkg.colours),
    // Final Parity Pass 2026-10-11 · hand the ambient family list
    // from the ThemePackage to the preview layer so each mini-phone
    // paints a static representation of its live ambient identity.
    ambient_families: pkg.ambient?.families
      ? ([...pkg.ambient.families] as readonly string[])
      : null,
    // Final Parity Pass 2026-10-11 · hand the bubble material from
    // the ThemePackage to the preview layer so each mini-phone
    // paints bubbles using the SAME engine formula the live chat
    // uses (solid for nex-flat, neon-glass for midnight-cafe, etc).
    bubble_material: pkg.bubbles?.material ?? "glass",
  };
}

function paletteFromPackageColours(
  colours: (typeof LIVE_WORLD_PACKAGES)[LiveWorldId]["colours"],
): MiniPhonePalette {
  return {
    primary: colours.primary ?? NEX_DEFAULT_PALETTE.primary,
    secondary: colours.secondary ?? NEX_DEFAULT_PALETTE.secondary,
    highlight: colours.highlight ?? NEX_DEFAULT_PALETTE.highlight,
    glow: colours.glow ?? `${colours.primary ?? NEX_DEFAULT_PALETTE.primary}55`,
    deep: colours.deep ?? NEX_DEFAULT_PALETTE.deep,
  };
}

/** List every registered Standard Experience world as a
 *  `BrowserThemeRow`. The Theme Library page merges this list with
 *  the DB-sourced themes. Order follows `LIVE_WORLD_IDS` in
 *  `_live-worlds.ts`. */
export function listLiveWorldsAsBrowserRows(): BrowserThemeRow[] {
  return LIVE_WORLD_IDS.map((id) => liveWorldAsBrowserRow(id));
}

/** Step 1E resolver · explicit declaration wins when it points at a
 *  REAL (non-explore) category; otherwise the keyword rule infers. */
function resolveCategoryIdForPackage(
  pkg: (typeof LIVE_WORLD_PACKAGES)[LiveWorldId],
): string {
  const declared = pkg.identity.categoryId;
  if (
    declared &&
    isRegisteredCategory(declared) &&
    declared !== EXPLORE_CATEGORY_ID
  ) {
    return declared;
  }
  const inferred = inferCategoryIdFromSignals({
    id: pkg.identity.id,
    name: pkg.identity.name,
    tagline: pkg.identity.tagline,
    conceptOneLine: pkg.identity.conceptOneLine,
  });
  if (inferred) return inferred;
  return resolveCategoryId(declared);
}
