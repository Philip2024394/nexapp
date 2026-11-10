// src/app/api/nex-native/paypal/webhook/__tests__/route.test.ts
//
// Owner-sealed 2026-11-10 (REVISED) · PayPal webhook route integration.
// Covers the full live-wire path:
//   · GET → 405
//   · Missing PAYPAL_WEBHOOK_ID → 503 credentials_missing
//   · PayPal verify FAILURE → 400 invalid_signature
//   · PayPal verify unreachable → 503 paypal_unavailable (retry-safe)
//   · PayPal verify SUCCESS + CHECKOUT.ORDER.APPROVED → records event
//   · PayPal verify SUCCESS + PAYMENT.CAPTURE.COMPLETED → markOrderPaid
//   · PayPal verify SUCCESS + PAYMENT.CAPTURE.COMPLETED replay → 200 replay_ignored
//   · PayPal verify SUCCESS + PAYMENT.CAPTURE.REFUNDED → refundOrder
//   · PayPal verify SUCCESS + PAYMENT.CAPTURE.DENIED → record only
//   · Payee merchant id mismatch → 403 payee_mismatch
//   · Unhandled event type → 200 unhandled
//   · Response NEVER echoes received transmission-sig or webhook_id

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetPaypalWebhookOauthCacheForTests } from "@/lib/nex-native/payments/paypal-webhook-service";

vi.mock("server-only", () => ({}));
vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

// Hoisted mocks for service layer boundaries
const {
  markOrderPaidMock,
  refundOrderMock,
  getOrderByIdMock,
  recordOrderEventMock,
  alreadyProcessedMock,
  readPaypalMerchantMock,
} = vi.hoisted(() => ({
  markOrderPaidMock: vi.fn(),
  refundOrderMock: vi.fn(),
  getOrderByIdMock: vi.fn(),
  recordOrderEventMock: vi.fn(),
  alreadyProcessedMock: vi.fn(),
  readPaypalMerchantMock: vi.fn(),
}));

vi.mock("@/lib/nex-native/commerce-service", () => ({
  markOrderPaid: (...a: unknown[]) => markOrderPaidMock(...a),
  refundOrder: (...a: unknown[]) => refundOrderMock(...a),
}));
vi.mock("@/lib/nex-native/order-service", () => ({
  getOrderById: (...a: unknown[]) => getOrderByIdMock(...a),
  recordOrderEvent: (...a: unknown[]) => recordOrderEventMock(...a),
}));

// Supabase-admin · provides two chains: nex_order_event idempotency
// probe + nex_business merchant id lookup. We override each per-test.
vi.mock("@/lib/nex-native/supabase-admin", () => {
  const chainEvent = () => ({
    select: () => ({
      contains: () => ({
        limit: () => alreadyProcessedMock(),
      }),
    }),
  });
  const chainBusiness = () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => readPaypalMerchantMock(),
      }),
    }),
  });
  return {
    nexSupabaseAdmin: {
      from: (table: string) =>
        table === "nex_order_event" ? chainEvent() : chainBusiness(),
    },
  };
});

// Global fetch spy · every call MUST go via explicit route mock.
const fetchSpy = vi.spyOn(globalThis, "fetch");

