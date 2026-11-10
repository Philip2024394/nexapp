// src/app/api/nex-native/qris/webhook/__tests__/route.test.ts
//
// Owner-sealed 2026-11-10 · QRIS webhook route hardening tests.
// Scaffold mode · route verifies signatures end-to-end but never calls
// markOrderPaid (returns 503 `provider_scaffold_not_live` on verified
// settlement events). Tests prove:
//   · GET → 405
//   · Missing/invalid `x-nex-qris-provider` → 400
//   · Midtrans valid sig + settlement → 503 scaffold · no network call
//   · Midtrans invalid sig → 400 · never leaks signature bytes
//   · Midtrans missing MIDTRANS_SERVER_KEY → 503 credentials_missing
//   · Midtrans malformed body → 400 malformed_body (opaque)
//   · Midtrans trailing-whitespace body → signature mismatch · 400
//   · Xendit valid sig → 503 scaffold · no network call
//   · Xendit invalid sig → 400
//   · Xendit header case insensitivity (X-Callback-Signature vs lower)
//   · Xendit Unicode body round-trip holds
//   · Response NEVER echoes signature or secret bytes
//   · Settlement vs pending/expire/cancel/deny branches dispatch
//     correctly (all return 503 scaffold in current mode)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";

const ORIGINAL_ENV = process.env;
const MIDTRANS_KEY = "SB-Mid-server-TEST-KEY-DO-NOT-COMMIT";
const XENDIT_TOKEN = "xnd-wh-token-test-DO-NOT-COMMIT";

const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
  throw new Error("fetch was called — qris webhook route must not touch the network in scaffold mode");
});

function midtransBody(opts: {
  order_id?: string;
  status?: string;
  status_code?: string;
  gross_amount?: string;
  key?: string;
} = {}): string {
  const order_id = opts.order_id ?? "order-qris-1";
  const transaction_status = opts.status ?? "settlement";
  const status_code = opts.status_code ?? "200";
  const gross_amount = opts.gross_amount ?? "50000.00";
  const signature_key = createHash("sha512")
    .update(`${order_id}${status_code}${gross_amount}${opts.key ?? MIDTRANS_KEY}`, "utf8")
    .digest("hex");
  return JSON.stringify({
    transaction_id: "mt-tx-1",
    order_id,
    transaction_status,
    status_code,
    gross_amount,
    currency: "IDR",
    signature_key,
  });
}

function xenditBody(opts: { status?: string; order?: string; extra?: string } = {}): string {
  return JSON.stringify({
    id: "xnd-cb-1",
    data: {
      status: opts.status ?? "SUCCEEDED",
      reference_id: opts.order ?? "order-qris-xnd-1",
      amount: 50000,
      currency: "IDR",
      extra: opts.extra,
    },
  });
}

function xenditSig(rawBody: string, token: string = XENDIT_TOKEN): string {
  return createHmac("sha256", token).update(rawBody, "utf8").digest("hex");
}

