// src/lib/nex-native/directory/landing-category-mapping.ts
//
// NEX Directory · landing-slug → NEX_BUSINESS_CATEGORIES mapping
// --------------------------------------------------------------------
// Owner-approved Phase A, 2026-10-16.
//
// The landing page exposes eight thematic tiles (Products, Services,
// Stay, Food, Travel, Transport, Events, Deals) that are URL-level
// facets. The underlying data model stores each business under one
// `business_category` enum value drawn from
// `NEX_BUSINESS_CATEGORIES` in `src/lib/nex-native/site-templates.ts`.
//
// This file is the SINGLE SOURCE OF TRUTH for which landing slug
// resolves to which concrete category list. Rules the owner locked
// in during the Phase A approval:
//
//   · Code-only mapping · NO database column, NO migration.
//   · Explicit only · unsupported slugs resolve to an EMPTY list and
//     the directory returns an honest empty state. We NEVER return
//     unrelated results to pad a tile.
//   · Decoupled slug ↔ label · tile labels can change in the landing
//     UI without breaking URL contracts (e.g., "Accommodation" became
//     "Stay" without changing the `accommodation` slug).
//   · Dual labels accepted · the dash-cased landing slugs
//     (`food-drink`, `accommodation`) and the short alias they display
//     on the tile (`food`, `stay`) BOTH resolve to the same list so
//     either flavour in a URL works identically.
//
// Known gaps the owner acknowledged (NOT silently filled here):
//
//   · G1 · "Stay" has no accommodation upload surface yet · the only
//     eligible rows come from the canonical / harvester source via its
//     vertical `nex.accommodation_business` table. The nex_business
//     source has no `accommodation` category enum value, so this
//     mapping returns an empty category list for the `nex_business`
//     side · the feed service recognises the slug and consults the
//     canonical adapter instead.
//
//   · G4 · "Travel", "Transport" and "Deals" are presentation facets
//     with no matching category today. They map to the empty list and
//     the directory returns an honest empty state. These three slugs
//     require either (a) new category values in NEX_BUSINESS_CATEGORIES
//     (migration · deferred) or (b) a different data model (e.g. a
//     `discount` column for Deals · also deferred).
//
// This module is pure · no database access, no server-only imports,
// no side effects. Safe to import from client or server.

import {
  NEX_BUSINESS_CATEGORIES,
  type NexBusinessCategory,
} from "@/lib/nex-native/site-templates";

/** The eight slug values the landing tiles emit, PLUS the two shorter
 *  tile-label aliases ("stay", "food", "events") that resolve to the
 *  same category sets. "Stay" and "accommodation" are twins. "Food"
 *  and "food-drink" are twins. "Events" and "experiences" are twins. */
export type LandingCategorySlug =
  | "products"
  | "services"
  | "accommodation"
  | "stay"
  | "food-drink"
  | "food"
  | "travel"
  | "transport"
  | "experiences"
  | "events"
  | "deals";

/** Supported slugs that resolve to at least one `nex_business`
 *  category. Used by the landing-feed-service to decide whether to
 *  consult the `nex_business` source at all for a given tile. */
export type SupportedLandingSlug =
  | "products"
  | "services"
  | "food-drink"
  | "food"
  | "experiences"
  | "events";

/** Narrower sibling that only lists slugs with a canonical-side
 *  mapping (currently: accommodation / stay via the vertical table).
 *  "accommodation" is honoured here even though it has no
 *  `business_category` enum match, because the canonical layer has a
 *  dedicated vertical. */
export type CanonicalOnlyLandingSlug = "accommodation" | "stay";

const PRODUCTS: readonly NexBusinessCategory[] = [
  "ecommerce",
  "product-brand",
];

const SERVICES: readonly NexBusinessCategory[] = [
  "tradesperson",
  "construction",
  "staircase-company",
  "salon",
  "beauty",
  "fitness",
  "consultant",
  "agency",
  "local-service",
  "professional-service",
];

const FOOD: readonly NexBusinessCategory[] = [
  "bakery",
  "restaurant",
  "cafe",
  "ice-cream",
  "dessert-shop",
  "drinks-shop",
  "juice-bar",
];

const EVENTS: readonly NexBusinessCategory[] = ["event", "community"];

/** Core lookup · exported for tests + for the directory consumer.
 *  Unsupported slugs are present with an EXPLICITLY empty array so
 *  the typesystem catches a missing slug addition and the runtime
 *  honestly returns empty rather than falling back to unrelated
 *  categories. */
export const LANDING_SLUG_TO_CATEGORIES: Readonly<
  Record<LandingCategorySlug, readonly NexBusinessCategory[]>
