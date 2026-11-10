// src/app/api/nex-native/paypal/webhook/__tests__/route.test.ts
//
// Owner-sealed 2026-11-10 · PayPal webhook route hardening tests.
// Scaffold mode · route never reaches markOrderPaid (live verify call
// is not authorised yet). Tests prove:
//   · GET → 405
//   · Missing PAYPAL_WEBHOOK_ID → 503 credentials_missing
//   · Creds present → 503 verification_requires_live_paypal
//   · Header case-insensitivity (paypal-* headers)
//   · Malformed body → still 503 (not 500 stack leak) because verify
//     short-circuits on creds before the body is parsed
//   · Response NEVER echoes received signature or secret bytes
//   · Zero fetch calls (scaffold must not touch the network)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = process.env;
const WEBHOOK_ID = "WH-TEST-ID-DO-NOT-COMMIT";

const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
  throw new Error("fetch was called — paypal webhook route must not touch the network in scaffold mode");
});

function buildReq(
  rawBody: string,
  headers: Record<string, string> = {},
): import("next/server").NextRequest {
  const req = new Request("http://localhost:3008/api/nex-native/paypal/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: rawBody,
  });
  return req as unknown as import("next/server").NextRequest;
}

async function invokePost(
  rawBody: string,
  headers: Record<string, string> = {},
) {
  const mod = await import("../route");
  const res = await mod.POST(buildReq(rawBody, headers));
  const json = await res.json();
  return { status: res.status, json };
}

const BASE_HEADERS = {
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.sandbox.paypal.com/v1/certs/cert.pem",
  "paypal-transmission-id": "txid-123",
  "paypal-transmission-sig": "sig-abc-SECRETSHAPE",
  "paypal-transmission-time": "2026-11-10T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchSpy.mockClear();
  process.env = { ...ORIGINAL_ENV };
  delete (process.env as Record<string, string | undefined>).PAYPAL_WEBHOOK_ID;
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  // Scaffold contract: zero network calls under any branch.
  expect(fetchSpy).not.toHaveBeenCalled();
});

describe("GET /api/nex-native/paypal/webhook", () => {
  it("returns 405 method_not_allowed", async () => {
    const mod = await import("../route");
    const res = await mod.GET();
    expect(res.status).toBe(405);
    const json = await res.json();
    expect(json).toEqual({ ok: false, error: "method_not_allowed" });
  });
});

describe("POST /api/nex-native/paypal/webhook · scaffold mode", () => {
  it("missing PAYPAL_WEBHOOK_ID → 503 credentials_missing", async () => {
    const body = JSON.stringify({ id: "EV-1", event_type: "PAYMENT.CAPTURE.COMPLETED" });
    const { status, json } = await invokePost(body, BASE_HEADERS);
    expect(status).toBe(503);
    expect(json).toEqual({ ok: false, error: "credentials_missing" });
  });

  it("creds present + all 5 headers → 503 verification_requires_live_paypal", async () => {
    process.env.PAYPAL_WEBHOOK_ID = WEBHOOK_ID;
    const body = JSON.stringify({ id: "EV-2", event_type: "PAYMENT.CAPTURE.COMPLETED" });
    const { status, json } = await invokePost(body, BASE_HEADERS);
    expect(status).toBe(503);
    expect(json).toEqual({ ok: false, error: "verification_requires_live_paypal" });
  });

  it("creds present + missing one header → still 503 verification_requires_live_paypal (header enforcement is a live-call concern)", async () => {
    // The scaffold's verify function doesn't short-circuit on missing
    // individual headers · it defers to the live PayPal call. We document
    // that behaviour here so the live wire-up has a clear bar: once the
    // live verify is enabled, missing headers MUST turn into a 400.
    process.env.PAYPAL_WEBHOOK_ID = WEBHOOK_ID;
    const headers = { ...BASE_HEADERS };
    delete (headers as Record<string, string>)["paypal-transmission-sig"];
    const body = JSON.stringify({ id: "EV-3", event_type: "PAYMENT.CAPTURE.COMPLETED" });
    const { status, json } = await invokePost(body, headers);
    expect(status).toBe(503);
    expect(json.error).toBe("verification_requires_live_paypal");
  });

  it("creds present + wrong-format paypal-transmission-time → still 503 (deferred to live call)", async () => {
    process.env.PAYPAL_WEBHOOK_ID = WEBHOOK_ID;
    const body = JSON.stringify({ id: "EV-4", event_type: "PAYMENT.CAPTURE.COMPLETED" });
    const { status } = await invokePost(body, {
      ...BASE_HEADERS,
      "paypal-transmission-time": "not-a-date",
    });
    // Scaffold does not parse the timestamp · live PayPal call would reject.
    expect(status).toBe(503);
  });

  it("header case-insensitivity · PayPal-Transmission-Sig works the same as paypal-transmission-sig", async () => {
    process.env.PAYPAL_WEBHOOK_ID = WEBHOOK_ID;
    const body = JSON.stringify({ id: "EV-5", event_type: "PAYMENT.CAPTURE.COMPLETED" });
    const req = new Request("http://localhost:3008/api/nex-native/paypal/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "PayPal-Auth-Algo": BASE_HEADERS["paypal-auth-algo"],
        "PayPal-Cert-Url": BASE_HEADERS["paypal-cert-url"],
        "PayPal-Transmission-Id": BASE_HEADERS["paypal-transmission-id"],
        "PayPal-Transmission-Sig": BASE_HEADERS["paypal-transmission-sig"],
        "PayPal-Transmission-Time": BASE_HEADERS["paypal-transmission-time"],
      },
      body,
    }) as unknown as import("next/server").NextRequest;
    const mod = await import("../route");
    const res = await mod.POST(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe("verification_requires_live_paypal");
  });

  it("malformed JSON body still returns 503 (route does not parse body before creds check)", async () => {
    process.env.PAYPAL_WEBHOOK_ID = WEBHOOK_ID;
    const { status } = await invokePost("{not-valid-json", BASE_HEADERS);
    // Scaffold never attempts parsing. In live mode the live-verify call
    // would reject the signature first · body parsing is downstream.
    expect(status).toBe(503);
  });

  it("response NEVER echoes the received transmission-sig header bytes", async () => {
    process.env.PAYPAL_WEBHOOK_ID = WEBHOOK_ID;
    const secretLookalike = "SECRETSIGXYZ123DONOTLEAK";
    const body = JSON.stringify({ id: "EV-6", event_type: "PAYMENT.CAPTURE.COMPLETED" });
    const { json } = await invokePost(body, {
      ...BASE_HEADERS,
      "paypal-transmission-sig": secretLookalike,
    });
    const serialised = JSON.stringify(json);
    expect(serialised).not.toContain(secretLookalike);
    expect(serialised).not.toContain(WEBHOOK_ID);
  });
});
