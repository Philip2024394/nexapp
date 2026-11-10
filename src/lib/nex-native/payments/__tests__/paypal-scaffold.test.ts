// src/lib/nex-native/payments/__tests__/paypal-scaffold.test.ts
//
// Owner-sealed 2026-11-10 (REVISED) · PayPal service tests under the
// live-wire implementation. Covers:
//   · createMerchantDirectPaypalOrder · credentials_missing / seller_not_
//     connected / order_not_payable / live happy-path (mocked fetch) /
//     OAuth cache reuse / API error / malformed response
//   · capturePaypalOrder · credentials_missing / happy-path / 422
//     not_approved_yet / network error
//   · getSellerPaypalMerchantId · present / absent / throw
//   · verifyPaypalWebhookSignature · credentials_missing / signature_invalid /
//     paypal_unavailable / happy-path SUCCESS / oauth_failed
//   · parsePaypalWebhookEvent · all 5 discriminants + invalid JSON
//   · extractNexOrderIdFromPaypal · custom_id first · invoice_id fallback · null
//
// Every test that reaches the live code path provides its own `fetchImpl`
// mock. A global fetch spy enforces that NOTHING else calls out to the
// network.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

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

const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
  throw new Error("fetch was called without an explicit fetchImpl mock");
});

import {
  createMerchantDirectPaypalOrder,
  capturePaypalOrder,
  getSellerPaypalMerchantId,
  isPaypalConfigured,
  _resetPaypalOauthCacheForTests,
} from "../paypal-checkout-service";
import {
  verifyPaypalWebhookSignature,
  parsePaypalWebhookEvent,
  extractNexOrderIdFromPaypal,
  NEX_PAYPAL_SYSTEM_ACTOR_ID,
  _resetPaypalWebhookOauthCacheForTests,
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

/** Build a mock fetch that routes by URL. Unknown URLs throw. */
function routedFetch(routes: Record<string, (req: RequestInit) => Response | Promise<Response>>): typeof fetch {
  return (async (url: string | URL, init?: RequestInit) => {
    const str = typeof url === "string" ? url : url.toString();
    for (const prefix of Object.keys(routes)) {
      if (str.startsWith(prefix)) {
        return await routes[prefix]!(init ?? {});
      }
    }
    throw new Error(`routedFetch · no route for ${str}`);
  }) as unknown as typeof fetch;
}

function jsonResp(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
  vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
  vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");
  supabaseMaybeSingleMock.mockReset();
  supabaseMaybeSingleMock.mockResolvedValue({ data: null, error: null });
  fetchSpy.mockClear();
  _resetPaypalOauthCacheForTests();
  _resetPaypalWebhookOauthCacheForTests();
});

afterEach(() => {
  // Default fetch spy must NEVER be called · any test that needs a
  // network call must pass an explicit fetchImpl.
  expect(fetchSpy).not.toHaveBeenCalled();
});

describe("NEX_PAYPAL_SYSTEM_ACTOR_ID", () => {
  it("is the documented constant", () => {
    expect(NEX_PAYPAL_SYSTEM_ACTOR_ID).toBe("00000000-0000-4000-8000-000000000001");
  });
});

describe("isPaypalConfigured", () => {
  it("false when env absent", () => {
    expect(isPaypalConfigured()).toBe(false);
  });
  it("true when all three env vars present", () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://nex.example");
    expect(isPaypalConfigured()).toBe(true);
  });
});

