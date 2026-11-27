// src/app/nex-native/cover/layout-ids.ts
//
// Server-safe list of the 10 sealed cover-layout ids. Kept in a
// plain (no "use client") module so server components can validate
// URL params against it. The layout COMPONENTS live in
// ./layouts.tsx which is "use client" — enumerable exports from a
// client module aren't visible to server components as plain data
// (they become opaque client references), so the id list has to
// live separately.
//
// Founder-sealed 2026-09-30 · ONE NEX IDENTITY doctrine · Bridge 98.

// Founder-sealed 2026-09-30 · only green-ticked templates ship in
// production. 7 unfinished templates (restaurant, tradesperson,
// salon, creator, fashion, street_food, premium_business) removed
// on 2026-09-30 · they will return as new founder-approved layouts
// (or not) but never as the "old, unfinished" set. 10 layouts live.
export const COVER_LAYOUT_IDS = [
  "cafe",
  "cafe_landscape",
  "cafe_round",
  "product",
  "product_landscape",
  "product_round",
  "product_landscape_round",
  "personal_brand",
  "personal_brand_landscape",
  "personal_brand_round",
  // Owner directive 2026-10-20 · Phase 1 Accommodation · the first
  // of three sealed hospitality layouts (default/landscape/round) ·
  // closes the "Accommodation" chooser-card gap for the Indonesian
  // homestay / villa / hotel market. Landscape + round variants
  // follow in a subsequent build.
  "accommodation",
  // Owner directive 2026-11-28 · Template 15 · landscape product cards
  // with a vertical shop-brand strip rendered on the left edge of each
  // row. Same data contract as `product_landscape` + new brandStripUrl
  // content field. Cards bump to 8 per page (vs 6) and the strip paints
  // shop identity on every card so the shop reads as a single branded
  // surface even when the buyer scrolls past the identity badge.
  "product_hero_landscape",
] as const;

export type CoverLayoutId = (typeof COVER_LAYOUT_IDS)[number];

export const COVER_LAYOUT_LABELS: Record<CoverLayoutId, string> = {
  cafe: "Café",
  cafe_landscape: "Café · Landscape",
  cafe_round: "Café · Round Products",
  product: "Product Seller",
  product_landscape: "Product Seller · Landscape",
  product_round: "Product Seller · Round Products",
  product_landscape_round: "Product Seller · Landscape · Round",
  personal_brand: "Personal Brand",
  personal_brand_landscape: "Personal Brand · Landscape",
  personal_brand_round: "Personal Brand · Round Products",
  accommodation: "Accommodation",
  product_hero_landscape: "Product Seller · Hero Landscape",
};

export function isValidCoverLayoutId(id: string | undefined): id is CoverLayoutId {
  return !!id && (COVER_LAYOUT_IDS as readonly string[]).includes(id);
}