> = Object.freeze({
  products: PRODUCTS,
  services: SERVICES,
  "food-drink": FOOD,
  food: FOOD, // alias of food-drink
  experiences: EVENTS,
  events: EVENTS, // alias of experiences

  // Canonical-only · no nex_business category match today (see G1).
  accommodation: [],
  stay: [],

  // Unsupported · owner-acknowledged gaps (G4). Honest empty rather
  // than mapping to unrelated categories.
  travel: [],
  transport: [],
  deals: [],
});

/** Lightweight validator · returns true iff the input string is one
 *  of the recognised landing slugs. Used by the directory page to
 *  reject arbitrary ?category= values without exposing a 500. */
export function isLandingCategorySlug(
  input: unknown,
): input is LandingCategorySlug {
  if (typeof input !== "string") return false;
  return (
    input in LANDING_SLUG_TO_CATEGORIES ||
    (LANDING_SLUG_TO_CATEGORIES as Record<string, unknown>)[input] !==
      undefined
  );
}

/** Returns the categories a landing slug resolves to, or an empty
 *  readonly array for unsupported / unknown slugs. Pure function. */
export function resolveLandingSlugToCategories(
  slug: string | null | undefined,
): readonly NexBusinessCategory[] {
  if (!slug) return [];
  if (!isLandingCategorySlug(slug)) return [];
  return LANDING_SLUG_TO_CATEGORIES[slug];
}

/** Returns true iff the slug has at least one `nex_business`
 *  category mapping · false for canonical-only slugs (stay /
 *  accommodation) and for the unsupported slugs. */
export function slugHasNexBusinessCoverage(
  slug: string | null | undefined,
): boolean {
  return resolveLandingSlugToCategories(slug).length > 0;
}

/** Returns true iff the slug is honoured by the canonical layer via
 *  its dedicated vertical tables (e.g. `nex.accommodation_business`).
 *  Pure · no DB access · the feed service uses this to decide which
 *  adapter path to call. */
export function slugHasCanonicalVerticalCoverage(
  slug: string | null | undefined,
): boolean {
  if (!slug) return false;
  return slug === "accommodation" || slug === "stay";
}

/** Owner-approved diagnostic · returns every landing slug paired with
 *  its current coverage status. The HQ dashboard can surface this so
 *  the owner sees at a glance which tiles are "fully wired", which
 *  are "canonical-only" and which are honest-empty gaps. */
export interface LandingSlugCoverageReport {
  readonly slug: LandingCategorySlug;
  readonly nexBusinessCategoryCount: number;
  readonly hasCanonicalVertical: boolean;
  readonly status: "wired" | "canonical_only" | "gap";
}

export function reportLandingSlugCoverage(): readonly LandingSlugCoverageReport[] {
  const slugs = Object.keys(
    LANDING_SLUG_TO_CATEGORIES,
  ) as readonly LandingCategorySlug[];
  return slugs.map((slug) => {
    const n = resolveLandingSlugToCategories(slug).length;
    const canon = slugHasCanonicalVerticalCoverage(slug);
    const status: LandingSlugCoverageReport["status"] =
      n > 0 ? "wired" : canon ? "canonical_only" : "gap";
    return {
      slug,
      nexBusinessCategoryCount: n,
      hasCanonicalVertical: canon,
      status,
    };
  });
}

// ────────────────────────────────────────────────────────────────────
// Phase A card-design visuals · owner-approved card template 2026-10-16.
//
// `card design.png` showed per-category colour + icon in the bottom
// row of every ListingCard. These visuals must match the landing tile
// grid for the same category so a visitor sees "Products = orange
// cart" everywhere — tile, card, future UI.
//
// Each entry pins:
//   · `accent`  · the neon hex colour used by both the icon glow and
//     the category label text.
//   · `iconCol` / `iconRow` · coordinates on the sealed
//     `/nex-directory/icons/category-grid.png` sprite (4 cols × 2 rows).
//
// A category id that does not fall into any of the known groups
// falls back to a neutral cyan default (`DEFAULT_CATEGORY_VISUALS`).
// Pure code · no runtime lookup table on the DB. ────────────────────

export interface CategoryVisuals {
  readonly accent: string;
  readonly iconCol: 0 | 1 | 2 | 3;
  readonly iconRow: 0 | 1;
  /** Short human label used by the card footer. Mirrors the group
   *  labels on the landing tiles (`Products`, `Food`, `Stay`, …). */
  readonly label: string;
}

export const DEFAULT_CATEGORY_VISUALS: CategoryVisuals = {
  accent: "#00AFFF", // neutral neon cyan
  iconCol: 1,
  iconRow: 0, // wrench · services glyph as the generic fallback
  label: "Listings",
};

