// src/lib/nex-native/wholesale/__tests__/initiate-order.test.ts
//
// Authored 2026-11-18 · Round-4 payment-gate wiring
//
// Scope
//   Unit coverage for `initiateWholesaleOrderAction` — the single
//   authorised wholesale entry point every UI path must call before
//   handing off to a payment provider. The action is a thin wrapper
//   around `evaluateWholesalePaymentGateAction`; these tests verify:
//
//     · happy path returns a deterministic idempotency key + the
//       gate's envelope untouched
//     · every fail-closed branch propagates verbatim (never promoted
//       to ok)
//     · no DB write happens here (mig 350 / 351 unapplied)
//     · the key is stable across repeated calls for the same accepted
//       quote, so Stripe / PayPal retries do not create duplicates
//
// What is NOT covered
//   · The gate's own precondition matrix (covered by payment-gate.test.ts)
//   · Downstream payment-provider wiring (deferred · mig 350/351
//     required)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks (mirror payment-gate.test.ts shape) ───────────────────────

const sessionState: { current: { account: { id: string } } | null } = {
  current: { account: { id: "buyer-1" } },
};

vi.mock("@/lib/nex-native/app/dev-impersonation", () => {
  return {
    async resolveSessionWithDevOverride() {
      return sessionState.current;
    },
  };
});

type Row = Record<string, unknown> | null;
type ErrorShape = { code?: string } | null;

interface TableResponse {
  readonly data: Row;
  readonly error: ErrorShape;
}

type TableKey =
  | "nex_wholesale_quote"
  | "nex_wholesale_buyer_approval"
  | "nex_business";

const tableResponses: Record<TableKey, TableResponse> = {
  nex_wholesale_quote: { data: null, error: null },
  nex_wholesale_buyer_approval: { data: null, error: null },
  nex_business: { data: null, error: null },
};

function setTable(key: TableKey, res: TableResponse) {
  tableResponses[key] = res;
}

vi.mock("@/lib/nex-native/supabase-admin", () => {
  function chain(table: string) {
    const key = table as TableKey;
    const result = () => tableResponses[key] ?? { data: null, error: null };
    const api = {
      select: (_c: string) => api,
      eq: (_c: string, _v: unknown) => api,
      maybeSingle: async () => result(),
    };
    return api;
  }
  return {
    nexSupabaseAdmin: {
      from: (t: string) => chain(t),
    },
  };
});

vi.mock("server-only", () => ({}));

// ─── Fixtures ────────────────────────────────────────────────────────

const BUSINESS_ID = "biz-1";
const BUYER_ID = "buyer-1";
const SELLER_ID = "seller-1";
const PRODUCT_ID = "prod-1";
const QUOTE_ID = "quote-1";
const ACCEPTED_AT = "2026-11-18T01:00:00Z";

const FUTURE_ISO = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

const ACCEPTED_ROW = {
  id: QUOTE_ID,
  business_id: BUSINESS_ID,
  buyer_account_id: BUYER_ID,
  product_id: PRODUCT_ID,
  quantity: 100,
  currency: "IDR",
  goods_unit_price_pence: 1_500,
  goods_subtotal_pence: 150_000,
  freight_pence: 25_000,
  freight_method: "Sea FCL",
  transit_days_min: 14,
  transit_days_max: 21,
  duties_disposition: "buyer_pays" as const,
  terms_note: "FOB Jakarta",
  status: "accepted" as const,
  quoted_at: "2026-11-18T00:00:00Z",
  buyer_accepted_at: ACCEPTED_AT,
  buyer_rejected_at: null,
  cancelled_at: null,
  expires_at: FUTURE_ISO,
};

const APPROVED_ROW = {
  status: "approved",
  decided_at: "2026-11-18T00:00:00Z",
  revoked_at: null,
};

const BUSINESS_ROW = { owner_account_id: SELLER_ID };

function defaultOk() {
  setTable("nex_wholesale_quote", { data: ACCEPTED_ROW, error: null });
  setTable("nex_wholesale_buyer_approval", { data: APPROVED_ROW, error: null });
  setTable("nex_business", { data: BUSINESS_ROW, error: null });
  sessionState.current = { account: { id: BUYER_ID } };
}

