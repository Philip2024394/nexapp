// src/lib/nex-native/theme-category/industry-order.ts
//
// Industry-first category ordering for the Theme Library landing.
// ---------------------------------------------------------------
// When the viewer owns a business, the business's `business_category`
// maps to a Theme Category and that Theme Category moves to the FRONT
// of the landing grid. The other categories keep their sealed order.
//
// Why: the first-time experience doctrine says "if they have their
// business or skill set to a certain industry that industry should
// display first on their theme category list page".
//
// Rules sealed with this helper (2026-10-11):
//   · The registry itself is NOT mutated. `listCategories()` continues
//     to return its deterministic snapshot (sealed by the IA tests).
//     The reorder is a VIEW-time operation applied by the landing
//     page before rendering.
//   · Business category → Theme category mapping (Step 1H · 2026-10-11):
//       food          → food
//       products      → products
//       services      → services
//       accommodation → accommodation (own room since Step 1H)
//       property      → accommodation (real-estate rental is still
//                        a hosting business · the Accommodation room
//                        welcomes it)
//   · Unknown / unset business category → no reorder (keep sealed
//     registration order).
//   · The viewer's business is already resolved by the caller · this
//     module stays a pure function so it can be unit-tested without
//     a DB.

import type { ThemeCategory } from "./types";

/** Map a NEX business_category to the theme category id that
 *  represents it on the Theme Library landing. */
export function themeCategoryIdForBusinessCategory(
  businessCategory: string | null | undefined,
): string | null {
  if (!businessCategory) return null;
  switch (businessCategory) {
    case "food":
      return "food";
    case "products":
      return "products";
    case "services":
      return "services";
    case "accommodation":
    case "property":
      return "accommodation";
    default:
      return null;
  }
}

/** Return a new array with the viewer's industry category moved to
 *  the front. Pure · does not mutate the input. */
export function sortCategoriesByIndustry(
  categories: readonly ThemeCategory[],
  industryThemeCategoryId: string | null,
): ThemeCategory[] {
  if (!industryThemeCategoryId) return [...categories];
  const match = categories.find((c) => c.id === industryThemeCategoryId);
  if (!match) return [...categories];
  const rest = categories.filter((c) => c.id !== industryThemeCategoryId);
  return [match, ...rest];
}
