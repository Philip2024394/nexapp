// src/lib/nex-native/wholesale/quote-service.ts
//
// Authored 2026-11-18 · Phase W follow-up (W21)
//
// Purpose
//   Pure quote-binding + tamper-rejection helpers for the sealed
//   freight-on-request flow (master-prompt §3). The persistence target
//   is `nex_wholesale_quote` (migration 351 PROPOSAL · not applied),
//   which depends on `nex_wholesale_buyer_approval` (migration 350
//   PROPOSAL · not applied).
//
//   These helpers are deliberately exported SEPARATELY from the server
//   action wrapper so the whole binding + tamper + stale-detect logic
//   can be unit tested without touching Supabase. Nothing in this file
//   writes to the DB.
//
// Design invariants (master-prompt §3)
//   · Freight amount, method, and transit are NEVER folded into goods
//     subtotal · they are separate columns.
//   · "Unknown freight" is NOT zero, NOT free, and NOT inferred from
//     country · it is `freight_pence: null`.
//   · Goods price per piece comes from the SELLER's stored tier table
//     at bind time · the buyer's submitted price is NEVER trusted.
//   · Currency comes from the enclosing product, mirrored at bind time
//     so a later product-currency change does not rewrite history.
//   · Material terms (quantity, currency, goods_unit_price_pence,
//     freight_pence, freight_method, duties_disposition, terms_note,
//     transit range) that change AFTER buyer acceptance invalidate the
//     acceptance · a fresh buyer decision is required.

import {
  calcLineTotalPence,
  selectApplicableTier,
  readTiersFromSpec,
  type WholesaleTierT,
} from "@/lib/nex-native/catalogue/wholesale-tiers";

// ─── Types ───────────────────────────────────────────────────────────

/** A row sourced from `nex_wholesale_quote`. Timestamps are ISO strings
 *  as PostgREST returns them. */
export interface QuoteRow {
  readonly id: string;
  readonly business_id: string;
  readonly buyer_account_id: string;
  readonly product_id: string;
  readonly quantity: number;
  readonly currency: string;
  readonly goods_unit_price_pence: number;
  readonly goods_subtotal_pence: number;
  readonly freight_pence: number | null;
  readonly freight_method: string | null;
  readonly transit_days_min: number | null;
  readonly transit_days_max: number | null;
  readonly duties_disposition: "seller_pays" | "buyer_pays" | "unspecified" | null;
  readonly terms_note: string | null;
  readonly status: "draft" | "quoted" | "accepted" | "rejected" | "expired" | "cancelled";
  readonly quoted_at: string | null;
  readonly buyer_accepted_at: string | null;
  readonly buyer_rejected_at: string | null;
  readonly cancelled_at: string | null;
  readonly expires_at: string | null;
}

/** The parameters a seller supplies at quote creation time. */
export interface QuoteDraft {
  readonly businessId: string;
  readonly buyerAccountId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly freightPence: number | null;
  readonly freightMethod: string | null;
  readonly transitDaysMin: number | null;
  readonly transitDaysMax: number | null;
  readonly dutiesDisposition: "seller_pays" | "buyer_pays" | "unspecified" | null;
  readonly termsNote: string | null;
  readonly expiresAt: string | null;
}

/** Authoritative product context resolved server-side when creating a
 *  quote · the seller cannot override price or currency. */
export interface ProductBindContext {
  readonly productId: string;
  readonly productCurrency: string;
  readonly wholesaleSpecRaw: unknown;
}

export type BindQuoteOutcome =
  | {
      readonly ok: true;
      readonly bound: BoundQuote;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "quantity_invalid"
        | "quantity_below_moq"
        | "product_not_wholesale"
        | "no_applicable_tier"
        | "currency_invalid"
        | "transit_range_invalid"
        | "freight_invalid"
        | "terms_note_invalid"
        | "duties_invalid";
    };

export interface BoundQuote {
  readonly businessId: string;
  readonly buyerAccountId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly currency: string;
  readonly goodsUnitPricePence: number;
  readonly goodsSubtotalPence: number;
  readonly appliedTier: WholesaleTierT;
  readonly freightPence: number | null;
  readonly freightMethod: string | null;
  readonly transitDaysMin: number | null;
  readonly transitDaysMax: number | null;
  readonly dutiesDisposition: "seller_pays" | "buyer_pays" | "unspecified" | null;
  readonly termsNote: string | null;
  readonly expiresAt: string | null;
}

// ─── Pure binders / validators ───────────────────────────────────────

const ISO_CURRENCY_RE = /^[A-Z]{3}$/;
const DUTIES = new Set(["seller_pays", "buyer_pays", "unspecified"]);

