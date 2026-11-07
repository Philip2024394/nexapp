// src/lib/nex-native/business/subtypes.ts
//
// NEX Business Experience · 30 subtypes under 5 categories.
// Rev 6 FROZEN · 2026-10-02.
//
// A subtype is a RECOMMENDATION context, not a permission boundary. It
// drives the starting values of capability + content recommendations and
// the terminology defaults. The owner can override anything, enable any
// content type from the universal catalog, and toggle any implemented
// capability regardless of subtype.
//
// Deeper specialisation within a subtype (nail artist vs hairdresser, plumber
// vs electrician) is OWNER-AUTHORED, not another subtype level. The subtype
// tree is kept intentionally flat to stop a 300-subtype slide.

import type {
  AccommodationSubtype,
  BusinessCategory,
  BusinessSubtype,
  FoodSubtype,
  ProductsSubtype,
  PropertySubtype,
  ServicesSubtype,
} from "./types";

export const FOOD_SUBTYPES: readonly FoodSubtype[] = [
  "restaurant",
  "cafe",
  "bakery",
  "food_maker",
  "catering",
  "drinks",
  "food_delivery",
  // Phase B restoration 2026-11-07 · see types.ts FoodSubtype.
  "ice_cream",
  "dessert_shop",
  "juice_bar",
] as const;

export const ACCOMMODATION_SUBTYPES: readonly AccommodationSubtype[] = [
  "hotel",
  "villa",
  "guesthouse",
  "homestay",
  "resort",
  "short_rental",
  // Phase A1 addition · owner-authorised 2026-10-20 · see AccommodationSubtype
  // in types.ts for the rationale (additive extension of the 2026-10-02 freeze).
  "kost",
] as const;

export const PROPERTY_SUBTYPES: readonly PropertySubtype[] = [
  "for_sale",
  "for_rent",
  "developer",
  "agent",
] as const;

export const PRODUCTS_SUBTYPES: readonly ProductsSubtype[] = [
  "retail",
  "manufacturer",
  "wholesale",
  "local_artisan",
  "exporter",
  "motorbike_shop",
  // Phase B restoration 2026-11-07 · see types.ts ProductsSubtype.
  "ecommerce",
  "product_brand",
] as const;

export const SERVICES_SUBTYPES: readonly ServicesSubtype[] = [
  "beauty",
  "health_wellness",
  "home_services",
  "professional",
  "trade_construction",
  "automotive",
  "events",
  "creative",
  // Phase B restoration 2026-11-07 · see types.ts ServicesSubtype.
  "salon",
  "fitness",
  "tradesperson",
  "construction",
  "staircase_company",
  "consultant",
  "agency",
  "portfolio",
  "creator",
  "community",
] as const;

export const BUSINESS_SUBTYPES: readonly BusinessSubtype[] = [
  ...FOOD_SUBTYPES,
  ...ACCOMMODATION_SUBTYPES,
  ...PROPERTY_SUBTYPES,
  ...PRODUCTS_SUBTYPES,
  ...SERVICES_SUBTYPES,
] as const;

export const BUSINESS_SUBTYPE_CATEGORY: Record<BusinessSubtype, BusinessCategory> = {
  // Food
  restaurant:         "food",
  cafe:               "food",
  bakery:             "food",
  food_maker:         "food",
  catering:           "food",
  drinks:             "food",
  food_delivery:      "food",
  // Food · Phase B restoration 2026-11-07
  ice_cream:          "food",
  dessert_shop:       "food",
  juice_bar:          "food",
  // Accommodation
  hotel:              "accommodation",
  villa:              "accommodation",
  guesthouse:         "accommodation",
  homestay:           "accommodation",
  resort:             "accommodation",
  short_rental:       "accommodation",
  kost:               "accommodation",
  // Property
  for_sale:           "property",
  for_rent:           "property",
  developer:          "property",
  agent:              "property",
  // Products
  retail:             "products",
  manufacturer:       "products",
  wholesale:          "products",
  local_artisan:      "products",
  exporter:           "products",
  motorbike_shop:     "products",
  // Products · Phase B restoration 2026-11-07
  ecommerce:          "products",
  product_brand:      "products",
  // Services
  beauty:             "services",
  health_wellness:    "services",
  home_services:      "services",
  professional:       "services",
  trade_construction: "services",
  automotive:         "services",
  events:             "services",
  creative:           "services",
  // Services · Phase B restoration 2026-11-07
  salon:              "services",
  fitness:            "services",
  tradesperson:       "services",
  construction:       "services",
  staircase_company:  "services",
  consultant:         "services",
  agency:             "services",
  portfolio:          "services",
  creator:            "services",
  community:          "services",
};

