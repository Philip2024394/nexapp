// src/lib/nex-native/business-trial/__tests__/logging.test.ts
//
// G1 regression tests · Q6 structured logging + A4 hashed-identity helpers.

import { describe, it, expect, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { hashAccountId, makeRequestId, logTrialEvent } from "../logging";

const originalPepper = process.env.NEX_AUDIT_HASH_PEPPER;

afterEach(() => {
  if (originalPepper === undefined) {
    delete process.env.NEX_AUDIT_HASH_PEPPER;
  } else {
    process.env.NEX_AUDIT_HASH_PEPPER = originalPepper;
  }
});

describe("hashAccountId · A4 PROPOSED (SHA-256 + env pepper)", () => {
  it("produces a stable 16-char hex token for the same account+pepper", () => {
    process.env.NEX_AUDIT_HASH_PEPPER = "test-pepper-123";
    const h1 = hashAccountId("00000000-0000-0000-0000-000000000001");
    const h2 = hashAccountId("00000000-0000-0000-0000-000000000001");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{16}$/);
  });

  it("different accounts produce different hashes", () => {
    process.env.NEX_AUDIT_HASH_PEPPER = "test-pepper-123";
    const h1 = hashAccountId("00000000-0000-0000-0000-000000000001");
    const h2 = hashAccountId("00000000-0000-0000-0000-000000000002");
    expect(h1).not.toBe(h2);
  });

  it("different peppers produce different hashes for same account (defence vs cross-env correlation)", () => {
    process.env.NEX_AUDIT_HASH_PEPPER = "pepper-a";
    const h1 = hashAccountId("00000000-0000-0000-0000-000000000001");
    process.env.NEX_AUDIT_HASH_PEPPER = "pepper-b";
    const h2 = hashAccountId("00000000-0000-0000-0000-000000000001");
    expect(h1).not.toBe(h2);
  });

  it("raw UUID never appears in the output", () => {
    process.env.NEX_AUDIT_HASH_PEPPER = "test";
    const id = "deadbeef-cafe-babe-dead-beefcafebabe";
    const hashed = hashAccountId(id);
    expect(hashed).not.toContain(id);
    expect(hashed).not.toContain("deadbeef");
  });
});

describe("makeRequestId", () => {
  it("preserves incoming x-request-id when well-formed", () => {
    const req = new Request("https://nex.example/trial/start", {
      headers: { "x-request-id": "req_abc12345" },
    });
    expect(makeRequestId(req)).toBe("req_abc12345");
  });

  it("also accepts x-nex-request-id", () => {
    const req = new Request("https://nex.example/trial/start", {
      headers: { "x-nex-request-id": "nex-9876abcd" },
    });
    expect(makeRequestId(req)).toBe("nex-9876abcd");
  });

  it("generates a UUID when no incoming id present", () => {
    const req = new Request("https://nex.example/trial/start");
    const id = makeRequestId(req);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("rejects malformed incoming ids (characters outside allowlist) · generates fresh id", () => {
    const req = new Request("https://nex.example/trial/start", {
      headers: { "x-request-id": "bad;sql'injection\"" },
    });
    const id = makeRequestId(req);
    expect(id).not.toContain(";");
    expect(id).not.toContain("'");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("rejects too-short id · generates fresh id", () => {
    const req = new Request("https://nex.example/trial/start", {
      headers: { "x-request-id": "short" }, // 5 chars · min is 8
    });
    const id = makeRequestId(req);
    expect(id).not.toBe("short");
  });
});

describe("logTrialEvent · structured JSON output", () => {
  it("emits a parseable JSON line to stdout containing required fields", () => {
    const spy = { calls: [] as string[] };
    const originalLog = console.log;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log = ((...args: any[]) => {
      spy.calls.push(args.join(" "));
    }) as typeof console.log;
    try {
      logTrialEvent({
        event: "trial.business.start",
        hashedAccount: "abcd1234abcd1234",
        requestId: "req-test-0001",
        statusCode: 200,
      });
    } finally {
      console.log = originalLog;
    }
    expect(spy.calls.length).toBe(1);
    const parsed = JSON.parse(spy.calls[0]) as Record<string, unknown>;
    expect(parsed.event).toBe("trial.business.start");
    expect(parsed.account).toBe("abcd1234abcd1234");
    expect(parsed.request_id).toBe("req-test-0001");
    expect(parsed.status).toBe(200);
    expect(parsed.kind).toBe("nex.business_trial");
    expect(typeof parsed.at).toBe("string");
  });

  it("does NOT emit the raw account_id · only the hashed value", () => {
    const spy = { calls: [] as string[] };
    const originalLog = console.log;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log = ((...args: any[]) => {
      spy.calls.push(args.join(" "));
    }) as typeof console.log;
    try {
      logTrialEvent({
        event: "trial.business.opt_out",
        hashedAccount: "fedcba9876543210",
        requestId: "req-test-0002",
        statusCode: 200,
      });
    } finally {
      console.log = originalLog;
    }
    const line = spy.calls[0];
    expect(line).not.toContain("00000000-0000-0000-0000");
    expect(line).toContain("fedcba9876543210");
  });
});
