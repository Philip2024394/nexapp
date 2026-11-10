// src/app/api/nex-native/stripe/webhook/__tests__/route.test.ts
//
// Owner-sealed 2026-11-10 · NEX merchant-direct Stripe webhook route test.
// Verifies the trust boundary and dispatch behaviour:
//   · Valid signed checkout.session.completed → markOrderPaid + recordOrderEvent
//   · Invalid signature → 400 · no markOrderPaid
//   · Duplicate signed event → markOrderPaid called TWICE (idempotency is
//     enforced by commerce-service, NOT the webhook route)
//   · Unhandled event type → 200 · no markOrderPaid
//   · Missing STRIPE_WEBHOOK_SECRET env → 500
//   · GET → 405
//
// Uses real HMAC-SHA256 so the signature verification path is exercised
// exactly as production Stripe would sign the payload.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";

// vi.hoisted so these refs are available inside vi.mock() factories.
const mocks = vi.hoisted(() => ({
  markOrderPaid: vi.fn(),
  recordOrderEvent: vi.fn(),
}));

vi.mock("@/lib/nex-native/commerce-service", () => ({
  markOrderPaid: (orderId: string, actorId: string) =>
    mocks.markOrderPaid(orderId, actorId),
}));

vi.mock("@/lib/nex-native/order-service", () => ({
  recordOrderEvent: (input: unknown) => mocks.recordOrderEvent(input),
}));

const ORIGINAL_ENV = process.env;
const WEBHOOK_SECRET = "whsec_route_test_secret";

function signBody(rawBody: string, secret: string, timestamp: string): string {
  const sig = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

function buildReq(
  rawBody: string,
  signatureHeader: string | null,
  extraHeaders: Record<string, string> = {},
): import("next/server").NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...extraHeaders,
  };
  if (signatureHeader !== null) {
    headers["stripe-signature"] = signatureHeader;
  }
  const req = new Request("http://localhost:3008/api/nex-native/stripe/webhook", {
    method: "POST",
    headers,
    body: rawBody,
  });
  return req as unknown as import("next/server").NextRequest;
}

async function invokePost(
  rawBody: string,
  signatureHeader: string | null,
  extraHeaders: Record<string, string> = {},
) {
  const mod = await import("../route");
  const req = buildReq(rawBody, signatureHeader, extraHeaders);
  const res = await mod.POST(req);
  const json = await res.json();
  return { status: res.status, json };
}

const ORDER_ID = "aaaa1111-2222-4333-8444-555555555555";
const SESSION_ID = "cs_test_live_1";
const STRIPE_EVENT_ID = "evt_test_1";
const CONNECTED_ACCOUNT_ID = "acct_test_merchant_1";

