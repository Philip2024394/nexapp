// src/lib/nex-native/watches/__tests__/watch-payment-webhook.test.ts
//
// §3 · Payment webhook verification · pure unit tests.
// Proves:
//   · Correct signature + body = ok.
//   · Missing / wrong signature / wrong secret = rejection.
//   · Replay (old timestamp) rejected when provider uses signed timestamp.
//   · Malformed JSON rejected.
//   · Wrong amount / wrong currency rejected.
//   · provider in URL and in body must match.

import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  verifyWebhook,
  computeSignature,
  constantTimeEqualEncoded,
  WEBHOOK_ADAPTERS,
  hasConfiguredWebhookProvider,
  rejectionToStatus,
  EXPECTED_ENTITLEMENT_PENCE,
  EXPECTED_ENTITLEMENT_CURRENCY,
  isKnownWebhookProvider,
} from "../watch-payment-webhook";

const LISTING_ID = "550e8400-e29b-41d4-a716-446655440000";
const EVENT_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const SECRET = "test-shared-secret-nex-dev";

function makeBody(overrides: Partial<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    provider: "nex-test",
    event_id: EVENT_ID,
    listing_id: LISTING_ID,
    amount_pence: EXPECTED_ENTITLEMENT_PENCE,
    currency: EXPECTED_ENTITLEMENT_CURRENCY,
    payment_reference: "NEX-TEST-REF-1",
    paid_at: "2026-10-26T12:00:00Z",
    status: "paid",
    ...overrides,
  });
}

function signedHeaders(rawBody: string, nowMs = Date.now()) {
  const adapter = WEBHOOK_ADAPTERS["nex-test"];
  const timestamp = Math.floor(nowMs / 1000).toString();
  const sig = computeSignature({
    rawBody,
    secret: SECRET,
    timestamp,
    algo: adapter.algo,
    encoding: adapter.encoding,
  });
  return {
    [adapter.signatureHeaderName]: sig,
    [adapter.timestampHeaderName as string]: timestamp,
  };
}

describe("constantTimeEqualEncoded", () => {
  it("returns true for identical hex strings", () => {
    const a = createHmac("sha256", "k").update("x").digest("hex");
    expect(constantTimeEqualEncoded(a, a, "hex")).toBe(true);
  });

  it("returns false for different hex strings of same length", () => {
    const a = createHmac("sha256", "k1").update("x").digest("hex");
    const b = createHmac("sha256", "k2").update("x").digest("hex");
    expect(constantTimeEqualEncoded(a, b, "hex")).toBe(false);
  });

  it("returns false for different byte-length inputs", () => {
    // "abcd" hex-decodes to 2 bytes · "abcdef" hex-decodes to 3 bytes.
    expect(constantTimeEqualEncoded("abcd", "abcdef", "hex")).toBe(false);
  });

  it("returns false for garbage inputs", () => {
    expect(constantTimeEqualEncoded("", "abcd", "hex")).toBe(false);
    expect(constantTimeEqualEncoded("xyz", "abc", "hex")).toBe(false);
  });
});

describe("verifyWebhook · happy path", () => {
  it("accepts a correctly-signed event", () => {
    const body = makeBody();
    const headers = signedHeaders(body);
    const outcome = verifyWebhook({
      adapter: WEBHOOK_ADAPTERS["nex-test"],
      rawBody: body,
      headers,
      secret: SECRET,
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.event.eventId).toBe(EVENT_ID);
      expect(outcome.event.listingId).toBe(LISTING_ID);
      expect(outcome.event.amountPence).toBe(EXPECTED_ENTITLEMENT_PENCE);
      expect(outcome.event.currency).toBe(EXPECTED_ENTITLEMENT_CURRENCY);
    }
  });
});

