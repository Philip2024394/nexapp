// src/lib/nex-native/wholesale/__tests__/quote-service.test.ts
//
// Pure-library coverage for quote binding + tamper rejection +
// acceptance + staleness + payment eligibility.
//
// Authored 2026-11-18 · Phase W follow-up (W22)

import { describe, expect, it } from "vitest";
import {
  bindQuoteFromDraft,
  canBuyerAccept,
  hasSameMaterialTerms,
  isPaymentEligible,
  type ProductBindContext,
  type QuoteDraft,
  type QuoteRow,
} from "../quote-service";

const PRODUCT: ProductBindContext = {
  productId: "prod-1",
  productCurrency: "GBP",
  wholesaleSpecRaw: {
    offered: true,
    tiers: [
      { min_qty: 10, price_per_piece_pence: 1200 },
      { min_qty: 50, price_per_piece_pence: 1000 },
      { min_qty: 100, price_per_piece_pence: 900 },
    ],
  },
};

const BASE_DRAFT: QuoteDraft = {
  businessId: "biz-1",
  buyerAccountId: "buyer-A",
  productId: "prod-1",
  quantity: 50,
  freightPence: 5000,
  freightMethod: "DHL Air",
  transitDaysMin: 5,
  transitDaysMax: 10,
  dutiesDisposition: "buyer_pays",
  termsNote: "DAP buyer address",
  expiresAt: "2026-12-02T00:00:00Z",
};

