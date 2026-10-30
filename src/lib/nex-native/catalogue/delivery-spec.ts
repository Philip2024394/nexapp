// src/lib/nex-native/catalogue/delivery-spec.ts
//
// Delivery substrate · owner-authorised 2026-10-30 (initial) +
// 2026-10-31 (SIMPLIFIED per owner directive).
//
// Owner directive 2026-10-31 verbatim:
//   "deleivery price should be drop down with all country when user
//    select a country they add price and kg weight and press save .
//    local deleivery select km distance drop down and set price and
//    save and it saves that price from where the owner location is
//    set .which we have on the app when enter set location for all
//    user"
//
// Simplified shape:
//
//   LOCAL = list of radius entries. Each row is one km radius ring
//   (5 / 10 / 15 / 20 / 25 / 30 / 50 / 100) with a price. The ring
//   is anchored from `nex_business.location_lat/lng` (set by the
//   seller via /nex-native/manage/shop · migration 082).
//
//   EXPORT = list of country entries. Each row is one country (ISO
//   alpha-2) with a price and the parcel weight in kilograms.
//
// What this simplification REPLACES: the previous spec held zone
// labels, cities, areas, dispatch days, delivery day ranges, COD
// toggles, pickup toggles, min-order values, free-delivery
// thresholds, packaging notes, HS codes, country-of-origin, etc.
// All of that is DROPPED in favour of the simpler model the owner
// specified. Future expansions can add fields; this file is the
// single source of truth today.
//
// Legacy data note: products created against the previous Zod shape
// (`spec.__delivery.local.zones[]` etc.) will fail safeParse against
// the new schema below. extractDelivery() returns null for those
// rows · the Edit form shows the delivery section as empty. On save
// the new simpler shape overwrites the legacy block.
//
// Storage: nex_product.spec.__delivery jsonb · no migration.

import { z } from "zod";

const ISO_CURRENCY = z.string().regex(/^[A-Z]{3}$/, "ISO 4217 currency");
const ISO_COUNTRY  = z.string().regex(/^[A-Z]{2}$/, "ISO 3166-1 alpha-2");

/** Local-radius ring anchored from the seller's set location
 *  (nex_business.location_lat/lng). */
export const LocalRadiusEntry = z.object({
  km: z.number().int().positive().max(1000),
  price_pence: z.number().int().nonnegative(),
  currency: ISO_CURRENCY,
  /** Owner-authorised 2026-10-31 · delivery estimate in days.
   *  Seller-declared, applies to this radius ring. */
  delivery_days: z.number().int().positive().max(365).optional(),
});

export const LocalDeliverySpec = z.object({
  radii: z.array(LocalRadiusEntry).max(20),
});

/** Export destination · country + shipping price + delivery days.
 *  Package weight + dimensions live once per product in
 *  DeliverySpec.package. */
export const ExportCountryEntry = z.object({
  iso: ISO_COUNTRY,
  price_pence: z.number().int().nonnegative(),
  currency: ISO_CURRENCY,
  /** Owner-authorised 2026-10-31 · delivery estimate in days. */
  delivery_days: z.number().int().positive().max(365).optional(),
});

export const ExportDeliverySpec = z.object({
  countries: z.array(ExportCountryEntry).max(250),
});

/** Package dimensions + weight (owner-authorised 2026-10-31 ·
 *  "weight (g) this should be at delivery container and local and
 *  export and weights and dimension should be 1 section"). Shared
 *  across local + export so the seller declares it once per product. */
export const PackageSpec = z.object({
  dimensions: z.string().max(80).optional(),
  weight_kg: z.number().positive().max(2000).optional(),
});

/** Combined delivery substrate · all blocks optional. */
export const DeliverySpec = z.object({
  package: PackageSpec.optional(),
  local: LocalDeliverySpec.optional(),
  export: ExportDeliverySpec.optional(),
});

export type LocalRadiusEntryT = z.infer<typeof LocalRadiusEntry>;
export type ExportCountryEntryT = z.infer<typeof ExportCountryEntry>;
export type DeliveryT = z.infer<typeof DeliverySpec>;

// ─── Reserved spec key + helpers ─────────────────────────────────────

export const DELIVERY_SPEC_KEY = "__delivery";

export function extractDelivery(spec: unknown): DeliveryT | null {
  if (!spec || typeof spec !== "object") return null;
  const d = (spec as Record<string, unknown>)[DELIVERY_SPEC_KEY];
  if (!d || typeof d !== "object") return null;
  const parsed = DeliverySpec.safeParse(d);
  return parsed.success ? parsed.data : null;
}

export function mergeDeliveryIntoSpec(
  spec: Record<string, unknown>,
  delivery: DeliveryT,
): Record<string, unknown> {
  return { ...spec, [DELIVERY_SPEC_KEY]: delivery };
}

/** Summary for tiles / cards. */
export function summariseDelivery(d: DeliveryT | null): {
  readonly localRadiusCount: number;
  readonly exportCountryCount: number;
} {
  return {
    localRadiusCount: d?.local?.radii.length ?? 0,
    exportCountryCount: d?.export?.countries.length ?? 0,
  };
}