function checkoutCompletedBody(opts: {
  eventId?: string;
  orderId?: string;
  sessionId?: string;
} = {}): string {
  return JSON.stringify({
    id: opts.eventId ?? STRIPE_EVENT_ID,
    type: "checkout.session.completed",
    data: {
      object: {
        id: opts.sessionId ?? SESSION_ID,
        metadata: { nex_order_id: opts.orderId ?? ORDER_ID },
        client_reference_id: opts.orderId ?? ORDER_ID,
        payment_status: "paid",
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV, STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET };
  mocks.markOrderPaid.mockResolvedValue({
    order: { id: ORDER_ID, state: "paid", price_pence: 2500, currency: "GBP" },
    ledgerEntryId: "ledger-entry-1",
  });
  mocks.recordOrderEvent.mockResolvedValue({ id: "event-row-1" });
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("GET /api/nex-native/stripe/webhook", () => {
  it("returns 405 method_not_allowed", async () => {
    const mod = await import("../route");
    const res = await mod.GET();
    expect(res.status).toBe(405);
    const json = await res.json();
    expect(json).toEqual({ ok: false, error: "method_not_allowed" });
  });
});

describe("POST /api/nex-native/stripe/webhook", () => {
  it("valid signed checkout.session.completed → markOrderPaid + recordOrderEvent · 200", async () => {
    const body = checkoutCompletedBody();
    const sig = signBody(body, WEBHOOK_SECRET, "1700000000");
    const { status, json } = await invokePost(body, sig, {
      "stripe-account": CONNECTED_ACCOUNT_ID,
    });
    expect(status).toBe(200);
    expect(json).toEqual({ ok: true, outcome: "order_paid" });

    expect(mocks.markOrderPaid).toHaveBeenCalledTimes(1);
    expect(mocks.markOrderPaid).toHaveBeenCalledWith(
      ORDER_ID,
      "00000000-0000-4000-8000-000000000000",
    );

    expect(mocks.recordOrderEvent).toHaveBeenCalledTimes(1);
    const eventArg = mocks.recordOrderEvent.mock.calls[0][0] as {
      order_id: string;
      event: string;
      actor_account_id: string;
      metadata: Record<string, unknown>;
    };
    expect(eventArg.order_id).toBe(ORDER_ID);
    expect(eventArg.event).toBe("stripe.checkout.session.completed");
    expect(eventArg.actor_account_id).toBe("00000000-0000-4000-8000-000000000000");
    expect(eventArg.metadata.stripe_event_id).toBe(STRIPE_EVENT_ID);
    expect(eventArg.metadata.stripe_session_id).toBe(SESSION_ID);
    expect(eventArg.metadata.stripe_connected_account_id).toBe(CONNECTED_ACCOUNT_ID);
    expect(eventArg.metadata.ledger_entry_id).toBe("ledger-entry-1");
  });

  it("invalid signature → 400 · no markOrderPaid · no recordOrderEvent", async () => {
    const body = checkoutCompletedBody();
    // Sign with a different secret so HMAC fails.
    const badSig = signBody(body, "whsec_wrong_secret", "1700000000");
    const { status, json } = await invokePost(body, badSig);
    expect(status).toBe(400);
    expect(json).toEqual({ ok: false, error: "invalid signature" });
    expect(mocks.markOrderPaid).not.toHaveBeenCalled();
    expect(mocks.recordOrderEvent).not.toHaveBeenCalled();
  });

  it("missing stripe-signature header → 400 · no markOrderPaid", async () => {
    const body = checkoutCompletedBody();
    const { status, json } = await invokePost(body, null);
    expect(status).toBe(400);
    expect(json).toEqual({ ok: false, error: "invalid signature" });
    expect(mocks.markOrderPaid).not.toHaveBeenCalled();
  });

  it("tampered body (signature was valid for original) → 400 · no markOrderPaid", async () => {
    const originalBody = checkoutCompletedBody();
    const sig = signBody(originalBody, WEBHOOK_SECRET, "1700000000");
    // Tamper AFTER signing so HMAC no longer matches.
    const tamperedBody = originalBody.replace(ORDER_ID, "ffffffff-ffff-4fff-8fff-ffffffffffff");
    const { status } = await invokePost(tamperedBody, sig);
    expect(status).toBe(400);
    expect(mocks.markOrderPaid).not.toHaveBeenCalled();
  });

  it("duplicate signed event → markOrderPaid called TWICE (idempotency enforced by commerce-service)", async () => {
    const body = checkoutCompletedBody();
    const sig = signBody(body, WEBHOOK_SECRET, "1700000000");

    const a = await invokePost(body, sig);
    const b = await invokePost(body, sig);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    // Webhook layer does NOT dedupe · commerce-service.markOrderPaid is the
    // single source of idempotency. The owner contract is: route calls it
    // every time · service no-ops on repeat.
    expect(mocks.markOrderPaid).toHaveBeenCalledTimes(2);
    expect(mocks.recordOrderEvent).toHaveBeenCalledTimes(2);
  });

  it("unhandled event type (signed) → 200 outcome=unhandled · no markOrderPaid", async () => {
    const body = JSON.stringify({
      id: "evt_other_1",
      type: "customer.created",
      data: { object: { id: "cus_1" } },
    });
    const sig = signBody(body, WEBHOOK_SECRET, "1700000000");
    const { status, json } = await invokePost(body, sig);
    expect(status).toBe(200);
    expect(json).toEqual({ ok: true, outcome: "unhandled" });
    expect(mocks.markOrderPaid).not.toHaveBeenCalled();
    expect(mocks.recordOrderEvent).not.toHaveBeenCalled();
  });

  it("signed charge.refunded with nex_order_id → 200 refund_logged · recordOrderEvent · no markOrderPaid", async () => {
    const body = JSON.stringify({
      id: "evt_refund_1",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_1",
          amount_refunded: 2500,
          metadata: { nex_order_id: ORDER_ID },
        },
      },
    });
    const sig = signBody(body, WEBHOOK_SECRET, "1700000000");
    const { status, json } = await invokePost(body, sig);
    expect(status).toBe(200);
    expect(json).toEqual({ ok: true, outcome: "refund_logged" });
    expect(mocks.markOrderPaid).not.toHaveBeenCalled();
    expect(mocks.recordOrderEvent).toHaveBeenCalledTimes(1);
    const eventArg = mocks.recordOrderEvent.mock.calls[0][0] as {
      event: string;
      metadata: Record<string, unknown>;
    };
    expect(eventArg.event).toBe("stripe.charge.refunded");
    expect(eventArg.metadata.stripe_amount_refunded).toBe(2500);
  });

  it("signed checkout.session.completed WITHOUT nex_order_id → 200 no_order_ref · no markOrderPaid", async () => {
    const body = JSON.stringify({
      id: "evt_no_order",
      type: "checkout.session.completed",
      data: { object: { id: "cs_x", payment_status: "paid" } },
    });
    const sig = signBody(body, WEBHOOK_SECRET, "1700000000");
    const { status, json } = await invokePost(body, sig);
    expect(status).toBe(200);
    expect(json).toEqual({ ok: true, outcome: "no_order_ref" });
    expect(mocks.markOrderPaid).not.toHaveBeenCalled();
  });

  it("missing STRIPE_WEBHOOK_SECRET env → 500 config_error", async () => {
    process.env = { ...ORIGINAL_ENV };
    delete (process.env as Record<string, string | undefined>).STRIPE_WEBHOOK_SECRET;
    const body = checkoutCompletedBody();
    const sig = signBody(body, WEBHOOK_SECRET, "1700000000");
    const { status, json } = await invokePost(body, sig);
    expect(status).toBe(500);
    expect(json).toEqual({ ok: false, error: "config_error" });
    expect(mocks.markOrderPaid).not.toHaveBeenCalled();
  });

  it("signed but malformed JSON body → 400 malformed_event", async () => {
    const body = "{not: valid json";
    const sig = signBody(body, WEBHOOK_SECRET, "1700000000");
    const { status, json } = await invokePost(body, sig);
    expect(status).toBe(400);
    expect(json).toEqual({ ok: false, error: "malformed_event" });
  });

  it("markOrderPaid throws → 500 processing_error · no echo of internal message", async () => {
    mocks.markOrderPaid.mockRejectedValueOnce(new Error("DB CONNECTION LOST · SECRET LEAK"));
    const body = checkoutCompletedBody();
    const sig = signBody(body, WEBHOOK_SECRET, "1700000000");
    const { status, json } = await invokePost(body, sig);
    expect(status).toBe(500);
    expect(json).toEqual({ ok: false, error: "processing_error" });
    // The underlying message must not appear in the response body.
    expect(JSON.stringify(json)).not.toContain("SECRET LEAK");
  });
});
