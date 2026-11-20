// src/lib/nex-native/catalogue/wholesale-tiers.ts
//
// Multi-tier wholesale pricing · pure helpers + extended Zod schema.
// Authored 2026-11-18 during wholesale-catalogue scaffold (Phase W).
//
// Relationship to identity-wholesale-spec.ts
//   The existing `WholesaleSpec` in identity-wholesale-spec.ts is SINGLE-tier
//   (min_qty + price_per_piece_pence). The master wholesale brief requires
//   MULTIPLE quantity tiers (e.g. "10+ units: £12 each; 50+ units: £10
//   each"). Rather than replace the existing shape (which would break
//   every existing persisted spec row and in-flight concurrent form edit),
//   we extend it ADDITIVELY with an optional `tiers` array.
//
//   Precedence when both are present on a persisted row:
//     · If `tiers` is a non-empty, valid array → it is the authority.
//     · Else if legacy `min_qty` + `price_per_piece_pence` are set → they
//       are interpreted as a single-tier of shape
//       [{ min_qty, price_per_piece_pence }].
//     · Else → wholesale is OFFERED but incomplete; UI treats as "needs
//       pricing" and never publishes to the buyer catalogue.
//
// This file exports PURE functions only. No DB, no I/O, no React. Safe to
// import from server actions, client components, and tests alike.
//
// Money handling
//   Prices are stored in integer pence (bigint on the DB side, number on
//   the TS side — well under 2^53). Line totals use safe integer multiply;
//   we never represent per-piece prices as floats.
//
// Currency
//   Tier objects carry no currency; the enclosing product's currency
//   (ISO 4217) is the single source of truth. Cross-currency tiers are
//   not supported.

import { z } from "zod";

// ─── Schema ────────────────────────────────────────────────────────────────

// A single quantity tier · "at `min_qty` units or more, price per item is
// `price_per_piece_pence`".
//
// 2026-11-18 extension (W13):
//   Each tier may optionally carry its OWN dispatch lead-time range,
//   expressed in whole DAYS (production / preparation only · NOT
//   transit). min_days ≤ max_days enforced by `validateTiers`. When
//   omitted, the enclosing spec's top-level `dispatch_lead_days_min` /
//   `_max` applies as the default.
export const WholesaleTier = z.object({
  min_qty: z.number().int().positive(),
  price_per_piece_pence: z.number().int().nonnegative().finite(),
  dispatch_lead_days_min: z.number().int().nonnegative().optional(),
  dispatch_lead_days_max: z.number().int().nonnegative().optional(),
});
export type WholesaleTierT = z.infer<typeof WholesaleTier>;

// Extended wholesale spec · superset of the sealed single-tier
// WholesaleSpec from identity-wholesale-spec.ts. Both fields are optional
// so the JSON shape persisted today remains valid.
//
// 2026-11-18 extension (W13):
//   · Top-level dispatch_lead_days_min / _max as the default production
//     lead-time range when a tier does not specify its own. Expressed in
//     whole DAYS. Dispatch means time-to-ship, NOT time-to-arrive.
//   · branding_available + branding_terms · capability flag for buyer's
//     branding / private label, with an optional short terms string.
//   · custom_spec_available + custom_spec_terms · capability flag for
//     made-to-buyer's-specifications, with an optional short terms
//     string. Per master prompt: do NOT collapse branding + custom into
//     a single OEM toggle · a seller may offer either, both, or neither.
export const WholesaleSpecWithTiers = z.object({
  offered: z.boolean().default(false),
  // Legacy single-tier fields · retained for backward compat.
  min_qty: z.number().int().positive().optional(),
  price_per_piece_pence: z.number().int().nonnegative().optional(),
  // New · zero-or-more tiers. Enforcement of positivity + uniqueness +
  // ascending-order display is done by `validateTiers` below, not by the
  // schema, so a partially-built draft can still parse.
  tiers: z.array(WholesaleTier).optional(),
  // W13 · default dispatch lead-time range in days (production time, not
  // transit). min ≤ max enforced at validation.
  dispatch_lead_days_min: z.number().int().nonnegative().optional(),
  dispatch_lead_days_max: z.number().int().nonnegative().optional(),
  // W13 · separate, independent capability flags. Default false.
  branding_available: z.boolean().optional(),
  branding_terms: z.string().max(400).optional(),
  custom_spec_available: z.boolean().optional(),
  custom_spec_terms: z.string().max(400).optional(),
});
export type WholesaleSpecWithTiersT = z.infer<typeof WholesaleSpecWithTiers>;

// ─── Validation ────────────────────────────────────────────────────────────

export type TierValidationError =
  | { code: "empty" }
  | { code: "duplicate_min_qty"; min_qty: number }
  | { code: "non_positive_min_qty"; index: number }
  | { code: "non_finite_price"; index: number }
  | { code: "negative_price"; index: number }
  // W13 · a tier's dispatch_lead_days range must be well-formed.
  | { code: "dispatch_range_inverted"; index: number };

export type TierValidationWarning =
  | { code: "inverted_tier"; min_qty: number; price_per_piece_pence: number };

