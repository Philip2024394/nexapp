// src/lib/nex-native/manage-orders/__tests__/dispatch-service.test.ts
//
// Preparatory tests for the dispatch service. These test the SERVER
// OPERATION LAYER with mocked Supabase + mocked session resolver.
//
// IMPORTANT: these tests do NOT prove deployed database enforcement.
// They prove the TypeScript layer:
//   · Honours the feature flag (schema-safe disabled default)
//   · Derives seller identity from session · never from client input
//   · Rejects terminal payment states before the RPC is called
//   · Rejects non-owners with forbidden_not_fulfilling_seller
//   · Validates https-only tracking URL + qty/unit pairing + practical bounds
//   · Maps PostgreSQL RPC errors to typed DispatchSaveFailureReason
//
// DATABASE-BACKED tests covering:
//   · The SECURITY DEFINER RPC's own re-verification of ownership
//   · The DB CHECK constraints (dispatch_state, qty range, provider enum)
//   · The authenticated-caller CANNOT bypass via direct PostgREST UPDATE
// … are BLOCKED until migration 349 is applied to sandbox under a
// separate authorisation. They are enumerated in the dispatch-tracking
// checkpoint REPORT.md handoff section.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- mocks ----------------------------------------------------------------

type OrderRow = {
  id: string;
  business_id: string;
  state: string;
  customer_account_id: string;
  price_pence: number;
  currency: string;
  product_id: string;
};

type BizRow = { owner_account_id: string };

let featureEnabled = true;
let session: { account: { id: string } | null } | null = { account: { id: "seller-A" } };
let orderRow: OrderRow | null = {
  id: "order-1",
  business_id: "biz-A",
  state: "created",
  customer_account_id: "buyer-B",
  price_pence: 1799,
  currency: "EUR",
  product_id: "prod-X",
};
let bizRow: BizRow | null = { owner_account_id: "seller-A" };
let rpcReturn: {
  data: Array<Record<string, unknown>> | null;
  error: { message: string } | null;
} = {
  data: [
    {
      id: "order-1",
      dispatch_state: "preparing",
      dispatched_at: null,
      delivered_at: null,
      dispatch_provider: null,
      dispatch_provider_custom: null,
      dispatch_tracking_number: null,
      dispatch_tracking_url: null,
      estimated_transit_qty: null,
      estimated_transit_unit: null,
      tracking_updated_at: "2026-11-17T12:00:00.000Z",
    },
  ],
  error: null,
};

const rpcSpy = vi.fn(async (_name: string, _args: Record<string, unknown>) => rpcReturn);

vi.mock("@/lib/nex-native/manage-orders/dispatch-feature-flag", () => ({
  isDispatchFeatureEnabled: () => featureEnabled,
}));
vi.mock("@/lib/nex-native/app/dev-impersonation", () => ({
  resolveSessionWithDevOverride: async () => session,
}));
vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          maybeSingle: async () => {
            if (table === "nex_order") return { data: orderRow, error: null };
            if (table === "nex_business") return { data: bizRow, error: null };
            return { data: null, error: null };
          },
        }),
      }),
    }),
    rpc: (name: string, args: Record<string, unknown>) => rpcSpy(name, args),
  },
}));
vi.mock("@/lib/nex-native/manage-orders/order-notification-service", () => ({
  notifyBuyerShipmentUpdate: async () => ({
    kind: "shipment_update",
    recipientAccountId: null,
    attempted: 0,
    delivered: 0,
    failed: 0,
  }),
}));

// Import AFTER mocks.
import { sellerSaveOrderDispatch } from "../dispatch-service";

// ---- reset defaults between cases -----------------------------------------

beforeEach(() => {
  featureEnabled = true;
  session = { account: { id: "seller-A" } };
  orderRow = {
    id: "order-1",
    business_id: "biz-A",
    state: "created",
    customer_account_id: "buyer-B",
    price_pence: 1799,
    currency: "EUR",
    product_id: "prod-X",
  };
  bizRow = { owner_account_id: "seller-A" };
  rpcReturn = {
    data: [
      {
        id: "order-1",
        dispatch_state: "preparing",
        dispatched_at: null,
        delivered_at: null,
        dispatch_provider: null,
        dispatch_provider_custom: null,
        dispatch_tracking_number: null,
        dispatch_tracking_url: null,
        estimated_transit_qty: null,
        estimated_transit_unit: null,
        tracking_updated_at: "2026-11-17T12:00:00.000Z",
      },
    ],
    error: null,
  };
  rpcSpy.mockClear();
});