/** Pins each `NEX_BUSINESS_CATEGORIES` enum value to the landing-tile
 *  group it visually belongs to. Mirror of `LANDING_SLUG_TO_CATEGORIES`
 *  with the orientation reversed. */
const CATEGORY_ID_TO_VISUALS: Readonly<
  Record<NexBusinessCategory, CategoryVisuals>
> = Object.freeze({
  // Products group · cart glyph · orange ────────────────────────────
  ecommerce:       { accent: "#FF8A2A", iconCol: 0, iconRow: 0, label: "Products" },
  "product-brand": { accent: "#FF8A2A", iconCol: 0, iconRow: 0, label: "Products" },

  // Services group · wrench glyph · cyan ────────────────────────────
  tradesperson:          { accent: "#00AFFF", iconCol: 1, iconRow: 0, label: "Services" },
  construction:          { accent: "#00AFFF", iconCol: 1, iconRow: 0, label: "Services" },
  "staircase-company":   { accent: "#00AFFF", iconCol: 1, iconRow: 0, label: "Services" },
  salon:                 { accent: "#00AFFF", iconCol: 1, iconRow: 0, label: "Services" },
  beauty:                { accent: "#00AFFF", iconCol: 1, iconRow: 0, label: "Services" },
  fitness:               { accent: "#00AFFF", iconCol: 1, iconRow: 0, label: "Services" },
  consultant:            { accent: "#00AFFF", iconCol: 1, iconRow: 0, label: "Services" },
  agency:                { accent: "#00AFFF", iconCol: 1, iconRow: 0, label: "Services" },
  "local-service":       { accent: "#00AFFF", iconCol: 1, iconRow: 0, label: "Services" },
  "professional-service":{ accent: "#00AFFF", iconCol: 1, iconRow: 0, label: "Services" },

  // Food group · fork + knife glyph · green ─────────────────────────
  bakery:        { accent: "#4DD17A", iconCol: 3, iconRow: 0, label: "Food" },
  restaurant:    { accent: "#4DD17A", iconCol: 3, iconRow: 0, label: "Food" },
  cafe:          { accent: "#4DD17A", iconCol: 3, iconRow: 0, label: "Food" },
  "ice-cream":   { accent: "#4DD17A", iconCol: 3, iconRow: 0, label: "Food" },
  "dessert-shop":{ accent: "#4DD17A", iconCol: 3, iconRow: 0, label: "Food" },
  "drinks-shop": { accent: "#4DD17A", iconCol: 3, iconRow: 0, label: "Food" },
  "juice-bar":   { accent: "#4DD17A", iconCol: 3, iconRow: 0, label: "Food" },

  // Events group · ticket glyph · pink ──────────────────────────────
  event:     { accent: "#FF5EB4", iconCol: 2, iconRow: 1, label: "Events" },
  community: { accent: "#FF5EB4", iconCol: 2, iconRow: 1, label: "Events" },

  // Portfolio / creator · wrench fallback for now (G4) ──────────────
  portfolio: { ...DEFAULT_CATEGORY_VISUALS, label: "Portfolio" },
  creator:   { ...DEFAULT_CATEGORY_VISUALS, label: "Creator" },
});

/** Resolve the per-category visuals for the card footer. Falls back
 *  to the neutral default when the category id is unrecognised or
 *  null · never throws · never fabricates a mismatched colour. */
export function visualsForCategoryId(
  id: string | null | undefined,
): CategoryVisuals {
  if (!id) return DEFAULT_CATEGORY_VISUALS;
  const key = id as NexBusinessCategory;
  const hit = (CATEGORY_ID_TO_VISUALS as Record<string, CategoryVisuals | undefined>)[key];
  return hit ?? DEFAULT_CATEGORY_VISUALS;
}

/** Convenience · special-case the canonical layer's `entity_type`
 *  values which draw from a different vocabulary (`business` /
 *  `person` / `place` · NOT `NEX_BUSINESS_CATEGORIES`). Pins them
 *  all to the neutral default so canonical rows render with a
 *  consistent footer regardless of their classification axis. */
export function visualsForCanonicalEntityType(
  entityType: string | null | undefined,
): CategoryVisuals {
  if (!entityType) return DEFAULT_CATEGORY_VISUALS;
  // Explicit map to catch future entity-type expansion safely.
  switch (entityType) {
    case "business":
    case "person":
    case "place":
    default:
      return DEFAULT_CATEGORY_VISUALS;
  }
}

// Re-export for consumers that want to type-check against the enum
// without importing site-templates directly.
export { NEX_BUSINESS_CATEGORIES };
export type { NexBusinessCategory };