describe("createMerchantDirectPaypalOrder · fail-fast", () => {
  it("credentials_missing · env absent, merchant id present", async () => {
    const r = await createMerchantDirectPaypalOrder({
      order: buildOrder(),
      sellerPaypalMerchantId: "M-123",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("credentials_missing");
  });
  it("seller_not_connected · merchant id null, env absent", async () => {
    const r = await createMerchantDirectPaypalOrder({
      order: buildOrder(),
      sellerPaypalMerchantId: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("seller_not_connected");
  });
  it("seller_not_connected · merchant id null · env present · never calls PayPal", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://nex.example");
    const explode = vi.fn(() => { throw new Error("must not call"); });
    const r = await createMerchantDirectPaypalOrder({
      order: buildOrder(),
      sellerPaypalMerchantId: null,
      fetchImpl: explode as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("seller_not_connected");
    expect(explode).not.toHaveBeenCalled();
  });
  it("order_not_payable · when state is not created|pending", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://nex.example");
    const r = await createMerchantDirectPaypalOrder({
      order: buildOrder({ state: "paid" }),
      sellerPaypalMerchantId: "M-123",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("order_not_payable");
  });
});

describe("createMerchantDirectPaypalOrder · live wire-up with mocked fetch", () => {
  it("happy path · mints OAuth token · creates order · returns approval URL", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://nex.example");
    let oauthCount = 0;
    let createCount = 0;
    const impl = routedFetch({
      "https://api-m.sandbox.paypal.com/v1/oauth2/token": () => {
        oauthCount++;
        return jsonResp(200, { access_token: "T1", expires_in: 300 });
      },
      "https://api-m.sandbox.paypal.com/v2/checkout/orders": (init) => {
        createCount++;
        expect(init.method).toBe("POST");
        const body = JSON.parse(String(init.body ?? "{}"));
        expect(body.intent).toBe("CAPTURE");
        expect(body.purchase_units[0].payee.merchant_id).toBe("M-XYZ");
        expect(body.purchase_units[0].amount.currency_code).toBe("USD");
        expect(body.purchase_units[0].amount.value).toBe("19.99");
        return jsonResp(201, {
          id: "PAYPAL-ORDER-1",
          links: [
            { rel: "self", href: "https://api/orders/1" },
            { rel: "approve", href: "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-1" },
          ],
        });
      },
    });
    const r = await createMerchantDirectPaypalOrder({
      order: buildOrder(),
      sellerPaypalMerchantId: "M-XYZ",
      fetchImpl: impl,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.orderId).toBe("PAYPAL-ORDER-1");
      expect(r.url).toContain("sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-1");
    }
    expect(oauthCount).toBe(1);
    expect(createCount).toBe(1);
  });

  it("OAuth cache is reused across two create calls in the same process", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://nex.example");
    let oauthCount = 0;
    let createCount = 0;
    const impl = routedFetch({
      "https://api-m.sandbox.paypal.com/v1/oauth2/token": () => {
        oauthCount++;
        return jsonResp(200, { access_token: "T2", expires_in: 300 });
      },
      "https://api-m.sandbox.paypal.com/v2/checkout/orders": () => {
        createCount++;
        return jsonResp(201, { id: `PO-${createCount}`, links: [{ rel: "approve", href: "https://approve/a" }] });
      },
    });
    await createMerchantDirectPaypalOrder({ order: buildOrder({ id: "order-A" }), sellerPaypalMerchantId: "M-A", fetchImpl: impl });
    await createMerchantDirectPaypalOrder({ order: buildOrder({ id: "order-B" }), sellerPaypalMerchantId: "M-B", fetchImpl: impl });
    expect(oauthCount).toBe(1);
    expect(createCount).toBe(2);
  });

  it("oauth_failed when token mint returns non-2xx · no create call attempted", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://nex.example");
    let createCount = 0;
    const impl = routedFetch({
      "https://api-m.sandbox.paypal.com/v1/oauth2/token": () => jsonResp(401, { error: "invalid_client" }),
      "https://api-m.sandbox.paypal.com/v2/checkout/orders": () => {
        createCount++;
        return jsonResp(201, {});
      },
    });
    const r = await createMerchantDirectPaypalOrder({
      order: buildOrder(),
      sellerPaypalMerchantId: "M-XYZ",
      fetchImpl: impl,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("oauth_failed");
    expect(createCount).toBe(0);
  });

  it("paypal_api_error when create returns non-2xx · surfaces httpStatus", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://nex.example");
    const impl = routedFetch({
      "https://api-m.sandbox.paypal.com/v1/oauth2/token": () => jsonResp(200, { access_token: "T", expires_in: 300 }),
      "https://api-m.sandbox.paypal.com/v2/checkout/orders": () => jsonResp(422, { error: "invalid_body" }),
    });
    const r = await createMerchantDirectPaypalOrder({
      order: buildOrder(),
      sellerPaypalMerchantId: "M-XYZ",
      fetchImpl: impl,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("paypal_api_error");
      expect(r.httpStatus).toBe(422);
    }
  });

  it("paypal_api_error when response missing approve link", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://nex.example");
    const impl = routedFetch({
      "https://api-m.sandbox.paypal.com/v1/oauth2/token": () => jsonResp(200, { access_token: "T", expires_in: 300 }),
      "https://api-m.sandbox.paypal.com/v2/checkout/orders": () => jsonResp(201, { id: "PO-1", links: [{ rel: "self", href: "..." }] }),
    });
    const r = await createMerchantDirectPaypalOrder({
      order: buildOrder(),
      sellerPaypalMerchantId: "M-XYZ",
      fetchImpl: impl,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("paypal_api_error");
  });

  it("live env points at the live PayPal host", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://nex.example");
    vi.stubEnv("PAYPAL_ENV", "live");
    const seenUrls: string[] = [];
    const impl = ((async (url: string | URL, init?: RequestInit) => {
      void init;
      seenUrls.push(String(url));
      return jsonResp(200, { access_token: "T", expires_in: 300 });
    }) as unknown) as typeof fetch;
    await createMerchantDirectPaypalOrder({
      order: buildOrder(),
      sellerPaypalMerchantId: "M",
      fetchImpl: impl,
    });
    // At minimum the oauth call must have hit the live host.
    expect(seenUrls.some((u) => u.startsWith("https://api-m.paypal.com"))).toBe(true);
    // And it MUST NOT have hit the sandbox host.
    expect(seenUrls.some((u) => u.startsWith("https://api-m.sandbox.paypal.com"))).toBe(false);
  });
});

describe("capturePaypalOrder", () => {
  it("credentials_missing when env absent", async () => {
    const r = await capturePaypalOrder({ paypalOrderId: "PO-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("credentials_missing");
  });

  it("happy-path · returns capture id + amount + merchant id", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://nex.example");
    const impl = routedFetch({
      "https://api-m.sandbox.paypal.com/v1/oauth2/token": () => jsonResp(200, { access_token: "T", expires_in: 300 }),
      "https://api-m.sandbox.paypal.com/v2/checkout/orders/PO-1/capture": () =>
        jsonResp(201, {
          id: "PO-1",
          status: "COMPLETED",
          purchase_units: [{
            payee: { merchant_id: "M-XYZ" },
            custom_id: "nex-order-1",
            payments: {
              captures: [{
                id: "CAP-1",
                status: "COMPLETED",
                amount: { currency_code: "USD", value: "19.99" },
                custom_id: "nex-order-1",
              }],
            },
          }],
        }),
    });
    const r = await capturePaypalOrder({ paypalOrderId: "PO-1", fetchImpl: impl });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.captureId).toBe("CAP-1");
      expect(r.status).toBe("COMPLETED");
      expect(r.payeeMerchantId).toBe("M-XYZ");
      expect(r.amount.value).toBe("19.99");
      expect(r.nexOrderId).toBe("nex-order-1");
    }
  });

  it("not_approved_yet on PayPal 422", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://nex.example");
    const impl = routedFetch({
      "https://api-m.sandbox.paypal.com/v1/oauth2/token": () => jsonResp(200, { access_token: "T", expires_in: 300 }),
      "https://api-m.sandbox.paypal.com/v2/checkout/orders/PO-9/capture": () =>
        jsonResp(422, { error: "UNPROCESSABLE_ENTITY" }),
    });
    const r = await capturePaypalOrder({ paypalOrderId: "PO-9", fetchImpl: impl });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("not_approved_yet");
      expect(r.httpStatus).toBe(422);
    }
  });

  it("paypal_api_error on network throw", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://nex.example");
    const impl = routedFetch({
      "https://api-m.sandbox.paypal.com/v1/oauth2/token": () => jsonResp(200, { access_token: "T", expires_in: 300 }),
      "https://api-m.sandbox.paypal.com/v2/checkout/orders/PO-10/capture": () => {
        throw new TypeError("network down");
      },
    });
    const r = await capturePaypalOrder({ paypalOrderId: "PO-10", fetchImpl: impl });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("paypal_api_error");
  });
});

describe("getSellerPaypalMerchantId", () => {
  it("returns null when supabase row is null (fail-soft)", async () => {
    supabaseMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await getSellerPaypalMerchantId("biz-1")).toBeNull();
  });
  it("returns the merchant id when present", async () => {
    supabaseMaybeSingleMock.mockResolvedValueOnce({
      data: { paypal_merchant_id: "M-ABC" },
      error: null,
    });
    expect(await getSellerPaypalMerchantId("biz-1")).toBe("M-ABC");
  });
  it("returns null when supabase throws (column absent pre-mig-336)", async () => {
    supabaseMaybeSingleMock.mockRejectedValueOnce(new Error("column does not exist"));
    expect(await getSellerPaypalMerchantId("biz-1")).toBeNull();
  });
});

