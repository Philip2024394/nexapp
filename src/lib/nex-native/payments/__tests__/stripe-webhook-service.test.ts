// src/lib/nex-native/payments/__tests__/stripe-webhook-service.test.ts
//
// Owner-sealed 2026-11-10 · verifies NEX Stripe webhook primitives.
// Covers:
//   · Signature verify · valid sig → true · invalid → false · tampered body → false
//   · Signature verify · missing secret → false · missing header → false
//   · Timing-safe compare · equal + non-equal
//   · Event parser · checkout.session.completed · charge.refunded · unhandled
//   · extractNexOrderId · metadata first · client_reference_id fallback
//
// Uses real HMAC-SHA256 (Node crypto) so the tests are deterministic and
// exercise the exact production verification path.

import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyStripeSignature,
  computeStripeSignature,
  timingSafeHexEqual,
  parseStripeWebhookEvent,
  extractNexOrderId,
  NEX_STRIPE_SYSTEM_ACTOR_ID,
} from "../stripe-webhook-service";

const SECRET = "whsec_test_secret_do_not_commit";

function signHeader(rawBody: string, secret: string, timestamp: string): string {
  const sig = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

describe("NEX_STRIPE_SYSTEM_ACTOR_ID", () => {
  it("is the documented zero-uuid constant", () => {
    expect(NEX_STRIPE_SYSTEM_ACTOR_ID).toBe("00000000-0000-4000-8000-000000000000");
  });
});

describe("computeStripeSignature", () => {
  it("matches a hand-rolled HMAC-SHA256 of t.body", () => {
    const body = '{"id":"evt_1","type":"checkout.session.completed"}';
    const ts = "1700000000";
    const expected = createHmac("sha256", SECRET)
      .update(`${ts}.${body}`, "utf8")
      .digest("hex");
    expect(computeStripeSignature(body, ts, SECRET)).toBe(expected);
  });
});

describe("timingSafeHexEqual", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeHexEqual("abc123", "abc123")).toBe(true);
  });
  it("returns false for different strings of equal length", () => {
    expect(timingSafeHexEqual("abc123", "abc124")).toBe(false);
  });
  it("returns false for different-length strings (no partial compare)", () => {
    expect(timingSafeHexEqual("abc", "abcd")).toBe(false);
  });
  it("returns false for non-string input", () => {
    // @ts-expect-error · exercising defensive branch
    expect(timingSafeHexEqual(null, "abc")).toBe(false);
    // @ts-expect-error · exercising defensive branch
    expect(timingSafeHexEqual("abc", undefined)).toBe(false);
  });
});

describe("verifyStripeSignature", () => {
  const body = '{"id":"evt_abc","type":"checkout.session.completed","data":{"object":{"id":"cs_1"}}}';
  const ts = "1700000000";

  it("valid signature → true", () => {
    const header = signHeader(body, SECRET, ts);
    expect(verifyStripeSignature(body, header, SECRET)).toBe(true);
  });

  it("invalid signature (wrong hex) → false", () => {
    const header = `t=${ts},v1=${"0".repeat(64)}`;
    expect(verifyStripeSignature(body, header, SECRET)).toBe(false);
  });

  it("tampered body (same header) → false", () => {
    const header = signHeader(body, SECRET, ts);
    const tampered = body.replace("cs_1", "cs_HACK");
    expect(verifyStripeSignature(tampered, header, SECRET)).toBe(false);
  });

  it("tampered timestamp (shifted by 1s) → false", () => {
    const header = signHeader(body, SECRET, ts);
    // Replace t=... with t=ts+1 but keep the v1= from the original timestamp.
    const shifted = header.replace(`t=${ts}`, `t=${Number(ts) + 1}`);
    expect(verifyStripeSignature(body, shifted, SECRET)).toBe(false);
  });

  it("missing secret → false", () => {
    const header = signHeader(body, SECRET, ts);
    expect(verifyStripeSignature(body, header, "")).toBe(false);
    expect(verifyStripeSignature(body, header, null)).toBe(false);
    expect(verifyStripeSignature(body, header, undefined)).toBe(false);
  });

  it("missing signature header → false", () => {
    expect(verifyStripeSignature(body, null, SECRET)).toBe(false);
    expect(verifyStripeSignature(body, undefined, SECRET)).toBe(false);
    expect(verifyStripeSignature(body, "", SECRET)).toBe(false);
  });

  it("malformed header (no t=) → false", () => {
    expect(verifyStripeSignature(body, `v1=${"a".repeat(64)}`, SECRET)).toBe(false);
  });

  it("malformed header (no v1=) → false", () => {
    expect(verifyStripeSignature(body, `t=${ts}`, SECRET)).toBe(false);
  });

  it("signed with different secret → false", () => {
    const header = signHeader(body, "whsec_other_secret", ts);
    expect(verifyStripeSignature(body, header, SECRET)).toBe(false);
  });

  it("multi-signature header (second v1 is correct) → true", () => {
    const correctSig = computeStripeSignature(body, ts, SECRET);
    const header = `t=${ts},v1=${"0".repeat(64)},v1=${correctSig}`;
    expect(verifyStripeSignature(body, header, SECRET)).toBe(true);
  });
});

