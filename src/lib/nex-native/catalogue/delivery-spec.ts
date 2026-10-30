// src/lib/nex-native/catalogue/delivery-spec.ts
//
// Delivery substrate · owner-authorised 2026-10-30 (Product Upload
// World-Class brief · expansion §1 Local delivery + §2 Export).
//
// Lives OUTSIDE the per-category spec registry (cross-category) · one
// substrate per product · stored on nex_product.spec.__delivery jsonb.
// No new migration required — same storage pattern as spec.__market.
//
// Owner distinction (sealed · must be preserved in every rendering):
//
//   · DISPATCH time   = how long the seller takes to prepare and hand
//                        over the parcel.
//   · DELIVERY time   = carrier's estimated transit time to the buyer.
//
//   NEX displays them SEPARATELY. The seller fills both; the UI does
//   not conflate them.
//
// Compliance posture:
//   NEX does NOT verify carrier promises, customs timelines, or COD
//   availability. All values are seller-declared. Copy must say
//   "declare"/"typical"/"seller-stated" — never "guaranteed".

import { z } from "zod";
import type { SpecFieldConfig } from "./specs/types";

// ─── Zod ─────────────────────────────────────────────────────────────

const ISO_CURRENCY = z.string().regex(/^[A-Z]{3}$/, "ISO 4217 currency");
const ISO_COUNTRY  = z.string().regex(/^[A-Z]{2}$/, "ISO 3166-1 alpha-2");

/** One local-delivery zone (e.g. "Central Yogyakarta"). */
export const LocalDeliveryZone = z.object({
  label: z.string().min(1).max(80),
  cities: z.array(z.string().max(60)).max(40).optional(),
  areas: z.array(z.string().max(60)).max(60).optional(),
  price_pence: z.number().int().nonnegative(),
  currency: ISO_CURRENCY,
  /** When set, orders at or above this value ship free. */
  free_above_pence: z.number().int().nonnegative().optional(),
  dispatch_days: z.number().int().nonnegative(),
  delivery_days_min: z.number().int().nonnegative(),
  delivery_days_max: z.number().int().nonnegative(),
  cod_enabled: z.boolean().default(false),
  cod_min_order_pence: z.number().int().nonnegative().optional(),
  pickup_available: z.boolean().default(false),
  notes: z.string().max(400).optional(),
}).refine((v) => v.delivery_days_max >= v.delivery_days_min, {
  message: "delivery_days_max must be ≥ delivery_days_min",
  path: ["delivery_days_max"],
});

export const LocalDeliverySpec = z.object({
  zones: z.array(LocalDeliveryZone).max(60),
  pickup_location: z.string().max(400).optional(),
});

/** One export destination row. */
export const ExportDestination = z.object({
  iso: ISO_COUNTRY,
  enabled: z.boolean().default(true),
  /** Per-destination product price override. If omitted the base
   *  product price_pence applies (converted at the buyer surface by the
   *  sealed FX pipeline when it lights up). */
  price_pence: z.number().int().nonnegative().optional(),
  currency: ISO_CURRENCY.optional(),
  shipping_cost_pence: z.number().int().nonnegative(),
  shipping_currency: ISO_CURRENCY,
  dispatch_days_min: z.number().int().nonnegative(),
  dispatch_days_max: z.number().int().nonnegative(),
  delivery_days_min: z.number().int().nonnegative(),
  delivery_days_max: z.number().int().nonnegative(),
  min_order_pence: z.number().int().nonnegative().optional(),
  notes: z.string().max(400).optional(),
}).refine((v) => v.dispatch_days_max >= v.dispatch_days_min, {
  message: "dispatch_days_max must be ≥ dispatch_days_min",
  path: ["dispatch_days_max"],
}).refine((v) => v.delivery_days_max >= v.delivery_days_min, {
  message: "delivery_days_max must be ≥ delivery_days_min",
  path: ["delivery_days_max"],
});

export const ExportDeliverySpec = z.object({
  destinations: z.array(ExportDestination).max(200),
});

/** Combined delivery substrate · both blocks are optional at the top
 *  level so a seller selling local-only or export-only can leave the
 *  irrelevant block absent (progressive disclosure driven by the
 *  parent product's spec.__market scope). */
export const DeliverySpec = z.object({
  local: LocalDeliverySpec.optional(),
  export: ExportDeliverySpec.optional(),
});

export type LocalDeliveryZoneT = z.infer<typeof LocalDeliveryZone>;
export type ExportDestinationT = z.infer<typeof ExportDestination>;
export type DeliveryT = z.infer<typeof DeliverySpec>;

// ─── Form field configs (progressive disclosure driver) ──────────────

