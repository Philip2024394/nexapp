// src/lib/nex-native/catalogue/returns-spec.ts
//
// Returns substrate · owner-authorised 2026-10-30 (initial) +
// 2026-10-31 (SIMPLIFIED per owner directive).
//
// Owner directive 2026-10-31 verbatim: "Returns & legal information
// change to Returns Policy and leave black container for owner to
// add their own returns policy but add 3 small circle for select
// days 7 - 14 - 30 days and if owner select one of them auto add
// text to container text field".
//
// Simplified shape:
//   · policy_text  — seller-authored free text, up to 2000 chars.
//   · days_option  — optional 7 | 14 | 30 (which quick-select the
//     seller tapped) · persisted so the UI can reflect which chip
//     was active on reload.
//
// What was dropped: accepts_returns toggle · within_days numeric ·
// who_pays_shipping dropdown · condition_requirement free-text ·
// seller_country_iso · notes (replaced by the main policy_text) ·
// the statutory-floor overlay reads from catalogue/consumer-rights.ts.
//
// Legacy data note: products saved against the previous Zod shape
// fail safeParse against this new schema. extractReturns() returns
// null · the Edit form shows the policy section empty. The seller's
// next save overwrites with the simpler shape.
//
// Storage: nex_product.spec.__returns jsonb · no migration.

import { z } from "zod";

export const SellerReturnsPolicy = z.object({
  /** Owner-authored returns-policy text. The whole policy lives here;
   *  "we accept returns…" boilerplate is a seed string injected by
   *  the UI when the seller taps a 7/14/30-day chip, then editable
   *  as plain text. Max 2000 chars matches the sealed
   *  updateProductDescription cap. */
  policy_text: z.string().max(2000).optional(),
  /** Which quick-select days chip the seller last tapped. Persisted
   *  so the UI shows the active chip on reload. Optional. */
  days_option: z.union([z.literal(7), z.literal(14), z.literal(30)]).optional(),
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

/** Seed string the UI injects when the seller taps a day chip.
 *  Owner-approved copy (reworded for clarity). */
export function policyTemplateForDays(days: 7 | 14 | 30): string {
  return (
    `We accept returns of this product in its original packaging within ${days} days. `
    + `Please reach out to us to arrange a return. If the package arrives damaged, `
    + `this must be noted on the delivery docket at the time of delivery to support `
    + `any future claim.`
  );
}