/** Produce the authoritative column set for an INSERT into
 *  `nex_wholesale_quote`. Called from the server action AFTER identity
 *  + ownership + approval are confirmed. Rejects every form of seller
 *  tampering: a buyer-submitted price, a bogus currency, a backwards
 *  transit range, negative freight, a quantity below MOQ, etc. */
export function bindQuoteFromDraft(
  draft: QuoteDraft,
  product: ProductBindContext,
): BindQuoteOutcome {
  // Quantity gates
  if (!Number.isInteger(draft.quantity) || draft.quantity <= 0) {
    return { ok: false, reason: "quantity_invalid" };
  }

  // Product must declare the quote's product_id
  if (product.productId !== draft.productId) {
    return { ok: false, reason: "product_not_wholesale" };
  }

  // Currency must be ISO-3 upper
  if (!ISO_CURRENCY_RE.test(product.productCurrency)) {
    return { ok: false, reason: "currency_invalid" };
  }

  // Resolve applicable tier from the AUTHORITATIVE product spec
  const tiers = readTiersFromSpec(product.wholesaleSpecRaw);
  if (tiers.length === 0) {
    return { ok: false, reason: "product_not_wholesale" };
  }
  const applied = selectApplicableTier(tiers, draft.quantity);
  if (applied === null) {
    // Quantity is positive but below MOQ (or above all tiers · impossible
    // since we always pick the largest applicable). Explicit split so
    // callers can tell the two apart.
    const lowestMinQty = tiers.reduce(
      (m, t) => (m === null || t.min_qty < m ? t.min_qty : m),
      null as number | null,
    );
    if (lowestMinQty !== null && draft.quantity < lowestMinQty) {
      return { ok: false, reason: "quantity_below_moq" };
    }
    return { ok: false, reason: "no_applicable_tier" };
  }

  const goodsSubtotalPence = calcLineTotalPence(tiers, draft.quantity);
  if (goodsSubtotalPence === null) {
    return { ok: false, reason: "no_applicable_tier" };
  }

  // Freight · may be null ("not yet quoted") OR a non-negative integer.
  if (draft.freightPence !== null) {
    if (!Number.isInteger(draft.freightPence) || draft.freightPence < 0) {
      return { ok: false, reason: "freight_invalid" };
    }
  }
  if (draft.freightMethod !== null) {
    const trimmed = draft.freightMethod.trim();
    if (trimmed.length < 1 || trimmed.length > 120) {
      return { ok: false, reason: "freight_invalid" };
    }
  }

  // Transit · range must be well-formed if both ends present.
  if (draft.transitDaysMin !== null) {
    if (!Number.isInteger(draft.transitDaysMin) || draft.transitDaysMin < 0) {
      return { ok: false, reason: "transit_range_invalid" };
    }
  }
  if (draft.transitDaysMax !== null) {
    if (!Number.isInteger(draft.transitDaysMax) || draft.transitDaysMax < 0) {
      return { ok: false, reason: "transit_range_invalid" };
    }
  }
  if (
    draft.transitDaysMin !== null &&
    draft.transitDaysMax !== null &&
    draft.transitDaysMin > draft.transitDaysMax
  ) {
    return { ok: false, reason: "transit_range_invalid" };
  }

  // Duties
  if (draft.dutiesDisposition !== null && !DUTIES.has(draft.dutiesDisposition)) {
    return { ok: false, reason: "duties_invalid" };
  }

  // Terms note
  if (draft.termsNote !== null) {
    const t = draft.termsNote.trim();
    if (t.length < 1 || t.length > 2000) {
      return { ok: false, reason: "terms_note_invalid" };
    }
  }

  return {
    ok: true,
    bound: {
      businessId: draft.businessId,
      buyerAccountId: draft.buyerAccountId,
      productId: draft.productId,
      quantity: draft.quantity,
      currency: product.productCurrency,
      goodsUnitPricePence: applied.price_per_piece_pence,
      goodsSubtotalPence,
      appliedTier: applied,
      freightPence: draft.freightPence,
      freightMethod: draft.freightMethod === null ? null : draft.freightMethod.trim(),
      transitDaysMin: draft.transitDaysMin,
      transitDaysMax: draft.transitDaysMax,
      dutiesDisposition: draft.dutiesDisposition,
      termsNote: draft.termsNote === null ? null : draft.termsNote.trim(),
      expiresAt: draft.expiresAt,
    },
  };
}

// ─── Buyer acceptance & staleness ────────────────────────────────────

/** Canonical "material terms" projected from a quote row. Any change
 *  across this shape invalidates a prior acceptance. Deliberately does
 *  NOT include `updated_at`, `created_at`, or the acceptance timestamps
 *  themselves — those turn over on every write and would self-invalidate. */
