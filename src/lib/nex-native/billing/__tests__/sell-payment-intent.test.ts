// src/lib/nex-native/billing/__tests__/sell-payment-intent.test.ts
//
// NEX Billing · [in-memory] Sell PaymentIntent service tests.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT).
//
// Covers:
//   · 3 free listings fit the monthly allowance · no PaymentIntent created
//   · 4th listing triggers one PaymentIntent for 1 × €1.30
//   · Mixed batches (part free, part paid)
//   · Invalid addingCount / isoMonth · fail-closed
//   · Deterministic idempotency key shape (nex:sell:<account>:<month>:<nonce>)
//   · Stripe error surfaced as code='stripe_error'

import { describe, it, expect } from "vitest";
import {
  prepareSellListingPayment,
  type SellListingPaymentApi,
} from "../sell-payment-intent";
import { NEX_SELL_EXTRA_LISTING_CENTS_EUR } from "../enforcement";

function makeRecordingStripe(
  opts: {
    throwOn?: boolean;
    response?: { id: string; clientSecret: string };
  } = {},
): SellListingPaymentApi & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    createPaymentIntent: async (input) => {
      calls.push(input);
      if (opts.throwOn) throw new Error("stripe down");
      return (
        opts.response ?? { id: "pi_test_1", clientSecret: "pi_test_1_secret" }
      );
    },
  };
}

describe("[in-memory] prepareSellListingPayment · allowance", () => {
  it("3 listings · all free · no PaymentIntent", async () => {
    const stripe = makeRecordingStripe();
    const r = await prepareSellListingPayment(
      {
        nexAccountId: "acct_1",
        listingsUsedThisMonth: 0,
        addingCount: 3,
        requestNonce: "nonce-12345678",
        isoMonth: "2026-11",
      },
      stripe,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.needsPayment).toBe(false);
      if (!r.needsPayment) {
        expect(r.freeCovered).toBe(3);
      }
    }
    expect(stripe.calls).toHaveLength(0);
  });

  it("4th listing · creates one PaymentIntent for €1.30", async () => {
    const stripe = makeRecordingStripe();
    const r = await prepareSellListingPayment(
      {
        nexAccountId: "acct_1",
        listingsUsedThisMonth: 3,
        addingCount: 1,
        requestNonce: "nonce-12345678",
        isoMonth: "2026-11",
      },
      stripe,
    );
    expect(r.ok).toBe(true);
    if (r.ok && r.needsPayment) {
      expect(r.freeCovered).toBe(0);
      expect(r.extraCovered).toBe(1);
      expect(r.amountCents).toBe(NEX_SELL_EXTRA_LISTING_CENTS_EUR);
      expect(r.currency).toBe("eur");
    }
    expect(stripe.calls).toHaveLength(1);
    const call = stripe.calls[0] as {
      amountCents: number;
      currency: string;
      idempotencyKey: string;
    };
    expect(call.amountCents).toBe(130);
    expect(call.currency).toBe("eur");
  });

  it("mixed · 2 free + 3 paid · one PaymentIntent for 3 × €1.30", async () => {
    const stripe = makeRecordingStripe();
    const r = await prepareSellListingPayment(
      {
        nexAccountId: "acct_1",
        listingsUsedThisMonth: 1,
        addingCount: 5,
        requestNonce: "nonce-mixedcase",
        isoMonth: "2026-11",
      },
      stripe,
    );
    expect(r.ok).toBe(true);
    if (r.ok && r.needsPayment) {
      expect(r.freeCovered).toBe(2);
      expect(r.extraCovered).toBe(3);
      expect(r.amountCents).toBe(390);
    }
  });

  it("already-used quota · all adding count is paid", async () => {
    const stripe = makeRecordingStripe();
    const r = await prepareSellListingPayment(
      {
        nexAccountId: "acct_1",
        listingsUsedThisMonth: 10,
        addingCount: 2,
        requestNonce: "nonce-ninerogue",
        isoMonth: "2026-11",
      },
      stripe,
    );
    expect(r.ok).toBe(true);
    if (r.ok && r.needsPayment) {
      expect(r.freeCovered).toBe(0);
      expect(r.extraCovered).toBe(2);
      expect(r.amountCents).toBe(260);
    }
  });
});

describe("[in-memory] prepareSellListingPayment · validation", () => {
  it("rejects addingCount <= 0", async () => {
    const r = await prepareSellListingPayment(
      {
        nexAccountId: "acct_1",
        listingsUsedThisMonth: 0,
        addingCount: 0,
        requestNonce: "nonce-abcdefgh",
        isoMonth: "2026-11",
      },
      makeRecordingStripe(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("value_out_of_range");
  });

  it("rejects non-finite addingCount", async () => {
    const r = await prepareSellListingPayment(
      {
        nexAccountId: "acct_1",
        listingsUsedThisMonth: 0,
        addingCount: Number.NaN,
        requestNonce: "nonce-abcdefgh",
        isoMonth: "2026-11",
      },
      makeRecordingStripe(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("value_out_of_range");
  });

  it("rejects malformed isoMonth", async () => {
    const r = await prepareSellListingPayment(
      {
        nexAccountId: "acct_1",
        listingsUsedThisMonth: 0,
        addingCount: 1,
        requestNonce: "nonce-abcdefgh",
        isoMonth: "nov-2026",
      },
      makeRecordingStripe(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("value_out_of_range");
  });
});

describe("[in-memory] prepareSellListingPayment · idempotency + Stripe failure", () => {
  it("idempotencyKey has stable shape nex:sell:<account>:<month>:<nonce>", async () => {
    const stripe = makeRecordingStripe();
    await prepareSellListingPayment(
      {
        nexAccountId: "acct_abc",
        listingsUsedThisMonth: 10,
        addingCount: 1,
        requestNonce: "retry-key-01",
        isoMonth: "2026-11",
      },
      stripe,
    );
    const call = stripe.calls[0] as { idempotencyKey: string };
    expect(call.idempotencyKey).toBe("nex:sell:acct_abc:2026-11:retry-key-01");
  });

  it("surfaces Stripe failure as code='stripe_error'", async () => {
    const stripe = makeRecordingStripe({ throwOn: true });
    const r = await prepareSellListingPayment(
      {
        nexAccountId: "acct_abc",
        listingsUsedThisMonth: 10,
        addingCount: 1,
        requestNonce: "retry-key-02",
        isoMonth: "2026-11",
      },
      stripe,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("stripe_error");
      expect(r.reason).toContain("stripe down");
    }
  });

  it("metadata includes nex_account_id, iso_month, counts (useful for webhook join)", async () => {
    const stripe = makeRecordingStripe();
    await prepareSellListingPayment(
      {
        nexAccountId: "acct_meta",
        listingsUsedThisMonth: 2,
        addingCount: 3,
        requestNonce: "metacheck01",
        isoMonth: "2026-11",
      },
      stripe,
    );
    const call = stripe.calls[0] as {
      metadata: Record<string, string>;
    };
    expect(call.metadata.nex_account_id).toBe("acct_meta");
    expect(call.metadata.iso_month).toBe("2026-11");
    expect(call.metadata.free_covered).toBe("1");
    expect(call.metadata.extra_covered).toBe("2");
    expect(call.metadata.cents_per_listing).toBe("130");
    expect(call.metadata.request_nonce).toBe("metacheck01");
  });
});
