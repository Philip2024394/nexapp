// src/lib/nex-native/catalogue/market-spec.ts
//
// Sales-market substrate · owner-authorised 2026-10-30 (Product Upload
// World-Class Experience brief). Lives OUTSIDE the per-category spec
// registry because it is cross-category: every product in every one of
// the 30 departments carries a market selection.
//
// Storage model (sealed · no migration required):
//   · The canonical `nex_product` row stores market data inside the
//     existing `spec jsonb` under the reserved key `__market`.
//   · Per-category Zod validators continue to validate THEIR fields in
//     parallel; the server action validates the market payload with
//     the schema in this file and merges it into `spec.__market` before
//     the DB write.
//   · On read, surfaces split `spec.__market` back out as a first-class
//     field for display (badges on tiles, filters, etc.).
//
// Owner principle verbatim (2026-10-30):
//   "local and export are sales capabilities of the same product, not
//    two separate products. That way, a seller can create a product
//    once and sell it in both markets without maintaining duplicate
//    listings."
//
// Compliance note (sealed · do NOT loosen in copy):
//   NEX does NOT verify legal export compliance. All fields here are
//   seller-declared. The schema captures the declaration; it is NOT a
//   certification pipeline. UI copy must say "declare" not "verify".

import { z } from "zod";
import type { SpecFieldConfig } from "./specs/types";

// ─── Zod ─────────────────────────────────────────────────────────────

const ISO_CURRENCY = z
  .string()
  .regex(/^[A-Z]{3}$/, "Currency must be ISO 4217 (e.g. IDR, USD, EUR)");

export const LocalMarketSpec = z.object({
  price_pence: z.number().int().nonnegative().optional(),
  currency: ISO_CURRENCY.optional(),
  moq: z.number().int().positive().optional(),
  dispatch_days: z.number().int().nonnegative().optional(),
  origin_region: z.string().max(120).optional(),
  packaging_notes: z.string().max(400).optional(),
  delivery_notes: z.string().max(400).optional(),
});

export const ExportMarketSpec = z.object({
  price_pence: z.number().int().nonnegative().optional(),
  currency: ISO_CURRENCY.optional(),
  countries: z.array(z.string().max(60)).max(60).optional(),
  country_of_origin: z.string().max(60).optional(),
  hs_code: z.string().max(20).optional(),
  weight_g: z.number().positive().optional(),
  packaged_dimensions_cm: z.string().max(80).optional(),
  packaging_notes: z.string().max(400).optional(),
  moq: z.number().int().positive().optional(),
  lead_time_days: z.number().int().nonnegative().optional(),
  shipping_notes: z.string().max(400).optional(),
  certifications: z.string().max(400).optional(),
  customs_notes: z.string().max(400).optional(),
});

export type SalesScope = "local" | "export" | "both";

export const MarketSpec = z
  .object({
    scope: z.enum(["local", "export", "both"]),
    local: LocalMarketSpec.optional(),
    export: ExportMarketSpec.optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.scope === "local" || v.scope === "both") && !v.local) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Local market fields required when scope is 'local' or 'both'",
        path: ["local"],
      });
    }
    if ((v.scope === "export" || v.scope === "both") && !v.export) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Export market fields required when scope is 'export' or 'both'",
        path: ["export"],
      });
    }
  });

export type Market = z.infer<typeof MarketSpec>;

// ─── Form field configs (progressive disclosure driver) ──────────────

export const LocalMarketFields: readonly SpecFieldConfig[] = [
  { key: "price_pence_major", label: "Local price (in local currency)", kind: "number", min: 0, placeholder: "e.g. 150000" },
  { key: "currency", label: "Local currency", kind: "select", options: [
    { value: "IDR", label: "IDR" },
    { value: "USD", label: "USD" },
    { value: "EUR", label: "EUR" },
    { value: "GBP", label: "GBP" },
    { value: "MYR", label: "MYR" },
    { value: "SGD", label: "SGD" },
    { value: "AUD", label: "AUD" },
  ]},
  { key: "moq", label: "Minimum order quantity", kind: "number", min: 1 },
  { key: "dispatch_days", label: "Dispatch within (days)", kind: "number", min: 0 },
  { key: "origin_region", label: "Shipped from (region / city)", kind: "text", maxLength: 120 },
  { key: "packaging_notes", label: "Packaging notes", kind: "textarea", maxLength: 400 },
  { key: "delivery_notes", label: "Local delivery notes", kind: "textarea", maxLength: 400 },
];

export const ExportMarketFields: readonly SpecFieldConfig[] = [
  { key: "price_pence_major", label: "Export price", kind: "number", min: 0 },
  { key: "currency", label: "Export currency", kind: "select", options: [
    { value: "USD", label: "USD" },
    { value: "EUR", label: "EUR" },
    { value: "GBP", label: "GBP" },
    { value: "IDR", label: "IDR" },
    { value: "MYR", label: "MYR" },
    { value: "SGD", label: "SGD" },
    { value: "AUD", label: "AUD" },
    { value: "JPY", label: "JPY" },
    { value: "CNY", label: "CNY" },
  ]},
  { key: "countries", label: "Countries served (comma separated)", kind: "text", maxLength: 400, placeholder: "e.g. US, UK, DE" },
  { key: "country_of_origin", label: "Country of origin", kind: "text", maxLength: 60 },
  { key: "hs_code", label: "HS / customs tariff code", kind: "text", maxLength: 20, placeholder: "e.g. 6109.10", helpText: "Seller-declared. NEX does not verify export compliance." },
  { key: "weight_g", label: "Product weight (g)", kind: "number", min: 0 },
  { key: "packaged_dimensions_cm", label: "Packaged dimensions (L × W × H cm)", kind: "text", maxLength: 80 },
  { key: "packaging_notes", label: "Export packaging requirements", kind: "textarea", maxLength: 400 },
  { key: "moq", label: "Minimum export order quantity", kind: "number", min: 1 },
  { key: "lead_time_days", label: "Production / dispatch lead time (days)", kind: "number", min: 0 },
  { key: "shipping_notes", label: "International shipping arrangements", kind: "textarea", maxLength: 400 },
  { key: "certifications", label: "Certifications & permits (declared)", kind: "textarea", maxLength: 400, helpText: "Seller-declared. NEX does not verify." },
  { key: "customs_notes", label: "Customs / trade information", kind: "textarea", maxLength: 400 },
];

// ─── Pure helpers ────────────────────────────────────────────────────

/** Reserved spec key where market data lives. */
export const MARKET_SPEC_KEY = "__market";

/** Extract the market substrate from a spec jsonb payload. Returns null
 *  when the product predates the market substrate (legacy products). */
export function extractMarket(spec: unknown): Market | null {
  if (!spec || typeof spec !== "object") return null;
  const m = (spec as Record<string, unknown>)[MARKET_SPEC_KEY];
  if (!m || typeof m !== "object") return null;
  const parsed = MarketSpec.safeParse(m);
  return parsed.success ? parsed.data : null;
}

/** Merge a validated market payload into a category-spec jsonb object. */
export function mergeMarketIntoSpec(
  categorySpec: Record<string, unknown>,
  market: Market,
): Record<string, unknown> {
  return { ...categorySpec, [MARKET_SPEC_KEY]: market };
}

/** Human-readable summary of a market payload for tiles + cards. */
export function describeMarket(market: Market | null): string {
  if (!market) return "";
  if (market.scope === "local") return "Local only";
  if (market.scope === "export") return "Export only";
  const countries = market.export?.countries?.length;
  return countries ? `Local & export (${countries} markets)` : "Local & export";
}