// Owner directive 2026-11-07 · "specific ahead of generic". Labels
// below are the display strings the picker + summary surfaces show.
// The 5 generic buckets (food_maker · health_wellness · trade_construction
// · creative · retail) now read as "Other …" so the specific restorations
// (ice_cream, salon, tradesperson, portfolio, ecommerce, …) win when a
// seller is scanning the list. Backward compat: slugs never change.
export const BUSINESS_SUBTYPE_LABEL: Record<BusinessSubtype, string> = {
  restaurant:         "Restaurant",
  cafe:               "Café",
  bakery:             "Bakery",
  food_maker:         "Other food business",
  catering:           "Catering",
  drinks:             "Drinks shop",
  food_delivery:      "Food delivery",
  ice_cream:          "Ice-cream shop",
  dessert_shop:       "Dessert shop",
  juice_bar:          "Juice bar",
  hotel:              "Hotel",
  villa:              "Villa",
  guesthouse:         "Guesthouse",
  homestay:           "Homestay",
  resort:             "Resort",
  short_rental:       "Short rental",
  kost:               "Kost (Boarding)",
  for_sale:           "Property for sale",
  for_rent:           "Property for rent",
  developer:          "Property developer",
  agent:              "Property agent",
  retail:             "Other product business",
  manufacturer:       "Manufacturer",
  wholesale:          "Wholesaler",
  local_artisan:      "Local artisan",
  exporter:           "Exporter",
  motorbike_shop:     "Motorbike shop",
  ecommerce:          "Online retailer (ecommerce)",
  product_brand:      "Product brand",
  beauty:             "Beauty",
  health_wellness:    "Health & wellness",
  home_services:      "Home services",
  professional:       "Professional services",
  trade_construction: "Other trade / construction",
  automotive:         "Automotive",
  events:             "Events",
  creative:           "Other creative service",
  salon:              "Hair salon / barber",
  fitness:            "Fitness · gym · training",
  tradesperson:       "Tradesperson",
  construction:       "Construction / builder",
  staircase_company:  "Staircase company",
  consultant:         "Consultant",
  agency:             "Agency",
  portfolio:          "Portfolio / artist",
  creator:            "Content creator",
  community:          "Community organisation",
};

/** Owner-sealed 2026-11-07 · per-category "Other …" fallback strategy.
 *
 *  Food · Products · Services each have an existing generic subtype
 *  that's now relabeled "Other …" above (food_maker · retail · creative).
 *  A seller picking one of those is honestly classified as "other" in
 *  that family and the shop still flows through Directory / SEO like
 *  any other row.
 *
 *  Accommodation · Property have NO generic subtype in the approved
 *  Rev 6 registry (owner approved 15 specific additions · did not
 *  authorise a `_other` slug for these two). The picker surfaces an
 *  "Other …" row for all five categories, and the Accommodation /
 *  Property Other rows open the request-a-category flow instead of
 *  saving a profile. This satisfies the "no legitimate business left
 *  without a category" directive without mutating frozen doctrine.
 */
export const OTHER_BUSINESS_FALLBACK_SUBTYPE: Partial<Record<BusinessCategory, BusinessSubtype>> = {
  food:     "food_maker",
  products: "retail",
  services: "creative",
};

/** Categories whose "Other …" row opens the category-request flow
 *  instead of saving a subtype. The picker reads this to decide
 *  whether an "Other X" selection is a direct save or a redirect. */
export const CATEGORIES_WITHOUT_OTHER_SUBTYPE: readonly BusinessCategory[] = [
  "accommodation",
  "property",
];

export function isBusinessSubtype(value: string | null | undefined): value is BusinessSubtype {
  return !!value && (BUSINESS_SUBTYPES as readonly string[]).includes(value);
}

export function subtypesByCategory(category: BusinessCategory): readonly BusinessSubtype[] {
  switch (category) {
    case "food":          return FOOD_SUBTYPES;
    case "accommodation": return ACCOMMODATION_SUBTYPES;
    case "property":      return PROPERTY_SUBTYPES;
    case "products":      return PRODUCTS_SUBTYPES;
    case "services":      return SERVICES_SUBTYPES;
  }
}