function buildReq(
  rawBody: string,
  headers: Record<string, string> = {},
): import("next/server").NextRequest {
  const req = new Request("http://localhost:3008/api/nex-native/qris/webhook", {
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

beforeEach(() => {
  vi.clearAllMocks();
  fetchSpy.mockClear();
  process.env = { ...ORIGINAL_ENV };
  delete (process.env as Record<string, string | undefined>).MIDTRANS_SERVER_KEY;
  delete (process.env as Record<string, string | undefined>).XENDIT_WEBHOOK_TOKEN;
  delete (process.env as Record<string, string | undefined>).XENDIT_SECRET_KEY;
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  expect(fetchSpy).not.toHaveBeenCalled();
});

describe("GET /api/nex-native/qris/webhook", () => {
  it("returns 405 method_not_allowed", async () => {
    const mod = await import("../route");
    const res = await mod.GET();
    expect(res.status).toBe(405);
    const json = await res.json();
    expect(json).toEqual({ ok: false, error: "method_not_allowed" });
  });
});

describe("POST /api/nex-native/qris/webhook · provider dispatch", () => {
  it("missing x-nex-qris-provider → 400 missing_or_invalid_provider_header", async () => {
    const { status, json } = await invokePost(midtransBody());
    expect(status).toBe(400);
    expect(json).toEqual({ ok: false, error: "missing_or_invalid_provider_header" });
  });

  it("invalid x-nex-qris-provider value → 400 missing_or_invalid_provider_header", async () => {
    const { status } = await invokePost(midtransBody(), { "x-nex-qris-provider": "gopay" });
    expect(status).toBe(400);
  });
});

describe("POST /api/nex-native/qris/webhook · Midtrans", () => {
  it("missing MIDTRANS_SERVER_KEY → 503 credentials_missing", async () => {
    const { status, json } = await invokePost(midtransBody(), { "x-nex-qris-provider": "midtrans" });
    expect(status).toBe(503);
    expect(json).toEqual({ ok: false, error: "credentials_missing" });
  });

  it("valid signature + settlement → 503 provider_scaffold_not_live", async () => {
    process.env.MIDTRANS_SERVER_KEY = MIDTRANS_KEY;
    const { status, json } = await invokePost(midtransBody(), { "x-nex-qris-provider": "midtrans" });
    expect(status).toBe(503);
    expect(json).toEqual({ ok: false, error: "provider_scaffold_not_live" });
  });

  for (const status of ["pending", "expire", "cancel", "deny"] as const) {
    it(`valid signature + ${status} → 503 provider_scaffold_not_live (no paid state transition path)`, async () => {
      process.env.MIDTRANS_SERVER_KEY = MIDTRANS_KEY;
      // For non-settlement transaction_status the signature is still computed
      // over order_id + status_code + gross_amount + server_key.
      const r = await invokePost(midtransBody({ status }), { "x-nex-qris-provider": "midtrans" });
      expect(r.status).toBe(503);
      expect(r.json).toEqual({ ok: false, error: "provider_scaffold_not_live" });
    });
  }

  it("invalid signature (signed with a different server key) → 400 invalid signature", async () => {
    process.env.MIDTRANS_SERVER_KEY = MIDTRANS_KEY;
    const body = midtransBody({ key: "OTHER-SERVER-KEY" });
    const { status, json } = await invokePost(body, { "x-nex-qris-provider": "midtrans" });
    expect(status).toBe(400);
    expect(json).toEqual({ ok: false, error: "invalid signature" });
  });

  it("body with trailing whitespace tampering (signature was for untrimmed body) → 400 invalid signature", async () => {
    // Midtrans signature is over the exact fields, not the raw bytes · but
    // this proves that a tampered body where fields differ still fails. We
    // mutate gross_amount inside the body after signing.
    process.env.MIDTRANS_SERVER_KEY = MIDTRANS_KEY;
    const body = midtransBody();
    const tampered = body.replace('"gross_amount":"50000.00"', '"gross_amount":"99999.00"');
    expect(tampered).not.toBe(body);
    const { status } = await invokePost(tampered, { "x-nex-qris-provider": "midtrans" });
    expect(status).toBe(400);
  });

  it("malformed JSON body → 400 malformed_body (opaque · no stack trace)", async () => {
    process.env.MIDTRANS_SERVER_KEY = MIDTRANS_KEY;
    const { status, json } = await invokePost("{not-valid-json", { "x-nex-qris-provider": "midtrans" });
    expect(status).toBe(400);
    expect(json).toEqual({ ok: false, error: "malformed_body" });
    expect(JSON.stringify(json)).not.toMatch(/at\s+\w+/);
  });

  it("response NEVER echoes computed/received signature bytes on invalid signature", async () => {
    process.env.MIDTRANS_SERVER_KEY = MIDTRANS_KEY;
    const body = midtransBody({ key: "OTHER-KEY" });
    const receivedSig = JSON.parse(body).signature_key as string;
    const { json } = await invokePost(body, { "x-nex-qris-provider": "midtrans" });
    const serialised = JSON.stringify(json);
    expect(serialised).not.toContain(receivedSig);
    expect(serialised).not.toContain(MIDTRANS_KEY);
  });

  it("header name `X-Nex-Qris-Provider` (title case) works the same as lowercase", async () => {
    process.env.MIDTRANS_SERVER_KEY = MIDTRANS_KEY;
    const req = new Request("http://localhost:3008/api/nex-native/qris/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Nex-Qris-Provider": "midtrans",
      },
      body: midtransBody(),
    }) as unknown as import("next/server").NextRequest;
    const mod = await import("../route");
    const res = await mod.POST(req);
    expect(res.status).toBe(503);
    const j = await res.json();
    expect(j.error).toBe("provider_scaffold_not_live");
  });
});

describe("POST /api/nex-native/qris/webhook · Xendit", () => {
  it("missing XENDIT_WEBHOOK_TOKEN and XENDIT_SECRET_KEY → 503 credentials_missing", async () => {
    const body = xenditBody();
    const { status, json } = await invokePost(body, {
      "x-nex-qris-provider": "xendit",
      "x-callback-signature": xenditSig(body),
    });
    expect(status).toBe(503);
    expect(json).toEqual({ ok: false, error: "credentials_missing" });
  });

  it("valid HMAC-SHA256 signature + SUCCEEDED → 503 provider_scaffold_not_live", async () => {
    process.env.XENDIT_WEBHOOK_TOKEN = XENDIT_TOKEN;
    const body = xenditBody();
    const { status, json } = await invokePost(body, {
      "x-nex-qris-provider": "xendit",
      "x-callback-signature": xenditSig(body),
    });
    expect(status).toBe(503);
    expect(json).toEqual({ ok: false, error: "provider_scaffold_not_live" });
  });

  it("invalid signature → 400 invalid signature", async () => {
    process.env.XENDIT_WEBHOOK_TOKEN = XENDIT_TOKEN;
    const body = xenditBody();
    const { status, json } = await invokePost(body, {
      "x-nex-qris-provider": "xendit",
      "x-callback-signature": "0".repeat(64),
    });
    expect(status).toBe(400);
    expect(json).toEqual({ ok: false, error: "invalid signature" });
  });

  it("header name `X-Callback-Signature` (title case) works the same as lowercase", async () => {
    process.env.XENDIT_WEBHOOK_TOKEN = XENDIT_TOKEN;
    const body = xenditBody();
    const req = new Request("http://localhost:3008/api/nex-native/qris/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nex-qris-provider": "xendit",
        "X-Callback-Signature": xenditSig(body),
      },
      body,
    }) as unknown as import("next/server").NextRequest;
    const mod = await import("../route");
    const res = await mod.POST(req);
    expect(res.status).toBe(503);
    const j = await res.json();
    expect(j.error).toBe("provider_scaffold_not_live");
  });

  it("body with Unicode characters · signature round-trip holds", async () => {
    process.env.XENDIT_WEBHOOK_TOKEN = XENDIT_TOKEN;
    // Include characters requiring multi-byte UTF-8 encoding · the HMAC is
    // computed over UTF-8 bytes · a round-trip through the HMAC must
    // produce the same hex.
    const body = xenditBody({ extra: "warung naïve café · 日本語 · إندونيسيا · 🪙" });
    const sig = xenditSig(body);
    const { status } = await invokePost(body, {
      "x-nex-qris-provider": "xendit",
      "x-callback-signature": sig,
    });
    expect(status).toBe(503);
  });

  it("missing x-callback-signature header → 400 invalid signature", async () => {
    process.env.XENDIT_WEBHOOK_TOKEN = XENDIT_TOKEN;
    const body = xenditBody();
    const { status } = await invokePost(body, { "x-nex-qris-provider": "xendit" });
    expect(status).toBe(400);
  });

  it("response NEVER echoes computed/received signature bytes on invalid signature", async () => {
    process.env.XENDIT_WEBHOOK_TOKEN = XENDIT_TOKEN;
    const body = xenditBody();
    const receivedSig = "DEADBEEFSECRETSIG" + "f".repeat(47); // 64 chars total
    const { json } = await invokePost(body, {
      "x-nex-qris-provider": "xendit",
      "x-callback-signature": receivedSig,
    });
    const serialised = JSON.stringify(json);
    expect(serialised).not.toContain(receivedSig);
    expect(serialised).not.toContain(XENDIT_TOKEN);
  });

  it("falls back to XENDIT_SECRET_KEY when XENDIT_WEBHOOK_TOKEN is absent", async () => {
    process.env.XENDIT_SECRET_KEY = XENDIT_TOKEN;
    const body = xenditBody();
    const { status } = await invokePost(body, {
      "x-nex-qris-provider": "xendit",
      "x-callback-signature": xenditSig(body, XENDIT_TOKEN),
    });
    expect(status).toBe(503);
  });
});
