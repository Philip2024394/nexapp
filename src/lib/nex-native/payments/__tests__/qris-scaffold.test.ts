// src/lib/nex-native/payments/__tests__/qris-scaffold.test.ts
//
// Owner-sealed 2026-11-10 · verifies the dynamic QRIS scaffold:
//   · createMerchantDirectQrisOrder never calls out, matches
//     Stripe/PayPal failure-union shape
//   · verifyMidtransSignature · valid / invalid / tampered / missing-key
//   · verifyXenditSignature · valid / invalid / tampered / missing-token
//   · timing-safe compare correctness
//   · parse helpers for both providers · all discriminants + null paths
//   · NEX_QRIS_SYSTEM_ACTOR_ID shape

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";

// Harness · stub server-only + env + supabase-admin.
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

// Forbid any network call during the whole suite.
const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
  throw new Error("fetch was called — scaffold must not touch the network");
});

import {
  createMerchantDirectQrisOrder,
  getSellerQrisMerchantId,
} from "../qris-dynamic-service";
import {
  verifyMidtransSignature,
  verifyXenditSignature,
  computeMidtransSignature,
  computeXenditSignature,
  timingSafeHexEqual,
  parseMidtransWebhookEvent,
  parseXenditWebhookEvent,
  NEX_QRIS_SYSTEM_ACTOR_ID,
} from "../qris-webhook-service";
import type { NexOrderRow } from "../../types";

const MIDTRANS_SERVER_KEY = "SB-Mid-server-TEST-KEY-do-not-commit";
const XENDIT_WEBHOOK_TOKEN = "xnd-webhook-token-test-do-not-commit";

function buildOrder(overrides: Partial<NexOrderRow> = {}): NexOrderRow {
  return {
    id: "order-qris-test",
    customer_account_id: "cust-1",
    business_id: "biz-1",
    product_id: "prod-1",
    source_conversation_id: null,
    state: "created",
    price_pence: 5000000, // IDR 50,000.00 · stored in pence (smallest unit ×100)
    currency: "IDR",
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

describe("NEX_QRIS_SYSTEM_ACTOR_ID", () => {
  it("is the documented constant", () => {
    expect(NEX_QRIS_SYSTEM_ACTOR_ID).toBe("00000000-0000-4000-8000-000000000002");
  });
});

describe("timingSafeHexEqual", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeHexEqual("abc123", "abc123")).toBe(true);
  });
  it("returns false for different strings of equal length", () => {
    expect(timingSafeHexEqual("abc123", "abc124")).toBe(false);
  });
  it("returns false for different-length strings", () => {
    expect(timingSafeHexEqual("abc", "abcd")).toBe(false);
  });
  it("returns false for non-string input", () => {
    // @ts-expect-error · defensive branch
    expect(timingSafeHexEqual(null, "abc")).toBe(false);
    // @ts-expect-error · defensive branch
    expect(timingSafeHexEqual("abc", undefined)).toBe(false);
  });
});