export function materialTermsOf(q: QuoteRow): {
  readonly quantity: number;
  readonly currency: string;
  readonly goods_unit_price_pence: number;
  readonly goods_subtotal_pence: number;
  readonly freight_pence: number | null;
  readonly freight_method: string | null;
  readonly transit_days_min: number | null;
  readonly transit_days_max: number | null;
  readonly duties_disposition: QuoteRow["duties_disposition"];
  readonly terms_note: string | null;
  readonly product_id: string;
  readonly buyer_account_id: string;
  readonly business_id: string;
} {
  return {
    quantity: q.quantity,
    currency: q.currency,
    goods_unit_price_pence: q.goods_unit_price_pence,
    goods_subtotal_pence: q.goods_subtotal_pence,
    freight_pence: q.freight_pence,
    freight_method: q.freight_method,
    transit_days_min: q.transit_days_min,
    transit_days_max: q.transit_days_max,
    duties_disposition: q.duties_disposition,
    terms_note: q.terms_note,
    product_id: q.product_id,
    buyer_account_id: q.buyer_account_id,
    business_id: q.business_id,
  };
}

/** True iff two row snapshots describe the same material offer. Used
 *  by the server-side acceptance path to compare "what the buyer saw
 *  at click time" against "what the DB row still says". Any material
 *  divergence rejects the acceptance server-side. */
export function hasSameMaterialTerms(a: QuoteRow, b: QuoteRow): boolean {
  const am = materialTermsOf(a);
  const bm = materialTermsOf(b);
  return (
    am.quantity === bm.quantity &&
    am.currency === bm.currency &&
    am.goods_unit_price_pence === bm.goods_unit_price_pence &&
    am.goods_subtotal_pence === bm.goods_subtotal_pence &&
    am.freight_pence === bm.freight_pence &&
    am.freight_method === bm.freight_method &&
    am.transit_days_min === bm.transit_days_min &&
    am.transit_days_max === bm.transit_days_max &&
    am.duties_disposition === bm.duties_disposition &&
    am.terms_note === bm.terms_note &&
    am.product_id === bm.product_id &&
    am.buyer_account_id === bm.buyer_account_id &&
    am.business_id === bm.business_id
  );
}

export type AcceptabilityOutcome =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "not_your_quote"
        | "wrong_status"
        | "expired"
        | "freight_missing"
        | "stale_snapshot";
    };

/** Can this buyer accept this quote right now? Runs every check the
 *  payment-enable gate needs. Deliberately does NOT look at a payment
 *  table · acceptance is a pure precondition. Sealed master-prompt §3:
 *  "Buyer must explicitly accept the quote before any payment is
 *   taken" and material changes invalidate acceptance. */
export function canBuyerAccept(args: {
  readonly viewerAccountId: string;
  readonly current: QuoteRow;
  /** Optional · the snapshot the buyer last saw rendered. When present,
   *  any material divergence between `current` and `clientSnapshot`
   *  rejects acceptance. Omit to skip this check (e.g. for a first
   *  acceptance click where no prior snapshot exists). */
  readonly clientSnapshot: QuoteRow | null;
  readonly now: Date;
}): AcceptabilityOutcome {
  const { viewerAccountId, current, clientSnapshot, now } = args;

  if (current.buyer_account_id !== viewerAccountId) {
    return { ok: false, reason: "not_your_quote" };
  }
  if (current.status !== "quoted") {
    return { ok: false, reason: "wrong_status" };
  }
  if (current.freight_pence === null) {
    // Unknown freight is not zero · acceptance is premature.
    return { ok: false, reason: "freight_missing" };
  }
  if (current.expires_at !== null) {
    const expiresMs = Date.parse(current.expires_at);
    if (Number.isFinite(expiresMs) && expiresMs <= now.getTime()) {
      return { ok: false, reason: "expired" };
    }
  }
  if (clientSnapshot !== null && !hasSameMaterialTerms(current, clientSnapshot)) {
    return { ok: false, reason: "stale_snapshot" };
  }
  return { ok: true };
}

/** Would this quote row, with its current status + acceptance + expiry
 *  state, let the downstream payment path proceed? Used by any future
 *  payment-enable gate; strictly equivalent to "status=accepted AND
 *  not expired AND freight known". */
export function isPaymentEligible(q: QuoteRow, now: Date): boolean {
  if (q.status !== "accepted") return false;
  if (q.buyer_accepted_at === null) return false;
  if (q.freight_pence === null) return false;
  if (q.expires_at !== null) {
    const expiresMs = Date.parse(q.expires_at);
    if (Number.isFinite(expiresMs) && expiresMs <= now.getTime()) return false;
  }
  return true;
}