describe("bindQuoteFromDraft · authoritative binding", () => {
  it("binds goods price from the seller's tier table · ignores any buyer input", () => {
    const r = bindQuoteFromDraft(BASE_DRAFT, PRODUCT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 50 × 1000 = 50000 (tier at 50+ = 1000)
      expect(r.bound.goodsUnitPricePence).toBe(1000);
      expect(r.bound.goodsSubtotalPence).toBe(50000);
      expect(r.bound.appliedTier.min_qty).toBe(50);
      expect(r.bound.currency).toBe("GBP");
    }
  });

  it("promotes to the largest applicable tier at higher qty", () => {
    const r = bindQuoteFromDraft({ ...BASE_DRAFT, quantity: 200 }, PRODUCT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.bound.goodsUnitPricePence).toBe(900);
      expect(r.bound.goodsSubtotalPence).toBe(180_000);
    }
  });

  it("rejects quantity below MOQ with a distinct reason", () => {
    const r = bindQuoteFromDraft({ ...BASE_DRAFT, quantity: 5 }, PRODUCT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("quantity_below_moq");
  });

  it("rejects zero / non-integer / negative quantity", () => {
    expect(bindQuoteFromDraft({ ...BASE_DRAFT, quantity: 0 }, PRODUCT).ok).toBe(false);
    expect(bindQuoteFromDraft({ ...BASE_DRAFT, quantity: -5 }, PRODUCT).ok).toBe(false);
    expect(bindQuoteFromDraft({ ...BASE_DRAFT, quantity: 2.5 }, PRODUCT).ok).toBe(false);
  });

  it("rejects product mismatch", () => {
    const r = bindQuoteFromDraft({ ...BASE_DRAFT, productId: "prod-other" }, PRODUCT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("product_not_wholesale");
  });

  it("rejects product with no wholesale tiers", () => {
    const r = bindQuoteFromDraft(BASE_DRAFT, {
      ...PRODUCT,
      wholesaleSpecRaw: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("product_not_wholesale");
  });

  it("rejects invalid product currency", () => {
    const r = bindQuoteFromDraft(BASE_DRAFT, {
      ...PRODUCT,
      productCurrency: "gbp",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("currency_invalid");
  });

  it("accepts null freight (unknown) and preserves it rather than treating as zero", () => {
    const r = bindQuoteFromDraft({ ...BASE_DRAFT, freightPence: null }, PRODUCT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bound.freightPence).toBeNull();
  });

  it("rejects negative freight", () => {
    const r = bindQuoteFromDraft({ ...BASE_DRAFT, freightPence: -1 }, PRODUCT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("freight_invalid");
  });

  it("rejects over-long freight method", () => {
    const r = bindQuoteFromDraft(
      { ...BASE_DRAFT, freightMethod: "x".repeat(121) },
      PRODUCT,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("freight_invalid");
  });

  it("rejects inverted transit range", () => {
    const r = bindQuoteFromDraft(
      { ...BASE_DRAFT, transitDaysMin: 10, transitDaysMax: 5 },
      PRODUCT,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("transit_range_invalid");
  });

  it("rejects unknown duties disposition", () => {
    const r = bindQuoteFromDraft(
      { ...BASE_DRAFT, dutiesDisposition: "ddp" as "buyer_pays" },
      PRODUCT,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("duties_invalid");
  });

  it("rejects over-long terms note", () => {
    const r = bindQuoteFromDraft(
      { ...BASE_DRAFT, termsNote: "x".repeat(2001) },
      PRODUCT,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("terms_note_invalid");
  });

  it("trims freight method and terms note on bound output", () => {
    const r = bindQuoteFromDraft(
      { ...BASE_DRAFT, freightMethod: "  DHL  ", termsNote: "  DAP buyer  " },
      PRODUCT,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.bound.freightMethod).toBe("DHL");
      expect(r.bound.termsNote).toBe("DAP buyer");
    }
  });
});

// ─── Acceptance / staleness ────────────────────────────────────────

const QUOTED_ROW: QuoteRow = {
  id: "q-1",
  business_id: "biz-1",
  buyer_account_id: "buyer-A",
  product_id: "prod-1",
  quantity: 50,
  currency: "GBP",
  goods_unit_price_pence: 1000,
  goods_subtotal_pence: 50_000,
  freight_pence: 5000,
  freight_method: "DHL Air",
  transit_days_min: 5,
  transit_days_max: 10,
  duties_disposition: "buyer_pays",
  terms_note: "DAP buyer address",
  status: "quoted",
  quoted_at: "2026-11-18T10:00:00Z",
  buyer_accepted_at: null,
  buyer_rejected_at: null,
  cancelled_at: null,
  expires_at: "2026-12-02T00:00:00Z",
};

const NOW = new Date("2026-11-20T12:00:00Z");

describe("canBuyerAccept · tamper + staleness", () => {
  it("accepts a well-formed first-time acceptance (no prior snapshot)", () => {
    const r = canBuyerAccept({
      viewerAccountId: "buyer-A",
      current: QUOTED_ROW,
      clientSnapshot: null,
      now: NOW,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a non-matching buyer (cross-account acceptance)", () => {
    const r = canBuyerAccept({
      viewerAccountId: "buyer-B",
      current: QUOTED_ROW,
      clientSnapshot: null,
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_your_quote");
  });

  it("rejects when freight is still unknown", () => {
    const r = canBuyerAccept({
      viewerAccountId: "buyer-A",
      current: { ...QUOTED_ROW, freight_pence: null },
      clientSnapshot: null,
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("freight_missing");
  });

  it("rejects when expired", () => {
    const r = canBuyerAccept({
      viewerAccountId: "buyer-A",
      current: { ...QUOTED_ROW, expires_at: "2026-11-19T00:00:00Z" },
      clientSnapshot: null,
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expired");
  });

  it("rejects when status is not 'quoted'", () => {
    const r = canBuyerAccept({
      viewerAccountId: "buyer-A",
      current: { ...QUOTED_ROW, status: "accepted" },
      clientSnapshot: null,
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("wrong_status");
  });

  it("rejects acceptance when freight_pence has moved since the buyer saw it", () => {
    const stale = { ...QUOTED_ROW, freight_pence: 4000 };
    const r = canBuyerAccept({
      viewerAccountId: "buyer-A",
      current: QUOTED_ROW,
      clientSnapshot: stale,
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("stale_snapshot");
  });

  it("rejects acceptance when quantity has moved since the buyer saw it", () => {
    const stale = { ...QUOTED_ROW, quantity: 40 };
    const r = canBuyerAccept({
      viewerAccountId: "buyer-A",
      current: QUOTED_ROW,
      clientSnapshot: stale,
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("stale_snapshot");
  });

  it("rejects acceptance when goods subtotal has moved", () => {
    const stale = { ...QUOTED_ROW, goods_subtotal_pence: 45_000 };
    const r = canBuyerAccept({
      viewerAccountId: "buyer-A",
      current: QUOTED_ROW,
      clientSnapshot: stale,
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("stale_snapshot");
  });

  it("accepts when a matching snapshot is provided", () => {
    const r = canBuyerAccept({
      viewerAccountId: "buyer-A",
      current: QUOTED_ROW,
      clientSnapshot: { ...QUOTED_ROW },
      now: NOW,
    });
    expect(r.ok).toBe(true);
  });
});

describe("hasSameMaterialTerms", () => {
  it("true when terms are identical", () => {
    expect(hasSameMaterialTerms(QUOTED_ROW, { ...QUOTED_ROW })).toBe(true);
  });

  it("true when only timestamps differ", () => {
    expect(
      hasSameMaterialTerms(QUOTED_ROW, {
        ...QUOTED_ROW,
        quoted_at: "2026-11-15T00:00:00Z",
        buyer_accepted_at: "2026-11-20T00:00:00Z",
      }),
    ).toBe(true);
  });

  it("false when freight method differs", () => {
    expect(
      hasSameMaterialTerms(QUOTED_ROW, { ...QUOTED_ROW, freight_method: "Sea" }),
    ).toBe(false);
  });

  it("false when duties disposition differs", () => {
    expect(
      hasSameMaterialTerms(QUOTED_ROW, {
        ...QUOTED_ROW,
        duties_disposition: "seller_pays",
      }),
    ).toBe(false);
  });
});

describe("isPaymentEligible", () => {
  it("true for accepted · fresh · freight known", () => {
    const accepted: QuoteRow = {
      ...QUOTED_ROW,
      status: "accepted",
      buyer_accepted_at: "2026-11-20T00:00:00Z",
    };
    expect(isPaymentEligible(accepted, NOW)).toBe(true);
  });

  it("false for 'quoted' (acceptance required before payment)", () => {
    expect(isPaymentEligible(QUOTED_ROW, NOW)).toBe(false);
  });

  it("false for 'accepted' but expired (expiry wins)", () => {
    const accepted: QuoteRow = {
      ...QUOTED_ROW,
      status: "accepted",
      buyer_accepted_at: "2026-11-20T00:00:00Z",
      expires_at: "2026-11-19T00:00:00Z",
    };
    expect(isPaymentEligible(accepted, NOW)).toBe(false);
  });

  it("false for 'accepted' but freight_pence null (defensive — should never happen)", () => {
    const accepted: QuoteRow = {
      ...QUOTED_ROW,
      status: "accepted",
      buyer_accepted_at: "2026-11-20T00:00:00Z",
      freight_pence: null,
    };
    expect(isPaymentEligible(accepted, NOW)).toBe(false);
  });

  it("false for rejected / cancelled / expired / draft statuses", () => {
    for (const s of ["rejected", "cancelled", "expired", "draft"] as const) {
      expect(isPaymentEligible({ ...QUOTED_ROW, status: s }, NOW)).toBe(false);
    }
  });
});