describe("createMerchantDirectQrisOrder", () => {
  it("seller_not_connected when neither provider id is set", async () => {
    const result = await createMerchantDirectQrisOrder({
      order: buildOrder(),
      sellerMidtransMerchantId: {
        midtransMerchantId: null,
        xenditBusinessId: null,
        anyConnected: false,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("seller_not_connected");
  });

  it("credentials_missing when seller connected but no provider env", async () => {
    const result = await createMerchantDirectQrisOrder({
      order: buildOrder(),
      sellerMidtransMerchantId: {
        midtransMerchantId: "SUB-MERCHANT-1",
        xenditBusinessId: null,
        anyConnected: true,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("credentials_missing");
  });

  it("qris_api_error (scaffold) when env + seller both present", async () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", MIDTRANS_SERVER_KEY);
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://example.nex");
    const result = await createMerchantDirectQrisOrder({
      order: buildOrder(),
      sellerMidtransMerchantId: {
        midtransMerchantId: "SUB-MERCHANT-1",
        xenditBusinessId: null,
        anyConnected: true,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("qris_api_error");
  });

  it("order_not_payable for non-created/pending states", async () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", MIDTRANS_SERVER_KEY);
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://example.nex");
    const result = await createMerchantDirectQrisOrder({
      order: buildOrder({ state: "completed" }),
      sellerMidtransMerchantId: {
        midtransMerchantId: "SUB-1",
        xenditBusinessId: null,
        anyConnected: true,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("order_not_payable");
  });

  it("works with xendit-only seller connection", async () => {
    vi.stubEnv("XENDIT_SECRET_KEY", "xnd-secret");
    vi.stubEnv("NEX_APP_PUBLIC_URL", "https://example.nex");
    const result = await createMerchantDirectQrisOrder({
      order: buildOrder(),
      sellerMidtransMerchantId: {
        midtransMerchantId: null,
        xenditBusinessId: "biz-xnd-1",
        anyConnected: true,
      },
    });
    // Scaffold always returns qris_api_error when env + seller are both present.
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("qris_api_error");
  });
});

describe("getSellerQrisMerchantId", () => {
  it("returns empty + anyConnected=false when columns absent (fail-soft)", async () => {
    supabaseMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    const r = await getSellerQrisMerchantId("biz-1");
    expect(r.midtransMerchantId).toBeNull();
    expect(r.xenditBusinessId).toBeNull();
    expect(r.anyConnected).toBe(false);
  });

  it("returns midtrans when only midtrans is set", async () => {
    supabaseMaybeSingleMock.mockResolvedValueOnce({
      data: { midtrans_merchant_id: "MT-1", xendit_business_id: null },
      error: null,
    });
    const r = await getSellerQrisMerchantId("biz-1");
    expect(r.midtransMerchantId).toBe("MT-1");
    expect(r.xenditBusinessId).toBeNull();
    expect(r.anyConnected).toBe(true);
  });

  it("returns xendit when only xendit is set", async () => {
    supabaseMaybeSingleMock.mockResolvedValueOnce({
      data: { midtrans_merchant_id: null, xendit_business_id: "XND-1" },
      error: null,
    });
    const r = await getSellerQrisMerchantId("biz-1");
    expect(r.xenditBusinessId).toBe("XND-1");
    expect(r.anyConnected).toBe(true);
  });

  it("returns empty (fail-soft) when supabase throws", async () => {
    supabaseMaybeSingleMock.mockRejectedValueOnce(new Error("column missing"));
    const r = await getSellerQrisMerchantId("biz-1");
    expect(r.anyConnected).toBe(false);
  });
});

describe("computeMidtransSignature", () => {
  it("matches the documented SHA512 of order_id + status_code + gross_amount + server_key", () => {
    const payload = { order_id: "order-123", status_code: "200", gross_amount: "50000.00" };
    const expected = createHash("sha512")
      .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${MIDTRANS_SERVER_KEY}`, "utf8")
      .digest("hex");
    expect(computeMidtransSignature(payload, MIDTRANS_SERVER_KEY)).toBe(expected);
  });
});

describe("verifyMidtransSignature", () => {
  const payload = { order_id: "order-123", status_code: "200", gross_amount: "50000.00" };
  it("valid signature → true", () => {
    const sig = computeMidtransSignature(payload, MIDTRANS_SERVER_KEY);
    expect(verifyMidtransSignature(payload, sig, MIDTRANS_SERVER_KEY)).toBe(true);
  });
  it("invalid signature → false", () => {
    expect(verifyMidtransSignature(payload, "0".repeat(128), MIDTRANS_SERVER_KEY)).toBe(false);
  });
  it("tampered gross_amount (same signature) → false", () => {
    const sig = computeMidtransSignature(payload, MIDTRANS_SERVER_KEY);
    const tampered = { ...payload, gross_amount: "99999.00" };
    expect(verifyMidtransSignature(tampered, sig, MIDTRANS_SERVER_KEY)).toBe(false);
  });
  it("tampered order_id (same signature) → false", () => {
    const sig = computeMidtransSignature(payload, MIDTRANS_SERVER_KEY);
    const tampered = { ...payload, order_id: "order-HACK" };
    expect(verifyMidtransSignature(tampered, sig, MIDTRANS_SERVER_KEY)).toBe(false);
  });
  it("missing serverKey → false", () => {
    const sig = computeMidtransSignature(payload, MIDTRANS_SERVER_KEY);
    expect(verifyMidtransSignature(payload, sig, "")).toBe(false);
    expect(verifyMidtransSignature(payload, sig, null)).toBe(false);
    expect(verifyMidtransSignature(payload, sig, undefined)).toBe(false);
  });
  it("missing signature → false", () => {
    expect(verifyMidtransSignature(payload, null, MIDTRANS_SERVER_KEY)).toBe(false);
    expect(verifyMidtransSignature(payload, "", MIDTRANS_SERVER_KEY)).toBe(false);
  });
  it("missing payload → false", () => {
    expect(verifyMidtransSignature(null, "abc", MIDTRANS_SERVER_KEY)).toBe(false);
  });
  it("signed with different key → false", () => {
    const sig = computeMidtransSignature(payload, "OTHER-KEY");
    expect(verifyMidtransSignature(payload, sig, MIDTRANS_SERVER_KEY)).toBe(false);
  });
});

describe("computeXenditSignature", () => {
  it("matches the documented HMAC-SHA256 of the raw body under the webhook token", () => {
    const body = '{"id":"cb-1","data":{"status":"SUCCEEDED","reference_id":"order-1","amount":50000}}';
    const expected = createHmac("sha256", XENDIT_WEBHOOK_TOKEN).update(body, "utf8").digest("hex");
    expect(computeXenditSignature(body, XENDIT_WEBHOOK_TOKEN)).toBe(expected);
  });
});

describe("verifyXenditSignature", () => {
  const body = '{"id":"cb-1","data":{"status":"SUCCEEDED","reference_id":"order-1","amount":50000}}';
  it("valid signature → true", () => {
    const sig = computeXenditSignature(body, XENDIT_WEBHOOK_TOKEN);
    expect(verifyXenditSignature(body, sig, XENDIT_WEBHOOK_TOKEN)).toBe(true);
  });
  it("invalid signature → false", () => {
    expect(verifyXenditSignature(body, "0".repeat(64), XENDIT_WEBHOOK_TOKEN)).toBe(false);
  });
  it("tampered body (same header) → false", () => {
    const sig = computeXenditSignature(body, XENDIT_WEBHOOK_TOKEN);
    const tampered = body.replace("50000", "99999");
    expect(verifyXenditSignature(tampered, sig, XENDIT_WEBHOOK_TOKEN)).toBe(false);
  });
  it("missing token → false", () => {
    const sig = computeXenditSignature(body, XENDIT_WEBHOOK_TOKEN);
    expect(verifyXenditSignature(body, sig, "")).toBe(false);
    expect(verifyXenditSignature(body, sig, null)).toBe(false);
    expect(verifyXenditSignature(body, sig, undefined)).toBe(false);
  });
  it("missing header → false", () => {
    expect(verifyXenditSignature(body, null, XENDIT_WEBHOOK_TOKEN)).toBe(false);
    expect(verifyXenditSignature(body, "", XENDIT_WEBHOOK_TOKEN)).toBe(false);
  });
  it("signed with different token → false", () => {
    const sig = computeXenditSignature(body, "OTHER-TOKEN");
    expect(verifyXenditSignature(body, sig, XENDIT_WEBHOOK_TOKEN)).toBe(false);
  });
});

describe("parseMidtransWebhookEvent", () => {
  it("settlement → type=settlement with gross amount + currency", () => {
    const raw = JSON.stringify({
      transaction_id: "mt-tx-1",
      order_id: "order-123",
      transaction_status: "settlement",
      status_code: "200",
      gross_amount: "50000.00",
      currency: "IDR",
    });
    const ev = parseMidtransWebhookEvent(raw);
    expect(ev?.type).toBe("settlement");
    if (ev?.type === "settlement") {
      expect(ev.orderId).toBe("order-123");
      expect(ev.grossAmount).toBe("50000.00");
      expect(ev.currency).toBe("IDR");
    }
  });
  it("capture also maps to settlement", () => {
    const raw = JSON.stringify({
      transaction_id: "mt-tx-1",
      order_id: "order-123",
      transaction_status: "capture",
      status_code: "200",
      gross_amount: "50000.00",
    });
    const ev = parseMidtransWebhookEvent(raw);
    expect(ev?.type).toBe("settlement");
  });
  it("pending / expire / cancel / deny", () => {
    for (const status of ["pending", "expire", "cancel", "deny"] as const) {
      const raw = JSON.stringify({
        transaction_id: `mt-${status}`,
        order_id: "o",
        transaction_status: status,
        status_code: "202",
        gross_amount: "1.00",
      });
      const ev = parseMidtransWebhookEvent(raw);
      expect(ev?.type).toBe(status);
    }
  });
  it("other status → unhandled", () => {
    const raw = JSON.stringify({
      transaction_id: "mt-x",
      order_id: "o",
      transaction_status: "refund",
      status_code: "200",
      gross_amount: "1.00",
    });
    const ev = parseMidtransWebhookEvent(raw);
    expect(ev?.type).toBe("unhandled");
  });
  it("invalid JSON → null", () => {
    expect(parseMidtransWebhookEvent("not-json")).toBeNull();
  });
  it("missing required fields → null", () => {
    expect(parseMidtransWebhookEvent(JSON.stringify({ transaction_id: "x" }))).toBeNull();
  });
});

describe("Xendit · Unicode body round-trip (HMAC over UTF-8 bytes)", () => {
  it("HMAC-SHA256 of a body with multi-byte UTF-8 characters round-trips", () => {
    // Include scripts requiring multi-byte UTF-8 (Arabic, Japanese, emoji)
    // and combining marks (naïve) · the HMAC hex MUST match itself on a
    // round-trip. If this ever fails the string-encoding contract broke.
    const body = JSON.stringify({
      id: "xnd-utf8",
      data: {
        status: "SUCCEEDED",
        reference_id: "order-🪙",
        extra: "warung naïve café · 日本語 · إندونيسيا",
        amount: 50000,
      },
    });
    const sig = computeXenditSignature(body, XENDIT_WEBHOOK_TOKEN);
    expect(verifyXenditSignature(body, sig, XENDIT_WEBHOOK_TOKEN)).toBe(true);
  });
});

describe("Midtrans · trailing-whitespace sensitivity", () => {
  // Midtrans signature is computed over concatenated FIELD values, not the
  // raw request bytes · so adding whitespace to the raw body does not by
  // itself change the signature. The protection against injected-field
  // tampering is the field-level verification: if the signed order_id/
  // status_code/gross_amount triple differs from what's in the body, the
  // sig mismatches. This test documents that contract.
  const payload = { order_id: "order-123", status_code: "200", gross_amount: "50000.00" };
  it("raw-byte whitespace does not invalidate a field-level signature", () => {
    const sig = computeMidtransSignature(payload, MIDTRANS_SERVER_KEY);
    // The verifier accepts the same field triple regardless of surrounding
    // whitespace in the raw body because it does not consume the raw body.
    expect(verifyMidtransSignature(payload, sig, MIDTRANS_SERVER_KEY)).toBe(true);
  });
  it("tampered gross_amount with original signature → false", () => {
    const sig = computeMidtransSignature(payload, MIDTRANS_SERVER_KEY);
    expect(
      verifyMidtransSignature(
        { ...payload, gross_amount: "50000.00 " },
        sig,
        MIDTRANS_SERVER_KEY,
      ),
    ).toBe(false);
  });
});

describe("parseXenditWebhookEvent", () => {
  it("SUCCEEDED → settlement", () => {
    const raw = JSON.stringify({
      id: "xnd-cb-1",
      data: { status: "SUCCEEDED", reference_id: "order-abc", amount: 50000, currency: "IDR" },
    });
    const ev = parseXenditWebhookEvent(raw);
    expect(ev?.type).toBe("settlement");
    if (ev?.type === "settlement") {
      expect(ev.orderId).toBe("order-abc");
      expect(ev.grossAmount).toBe("50000");
      expect(ev.currency).toBe("IDR");
    }
  });
  it("ACTIVE → pending", () => {
    const raw = JSON.stringify({ id: "xnd-cb-2", data: { status: "ACTIVE", reference_id: "o" } });
    expect(parseXenditWebhookEvent(raw)?.type).toBe("pending");
  });
  it("EXPIRED → expire", () => {
    const raw = JSON.stringify({ id: "xnd-cb-3", data: { status: "EXPIRED", reference_id: "o" } });
    expect(parseXenditWebhookEvent(raw)?.type).toBe("expire");
  });
  it("FAILED → deny", () => {
    const raw = JSON.stringify({ id: "xnd-cb-4", data: { status: "FAILED", reference_id: "o" } });
    expect(parseXenditWebhookEvent(raw)?.type).toBe("deny");
  });
  it("unknown status → unhandled", () => {
    const raw = JSON.stringify({ id: "xnd-cb-5", data: { status: "WEIRD", reference_id: "o" } });
    expect(parseXenditWebhookEvent(raw)?.type).toBe("unhandled");
  });
  it("invalid JSON → null", () => {
    expect(parseXenditWebhookEvent("not-json")).toBeNull();
  });
  it("missing fields → null", () => {
    expect(parseXenditWebhookEvent(JSON.stringify({}))).toBeNull();
  });
});