export type TierValidationResult = {
  ok: boolean;
  errors: readonly TierValidationError[];
  // An inverted tier is one where a HIGHER min_qty has a HIGHER or equal
  // per-piece price than a lower tier. The owner is warned but the row is
  // NOT silently rewritten — per the master brief "warn clearly if a
  // higher-quantity tier costs more rather than silently changing it".
  warnings: readonly TierValidationWarning[];
};

/**
 * Validate an array of tiers.
 *
 * Returns ok:false with populated `errors` if the array has a hard problem
 * that must block save. Warnings do not block save; they surface in the UI
 * as an advisory banner.
 */
export function validateTiers(
  tiers: readonly WholesaleTierT[],
): TierValidationResult {
  const errors: TierValidationError[] = [];
  const warnings: TierValidationWarning[] = [];

  if (tiers.length === 0) {
    errors.push({ code: "empty" });
    return { ok: false, errors, warnings };
  }

  const seenMins = new Set<number>();
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i]!;
    if (!Number.isInteger(t.min_qty) || t.min_qty <= 0) {
      errors.push({ code: "non_positive_min_qty", index: i });
      continue;
    }
    if (!Number.isFinite(t.price_per_piece_pence)) {
      errors.push({ code: "non_finite_price", index: i });
      continue;
    }
    if (t.price_per_piece_pence < 0) {
      errors.push({ code: "negative_price", index: i });
      continue;
    }
    if (seenMins.has(t.min_qty)) {
      errors.push({ code: "duplicate_min_qty", min_qty: t.min_qty });
      continue;
    }
    // W13 · if a tier declares both ends of a dispatch range, min must
    // not exceed max. Either end may be omitted.
    if (
      typeof t.dispatch_lead_days_min === "number" &&
      typeof t.dispatch_lead_days_max === "number" &&
      t.dispatch_lead_days_min > t.dispatch_lead_days_max
    ) {
      errors.push({ code: "dispatch_range_inverted", index: i });
      continue;
    }
    seenMins.add(t.min_qty);
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  // Warn on inverted tiers (higher qty costs more per piece than a lower qty).
  const sorted = sortTiersByMinQty(tiers);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (cur.price_per_piece_pence >= prev.price_per_piece_pence) {
      warnings.push({
        code: "inverted_tier",
        min_qty: cur.min_qty,
        price_per_piece_pence: cur.price_per_piece_pence,
      });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ─── Selection ─────────────────────────────────────────────────────────────

/**
 * Deterministic ascending display order. Input is not mutated.
 */
export function sortTiersByMinQty(
  tiers: readonly WholesaleTierT[],
): readonly WholesaleTierT[] {
  return [...tiers].sort((a, b) => a.min_qty - b.min_qty);
}

/**
 * The lowest `min_qty` across the tiers is the Minimum Order Quantity.
 * Returns null for an empty array (caller treats as "incomplete, not
 * publishable").
 */
export function minimumOrderQuantity(
  tiers: readonly WholesaleTierT[],
): number | null {
  if (tiers.length === 0) return null;
  let min = tiers[0]!.min_qty;
  for (let i = 1; i < tiers.length; i++) {
    const q = tiers[i]!.min_qty;
    if (q < min) min = q;
  }
  return min;
}

/**
 * For a given order quantity, pick the applicable tier · the tier with the
 * HIGHEST `min_qty` that is still ≤ `quantity`.
 *
 * Returns null when:
 *   · tiers is empty, OR
 *   · quantity is below the minimum order quantity (buyer must raise qty).
 *
 * Example:
 *   tiers = [{10, 1200}, {50, 1000}]
 *   quantity 10 → tier{10, 1200}
 *   quantity 49 → tier{10, 1200}
 *   quantity 50 → tier{50, 1000}
 *   quantity  9 → null (below MOQ)
 *   quantity  0 → null
 */
export function selectApplicableTier(
  tiers: readonly WholesaleTierT[],
  quantity: number,
): WholesaleTierT | null {
  if (tiers.length === 0) return null;
  if (!Number.isInteger(quantity) || quantity <= 0) return null;
  const moq = minimumOrderQuantity(tiers);
  if (moq === null || quantity < moq) return null;

  let best: WholesaleTierT | null = null;
  for (const t of tiers) {
    if (t.min_qty <= quantity) {
      if (best === null || t.min_qty > best.min_qty) {
        best = t;
      }
    }
  }
  return best;
}

/**
 * Line total · quantity × per-piece price. Returns pence as a safe integer
 * (both inputs are integers; product fits inside Number.MAX_SAFE_INTEGER
 * for any realistic quantity × price combination).
 *
 * Returns null if the tier is not applicable at the given quantity.
 */
export function calcLineTotalPence(
  tiers: readonly WholesaleTierT[],
  quantity: number,
): number | null {
  const tier = selectApplicableTier(tiers, quantity);
  if (tier === null) return null;
  // Both are integers · multiplication is exact in JS doubles for values
  // up to 2^53. Realistic range: qty 1e6 × price 1e9 pence = 1e15 ≪ 2^53.
  return quantity * tier.price_per_piece_pence;
}

// ─── Reading the persisted spec (legacy + new shape) ───────────────────────

/**
 * Collapse the persisted `__wholesale` jsonb (which may carry EITHER the
 * sealed single-tier shape OR the new tiers array OR both) into a canonical
 * array of tiers suitable for the catalogue / editor.
 *
 * Precedence:
 *   1. If `tiers` is a non-empty valid array → return it (sorted asc).
 *   2. Else if legacy min_qty + price_per_piece_pence are both set → return
 *      a single-element tier array built from them.
 *   3. Else → return [].
 */
export function readTiersFromSpec(
  wholesale: unknown,
): readonly WholesaleTierT[] {
  if (!wholesale || typeof wholesale !== "object") return [];
  const raw = wholesale as Record<string, unknown>;

  // Pass 1 · array of tiers · validate each entry individually so one bad
  // row doesn't nuke the whole catalogue slot.
  if (Array.isArray(raw.tiers) && raw.tiers.length > 0) {
    const clean: WholesaleTierT[] = [];
    for (const entry of raw.tiers) {
      const parsed = WholesaleTier.safeParse(entry);
      if (parsed.success) clean.push(parsed.data);
    }
    if (clean.length > 0) return sortTiersByMinQty(clean);
    // fall through to legacy single-tier if nothing in the array survived.
  }

  // Pass 2 · legacy single-tier shape.
  const minQty = raw.min_qty;
  const price  = raw.price_per_piece_pence;
  if (
    typeof minQty === "number" &&
    Number.isInteger(minQty) &&
    minQty > 0 &&
    typeof price === "number" &&
    Number.isFinite(price) &&
    price >= 0
  ) {
    return [{ min_qty: minQty, price_per_piece_pence: price }];
  }
  return [];
}

/**
 * Is this product "wholesale-publishable"? · offered flag true AND at
 * least one valid tier resolves.
 */
export function isWholesalePublishable(wholesale: unknown): boolean {
  const parsed = WholesaleSpecWithTiers.safeParse(wholesale);
  if (!parsed.success) return false;
  if (parsed.data.offered !== true) return false;
  return readTiersFromSpec(parsed.data).length > 0;
}

// ─── W13 · capabilities + dispatch range readers ─────────────────────

export type WholesaleCapabilities = {
  readonly branding_available: boolean;
  readonly branding_terms: string | null;
  readonly custom_spec_available: boolean;
  readonly custom_spec_terms: string | null;
};

/**
 * Normalised capability flags for the UI. Treats missing fields as
 * `false` with no terms. Both branding and custom-spec are read
 * independently · no OEM compound toggle.
 */
export function readCapabilitiesFromSpec(
  wholesale: unknown,
): WholesaleCapabilities {
  const empty: WholesaleCapabilities = {
    branding_available: false,
    branding_terms: null,
    custom_spec_available: false,
    custom_spec_terms: null,
  };
  if (!wholesale || typeof wholesale !== "object") return empty;
  const raw = wholesale as Record<string, unknown>;
  const branding_available = raw.branding_available === true;
  const custom_spec_available = raw.custom_spec_available === true;
  const brandingTermsRaw = raw.branding_terms;
  const customTermsRaw = raw.custom_spec_terms;
  const branding_terms =
    typeof brandingTermsRaw === "string" && brandingTermsRaw.trim().length > 0
      ? brandingTermsRaw.trim()
      : null;
  const custom_spec_terms =
    typeof customTermsRaw === "string" && customTermsRaw.trim().length > 0
      ? customTermsRaw.trim()
      : null;
  return {
    branding_available,
    branding_terms,
    custom_spec_available,
    custom_spec_terms,
  };
}

export type DispatchRange = {
  readonly min_days: number;
  readonly max_days: number;
} | null;

/**
 * Dispatch lead-time range (production time), in whole days. Precedence:
 *   1. Tier-level range when both ends are present and well-formed.
 *   2. Spec-level default range when both ends are present.
 *   3. null (undisclosed · UI renders "contact seller for lead time").
 *
 * This is NOT transit time; see §3 of the master prompt.
 */
export function readDispatchRangeForTier(
  wholesale: unknown,
  tier: WholesaleTierT | null,
): DispatchRange {
  if (
    tier &&
    typeof tier.dispatch_lead_days_min === "number" &&
    typeof tier.dispatch_lead_days_max === "number" &&
    tier.dispatch_lead_days_min <= tier.dispatch_lead_days_max
  ) {
    return {
      min_days: tier.dispatch_lead_days_min,
      max_days: tier.dispatch_lead_days_max,
    };
  }
  if (!wholesale || typeof wholesale !== "object") return null;
  const raw = wholesale as Record<string, unknown>;
  const minD = raw.dispatch_lead_days_min;
  const maxD = raw.dispatch_lead_days_max;
  if (
    typeof minD === "number" &&
    Number.isInteger(minD) &&
    minD >= 0 &&
    typeof maxD === "number" &&
    Number.isInteger(maxD) &&
    maxD >= 0 &&
    minD <= maxD
  ) {
    return { min_days: minD, max_days: maxD };
  }
  return null;
}