describe("verifyWebhook · signature failures", () => {
  it("rejects when secret is missing (misconfigured env)", () => {
    const body = makeBody();
    const headers = signedHeaders(body);
    const o = verifyWebhook({
      adapter: WEBHOOK_ADAPTERS["nex-test"],
      rawBody: body,
      headers,
      secret: undefined,
    });
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.rejection.code).toBe("secret_missing");
  });

  it("rejects when signature header is missing", () => {
    const body = makeBody();
    const headers = signedHeaders(body);
    delete (headers as Record<string, string | undefined>)["x-nex-signature"];
    const o = verifyWebhook({
      adapter: WEBHOOK_ADAPTERS["nex-test"],
      rawBody: body,
      headers,
      secret: SECRET,
    });
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.rejection.code).toBe("signature_header_missing");
  });

  it("rejects when the signature is wrong", () => {
    const body = makeBody();
    const headers = signedHeaders(body);
    (headers as Record<string, string | undefined>)["x-nex-signature"] = createHmac(
      "sha256",
      "WRONG-SECRET",
    )
      .update(`${headers["x-nex-timestamp"]}.${body}`)
      .digest("hex");
    const o = verifyWebhook({
      adapter: WEBHOOK_ADAPTERS["nex-test"],
      rawBody: body,
      headers,
      secret: SECRET,
    });
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.rejection.code).toBe("signature_mismatch");
  });

  it("rejects when the raw body has been tampered after signing", () => {
    const body = makeBody();
    const headers = signedHeaders(body);
    const tamperedBody = body.replace(
      '"amount_pence":3000000',
      '"amount_pence":1',
    );
    const o = verifyWebhook({
      adapter: WEBHOOK_ADAPTERS["nex-test"],
      rawBody: tamperedBody,
      headers,
      secret: SECRET,
    });
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.rejection.code).toBe("signature_mismatch");
  });
});

describe("verifyWebhook · replay defence", () => {
  it("rejects a timestamp older than the tolerance window", () => {
    const body = makeBody();
    const nowMs = Date.now();
    // 10 minutes old · tolerance is 5 min.
    const oldMs = nowMs - 10 * 60_000;
    const headers = signedHeaders(body, oldMs);
    const o = verifyWebhook({
      adapter: WEBHOOK_ADAPTERS["nex-test"],
      rawBody: body,
      headers,
      secret: SECRET,
      nowMs,
    });
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.rejection.code).toBe("timestamp_too_old");
  });

  it("rejects a timestamp too far in the future", () => {
    const body = makeBody();
    const nowMs = Date.now();
    const futureMs = nowMs + 10 * 60_000;
    const headers = signedHeaders(body, futureMs);
    const o = verifyWebhook({
      adapter: WEBHOOK_ADAPTERS["nex-test"],
      rawBody: body,
      headers,
      secret: SECRET,
      nowMs,
    });
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.rejection.code).toBe("timestamp_too_old");
  });

  it("rejects a malformed timestamp", () => {
    const body = makeBody();
    const headers = signedHeaders(body);
    (headers as Record<string, string | undefined>)["x-nex-timestamp"] = "not-a-number";
    const o = verifyWebhook({
      adapter: WEBHOOK_ADAPTERS["nex-test"],
      rawBody: body,
      headers,
      secret: SECRET,
    });
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.rejection.code).toBe("signature_header_malformed");
  });
});

