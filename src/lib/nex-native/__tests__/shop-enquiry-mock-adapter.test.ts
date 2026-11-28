// src/lib/nex-native/__tests__/shop-enquiry-mock-adapter.test.ts
//
// Rev 3 guest-shop-enquiry · MockSendAdapter contract tests.
// ---------------------------------------------------------------------------
// The mock adapter is used by the integration tests to stand in for the
// real provider adapter. These tests pin its behaviour so the integration
// tests can rely on it:
//   · each send() records the payload exactly
//   · each mode returns the documented SendResult shape or throws
//   · is_dry_run is only true in "dry_run" mode

import { describe, expect, it } from "vitest";

import type { SendPayload } from "../email-send-adapter";
import { MockSendAdapter } from "../shop-enquiry/mock-send-adapter";

const PAYLOAD: SendPayload = {
  to: "merchant@example.invalid",
  subject: "New enquiry via NEX · Shop Name",
  body_text: "body goes here",
  body_html: null,
  from_business_name: "Shop Name",
  unsubscribe_url: "about:blank#enquiry-x",
};

describe("MockSendAdapter · dry_run mode", () => {
  it("returns ok=true + a dry_run_reason", async () => {
    const mock = new MockSendAdapter({ mode: "dry_run" });
    expect(mock.is_dry_run).toBe(true);
    const res = await mock.send(PAYLOAD);
    expect(res.ok).toBe(true);
    expect(res.dry_run_reason).toBeTruthy();
  });

  it("records each call with the payload", async () => {
    const mock = new MockSendAdapter({ mode: "dry_run" });
    await mock.send(PAYLOAD);
    await mock.send({ ...PAYLOAD, to: "another@example.invalid" });
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls[0]!.to).toBe("merchant@example.invalid");
    expect(mock.calls[1]!.to).toBe("another@example.invalid");
  });

  it("freezes the recorded payload (caller mutation does not affect recording)", async () => {
    const mock = new MockSendAdapter({ mode: "dry_run" });
    const payload = { ...PAYLOAD, subject: "first" };
    await mock.send(payload);
    payload.subject = "mutated";
    expect(mock.calls[0]!.subject).toBe("first");
  });
});

describe("MockSendAdapter · delivered mode", () => {
  it("returns ok=true without dry_run_reason", async () => {
    const mock = new MockSendAdapter({ mode: "delivered" });
    expect(mock.is_dry_run).toBe(false);
    const res = await mock.send(PAYLOAD);
    expect(res.ok).toBe(true);
    expect(res.dry_run_reason).toBeUndefined();
  });
});

describe("MockSendAdapter · failed mode", () => {
  it("returns ok=false with the default error message", async () => {
    const mock = new MockSendAdapter({ mode: "failed" });
    const res = await mock.send(PAYLOAD);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("mock-adapter failure");
  });

  it("returns ok=false with a configurable error message", async () => {
    const mock = new MockSendAdapter({
      mode: "failed",
      errorMessage: "provider rejected: 550 blocked sender",
    });
    const res = await mock.send(PAYLOAD);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("provider rejected: 550 blocked sender");
  });

  it("still records the call (so tests can assert what was attempted)", async () => {
    const mock = new MockSendAdapter({ mode: "failed" });
    await mock.send(PAYLOAD);
    expect(mock.calls).toHaveLength(1);
  });
});

describe("MockSendAdapter · throws mode", () => {
  it("throws with the default message", async () => {
    const mock = new MockSendAdapter({ mode: "throws" });
    await expect(mock.send(PAYLOAD)).rejects.toThrow("mock-adapter boom");
  });

  it("throws with a configurable message", async () => {
    const mock = new MockSendAdapter({
      mode: "throws",
      throwMessage: "timeout waiting for provider",
    });
    await expect(mock.send(PAYLOAD)).rejects.toThrow("timeout waiting for provider");
  });

  it("still records the call even if the send throws", async () => {
    const mock = new MockSendAdapter({ mode: "throws" });
    await mock.send(PAYLOAD).catch(() => undefined);
    expect(mock.calls).toHaveLength(1);
  });
});