describe("verifyPaypalWebhookSignature · live wire-up with mocked fetch", () => {
  const BASE_HEADERS = {
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api.sandbox.paypal.com/v1/certs/cert.pem",
    "paypal-transmission-id": "txid-1",
    "paypal-transmission-sig": "sig-abc",
    "paypal-transmission-time": "2026-11-10T00:00:00Z",
  };

  it("credentials_missing when PAYPAL_WEBHOOK_ID absent", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    const r = await verifyPaypalWebhookSignature('{"id":"EV-1"}', BASE_HEADERS, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("credentials_missing");
  });

  it("credentials_missing when PAYPAL_CLIENT_ID absent", async () => {
    const r = await verifyPaypalWebhookSignature('{"id":"EV-1"}', BASE_HEADERS, "WH-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("credentials_missing");
  });

  it("signature_invalid when any header missing · never calls PayPal", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    const explode = vi.fn(() => { throw new Error("must not be called"); });
    const headers = { ...BASE_HEADERS, "paypal-transmission-sig": null };
    const r = await verifyPaypalWebhookSignature('{"id":"EV-1"}', headers, "WH-1", {
      fetchImpl: explode as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("signature_invalid");
    expect(explode).not.toHaveBeenCalled();
  });

  it("happy path · PayPal verify returns SUCCESS", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    const impl = routedFetch({
      "https://api-m.sandbox.paypal.com/v1/oauth2/token": () => jsonResp(200, { access_token: "T", expires_in: 300 }),
      "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature": (init) => {
        const body = JSON.parse(String(init.body ?? "{}"));
        expect(body.auth_algo).toBe("SHA256withRSA");
        expect(body.webhook_id).toBe("WH-1");
        return jsonResp(200, { verification_status: "SUCCESS" });
      },
    });
    const r = await verifyPaypalWebhookSignature(
      '{"id":"EV-OK","event_type":"PAYMENT.CAPTURE.COMPLETED"}',
      BASE_HEADERS,
      "WH-1",
      { fetchImpl: impl },
    );
    expect(r.ok).toBe(true);
  });

  it("signature_invalid when PayPal verify returns FAILURE", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    const impl = routedFetch({
      "https://api-m.sandbox.paypal.com/v1/oauth2/token": () => jsonResp(200, { access_token: "T", expires_in: 300 }),
      "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature": () =>
        jsonResp(200, { verification_status: "FAILURE" }),
    });
    const r = await verifyPaypalWebhookSignature(
      '{"id":"EV-BAD"}',
      BASE_HEADERS,
      "WH-1",
      { fetchImpl: impl },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("signature_invalid");
  });

  it("paypal_unavailable when verify endpoint returns 500", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    const impl = routedFetch({
      "https://api-m.sandbox.paypal.com/v1/oauth2/token": () => jsonResp(200, { access_token: "T", expires_in: 300 }),
      "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature": () =>
        jsonResp(500, { error: "SERVER_ERROR" }),
    });
    const r = await verifyPaypalWebhookSignature('{"id":"EV-1"}', BASE_HEADERS, "WH-1", { fetchImpl: impl });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("paypal_unavailable");
      expect(r.httpStatus).toBe(500);
    }
  });

  it("oauth_failed when token mint 401 · never calls verify endpoint", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    let verifyCalls = 0;
    const impl = routedFetch({
      "https://api-m.sandbox.paypal.com/v1/oauth2/token": () => jsonResp(401, { error: "invalid_client" }),
      "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature": () => {
        verifyCalls++;
        return jsonResp(200, { verification_status: "SUCCESS" });
      },
    });
    const r = await verifyPaypalWebhookSignature('{"id":"EV-1"}', BASE_HEADERS, "WH-1", { fetchImpl: impl });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("oauth_failed");
    expect(verifyCalls).toBe(0);
  });

  it("response NEVER echoes the transmission-sig", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "cid");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    const impl = routedFetch({
      "https://api-m.sandbox.paypal.com/v1/oauth2/token": () => jsonResp(200, { access_token: "T", expires_in: 300 }),
      "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature": () =>
        jsonResp(200, { verification_status: "FAILURE" }),
    });
    const leak = "SECRETSIG-DO-NOT-LEAK-7F19";
    const r = await verifyPaypalWebhookSignature(
      '{"id":"EV-L"}',
      { ...BASE_HEADERS, "paypal-transmission-sig": leak },
      "WH-L",
      { fetchImpl: impl },
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

  it("parses PAYMENT.CAPTURE.DENIED", () => {
    const raw = JSON.stringify({
      id: "WH-EVT-D",
      event_type: "PAYMENT.CAPTURE.DENIED",
      resource: { id: "cap-x", custom_id: "order-denied", amount: { currency_code: "USD", value: "5.00" } },
    });
    const ev = parsePaypalWebhookEvent(raw);
    expect(ev?.type).toBe("PAYMENT.CAPTURE.DENIED");
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

  it("returns null for invalid JSON or missing fields", () => {
    expect(parsePaypalWebhookEvent("not-json")).toBeNull();
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
