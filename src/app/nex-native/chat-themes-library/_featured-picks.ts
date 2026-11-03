// src/app/nex-native/chat-themes-library/_featured-picks.ts
//
// NEX Space landing · featured-theme + popular-strip resolution.
// -------------------------------------------------------------
// Pure data layer for the redesigned Theme Library landing (Task #34).
// Takes:
//   · the merged theme collection (same shape every library surface
//     already consumes)
//   · the viewer's business category (null for guest or no business)
// Returns:
//   · one "Featured for you" row, chosen to match the viewer's
//     industry so the first-time experience feels personalised
//   · a "Popular" short-list — hand-picked polished themes that look
//     great on first open
//
// Load-bearing rules:
//   · ZERO fabrication · every row returned is from the live collection
//     the loader already produced. If an id in the registry below is
//     missing from the collection (not registered yet), the helper
//     skips it rather than crashing.
//   · Deterministic across guest + session so screenshots and tests
//     stay stable. No randomisation.
//   · The featured pick NEVER overlaps the popular row · if the
//     chosen featured id is in the popular list the popular list
//     drops that id so the two sections stay visually distinct.

import type { BrowserThemeRow } from "./_theme-browser-client";

/** DEPRECATED fallback (kept for test fixtures) · the Popular row
 *  is now driven by `nex_theme_view_counter` via the theme-view
 *  service. This hand-picked list is used ONLY when the counter
 *  table returns zero rows (fresh deployment · nobody has viewed
 *  any theme yet) so the Popular section never renders empty.
 *
 *  The ordering here IS the fallback display order. Only ids that
 *  resolve against the live theme collection paint; missing ids
 *  silently drop so a kill-switch on a theme doesn't crash the row. */
// Owner directive 2026-11-03 · "add all chat themes to the library for
// chat theme simple" · the 97 owner-supplied wallpaper themes
// (theme-o1..theme-o97) seeded by migration 272 are appended to the
// Popular fallback so they appear on the entry landing carousel
// immediately. Once real view counts accumulate in
// nex_theme_view_counter, the organic ordering takes over and this
// fallback stops being read.
const OWNER_O_THEME_IDS: readonly string[] = Array.from(
  { length: 97 },
  (_, i) => `theme-o${i + 1}`,
);

export const POPULAR_THEME_IDS: readonly string[] = [
  "nex-bubbles",
  "nex-flat",
  "coffee",
  "waterworld",
  "food",
  ...OWNER_O_THEME_IDS,
];

/** Map business_category to the theme that best represents it as the
 *  "Featured for you" hero. Unknown / missing / rental-ish industries
 *  fall through to nex-bubbles (NEX brand identity) so the page always
 *  has a dominant featured card. */
const FEATURED_BY_INDUSTRY: Readonly<Record<string, string>> = {
  // Food · the Food world owns the Food category hero.
  food: "food",
  products: "nex-bubbles",
  services: "nex-flat",
  // Accommodation + Property (Step 1H · 2026-10-11): no
  // dedicated accommodation world ships yet · we still feature
  // waterworld because its coastal-resort visual is the closest
  // real asset. Swap to a future accommodation world once one
  // lands in the Accommodation room.
  accommodation: "waterworld",
  property: "waterworld",
};

/** The fallback featured theme when no industry hint is available. */
export const DEFAULT_FEATURED_THEME_ID = "nex-bubbles";

export interface FeaturedPicks {
  /** The dominant "Featured for you" card at the top of the landing.
   *  Null when no theme in the collection resolves · the page should
   *  simply omit the section in that case. */
  featured: BrowserThemeRow | null;
  /** The "Popular" row underneath · never includes the featured id so
   *  the two sections stay distinct. May be empty if the collection
   *  doesn't contain any of the popular ids. */
  popular: BrowserThemeRow[];
  /** Why this card was chosen · drives the small eyebrow label on
   *  the featured card ("Picked for Food", "NEX pick", etc). */
  featuredReason:
    | "industry-match"
    | "nex-default"
    | "none";
}

export interface PickFeaturedInput {
  themes: ReadonlyArray<BrowserThemeRow>;
  businessCategory: string | null;
  /** View-ranked ids from `nex_theme_view_counter` (highest-first).
   *  Pass an empty array to fall back to the sealed POPULAR_THEME_IDS
   *  list · which is what fresh deployments see before any views have
   *  been recorded. Optional for backwards-compat with tests that
   *  predate the view ranker. */
  viewRankedIds?: readonly string[];
}

export function pickFeatured(input: PickFeaturedInput): FeaturedPicks {
  const index = new Map(input.themes.map((t) => [t.id, t]));

  // Step 1 · resolve the featured id.
  let featuredId: string | null = null;
  let reason: FeaturedPicks["featuredReason"] = "none";
  if (input.businessCategory) {
    const candidate = FEATURED_BY_INDUSTRY[input.businessCategory];
    if (candidate && index.has(candidate)) {
      featuredId = candidate;
      reason = "industry-match";
    }
  }
  if (!featuredId && index.has(DEFAULT_FEATURED_THEME_ID)) {
    featuredId = DEFAULT_FEATURED_THEME_ID;
    reason = "nex-default";
  }

  const featured = featuredId ? index.get(featuredId) ?? null : null;

  // Step 2 · build the Popular row. Prefer view-ranked ids when
  // available; fall back to the sealed static list on fresh
  // deployments. Either way, drop the featured id so the two
  // sections never duplicate.
  const sourceIds =
    input.viewRankedIds && input.viewRankedIds.length > 0
      ? input.viewRankedIds
      : POPULAR_THEME_IDS;
  const popular = sourceIds
    .filter((id) => id !== featuredId)
    .map((id) => index.get(id))
    .filter((r): r is BrowserThemeRow => !!r);

  return {
    featured,
    popular,
    featuredReason: featured ? reason : "none",
  };
}