afterEach(() => {
  rpcSpy.mockReset();
});

// ---- cases ----------------------------------------------------------------

describe("sellerSaveOrderDispatch · feature-flag gate", () => {
  it("returns feature_disabled when flag is off · no RPC call", async () => {
    featureEnabled = false;
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: null,
      provider_custom: null,
      tracking_number: null,
      tracking_url: null,
      estimated_transit_qty: null,
      estimated_transit_unit: null,
      action: "save",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("feature_disabled");
    expect(rpcSpy).not.toHaveBeenCalled();
  });
});

describe("sellerSaveOrderDispatch · identity derivation", () => {
  it("returns not_signed_in when session has no account · no RPC call", async () => {
    session = null;
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: null,
      provider_custom: null,
      tracking_number: null,
      tracking_url: null,
      estimated_transit_qty: null,
      estimated_transit_unit: null,
      action: "save",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_signed_in");
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("passes the SESSION seller id to the RPC · never a client value", async () => {
    session = { account: { id: "seller-A" } };
    await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: null,
      provider_custom: null,
      tracking_number: null,
      tracking_url: null,
      estimated_transit_qty: null,
      estimated_transit_unit: null,
      action: "save",
    });
    expect(rpcSpy).toHaveBeenCalledOnce();
    const args = rpcSpy.mock.calls[0]![1] as Record<string, unknown>;
    expect(args.p_seller_account_id).toBe("seller-A");
  });
});

