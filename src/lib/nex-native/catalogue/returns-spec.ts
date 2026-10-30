// src/lib/nex-native/catalogue/returns-spec.ts
//
// Returns substrate · owner-authorised 2026-10-30 (Product Upload
// World-Class brief · expansion §4 Returns and consumer rights by
// country).
//
// Policy contract (sealed):
//
//   The seller's declared policy sits BESIDE the statutory floor
//   drawn from consumer-rights.ts for every buyer-destination
//   country. The seller policy CANNOT override statutory rights:
//   the UI shows both; the lower-bound (buyer-favouring) applies.
//
//   This file encodes the seller policy only. Statutory rights are a
//   separate concern · do not merge them.
//
// Storage: nex_product.spec.__returns jsonb. No new migration.

import { z } from "zod";

export const WhoPaysShipping = z.enum(["buyer", "seller", "negotiable"]);

export const SellerReturnsPolicy = z.object({
  /** Does the seller accept returns outside statutory rights?
   *  (Statutory rights apply regardless · see consumer-rights.ts.) */
  accepts_returns: z.boolean().default(false),
  /** Number of days from delivery that the seller accepts returns.
   *  Ignored when accepts_returns is false. */
  within_days: z.number().int().nonnegative().optional(),
  /** Who pays the return shipping on seller-policy returns. */
  who_pays_shipping: WhoPaysShipping.default("buyer"),
  /** Condition the item must be in to qualify (e.g. "unopened"). */
  condition_requirement: z.string().max(400).optional(),
  /** Free-text additional terms. Must NOT exclude statutory rights.
   *  UI copy reminds the seller of that constraint. */
  notes: z.string().max(1200).optional(),
  /** Owner-authorised 2026-10-31 (Decision 2 · Option 1) · the
   *  seller's own market country, captured per-product because
   *  nex_account carries no reliable country field (phone_country_code
   *  is ambiguous for +1/+44; last_known_country_iso is user-initiated
   *  and null for most new accounts). Explicit per-product field keeps
   *  the data honest and avoids a new DB column. Drives the "your
   *  market" statutory-floor card in the ReturnsEditor. */
  seller_country_iso: z.string().regex(/^[A-Z]{2}$/, "ISO 3166-1 alpha-2").optional(),
});

export const ReturnsSpec = z.object({
  seller_policy: SellerReturnsPolicy,
});

export type ReturnsT = z.infer<typeof ReturnsSpec>;
export type SellerReturnsPolicyT = z.infer<typeof SellerReturnsPolicy>;

export const RETURNS_SPEC_KEY = "__returns";

export function extractReturns(spec: unknown): ReturnsT | null {
  if (!spec || typeof spec !== "object") return null;
  const r = (spec as Record<string, unknown>)[RETURNS_SPEC_KEY];
  if (!r || typeof r !== "object") return null;
  const parsed = ReturnsSpec.safeParse(r);
  return parsed.success ? parsed.data : null;
}

export function mergeReturnsIntoSpec(
  spec: Record<string, unknown>,
  returns: ReturnsT,
): Record<string, unknown> {
  return { ...spec, [RETURNS_SPEC_KEY]: returns };
}