describe("verifyWebhook · body schema failures", () => {
  it("rejects malformed JSON", () => {
    // Sign a different body so sig passes · then feed garbage; this
    // tests the schema-stage rejection AFTER signature. We re-sign
    // the garbage body for this test to isolate the schema stage.
    const body = "{ not json";
    const adapter = WEBHOOK_ADAPTERS["nex-test"];
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers = {
      [adapter.signatureHeaderName]: computeSignature({
        rawBody: body,
        secret: SECRET,
        timestamp,
        algo: adapter.algo,
        encoding: adapter.encoding,
      }),
      [adapter.timestampHeaderName as string]: timestamp,
    };
    const o = verifyWebhook({
      adapter,
      rawBody: body,
      headers,
      secret: SECRET,
    });
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.rejection.code).toBe("body_not_json");
  });

  it("rejects wrong amount", () => {
    const body = makeBody({ amount_pence: 1 });
    const headers = signedHeaders(body);
    const o = verifyWebhook({
      adapter: WEBHOOK_ADAPTERS["nex-test"],
      rawBody: body,
      headers,
      secret: SECRET,
    });
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.rejection.code).toBe("amount_mismatch");
  });

  it("rejects wrong currency", () => {
    const body = makeBody({ currency: "USD" });
    const headers = signedHeaders(body);
    const o = verifyWebhook({
      adapter: WEBHOOK_ADAPTERS["nex-test"],
      rawBody: body,
      headers,
      secret: SECRET,
    });
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.rejection.code).toBe("currency_mismatch");
  });

  it("rejects a mismatched provider between URL and body", () => {
    const body = makeBody({ provider: "xendit" });
    const headers = signedHeaders(body);
    const o = verifyWebhook({
      // URL says nex-test, body says xendit
      adapter: WEBHOOK_ADAPTERS["nex-test"],
      rawBody: body,
      headers,
      secret: SECRET,
    });
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.rejection.code).toBe("event_schema_invalid");
  });

  it("rejects an event with a non-uuid listing_id", () => {
    const body = makeBody({ listing_id: "not-a-uuid" });
    const headers = signedHeaders(body);
    const o = verifyWebhook({
      adapter: WEBHOOK_ADAPTERS["nex-test"],
      rawBody: body,
      headers,
      secret: SECRET,
    });
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.rejection.code).toBe("event_schema_invalid");
  });
});

describe("rejectionToStatus", () => {
  it("maps signature failures to 401", () => {
    expect(rejectionToStatus("signature_mismatch")).toBe(401);
    expect(rejectionToStatus("signature_header_missing")).toBe(401);
    expect(rejectionToStatus("timestamp_too_old")).toBe(401);
  });

  it("maps schema failures to 422", () => {
    expect(rejectionToStatus("amount_mismatch")).toBe(422);
    expect(rejectionToStatus("event_schema_invalid")).toBe(422);
  });

  it("maps missing secret to 503 (operator alert)", () => {
    expect(rejectionToStatus("secret_missing")).toBe(503);
  });

  it("maps unknown provider to 404", () => {
    expect(rejectionToStatus("unknown_provider")).toBe(404);
  });
});

describe("hasConfiguredWebhookProvider", () => {
  it("returns false when no provider secret is set", () => {
    expect(hasConfiguredWebhookProvider({})).toBe(false);
  });

  it("returns true when any single provider secret is set", () => {
    expect(
      hasConfiguredWebhookProvider({
        NEX_WATCHES_WEBHOOK_SECRET_NEX_TEST: "s",
      }),
    ).toBe(true);
    expect(
      hasConfiguredWebhookProvider({
        NEX_WATCHES_WEBHOOK_SECRET_XENDIT: "s",
      }),
    ).toBe(true);
  });

  it("returns false when a secret is set to an empty string", () => {
    expect(
      hasConfiguredWebhookProvider({
        NEX_WATCHES_WEBHOOK_SECRET_NEX_TEST: "",
      }),
    ).toBe(false);
  });
});

describe("isKnownWebhookProvider", () => {
  it("accepts the three launch providers", () => {
    expect(isKnownWebhookProvider("nex-test")).toBe(true);
    expect(isKnownWebhookProvider("xendit")).toBe(true);
    expect(isKnownWebhookProvider("midtrans")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isKnownWebhookProvider("stripe")).toBe(false);
    expect(isKnownWebhookProvider("")).toBe(false);
    expect(isKnownWebhookProvider(42)).toBe(false);
    expect(isKnownWebhookProvider(null)).toBe(false);
  });
});