export const LocalZoneFields: readonly SpecFieldConfig[] = [
  { key: "label", label: "Zone name", kind: "text", required: true, maxLength: 80, placeholder: "e.g. Central Yogyakarta" },
  { key: "cities", label: "Cities (comma-separated)", kind: "text", maxLength: 400, placeholder: "e.g. Yogyakarta, Sleman" },
  { key: "areas", label: "Areas / districts (comma-separated)", kind: "text", maxLength: 400 },
  { key: "price_pence_major", label: "Delivery price", kind: "number", required: true, min: 0 },
  { key: "currency", label: "Currency", kind: "select", required: true, options: [
    { value: "IDR", label: "IDR" }, { value: "USD", label: "USD" }, { value: "EUR", label: "EUR" }, { value: "GBP", label: "GBP" }, { value: "MYR", label: "MYR" }, { value: "SGD", label: "SGD" }, { value: "AUD", label: "AUD" },
  ]},
  { key: "free_above_pence_major", label: "Free delivery above order value (optional)", kind: "number", min: 0 },
  { key: "dispatch_days", label: "Dispatch time (days)", kind: "number", required: true, min: 0, helpText: "How long YOU take to prepare the parcel." },
  { key: "delivery_days_min", label: "Est. delivery (min days)", kind: "number", required: true, min: 0, helpText: "Carrier transit — seller-declared." },
  { key: "delivery_days_max", label: "Est. delivery (max days)", kind: "number", required: true, min: 0 },
  { key: "cod_enabled", label: "Cash on Delivery (COD)", kind: "boolean" },
  { key: "cod_min_order_pence_major", label: "COD minimum order value", kind: "number", min: 0 },
  { key: "pickup_available", label: "Collection / pickup available", kind: "boolean" },
  { key: "notes", label: "Notes", kind: "textarea", maxLength: 400 },
];

export const ExportDestinationFields: readonly SpecFieldConfig[] = [
  { key: "iso", label: "Country (ISO 2-letter)", kind: "text", required: true, maxLength: 2, placeholder: "e.g. DE, US, SG" },
  { key: "enabled", label: "Available for this country", kind: "boolean" },
  { key: "price_pence_major", label: "Product price (optional override)", kind: "number", min: 0 },
  { key: "currency", label: "Product currency", kind: "select", options: [
    { value: "USD", label: "USD" }, { value: "EUR", label: "EUR" }, { value: "GBP", label: "GBP" }, { value: "IDR", label: "IDR" }, { value: "MYR", label: "MYR" }, { value: "SGD", label: "SGD" }, { value: "AUD", label: "AUD" }, { value: "JPY", label: "JPY" }, { value: "CNY", label: "CNY" },
  ]},
  { key: "shipping_cost_pence_major", label: "Shipping cost", kind: "number", required: true, min: 0 },
  { key: "shipping_currency", label: "Shipping currency", kind: "select", required: true, options: [
    { value: "USD", label: "USD" }, { value: "EUR", label: "EUR" }, { value: "GBP", label: "GBP" }, { value: "IDR", label: "IDR" }, { value: "MYR", label: "MYR" }, { value: "SGD", label: "SGD" }, { value: "AUD", label: "AUD" }, { value: "JPY", label: "JPY" }, { value: "CNY", label: "CNY" },
  ]},
  { key: "dispatch_days_min", label: "Dispatch (min days)", kind: "number", required: true, min: 0, helpText: "YOUR prep time range." },
  { key: "dispatch_days_max", label: "Dispatch (max days)", kind: "number", required: true, min: 0 },
  { key: "delivery_days_min", label: "Est. delivery (min days)", kind: "number", required: true, min: 0, helpText: "Carrier transit — seller-declared." },
  { key: "delivery_days_max", label: "Est. delivery (max days)", kind: "number", required: true, min: 0 },
  { key: "min_order_pence_major", label: "Minimum order (optional)", kind: "number", min: 0 },
  { key: "notes", label: "Notes", kind: "textarea", maxLength: 400 },
];

// ─── Pure helpers ────────────────────────────────────────────────────

export const DELIVERY_SPEC_KEY = "__delivery";

/** Extract the delivery substrate from a spec jsonb payload. */
export function extractDelivery(spec: unknown): DeliveryT | null {
  if (!spec || typeof spec !== "object") return null;
  const d = (spec as Record<string, unknown>)[DELIVERY_SPEC_KEY];
  if (!d || typeof d !== "object") return null;
  const parsed = DeliverySpec.safeParse(d);
  return parsed.success ? parsed.data : null;
}

/** Merge a validated delivery payload into a spec jsonb object. */
export function mergeDeliveryIntoSpec(
  spec: Record<string, unknown>,
  delivery: DeliveryT,
): Record<string, unknown> {
  return { ...spec, [DELIVERY_SPEC_KEY]: delivery };
}

/** Short rendering helper for summary chips / tiles. */
export function summariseDelivery(d: DeliveryT | null): {
  localZoneCount: number;
  exportCountryCount: number;
  hasCOD: boolean;
  hasPickup: boolean;
} {
  const zones = d?.local?.zones ?? [];
  const dests = d?.export?.destinations ?? [];
  return {
    localZoneCount: zones.length,
    exportCountryCount: dests.filter((x) => x.enabled !== false).length,
    hasCOD: zones.some((z) => z.cod_enabled),
    hasPickup: zones.some((z) => z.pickup_available),
  };
}
