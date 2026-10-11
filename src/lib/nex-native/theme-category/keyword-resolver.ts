// src/lib/nex-native/theme-category/keyword-resolver.ts
//
// Step 1E (2026-10-11) · founder-authorised keyword rule.
// -------------------------------------------------------
// "If the theme says food it's under category food. Products under
//  products. Services under services. Cakes under Bakery. Bike /
//  car / rentals under Rentals."
//
// This module implements that rule as a PURE helper. It takes free-
// text theme signals (id · name · tagline · one-line concept) and
// returns the registered category id a reasonable reader would file
// the theme under.
//
// Load-bearing rules:
//
//   · Priority order is specific-first. A theme named "chocolate
//     cake shop" matches Bakery (via 'cake') BEFORE Products
//     (via 'shop') and BEFORE Food. Bakery is more specific than
//     either of the siblings.
//   · Haunted keywords are evaluated BEFORE Rentals so a world
//     named "Haunted Hotel" routes to Haunted (via 'haunted')
//     rather than Rentals (via 'hotel'). Added Step 1F · 2026-10-11.
//   · Rentals keywords are evaluated before Services because
//     accommodation / vehicle hire is a rental, not a labour
//     service, per the Step 1D industry mapping.
//   · The resolver NEVER crashes on empty / null signals · it
//     returns null and the caller falls back to EXPLORE_CATEGORY_ID
//     through the sealed `resolveCategoryId` path.
//   · The resolver is a FALLBACK. The adapter uses it only when a
//     ThemePackage does not declare an explicit `identity.categoryId`.
//     Explicit declarations always win so sealed Theme Packages
//     cannot be moved by renaming a tagline.
//   · Case-insensitive, word-boundary-aware so matches don't fire on
//     substring collisions ("services" matching "autoservices" would
//     still work, but "food" cannot match "seafood"-only context
//     without a word boundary · see tests).
//
// This file lives in `src/lib/nex-native/theme-category/` so it
// stays in the core/registry layer where every theme consumer can
// import it without crossing dependency direction.

import {
  EXPLORE_CATEGORY_ID,
  isRegisteredCategory,
} from "./registry";

export interface ThemeKeywordSignals {
  id?: string | null;
  name?: string | null;
  tagline?: string | null;
  conceptOneLine?: string | null;
}

/** Specific-first ruleset. First matching entry wins. */
interface KeywordRule {
  categoryId: string;
  keywords: readonly string[];
}

const RULES: readonly KeywordRule[] = [
  // ─── Haunted · evaluated FIRST so "Haunted Hotel" doesn't fall
  //     into Rentals via 'hotel' (Step 1F · 2026-10-11). ───────────
  {
    categoryId: "haunted",
    keywords: [
      "haunted",
      "ghost",
      "spooky",
      "horror",
      "spirit",
      "phantom",
      "graveyard",
      "witch",
      "cursed",
      "spectre",
      "specter",
      "eerie",
    ],
  },
  // ─── Waterworld · ocean / river / lake / dive worlds · evaluated
  //     after Haunted so "haunted ship" still routes to Haunted,
  //     but before Rentals so a river/surf theme doesn't accidentally
  //     fall into Rentals via a stray keyword. Added Step 1G. ──────
  {
    categoryId: "waterworld",
    keywords: [
      "water",
      "waterworld",
      "ocean",
      "sea",
      "river",
      "lake",
      "dive",
      "reef",
      "coral",
      "aquarium",
      "surf",
      "sail",
      "yacht",
      "boat",
    ],
  },
  // ─── Bakery · more specific than Food · evaluated next ────────────
  {
    categoryId: "bakery",
    keywords: [
      "cake",
      "bakery",
      "baker",
      "bread",
      "pastry",
      "patisserie",
      "croissant",
      "muffin",
      "cupcake",
      "dessert",
      "macaron",
      "donut",
      "doughnut",
    ],
  },
  // ─── Accommodation · evaluated BEFORE Rentals so "Hotel Neo"
  //     routes here rather than Rentals via a stray keyword.
  //     Evaluated AFTER Haunted so "Haunted Hotel" still routes to
  //     Haunted. Added Step 1H. ────────────────────────────────────
  {
    categoryId: "accommodation",
    keywords: [
      "hotel",
      "villa",
      "resort",
      "lodge",
      "guesthouse",
      "homestay",
      "airbnb",
      "bnb",
      "inn",
      "motel",
      "hostel",
      "stay",
    ],
  },
  // ─── Rentals · evaluated after Accommodation (hotel → Accommodation)
  //     but before Services. Scope narrowed in Step 1H to vehicle +
  //     equipment hire. ────────────────────────────────────────────
  {
    categoryId: "rentals",
    keywords: [
      "rental",
      "rent",
      "hire",
      "bike",
      "scooter",
      "moped",
      "motorbike",
      "car",
      "auto",
    ],
  },
  // ─── Food · general-purpose dining / drink / meal ─────────────────
  {
    categoryId: "food",
    keywords: [
      "food",
      "cafe",
      "café",
      "coffee",
      "grill",
      "kitchen",
      "dining",
      "bistro",
      "meal",
      "eat",
      "restaurant",
      "warung",
      "nasi",
    ],
  },
  // ─── Products · retail · shop · catalogue ─────────────────────────
  {
    categoryId: "products",
    keywords: [
      "product",
      "shop",
      "store",
      "retail",
      "boutique",
      "market",
      "goods",
      "merch",
    ],
  },
  // ─── Services · studios · agencies · practitioners ────────────────
  {
    categoryId: "services",
    keywords: [
      "service",
      "studio",
      "salon",
      "agency",
      "workshop",
      "clinic",
      "consulting",
      "spa",
      "barber",
    ],
  },
];

const WORD_BOUNDARY = /[\s\-_.,/]+/;

/** True when `haystack` contains `needle` as a word (bounded by
 *  whitespace, dash, underscore, dot, comma, slash, or string ends).
 *  Case-insensitive. */
function hasWord(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  const parts = haystack
    .toLowerCase()
    .split(WORD_BOUNDARY)
    .filter((p) => p.length > 0);
  const n = needle.toLowerCase();
  return parts.includes(n);
}

/** Return the registered category id best matching the signals, or
 *  null when nothing matched. The caller decides the fallback
 *  (usually EXPLORE_CATEGORY_ID). */
export function inferCategoryIdFromSignals(
  signals: ThemeKeywordSignals,
): string | null {
  const haystack = [
    signals.id,
    signals.name,
    signals.tagline,
    signals.conceptOneLine,
  ]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join(" · ");
  if (!haystack) return null;

  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (hasWord(haystack, keyword)) {
        // Defence-in-depth: a stale rule referencing a retired category
        // must never ship a non-existent id. If the registry lost the
        // category, keep walking the rules instead of crashing.
        if (isRegisteredCategory(rule.categoryId)) {
          return rule.categoryId;
        }
      }
    }
  }
  return null;
}

/** Convenience · same as `inferCategoryIdFromSignals` but applies
 *  the Explore fallback the sealed `resolveCategoryId` would apply. */
export function resolveCategoryIdFromSignals(
  signals: ThemeKeywordSignals,
): string {
  return inferCategoryIdFromSignals(signals) ?? EXPLORE_CATEGORY_ID;
}
