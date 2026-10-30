// src/lib/nex-native/catalogue/identity-wholesale-spec.ts
//
// Identity + Wholesale substrate · owner-authorised 2026-10-30
// (Product Upload World-Class brief · expansion §3 Product identity
// and wholesale).
//
// Stored on nex_product.spec jsonb under reserved keys:
//   · spec.__identity   = condition + manufacture + origin
//   · spec.__wholesale  = bulk-order configuration
//
// No new migration required.
//
// Owner distinction (sealed):
//   · country_of_manufacture — WHERE the product was made.
//   · country_of_origin      — a customs/trade concept. Not always
//     the same as manufacture (e.g. a product may be assembled in one
//     country from components whose declared origin is another). The
//     fields are deliberately separate.
//
// Compliance posture:
//   The condition, manufacture, origin and wholesale-pricing fields
//   are seller-declared. NEX does NOT independently verify any of
//   them. Marketing copy must preserve that honesty.

import { z } from "zod";
import type { SpecFieldConfig } from "./specs/types";

const ISO_COUNTRY  = z.string().regex(/^[A-Z]{2}$/, "ISO 3166-1 alpha-2");
const ISO_CURRENCY = z.string().regex(/^[A-Z]{3}$/, "ISO 4217 currency");

// ─── Identity ────────────────────────────────────────────────────────

export const ConditionEnum = z.enum([
  "new",
  "used",
  "refurbished",
  "handmade",
  "other",
]);

export const IdentitySpec = z.object({
  condition: ConditionEnum,
  condition_notes: z.string().max(400).optional(),
  country_of_manufacture: ISO_COUNTRY.optional(),
  country_of_origin: ISO_COUNTRY.optional(),
});

export type IdentityT = z.infer<typeof IdentitySpec>;

// ─── Wholesale ───────────────────────────────────────────────────────

export const WholesaleTier = z.object({
  min_qty: z.number().int().positive(),
  price_pence: z.number().int().nonnegative(),
  currency: ISO_CURRENCY,
});

export const WholesaleSpec = z.object({
  offered: z.boolean().default(false),
  min_qty: z.number().int().positive().optional(),
  /** How wholesale pricing is communicated:
   *   · tiers        — explicit price tiers (shown on the listing)
   *   · on_request   — "contact seller" (no tier shown)
   *   · none         — no wholesale (ignored when offered=false)
   */
  pricing_mode: z.enum(["tiers", "on_request", "none"]).default("none"),
  tiers: z.array(WholesaleTier).max(10).optional(),
  notes: z.string().max(400).optional(),
}).superRefine((v, ctx) => {
  if (v.offered && v.pricing_mode === "tiers" && (!v.tiers || v.tiers.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one tier required when pricing_mode is 'tiers'",
      path: ["tiers"],
    });
  }
});

export type WholesaleT = z.infer<typeof WholesaleSpec>;
export type WholesaleTierT = z.infer<typeof WholesaleTier>;

// ─── Pure helpers ────────────────────────────────────────────────────

export const IDENTITY_SPEC_KEY  = "__identity";
export const WHOLESALE_SPEC_KEY = "__wholesale";

export function extractIdentity(spec: unknown): IdentityT | null {
  if (!spec || typeof spec !== "object") return null;
  const i = (spec as Record<string, unknown>)[IDENTITY_SPEC_KEY];
  if (!i || typeof i !== "object") return null;
  const parsed = IdentitySpec.safeParse(i);
  return parsed.success ? parsed.data : null;
}

export function extractWholesale(spec: unknown): WholesaleT | null {
  if (!spec || typeof spec !== "object") return null;
  const w = (spec as Record<string, unknown>)[WHOLESALE_SPEC_KEY];
  if (!w || typeof w !== "object") return null;
  const parsed = WholesaleSpec.safeParse(w);
  return parsed.success ? parsed.data : null;
}

export function mergeIdentityIntoSpec(
  spec: Record<string, unknown>,
  identity: IdentityT,
): Record<string, unknown> {
  return { ...spec, [IDENTITY_SPEC_KEY]: identity };
}

export function mergeWholesaleIntoSpec(
  spec: Record<string, unknown>,
  wholesale: WholesaleT,
): Record<string, unknown> {
  return { ...spec, [WHOLESALE_SPEC_KEY]: wholesale };
}

// ─── Form field configs (for shared SpecFormBuilder consumers) ───────

export const IdentityFields: readonly SpecFieldConfig[] = [
  { key: "condition", label: "Condition", kind: "select", required: true, options: [
    { value: "new", label: "New" },
    { value: "used", label: "Used" },
    { value: "refurbished", label: "Refurbished" },
    { value: "handmade", label: "Handmade" },
    { value: "other", label: "Other" },
  ]},
  { key: "condition_notes", label: "Condition notes (optional)", kind: "textarea", maxLength: 400 },
  { key: "country_of_manufacture", label: "Country of manufacture (ISO 2-letter)", kind: "text", maxLength: 2, placeholder: "e.g. ID, CN, DE", helpText: "Where the product is made." },
  { key: "country_of_origin", label: "Country of origin (ISO 2-letter)", kind: "text", maxLength: 2, placeholder: "e.g. ID", helpText: "For customs / trade — not always the same as manufacture." },
];
