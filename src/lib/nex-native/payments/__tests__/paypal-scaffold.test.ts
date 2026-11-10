// src/lib/nex-native/payments/__tests__/paypal-scaffold.test.ts
//
// Owner-sealed 2026-11-10 · verifies the PayPal Orders v2 scaffold
// never calls PayPal and returns the documented failure union in all
// four reachable branches:
//
//   · env absent + no seller merchant id     → seller_not_connected
//   · env absent + seller merchant id        → credentials_missing
//   · env present + no seller merchant id    → seller_not_connected
//   · env present + seller merchant id       → paypal_api_error (scaffold)
//
// Plus webhook-service coverage:
//   · verifyPaypalWebhookSignature returns credentials_missing / verification_requires_api_call
//   · parsePaypalWebhookEvent · all four discriminants + invalid JSON + missing fields
//   · extractNexOrderIdFromPaypal · custom_id first · invoice_id fallback · null
//   · NEX_PAYPAL_SYSTEM_ACTOR_ID shape

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Harness · stub server-only + env + supabase-admin so the service can be
// exercised without a live DB. `vi.hoisted` is NOT needed because
// `vi.mock` is hoisted and the stub module exposes a plain object.
vi.mock("server-only", () => ({}));
vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

// Default supabase-admin mock · returns null (column absent / row missing).
// Individual tests override via the chained `maybeSingle` result.
const supabaseMaybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock("../../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => supabaseMaybeSingleMock(),
        }),
      }),
    }),
  },
}));

// Forbid any network call during the whole suite · if the scaffold ever
// leaks a fetch call the tests will error loudly.
const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
  throw new Error("fetch was called — scaffold must not touch the network");
});

import {
  createMerchantDirectPaypalOrder,
  getSellerPaypalMerchantId,
} from "../paypal-checkout-service";
import {
  verifyPaypalWebhookSignature,
  parsePaypalWebhookEvent,
  extractNexOrderIdFromPaypal,
  NEX_PAYPAL_SYSTEM_ACTOR_ID,
} from "../paypal-webhook-service";
import type { NexOrderRow } from "../../types";

function buildOrder(overrides: Partial<NexOrderRow> = {}): NexOrderRow {
  return {
    id: "order-paypal-test",
    customer_account_id: "cust-1",
    business_id: "biz-1",
    product_id: "prod-1",
    source_conversation_id: null,
    state: "created",
    price_pence: 1999,
    currency: "USD",
    idempotency_key: null,
    customer_note: null,
    merchant_note: null,
    dispatch_tracking_url: null,
    created_at: "2026-11-10T00:00:00Z",
    updated_at: "2026-11-10T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  // Re-stub supabase env vars every test (vi.unstubAllEnvs clears them).
  vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
  vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
  vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");
  supabaseMaybeSingleMock.mockReset();
  supabaseMaybeSingleMock.mockResolvedValue({ data: null, error: null });
  fetchSpy.mockClear();
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
});

describe("NEX_PAYPAL_SYSTEM_ACTOR_ID", () => {
  it("is the documented constant (distinct from Stripe actor)", () => {
    expect(NEX_PAYPAL_SYSTEM_ACTOR_ID).toBe("00000000-0000-4000-8000-000000000001");
  });
});

describe("createMerchantDirectPaypalOrder", () => {
  it("credentials_missing when env absent + seller merchant id present", async () => {
    // No PAYPAL_* env vars set.
    const result = await createMerchantDirectPaypalOrder({
      order: buildOrder(),
      sellerPaypalMerchantId: "MERCHANT123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("credentials_missing");
    }
  });

  it("seller_not_connected when env absent + no seller merchant id", async () => {
    const result = await createMerchantDirectPaypalOrder({
      order: buildOrder(),
      sellerPaypalMerchantId: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("seller_not_connected");
    }
  });

  it("seller_not_connected when env present but no seller merchant id", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "mock-client");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "mock-secret");
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://example.nex");
    const result = await createMerchantDirectPaypalOrder({
      order: buildOrder(),
      sellerPaypalMerchantId: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("seller_not_connected");
    }
  });

  it("paypal_api_error (scaffold) when env present + seller merchant id present", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "mock-client");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "mock-secret");
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://example.nex");
    const result = await createMerchantDirectPaypalOrder({
      order: buildOrder(),
      sellerPaypalMerchantId: "MERCHANT123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("paypal_api_error");
      expect(result.detail).toMatch(/scaffold/i);
    }
  });

  it("order_not_payable when order state is not created|pending", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "mock-client");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "mock-secret");
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://example.nex");
    const result = await createMerchantDirectPaypalOrder({
      order: buildOrder({ state: "completed" }),
      sellerPaypalMerchantId: "MERCHANT123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("order_not_payable");
    }
  });
});