describe("sellerSaveOrderDispatch · ownership", () => {
  it("rejects a buyer-signed session that is NOT the business owner", async () => {
    session = { account: { id: "buyer-B" } };
    // buyer-B is on the order as customer but biz owner is seller-A
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: null,
      provider_custom: null,
      tracking_number: null,
      tracking_url: null,
      estimated_transit_qty: null,
      estimated_transit_unit: null,
      action: "mark_dispatched",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("forbidden_not_fulfilling_seller");
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("rejects an unrelated account", async () => {
    session = { account: { id: "stranger-Z" } };
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: null,
      provider_custom: null,
      tracking_number: null,
      tracking_url: null,
      estimated_transit_qty: null,
      estimated_transit_unit: null,
      action: "mark_dispatched",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("forbidden_not_fulfilling_seller");
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("rejects another seller trying to touch this order", async () => {
    session = { account: { id: "seller-OTHER" } };
    bizRow = { owner_account_id: "seller-A" }; // biz belongs to seller-A
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: "dhl",
      provider_custom: null,
      tracking_number: "ABC123",
      tracking_url: null,
      estimated_transit_qty: null,
      estimated_transit_unit: null,
      action: "save",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("forbidden_not_fulfilling_seller");
    expect(rpcSpy).not.toHaveBeenCalled();
  });
});

describe("sellerSaveOrderDispatch · terminal payment states", () => {
  it("rejects cancelled payment state before touching the RPC", async () => {
    orderRow = { ...orderRow!, state: "cancelled" };
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: null,
      provider_custom: null,
      tracking_number: null,
      tracking_url: null,
      estimated_transit_qty: null,
      estimated_transit_unit: null,
      action: "mark_dispatched",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("order_terminal_payment_state");
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("rejects refunded payment state", async () => {
    orderRow = { ...orderRow!, state: "refunded" };
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: null,
      provider_custom: null,
      tracking_number: null,
      tracking_url: null,
      estimated_transit_qty: null,
      estimated_transit_unit: null,
      action: "save",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("order_terminal_payment_state");
  });
});

describe("sellerSaveOrderDispatch · input validation (pre-RPC)", () => {
  it("rejects a non-https tracking URL", async () => {
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: "dhl",
      provider_custom: null,
      tracking_number: null,
      tracking_url: "http://evil.example.com/t",
      estimated_transit_qty: null,
      estimated_transit_unit: null,
      action: "save",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("tracking_url_must_be_https");
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("rejects qty without unit", async () => {
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: null,
      provider_custom: null,
      tracking_number: null,
      tracking_url: null,
      estimated_transit_qty: 5,
      estimated_transit_unit: null,
      action: "save",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_input");
  });

  it("rejects unit without qty", async () => {
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: null,
      provider_custom: null,
      tracking_number: null,
      tracking_url: null,
      estimated_transit_qty: null,
      estimated_transit_unit: "days",
      action: "save",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_input");
  });

  it("rejects days > 365", async () => {
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: null,
      provider_custom: null,
      tracking_number: null,
      tracking_url: null,
      estimated_transit_qty: 500,
      estimated_transit_unit: "days",
      action: "save",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_input");
  });

  it("rejects months > 12", async () => {
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: null,
      provider_custom: null,
      tracking_number: null,
      tracking_url: null,
      estimated_transit_qty: 24,
      estimated_transit_unit: "months",
      action: "save",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_input");
  });

  it("accepts sea_freight provider + 3 months estimate", async () => {
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: "sea_freight",
      provider_custom: "Evergreen EVER-A",
      tracking_number: null,
      tracking_url: "https://track.example.com/EVER-A",
      estimated_transit_qty: 3,
      estimated_transit_unit: "months",
      action: "save",
    });
    expect(r.ok).toBe(true);
    expect(rpcSpy).toHaveBeenCalledOnce();
  });

  it("rejects provider_custom when provider is dhl/ups/fedex", async () => {
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: "dhl",
      provider_custom: "trying to override",
      tracking_number: null,
      tracking_url: null,
      estimated_transit_qty: null,
      estimated_transit_unit: null,
      action: "save",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_input");
  });

  it("rejects invalid action", async () => {
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: null,
      provider_custom: null,
      tracking_number: null,
      tracking_url: null,
      estimated_transit_qty: null,
      estimated_transit_unit: null,
      // @ts-expect-error · hostile client input
      action: "mark_paid",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_action");
  });
});

describe("sellerSaveOrderDispatch · RPC error mapping", () => {
  it("maps forbidden_not_fulfilling_seller from RPC", async () => {
    rpcReturn = { data: null, error: { message: "forbidden_not_fulfilling_seller" } };
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: null,
      provider_custom: null,
      tracking_number: null,
      tracking_url: null,
      estimated_transit_qty: null,
      estimated_transit_unit: null,
      action: "save",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("forbidden_not_fulfilling_seller");
  });

  it("maps invalid_dispatch_transition from RPC", async () => {
    rpcReturn = { data: null, error: { message: "invalid_dispatch_transition" } };
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: null,
      provider_custom: null,
      tracking_number: null,
      tracking_url: null,
      estimated_transit_qty: null,
      estimated_transit_unit: null,
      action: "mark_delivered",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_dispatch_transition");
  });

  it("maps a generic DB error", async () => {
    rpcReturn = { data: null, error: { message: "connection reset" } };
    const r = await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: null,
      provider_custom: null,
      tracking_number: null,
      tracking_url: null,
      estimated_transit_qty: null,
      estimated_transit_unit: null,
      action: "save",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("db_error");
  });
});

describe("sellerSaveOrderDispatch · column-safety contract", () => {
  it("NEVER sends payment / price / ownership columns to the RPC", async () => {
    await sellerSaveOrderDispatch({
      order_id: "order-1",
      provider: "dhl",
      provider_custom: null,
      tracking_number: "ABC",
      tracking_url: "https://t.example.com/ABC",
      estimated_transit_qty: 7,
      estimated_transit_unit: "days",
      action: "mark_dispatched",
    });
    const args = rpcSpy.mock.calls[0]![1] as Record<string, unknown>;
    // Allowlist the dispatch service is allowed to send.
    const allowed = new Set([
      "p_order_id",
      "p_seller_account_id",
      "p_provider",
      "p_provider_custom",
      "p_tracking_number",
      "p_tracking_url",
      "p_estimated_qty",
      "p_estimated_unit",
      "p_action",
    ]);
    for (const k of Object.keys(args)) {
      expect(allowed.has(k), `unexpected RPC arg: ${k}`).toBe(true);
    }
    // Negative: common protected-field names must NOT appear.
    for (const forbidden of [
      "state",
      "price_pence",
      "currency",
      "customer_account_id",
      "business_id",
      "product_id",
      "customer_note",
      "merchant_note",
      "payment_method",
    ]) {
      expect(args).not.toHaveProperty(forbidden);
    }
  });
});