describe("parseStripeWebhookEvent", () => {
  it("parses checkout.session.completed with metadata", () => {
    const raw = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          metadata: { nex_order_id: "order-123" },
          client_reference_id: "cref-xyz",
          payment_status: "paid",
        },
      },
    });
    const ev = parseStripeWebhookEvent(raw, "acct_merchant_1");
    expect(ev).not.toBeNull();
    expect(ev!.type).toBe("checkout.session.completed");
    expect(ev!.connectedAccountId).toBe("acct_merchant_1");
    if (ev!.type === "checkout.session.completed") {
      expect(ev!.data.object.id).toBe("cs_1");
      expect(ev!.data.object.payment_status).toBe("paid");
    }
  });

  it("parses charge.refunded", () => {
    const raw = JSON.stringify({
      id: "evt_2",
      type: "charge.refunded",
      data: { object: { id: "ch_1", amount_refunded: 500, metadata: { nex_order_id: "order-9" } } },
    });
    const ev = parseStripeWebhookEvent(raw, null);
    expect(ev?.type).toBe("charge.refunded");
    if (ev?.type === "charge.refunded") {
      expect(ev.data.object.amount_refunded).toBe(500);
    }
  });

  it("returns unhandled union for any other event type", () => {
    const raw = JSON.stringify({
      id: "evt_3",
      type: "customer.created",
      data: { object: { id: "cus_1" } },
    });
    const ev = parseStripeWebhookEvent(raw, null);
    expect(ev?.type).toBe("unhandled");
    if (ev?.type === "unhandled") {
      expect(ev.originalType).toBe("customer.created");
    }
  });

  it("returns null for invalid JSON", () => {
    expect(parseStripeWebhookEvent("not-json", null)).toBeNull();
  });

  it("returns null for missing fields", () => {
    expect(parseStripeWebhookEvent(JSON.stringify({ type: "x" }), null)).toBeNull();
    expect(parseStripeWebhookEvent(JSON.stringify({ id: "a" }), null)).toBeNull();
    expect(
      parseStripeWebhookEvent(JSON.stringify({ id: "a", type: "x" }), null),
    ).toBeNull();
  });
});

describe("extractNexOrderId", () => {
  it("prefers metadata.nex_order_id", () => {
    const raw = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          metadata: { nex_order_id: "order-meta" },
          client_reference_id: "order-client-ref",
        },
      },
    });
    const ev = parseStripeWebhookEvent(raw, null);
    if (ev?.type !== "checkout.session.completed") throw new Error("wrong type");
    expect(extractNexOrderId(ev)).toBe("order-meta");
  });

  it("falls back to client_reference_id", () => {
    const raw = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: { id: "cs_1", client_reference_id: "order-client-ref" },
      },
    });
    const ev = parseStripeWebhookEvent(raw, null);
    if (ev?.type !== "checkout.session.completed") throw new Error("wrong type");
    expect(extractNexOrderId(ev)).toBe("order-client-ref");
  });

  it("returns null if neither present", () => {
    const raw = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { id: "cs_1" } },
    });
    const ev = parseStripeWebhookEvent(raw, null);
    if (ev?.type !== "checkout.session.completed") throw new Error("wrong type");
    expect(extractNexOrderId(ev)).toBeNull();
  });
});