describe("getSellerPaypalMerchantId", () => {
  it("returns null when column/row is absent (fail-soft)", async () => {
    supabaseMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    const result = await getSellerPaypalMerchantId("biz-1");
    expect(result).toBeNull();
  });

  it("returns the value when supabase returns a row", async () => {
    supabaseMaybeSingleMock.mockResolvedValueOnce({
      data: { paypal_merchant_id: "MERCHANT-ABC" },
      error: null,
    });
    const result = await getSellerPaypalMerchantId("biz-1");
    expect(result).toBe("MERCHANT-ABC");
  });

  it("returns null when supabase throws (fail-soft catch)", async () => {
    supabaseMaybeSingleMock.mockRejectedValueOnce(new Error("column does not exist"));
    const result = await getSellerPaypalMerchantId("biz-1");
    expect(result).toBeNull();
  });
});

describe("verifyPaypalWebhookSignature", () => {
  it("returns credentials_missing when webhookId absent", () => {
    const r = verifyPaypalWebhookSignature("{}", {}, null);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("credentials_missing");
  });

  it("returns credentials_missing when webhookId is empty string", () => {
    const r = verifyPaypalWebhookSignature("{}", {}, "");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("credentials_missing");
  });

  it("returns verification_requires_api_call when webhookId present", () => {
    const r = verifyPaypalWebhookSignature(
      '{"id":"EV-1"}',
      { "paypal-transmission-sig": "xyz" },
      "WH-TEST-1",
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("verification_requires_api_call");
  });

  // Documented PayPal header set required by the live verify-webhook-signature
  // call · this scaffold does not enforce their presence individually but we
  // document the shape so the live wire-up has a clear bar.
  it("returns verification_requires_api_call even when ALL 5 PayPal headers present", () => {
    const r = verifyPaypalWebhookSignature(
      '{"id":"EV-ALL-5"}',
      {
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://api.sandbox.paypal.com/v1/certs/cert.pem",
        "paypal-transmission-id": "txid-123",
        "paypal-transmission-sig": "sig-abc",
        "paypal-transmission-time": "2026-11-10T00:00:00Z",
      },
      "WH-TEST-FULL",
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("verification_requires_api_call");
  });

  it("returns verification_requires_api_call with one header missing (defers to live call)", () => {
    const r = verifyPaypalWebhookSignature(
      '{"id":"EV-MISSING"}',
      {
        "paypal-auth-algo": "SHA256withRSA",
        // Intentional · paypal-cert-url missing.
        "paypal-transmission-id": "txid-123",
        "paypal-transmission-sig": "sig-abc",
        "paypal-transmission-time": "2026-11-10T00:00:00Z",
      },
      "WH-TEST-MISS",
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("verification_requires_api_call");
  });

  it("returns verification_requires_api_call for wrong-format paypal-transmission-time (defers to live call)", () => {
    const r = verifyPaypalWebhookSignature(
      '{"id":"EV-BAD-TIME"}',
      {
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://api.sandbox.paypal.com/v1/certs/cert.pem",
        "paypal-transmission-id": "txid-123",
        "paypal-transmission-sig": "sig-abc",
        "paypal-transmission-time": "not-a-date-at-all",
      },
      "WH-TEST-BADTIME",
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("verification_requires_api_call");
  });

  it("result object omits echo of received transmission-sig (opaque failure)", () => {
    const leak = "SECRETSIGLEAK123";
    const r = verifyPaypalWebhookSignature(
      '{"id":"EV-LEAK"}',
      { "paypal-transmission-sig": leak },
      "WH-TEST-LEAK",
    );
    expect(JSON.stringify(r)).not.toContain(leak);
  });
});

describe("parsePaypalWebhookEvent", () => {
  it("parses CHECKOUT.ORDER.APPROVED", () => {
    const raw = JSON.stringify({
      id: "WH-EVT-1",
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: {
        id: "5O190127TN364715T",
        custom_id: "order-abc",
        invoice_id: "order-abc",
        payee: { merchant_id: "MERCHANT-XYZ" },
      },
    });
    const ev = parsePaypalWebhookEvent(raw);
    expect(ev?.type).toBe("CHECKOUT.ORDER.APPROVED");
    if (ev?.type === "CHECKOUT.ORDER.APPROVED") {
      expect(ev.customId).toBe("order-abc");
      expect(ev.payeeMerchantId).toBe("MERCHANT-XYZ");
    }
  });

  it("parses PAYMENT.CAPTURE.COMPLETED with amount", () => {
    const raw = JSON.stringify({
      id: "WH-EVT-2",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "CAPTURE-1",
        custom_id: "order-def",
        amount: { currency_code: "USD", value: "19.99" },
      },
    });
    const ev = parsePaypalWebhookEvent(raw);
    expect(ev?.type).toBe("PAYMENT.CAPTURE.COMPLETED");
    if (ev?.type === "PAYMENT.CAPTURE.COMPLETED") {
      expect(ev.amount.currencyCode).toBe("USD");
      expect(ev.amount.value).toBe("19.99");
    }
  });

  it("parses PAYMENT.CAPTURE.REFUNDED", () => {
    const raw = JSON.stringify({
      id: "WH-EVT-3",
      event_type: "PAYMENT.CAPTURE.REFUNDED",
      resource: { id: "REFUND-1", custom_id: "order-ghi", amount: { currency_code: "USD", value: "19.99" } },
    });
    const ev = parsePaypalWebhookEvent(raw);
    expect(ev?.type).toBe("PAYMENT.CAPTURE.REFUNDED");
  });

  it("returns unhandled for other event types", () => {
    const raw = JSON.stringify({
      id: "WH-EVT-4",
      event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
      resource: { id: "SUB-1" },
    });
    const ev = parsePaypalWebhookEvent(raw);
    expect(ev?.type).toBe("unhandled");
    if (ev?.type === "unhandled") {
      expect(ev.originalType).toBe("BILLING.SUBSCRIPTION.ACTIVATED");
    }
  });

  it("returns null for invalid JSON", () => {
    expect(parsePaypalWebhookEvent("not-json")).toBeNull();
  });

  it("returns null for missing fields", () => {
    expect(parsePaypalWebhookEvent(JSON.stringify({ event_type: "x" }))).toBeNull();
    expect(parsePaypalWebhookEvent(JSON.stringify({ id: "a" }))).toBeNull();
  });
});

describe("extractNexOrderIdFromPaypal", () => {
  it("prefers custom_id", () => {
    const raw = JSON.stringify({
      id: "WH-1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: { id: "cap-1", custom_id: "order-custom", invoice_id: "order-invoice" },
    });
    const ev = parsePaypalWebhookEvent(raw);
    if (ev?.type !== "PAYMENT.CAPTURE.COMPLETED") throw new Error("wrong type");
    expect(extractNexOrderIdFromPaypal(ev)).toBe("order-custom");
  });

  it("falls back to invoice_id", () => {
    const raw = JSON.stringify({
      id: "WH-1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: { id: "cap-1", invoice_id: "order-invoice" },
    });
    const ev = parsePaypalWebhookEvent(raw);
    if (ev?.type !== "PAYMENT.CAPTURE.COMPLETED") throw new Error("wrong type");
    expect(extractNexOrderIdFromPaypal(ev)).toBe("order-invoice");
  });

  it("returns null when neither present", () => {
    const raw = JSON.stringify({
      id: "WH-1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: { id: "cap-1" },
    });
    const ev = parsePaypalWebhookEvent(raw);
    if (ev?.type !== "PAYMENT.CAPTURE.COMPLETED") throw new Error("wrong type");
    expect(extractNexOrderIdFromPaypal(ev)).toBeNull();
  });
});