beforeEach(() => {
  defaultOk();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────

describe("initiateWholesaleOrderAction · happy path", () => {
  it("returns a draft envelope wrapping the gate result with a deterministic idempotency key", async () => {
    const { initiateWholesaleOrderAction } = await import("../actions");
    const res = await initiateWholesaleOrderAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.idempotencyKey).toBe(
      `nex-wholesale-${QUOTE_ID}-${ACCEPTED_AT}`,
    );
    expect(res.value.gate).toMatchObject({
      quoteId: QUOTE_ID,
      businessId: BUSINESS_ID,
      buyerAccountId: BUYER_ID,
      productId: PRODUCT_ID,
      totalPence: 175_000,
      acceptedAt: ACCEPTED_AT,
    });
  });

  it("idempotency key is stable across repeated calls for the same accepted quote", async () => {
    const { initiateWholesaleOrderAction } = await import("../actions");
    const a = await initiateWholesaleOrderAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    const b = await initiateWholesaleOrderAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.idempotencyKey).toBe(b.value.idempotencyKey);
  });

  it("idempotency key changes when buyer_accepted_at changes (re-accept)", async () => {
    const { initiateWholesaleOrderAction } = await import("../actions");
    const first = await initiateWholesaleOrderAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    // Simulate a re-accept that bumps buyer_accepted_at.
    const bumpedAt = "2026-11-18T02:00:00Z";
    setTable("nex_wholesale_quote", {
      data: { ...ACCEPTED_ROW, buyer_accepted_at: bumpedAt },
      error: null,
    });
    const second = await initiateWholesaleOrderAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.idempotencyKey).not.toBe(second.value.idempotencyKey);
    expect(second.value.idempotencyKey).toBe(
      `nex-wholesale-${QUOTE_ID}-${bumpedAt}`,
    );
  });
});

describe("initiateWholesaleOrderAction · fail-closed propagation", () => {
  it("not_authenticated propagates verbatim", async () => {
    sessionState.current = null;
    const { initiateWholesaleOrderAction } = await import("../actions");
    const res = await initiateWholesaleOrderAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_authenticated");
  });

  it("not_your_quote propagates verbatim", async () => {
    sessionState.current = { account: { id: "someone-else" } };
    const { initiateWholesaleOrderAction } = await import("../actions");
    const res = await initiateWholesaleOrderAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_your_quote");
  });

  it("migration_not_applied when nex_wholesale_quote is missing (42P01)", async () => {
    setTable("nex_wholesale_quote", { data: null, error: { code: "42P01" } });
    const { initiateWholesaleOrderAction } = await import("../actions");
    const res = await initiateWholesaleOrderAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("migration_not_applied");
  });

  it("db_unavailable on non-42P01 DB error (never promoted to ok)", async () => {
    setTable("nex_wholesale_quote", { data: null, error: { code: "42703" } });
    const { initiateWholesaleOrderAction } = await import("../actions");
    const res = await initiateWholesaleOrderAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("db_unavailable");
  });

  it("not_approved_buyer when approval row is revoked", async () => {
    setTable("nex_wholesale_buyer_approval", {
      data: { status: "revoked", decided_at: "x", revoked_at: "y" },
      error: null,
    });
    const { initiateWholesaleOrderAction } = await import("../actions");
    const res = await initiateWholesaleOrderAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_approved_buyer");
  });

  it("stale_snapshot when caller's snapshot disagrees on goods_unit_price_pence", async () => {
    const snap = {
      id: QUOTE_ID,
      business_id: BUSINESS_ID,
      buyer_account_id: BUYER_ID,
      product_id: PRODUCT_ID,
      quantity: 100,
      currency: "IDR",
      goods_unit_price_pence: 999, // tampered
      goods_subtotal_pence: 150_000,
      freight_pence: 25_000,
      freight_method: "Sea FCL",
      transit_days_min: 14,
      transit_days_max: 21,
      duties_disposition: "buyer_pays" as const,
      terms_note: "FOB Jakarta",
      status: "accepted" as const,
      quoted_at: "2026-11-18T00:00:00Z",
      buyer_accepted_at: ACCEPTED_AT,
      buyer_rejected_at: null,
      cancelled_at: null,
      expires_at: FUTURE_ISO,
    };
    const { initiateWholesaleOrderAction } = await import("../actions");
    const res = await initiateWholesaleOrderAction({
      quoteId: QUOTE_ID,
      clientSnapshot: snap,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("stale_snapshot");
  });

  it("freight_missing when fresh row has null freight_pence", async () => {
    setTable("nex_wholesale_quote", {
      data: { ...ACCEPTED_ROW, freight_pence: null },
      error: null,
    });
    const { initiateWholesaleOrderAction } = await import("../actions");
    const res = await initiateWholesaleOrderAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("freight_missing");
  });

  it("wrong_status when row is still quoted (buyer hasn't accepted)", async () => {
    setTable("nex_wholesale_quote", {
      data: {
        ...ACCEPTED_ROW,
        status: "quoted",
        buyer_accepted_at: null,
      },
      error: null,
    });
    const { initiateWholesaleOrderAction } = await import("../actions");
    const res = await initiateWholesaleOrderAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("wrong_status");
  });
});
