// src/lib/nex-native/directory/mock-seed-listings.ts
//
// NEX Directory · 2 owner-authorised mock preview listings · sealed
// 2026-10-16.
// --------------------------------------------------------------------
// Owner asked for 2 mock seed cards on the Search Directory page so
// the design preview has something to render while the real feed is
// still being wired. These are explicitly, LOUDLY labelled as
// `source: "mock_seed"` so the shared `ListingCard` renders them with
// a visually distinct orange "SAMPLE" chip (instead of the "Owner" or
// "Directory" chip used for production rows). A visitor can never
// confuse these with real listings.
//
// Hard rules this file enforces:
//
//   1. ISOLATION · all mock data lives in this one file. Zero
//      references to pricing / promotional literals leak into
//      production source paths. Removing this file removes the mocks.
//
//   2. HONEST LABELLING · every mock carries `source: "mock_seed"`.
//      The ListingCard tags them "SAMPLE" (orange) in place of the
//      Owner/Directory chip.
//
//   3. NO DATABASE WRITES · these are pure in-memory ViewModel
//      instances. Nothing in this module touches `nex_business`,
//      `nex.business_canonical`, or any migration.
//
//   4. OPT-IN SURFACING · callers consume `getMockSeedListings()`
//      explicitly. The sealed `landing-feed-service` does NOT emit
//      mocks · it ONLY returns rows from the real sources.
//
//   5. SCOPED TO THE DIRECTORY PREVIEW · the Featured Deals row on
//      the LANDING page does NOT consume mocks. Only the Search
//      Directory page consumes them, and only when it needs to.
//
// When the real feed carries ≥N eligible rows, the directory page
// should prefer those over the mocks and only fall back to mocks for
// an honest preview state. The caller controls the mix.

import type { ListingCardViewModel } from "./landing-feed-service";

/** Owner-authorised preview listings · 2 cards · one Products / one
 *  Accommodation. Both mocks are visibly tagged "SAMPLE" by the shared
 *  ListingCard · a visitor can never confuse them with real listings.
 *
 *  Phase A patch 2026-10-16 · the fake `priceWas` + `discountLabel`
 *  were dropped per owner rule "do not imply a discount without
 *  genuine supporting data". Prices are now shown as single
 *  authoritative seller-currency lines with the seller country flag
 *  (ID · Indonesia · the Phase A preview locale). */
const MOCK_SEEDS: ReadonlyArray<ListingCardViewModel> = Object.freeze([
  Object.freeze({
    id: "mock-seed-earbuds-1",
    slug: "sample-wireless-earbuds",
    // Owner directive 2026-10-18 (iteration) · `title` is the ONE
    // name shown on the card in the muted uppercase treatment. CSS
    // handles the uppercase · the mock stores the natural-case
    // string so screen-readers get a readable name.
    title: "Noise-Cancelling Pro",
    description: "Crystal clear sound. All day comfort.",
    featuredOffering: null,
    // Owner directive 2026-10-18 · location row (city then country
    // fallback) · mocks populate `city` so the row renders.
    city: "Jakarta",
    categoryLabel: "Products",
    categoryId: "ecommerce",
    categoryAccent: "#FF8A2A",
    categoryIconCol: 0 as const,
    categoryIconRow: 0 as const,
    imageUrl: null, // honest no-image · ListingCard renders the monogram
    href: "/nex-native/directory", // mock card does not navigate off-site
    source: "mock_seed" as const,
    priceNow: "Rp 950,000",
    priceWas: null,
    discountLabel: null,
    // Owner directive 2026-10-18 · Slice 2 · structured price so
    // the FX pipeline can convert 950,000 IDR into the viewer's
    // picked currency. 950,000 IDR × 100 minor-units-per-major =
    // 95,000,000 minor units (per sealed currencies.ts scale).
    priceAmountMinor: 95_000_000,
    priceCurrency: "IDR",
    sellerCountryIso: "ID",
    buyerLocalPrice: null,
  }),
  Object.freeze({
    id: "mock-seed-resort-1",
    slug: "sample-luxury-beach-resort",
    // Owner directive 2026-10-18 (iteration) · title is the room /
    // offering name directly.
    title: "Ocean-View Villa · King Bed",
    description: "Relax, unwind, enjoy.",
    featuredOffering: null,
    city: "Seminyak, Bali",
    categoryLabel: "Accommodation",
    categoryId: "accommodation",
    categoryAccent: "#B566FF",
    categoryIconCol: 2 as const,
    categoryIconRow: 0 as const,
    imageUrl: null,
    href: "/nex-native/directory",
    source: "mock_seed" as const,
    priceNow: "Rp 4,750,000",
    priceWas: null,
    discountLabel: null,
    // Owner directive 2026-10-18 · Slice 2 · 4,750,000 IDR × 100 =
    // 475,000,000 minor units.
    priceAmountMinor: 475_000_000,
    priceCurrency: "IDR",
    sellerCountryIso: "ID",
    buyerLocalPrice: null,
  }),
] as const);

/** Returns the full set of owner-authorised mock listings. Pure ·
 *  no side effects · identical shape to real feed cards so the
 *  shared ListingCard renders them without special casing. */
export function getMockSeedListings(): readonly ListingCardViewModel[] {
  return MOCK_SEEDS;
}

/** Exactly 2 mocks today · exported as a constant so tests can
 *  anchor the owner-approved count. */
export const MOCK_SEED_COUNT = 2 as const;

/** True iff the ViewModel is one of the owner-authorised mocks. Used
 *  by the ListingCard for the "SAMPLE" chip and by the directory
 *  page if it wants to render a page-level banner. */
export function isMockSeedListing(
  listing: ListingCardViewModel,
): boolean {
  return listing.source === "mock_seed";
}
