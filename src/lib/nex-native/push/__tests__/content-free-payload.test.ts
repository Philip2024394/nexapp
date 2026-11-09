// src/lib/nex-native/push/__tests__/content-free-payload.test.ts

import { describe, expect, it } from "vitest";
vi_default_server_only();
import {
  buildContentFreePushPayload,
  buildApnsEnvelope,
  buildFcmEnvelope,
  assertNoForbiddenKeys,
  FORBIDDEN_PAYLOAD_KEYS,
} from "../content-free-payload";

// vitest auto-imports are not available · stub `server-only` ourselves.
function vi_default_server_only() {
  // Using require-time import.meta would need top-level async. Instead,
  // we rely on the fact that `server-only` package throws only when
  // imported into a client bundle · in vitest Node env it is a no-op.
}

describe("buildContentFreePushPayload", () => {
  it("builds a minimal v1 payload", () => {
    const p = buildContentFreePushPayload({ conversation_id: "conv-1", wakeup_sequence: 42 });
    expect(p).toEqual({
      type: "nex_wakeup",
      conversation_id: "conv-1",
      wakeup_sequence: 42,
      v: 1,
    });
  });

  it("rejects missing conversation_id", () => {
    expect(() => buildContentFreePushPayload({ conversation_id: "", wakeup_sequence: 0 })).toThrow();
  });

  it("rejects non-integer wakeup_sequence", () => {
    expect(() =>
      buildContentFreePushPayload({ conversation_id: "x", wakeup_sequence: 1.5 as number }),
    ).toThrow();
  });

  it("rejects negative wakeup_sequence", () => {
    expect(() =>
      buildContentFreePushPayload({ conversation_id: "x", wakeup_sequence: -1 }),
    ).toThrow();
  });

  it("output has only the 4 whitelisted keys · no forbidden keys", () => {
    const p = buildContentFreePushPayload({ conversation_id: "c", wakeup_sequence: 1 });
    expect(Object.keys(p).sort()).toEqual(["conversation_id", "type", "v", "wakeup_sequence"]);
    for (const forbidden of FORBIDDEN_PAYLOAD_KEYS) {
      expect(Object.keys(p)).not.toContain(forbidden);
    }
  });
});

describe("assertNoForbiddenKeys", () => {
  it("passes on clean payload", () => {
    expect(() => assertNoForbiddenKeys({ safe: "value" })).not.toThrow();
  });

  it("throws on each forbidden key", () => {
    for (const k of FORBIDDEN_PAYLOAD_KEYS) {
      expect(() => assertNoForbiddenKeys({ [k]: "danger" })).toThrow(/sealed I-1/);
    }
  });

  it("case-insensitive · catches Body, BODY, body all", () => {
    expect(() => assertNoForbiddenKeys({ Body: "x" })).toThrow();
    expect(() => assertNoForbiddenKeys({ BODY: "x" })).toThrow();
    expect(() => assertNoForbiddenKeys({ body: "x" })).toThrow();
  });
});

describe("buildApnsEnvelope", () => {
  it("alert is generic · does NOT include conversation_id", () => {
    const p = buildContentFreePushPayload({ conversation_id: "conv-abc", wakeup_sequence: 1 });
    const apns = buildApnsEnvelope(p);
    expect(apns.aps.alert).toBe("You have a new message");
    expect(apns.aps.alert).not.toContain("conv-abc");
  });

  it("content-available is 1 (silent/background wake)", () => {
    const p = buildContentFreePushPayload({ conversation_id: "x", wakeup_sequence: 0 });
    const apns = buildApnsEnvelope(p);
    expect(apns.aps["content-available"]).toBe(1);
  });

  it("nex-field carries the payload · no forbidden keys", () => {
    const p = buildContentFreePushPayload({ conversation_id: "x", wakeup_sequence: 0 });
    const apns = buildApnsEnvelope(p);
    const serialised = JSON.stringify(apns);
    for (const forbidden of FORBIDDEN_PAYLOAD_KEYS) {
      expect(serialised.toLowerCase()).not.toMatch(new RegExp(`"${forbidden}"\\s*:`));
    }
  });
});

describe("buildFcmEnvelope", () => {
  it("notification.body is generic · does NOT include conversation_id", () => {
    const p = buildContentFreePushPayload({ conversation_id: "conv-abc", wakeup_sequence: 1 });
    const fcm = buildFcmEnvelope(p);
    expect(fcm.notification.body).toBe("You have a new message");
    expect(fcm.notification.body).not.toContain("conv-abc");
  });

  it("data field has only wakeup keys", () => {
    const p = buildContentFreePushPayload({ conversation_id: "x", wakeup_sequence: 7 });
    const fcm = buildFcmEnvelope(p);
    expect(Object.keys(fcm.data).sort()).toEqual([
      "conversation_id",
      "type",
      "v",
      "wakeup_sequence",
    ]);
  });
});
