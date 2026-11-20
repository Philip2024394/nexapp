// src/lib/nex-native/wholesale/__tests__/payment-gate.test.ts
//
// Authored 2026-11-18 · Phase W follow-up (payment-gate wiring)
//
// Scope
//   Unit coverage for `evaluateWholesalePaymentGateAction` — the single
//   authoritative server-side gate that every wholesale payment / order
//   initiation path must call. Mocks the Supabase surface and the dev-
//   impersonation session resolver, so the test exercises the
//   orchestration (fail-closed, ownership, approval, freshness,
//   payment-eligibility) rather than a live DB.
//
// What is NOT covered here
//   · Real sandbox / prod DB round-trip — mig 350 and 351 remain
//     PROPOSAL-only, so the 42P01 branch is the only DB behaviour
//     reachable without applying migrations. The "migration_not_applied"
//     assertion encodes that explicitly.
//   · Charging Stripe · the gate never calls a payment provider.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────

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

// server-only import stub so approval-service compiles under test.
vi.mock("server-only", () => ({}));

// ─── Fixtures ────────────────────────────────────────────────────────

const BUSINESS_ID = "biz-1";
const BUYER_ID = "buyer-1";
const SELLER_ID = "seller-1";
const PRODUCT_ID = "prod-1";
const QUOTE_ID = "quote-1";

const FUTURE_ISO = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
const PAST_ISO = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

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
  buyer_accepted_at: "2026-11-18T01:00:00Z",
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

describe("evaluateWholesalePaymentGateAction · happy path", () => {
  it("returns total = goods subtotal + freight when all five gates pass", async () => {
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toMatchObject({
      quoteId: QUOTE_ID,
      businessId: BUSINESS_ID,
      buyerAccountId: BUYER_ID,
      productId: PRODUCT_ID,
      currency: "IDR",
      quantity: 100,
      goodsSubtotalPence: 150_000,
      freightPence: 25_000,
      freightMethod: "Sea FCL",
      totalPence: 175_000,
      acceptedAt: "2026-11-18T01:00:00Z",
    });
  });
});

describe("evaluateWholesalePaymentGateAction · auth / ownership", () => {
  it("not_authenticated when no session", async () => {
    sessionState.current = null;
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_authenticated");
  });

  it("not_your_quote when viewer != row.buyer_account_id", async () => {
    sessionState.current = { account: { id: "someone-else" } };
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_your_quote");
  });
});

describe("evaluateWholesalePaymentGateAction · fail-closed", () => {
  it("migration_not_applied when quote table is 42P01", async () => {
    setTable("nex_wholesale_quote", { data: null, error: { code: "42P01" } });
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("migration_not_applied");
  });

  it("migration_not_applied when approval table is 42P01 (even if quote reads clean)", async () => {
    setTable("nex_wholesale_buyer_approval", {
      data: null,
      error: { code: "42P01" },
    });
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("migration_not_applied");
  });

  it("db_unavailable on transient quote-table error", async () => {
    setTable("nex_wholesale_quote", { data: null, error: { code: "08006" } });
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("db_unavailable");
  });

  it("quote_not_found when row is null", async () => {
    setTable("nex_wholesale_quote", { data: null, error: null });
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("quote_not_found");
  });
});

describe("evaluateWholesalePaymentGateAction · approval state", () => {
  it("not_approved_buyer when approval row is pending", async () => {
    setTable("nex_wholesale_buyer_approval", {
      data: { status: "pending", decided_at: null, revoked_at: null },
      error: null,
    });
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_approved_buyer");
  });

  it("not_approved_buyer when approval row is revoked (post-acceptance)", async () => {
    setTable("nex_wholesale_buyer_approval", {
      data: {
        status: "revoked",
        decided_at: "2026-11-18T00:00:00Z",
        revoked_at: "2026-11-18T02:00:00Z",
      },
      error: null,
    });
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_approved_buyer");
  });

  it("not_approved_buyer when no approval row exists", async () => {
    setTable("nex_wholesale_buyer_approval", { data: null, error: null });
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_approved_buyer");
  });
});

describe("evaluateWholesalePaymentGateAction · freshness (material snapshot)", () => {
  it("stale_snapshot when client snapshot's goods_unit_price_pence has moved", async () => {
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: {
        ...ACCEPTED_ROW,
        goods_unit_price_pence: 999, // buyer saw a different price
      },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("stale_snapshot");
  });

  it("stale_snapshot when freight method changes between render + initiation", async () => {
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: { ...ACCEPTED_ROW, freight_method: "Air" },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("stale_snapshot");
  });

  it("stale_snapshot when buyer passes a quote belonging to another product", async () => {
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: { ...ACCEPTED_ROW, product_id: "prod-other" },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("stale_snapshot");
  });

  it("happy with matching snapshot", async () => {
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: { ...ACCEPTED_ROW },
    });
    expect(res.ok).toBe(true);
  });
});

describe("evaluateWholesalePaymentGateAction · payment-eligibility", () => {
  it("wrong_status on a 'quoted' row (not yet accepted)", async () => {
    setTable("nex_wholesale_quote", {
      data: { ...ACCEPTED_ROW, status: "quoted", buyer_accepted_at: null },
      error: null,
    });
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("wrong_status");
  });

  it("freight_missing when freight_pence is null (unknown freight is NOT zero)", async () => {
    setTable("nex_wholesale_quote", {
      data: { ...ACCEPTED_ROW, freight_pence: null },
      error: null,
    });
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("freight_missing");
  });

  it("expired when expires_at is in the past", async () => {
    setTable("nex_wholesale_quote", {
      data: { ...ACCEPTED_ROW, expires_at: PAST_ISO },
      error: null,
    });
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("expired");
  });

  it("wrong_status on a cancelled row", async () => {
    setTable("nex_wholesale_quote", {
      data: {
        ...ACCEPTED_ROW,
        status: "cancelled",
        cancelled_at: "2026-11-18T03:00:00Z",
      },
      error: null,
    });
    const { evaluateWholesalePaymentGateAction } = await import("../actions");
    const res = await evaluateWholesalePaymentGateAction({
      quoteId: QUOTE_ID,
      clientSnapshot: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("wrong_status");
  });
});