function mockPaypalVerifySuccess(): void {
  fetchSpy.mockImplementation(((input: string | URL) => {
    const url = String(input);
    if (url.includes("/v1/oauth2/token")) {
      return Promise.resolve(new Response(
        JSON.stringify({ access_token: "T", expires_in: 300 }),
        { status: 200, headers: { "content-type": "application/json" } },
      ));
    }
    if (url.includes("/v1/notifications/verify-webhook-signature")) {
      return Promise.resolve(new Response(
        JSON.stringify({ verification_status: "SUCCESS" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ));
    }
    throw new Error(`unexpected fetch · ${url}`);
  }) as unknown as typeof fetch);
}
function mockPaypalVerifyFailure(): void {
  fetchSpy.mockImplementation(((input: string | URL) => {
    const url = String(input);
    if (url.includes("/v1/oauth2/token")) {
      return Promise.resolve(new Response(
        JSON.stringify({ access_token: "T", expires_in: 300 }),
        { status: 200, headers: { "content-type": "application/json" } },
      ));
    }
    if (url.includes("/v1/notifications/verify-webhook-signature")) {
      return Promise.resolve(new Response(
        JSON.stringify({ verification_status: "FAILURE" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ));
    }
    throw new Error(`unexpected fetch · ${url}`);
  }) as unknown as typeof fetch);
}
function mockPaypalVerifyUnavailable(): void {
  fetchSpy.mockImplementation(((input: string | URL) => {
    const url = String(input);
    if (url.includes("/v1/oauth2/token")) {
      return Promise.resolve(new Response(
        JSON.stringify({ access_token: "T", expires_in: 300 }),
        { status: 200, headers: { "content-type": "application/json" } },
      ));
    }
    if (url.includes("/v1/notifications/verify-webhook-signature")) {
      return Promise.resolve(new Response("", { status: 503 }));
    }
    throw new Error(`unexpected fetch · ${url}`);
  }) as unknown as typeof fetch);
}

const BASE_HEADERS: Record<string, string> = {
  "content-type": "application/json",
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.sandbox.paypal.com/v1/certs/cert.pem",
  "paypal-transmission-id": "txid-1",
  "paypal-transmission-sig": "sig-abc",
  "paypal-transmission-time": "2026-11-10T00:00:00Z",
};

function buildReq(rawBody: string, headers: Record<string, string> = BASE_HEADERS) {
  return new Request("http://localhost:3008/api/nex-native/paypal/webhook", {
    method: "POST",
    headers,
    body: rawBody,
  }) as unknown as import("next/server").NextRequest;
}

async function invokePost(rawBody: string, headers: Record<string, string> = BASE_HEADERS) {
  const mod = await import("../route");
  const res = await mod.POST(buildReq(rawBody, headers));
  const json = await res.json();
  return { status: res.status, json };
}

function orderRow(id: string, business_id = "biz-1", state = "pending" as const) {
  return {
    id,
    customer_account_id: "cust-1",
    business_id,
    product_id: "prod-1",
    source_conversation_id: null,
    state,
    price_pence: 1999,
    currency: "USD",
    idempotency_key: null,
    customer_note: null,
    merchant_note: null,
    dispatch_tracking_url: null,
    created_at: "2026-11-10T00:00:00Z",
    updated_at: "2026-11-10T00:00:00Z",
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
  vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
  vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");
  _resetPaypalWebhookOauthCacheForTests();
  fetchSpy.mockReset();
  fetchSpy.mockImplementation((() => {
    throw new Error("unexpected fetch · test did not mock PayPal endpoints");
  }) as unknown as typeof fetch);
  markOrderPaidMock.mockReset();
  refundOrderMock.mockReset();
  getOrderByIdMock.mockReset();
  recordOrderEventMock.mockReset();
  alreadyProcessedMock.mockReset();
  readPaypalMerchantMock.mockReset();
  alreadyProcessedMock.mockResolvedValue({ data: [], error: null });
  readPaypalMerchantMock.mockResolvedValue({ data: null, error: null });
  recordOrderEventMock.mockResolvedValue(undefined);
});

afterAll(() => {
  fetchSpy.mockRestore();
});

describe("GET /api/nex-native/paypal/webhook", () => {
  it("returns 405", async () => {
    const mod = await import("../route");
    const res = await mod.GET();
    expect(res.status).toBe(405);
  });
});

describe("POST · credentials gating", () => {
  it("missing PAYPAL_WEBHOOK_ID → 503 credentials_missing · never calls PayPal", async () => {
    const { status, json } = await invokePost(
      JSON.stringify({ id: "EV-NC", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "c1", custom_id: "o1" } }),
    );
    expect(status).toBe(503);
    expect(json).toEqual({ ok: false, error: "credentials_missing" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(markOrderPaidMock).not.toHaveBeenCalled();
  });

  it("PAYPAL_WEBHOOK_ID present but CLIENT creds absent → still 503 credentials_missing", async () => {
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-1");
    const { status, json } = await invokePost(
      JSON.stringify({ id: "EV-NC2", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "c1", custom_id: "o1" } }),
    );
    expect(status).toBe(503);
    expect(json.error).toBe("credentials_missing");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("POST · signature verification live path", () => {
  beforeEach(() => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-1");
  });

  it("PayPal verify FAILURE → 400 invalid_signature · no state mutation", async () => {
    mockPaypalVerifyFailure();
    const { status, json } = await invokePost(
      JSON.stringify({ id: "EV-F", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "c1", custom_id: "o1" } }),
    );
    expect(status).toBe(400);
    expect(json.error).toBe("invalid_signature");
    expect(markOrderPaidMock).not.toHaveBeenCalled();
    expect(refundOrderMock).not.toHaveBeenCalled();
  });

  it("PayPal verify unreachable → 503 paypal_unavailable (retry-safe)", async () => {
    mockPaypalVerifyUnavailable();
    const { status, json } = await invokePost(
      JSON.stringify({ id: "EV-U", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "c1", custom_id: "o1" } }),
    );
    expect(status).toBe(503);
    expect(json.error).toBe("paypal_unavailable");
  });

  it("missing paypal-transmission-sig header → signature_invalid 400 · never calls PayPal", async () => {
    const headers = { ...BASE_HEADERS };
    delete headers["paypal-transmission-sig"];
    fetchSpy.mockImplementation(() => { throw new Error("must not be called"); });
    const { status, json } = await invokePost(
      JSON.stringify({ id: "EV-MH", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "c1", custom_id: "o1" } }),
      headers,
    );
    expect(status).toBe(400);
    expect(json.error).toBe("invalid_signature");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("POST · event dispatch happy paths", () => {
  beforeEach(() => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-1");
    mockPaypalVerifySuccess();
  });

  it("PAYMENT.CAPTURE.COMPLETED → markOrderPaid + records event · 200 order_paid", async () => {
    getOrderByIdMock.mockResolvedValueOnce(orderRow("order-1"));
    markOrderPaidMock.mockResolvedValueOnce({ order: orderRow("order-1", "biz-1", "paid" as const), ledgerEntryId: "le-1" });
    const body = JSON.stringify({
      id: "EV-OK",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "capture-1",
        custom_id: "order-1",
        amount: { currency_code: "USD", value: "19.99" },
      },
    });
    const { status, json } = await invokePost(body);
    expect(status).toBe(200);
    expect(json).toEqual({ ok: true, outcome: "order_paid" });
    expect(markOrderPaidMock).toHaveBeenCalledTimes(1);
    expect(markOrderPaidMock).toHaveBeenCalledWith("order-1", "00000000-0000-4000-8000-000000000001");
    expect(recordOrderEventMock).toHaveBeenCalledWith(expect.objectContaining({
      order_id: "order-1",
      event: "paypal.capture.completed",
      actor_account_id: "00000000-0000-4000-8000-000000000001",
    }));
  });

  it("PAYMENT.CAPTURE.COMPLETED replay → 200 replay_ignored · no markOrderPaid", async () => {
    // idempotency probe returns a prior row for this event id.
    alreadyProcessedMock.mockResolvedValueOnce({ data: [{ id: "already-recorded" }], error: null });
    const body = JSON.stringify({
      id: "EV-REPLAY",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: { id: "capture-2", custom_id: "order-r" },
    });
    const { status, json } = await invokePost(body);
    expect(status).toBe(200);
    expect(json.outcome).toBe("replay_ignored");
    expect(markOrderPaidMock).not.toHaveBeenCalled();
    expect(getOrderByIdMock).not.toHaveBeenCalled();
  });

  it("PAYMENT.CAPTURE.REFUNDED → refundOrder · 200 order_refunded", async () => {
    getOrderByIdMock.mockResolvedValueOnce(orderRow("order-ref", "biz-1", "paid" as const));
    refundOrderMock.mockResolvedValueOnce({ order: orderRow("order-ref", "biz-1", "paid" as const), reversalEntryId: "rv-1" });
    const body = JSON.stringify({
      id: "EV-REF",
      event_type: "PAYMENT.CAPTURE.REFUNDED",
      resource: { id: "ref-1", custom_id: "order-ref", amount: { currency_code: "USD", value: "19.99" } },
    });
    const { status, json } = await invokePost(body);
    expect(status).toBe(200);
    expect(json.outcome).toBe("order_refunded");
    expect(refundOrderMock).toHaveBeenCalledWith("order-ref", "00000000-0000-4000-8000-000000000001", "paypal.capture.refunded");
  });

  it("PAYMENT.CAPTURE.DENIED → records only · 200 capture_denied_recorded", async () => {
    getOrderByIdMock.mockResolvedValueOnce(orderRow("order-d"));
    const body = JSON.stringify({
      id: "EV-DENIED",
      event_type: "PAYMENT.CAPTURE.DENIED",
      resource: { id: "cap-d", custom_id: "order-d", amount: { currency_code: "USD", value: "19.99" } },
    });
    const { status, json } = await invokePost(body);
    expect(status).toBe(200);
    expect(json.outcome).toBe("capture_denied_recorded");
    expect(markOrderPaidMock).not.toHaveBeenCalled();
    expect(refundOrderMock).not.toHaveBeenCalled();
  });

  it("CHECKOUT.ORDER.APPROVED → records only · 200 approval_recorded", async () => {
    getOrderByIdMock.mockResolvedValueOnce(orderRow("order-a"));
    const body = JSON.stringify({
      id: "EV-APP",
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: { id: "paypal-order-1", custom_id: "order-a" },
    });
    const { status, json } = await invokePost(body);
    expect(status).toBe(200);
    expect(json.outcome).toBe("approval_recorded");
  });

  it("Unhandled event type → 200 unhandled · no order lookup", async () => {
    const body = JSON.stringify({
      id: "EV-OTHER",
      event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
      resource: { id: "sub-1" },
    });
    const { status, json } = await invokePost(body);
    expect(status).toBe(200);
    expect(json.outcome).toBe("unhandled");
    expect(getOrderByIdMock).not.toHaveBeenCalled();
  });
});

describe("POST · payee mismatch guard", () => {
  beforeEach(() => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-1");
    mockPaypalVerifySuccess();
  });

  it("payee mismatch → 403 · no state mutation · records audit event", async () => {
    getOrderByIdMock.mockResolvedValueOnce(orderRow("order-m"));
    readPaypalMerchantMock.mockResolvedValueOnce({
      data: { paypal_merchant_id: "M-EXPECTED" },
      error: null,
    });
    const body = JSON.stringify({
      id: "EV-MM",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "cap-m",
        custom_id: "order-m",
        payee: { merchant_id: "M-ATTACKER" },
      },
    });
    const { status, json } = await invokePost(body);
    expect(status).toBe(403);
    expect(json.error).toBe("payee_mismatch");
    expect(markOrderPaidMock).not.toHaveBeenCalled();
    expect(recordOrderEventMock).toHaveBeenCalledWith(expect.objectContaining({
      event: "paypal.payee_mismatch",
    }));
  });

  it("payee matches → proceeds to markOrderPaid", async () => {
    getOrderByIdMock.mockResolvedValueOnce(orderRow("order-ok"));
    readPaypalMerchantMock.mockResolvedValueOnce({
      data: { paypal_merchant_id: "M-SELLER" },
      error: null,
    });
    markOrderPaidMock.mockResolvedValueOnce({ order: orderRow("order-ok", "biz-1", "paid" as const), ledgerEntryId: "le-ok" });
    const body = JSON.stringify({
      id: "EV-MATCH",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "cap-ok",
        custom_id: "order-ok",
        payee: { merchant_id: "M-SELLER" },
      },
    });
    const { status, json } = await invokePost(body);
    expect(status).toBe(200);
    expect(json.outcome).toBe("order_paid");
    expect(markOrderPaidMock).toHaveBeenCalledTimes(1);
  });
});

describe("POST · information leakage", () => {
  beforeEach(() => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-TOP-SECRET-ID");
  });

  it("response NEVER echoes received transmission-sig or the webhook id", async () => {
    mockPaypalVerifyFailure();
    const leak = "SECRETSIG-DO-NOT-LEAK-7F19";
    const body = JSON.stringify({ id: "EV-L", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "c", custom_id: "o" } });
    const { json } = await invokePost(body, { ...BASE_HEADERS, "paypal-transmission-sig": leak });
    const serialised = JSON.stringify(json);
    expect(serialised).not.toContain(leak);
    expect(serialised).not.toContain("WH-TOP-SECRET-ID");
  });
});
