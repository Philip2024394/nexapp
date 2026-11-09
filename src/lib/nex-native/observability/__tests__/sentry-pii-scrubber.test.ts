// src/lib/nex-native/observability/__tests__/sentry-pii-scrubber.test.ts

import { describe, expect, it } from "vitest";
import {
  scrubObject,
  scrubString,
  scrubSentryEvent,
  FORBIDDEN_KEYS,
} from "../sentry-pii-scrubber";

describe("scrubObject", () => {
  it("redacts sealed-invariant keys with sealed marker", () => {
    const input = { body: "hello", ciphertext: "deadbeef", attachment_bytes: "xx" };
    const out = scrubObject(input) as Record<string, unknown>;
    expect(out.body).toBe("[REDACTED · sealed I-1]");
    expect(out.ciphertext).toBe("[REDACTED · sealed I-1]");
    expect(out.attachment_bytes).toBe("[REDACTED · sealed I-1]");
  });

  it("redacts credential keys", () => {
    const input = { password: "hunter2", api_key: "sk_live_xyz", token: "abc" };
    const out = scrubObject(input) as Record<string, unknown>;
    expect(out.password).toBe("[REDACTED]");
    expect(out.api_key).toBe("[REDACTED]");
    expect(out.token).toBe("[REDACTED]");
  });

  it("case-insensitive and strips dashes/underscores", () => {
    const input = { "Message-Body": "x", MESSAGE_BODY: "x", MessageBody: "x" };
    const out = scrubObject(input) as Record<string, unknown>;
    expect(out["Message-Body"]).toBe("[REDACTED · sealed I-1]");
    expect(out["MESSAGE_BODY"]).toBe("[REDACTED · sealed I-1]");
    expect(out["MessageBody"]).toBe("[REDACTED · sealed I-1]");
  });

  it("recurses into nested objects", () => {
    const input = { outer: { inner: { password: "x", safe: "y" } } };
    const out = scrubObject(input) as { outer: { inner: Record<string, string> } };
    expect(out.outer.inner.password).toBe("[REDACTED]");
    expect(out.outer.inner.safe).toBe("y");
  });

  it("recurses into arrays", () => {
    const input = [{ body: "x" }, { safe: "y" }];
    const out = scrubObject(input) as Array<Record<string, string>>;
    expect(out[0].body).toBe("[REDACTED · sealed I-1]");
    expect(out[1].safe).toBe("y");
  });

  it("stops at MAX_DEPTH", () => {
    let input: any = {};
    let cur = input;
    for (let i = 0; i < 20; i++) {
      cur.next = {};
      cur = cur.next;
    }
    cur.body = "should_still_be_redacted_if_reached";
    const out = scrubObject(input);
    // Depth-limited · will return [MAX_DEPTH] at some point
    expect(JSON.stringify(out)).toContain("[MAX_DEPTH]");
  });
});

describe("scrubString", () => {
  it("redacts JWTs", () => {
    const s = "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhY2NvdW50In0.abcdefghij1234567890 in URL";
    expect(scrubString(s)).toBe("token [REDACTED] in URL");
  });

  it("redacts Stripe secret keys", () => {
    expect(scrubString("sk_live_abcdef1234567890abcdef12")).toBe("[REDACTED]");
    expect(scrubString("sk_test_abcdef1234567890abcdef12")).toBe("[REDACTED]");
  });

  it("redacts Bearer tokens", () => {
    expect(scrubString("Authorization: Bearer abcdef1234567890abcdef12")).toBe(
      "Authorization: [REDACTED]",
    );
  });
});

describe("scrubSentryEvent", () => {
  it("scrubs request.data", () => {
    const evt = scrubSentryEvent({ request: { data: { password: "x", body: "y", safe: "z" } } });
    const data = evt?.request?.data as Record<string, unknown>;
    expect(data.password).toBe("[REDACTED]");
    expect(data.body).toBe("[REDACTED · sealed I-1]");
    expect(data.safe).toBe("z");
  });

  it("drops cookies entirely", () => {
    const evt = scrubSentryEvent({ request: { cookies: { session: "abc", csrf: "def" } } });
    const cookies = evt?.request?.cookies ?? {};
    expect(cookies.session).toBe("[REDACTED]");
    expect(cookies.csrf).toBe("[REDACTED]");
  });

  it("keeps user id but drops email + ip", () => {
    const evt = scrubSentryEvent({ user: { id: "acc_123", email: "x@y.com", ip_address: "1.2.3.4" } });
    expect(evt?.user?.id).toBe("acc_123");
    expect(evt?.user?.email).toBeUndefined();
    expect(evt?.user?.ip_address).toBeUndefined();
  });

  it("scrubs exception stack frame vars", () => {
    const evt = scrubSentryEvent({
      exception: {
        values: [
          {
            value: "oops Bearer abcdef1234567890abcdef12",
            stacktrace: { frames: [{ vars: { body: "x", safe: "y" } }] },
          },
        ],
      },
    });
    const first = evt?.exception?.values?.[0];
    expect(first?.value).toBe("oops [REDACTED]");
    const vars = first?.stacktrace?.frames?.[0]?.vars as Record<string, unknown>;
    expect(vars.body).toBe("[REDACTED · sealed I-1]");
    expect(vars.safe).toBe("y");
  });

  it("has comprehensive forbidden-key coverage", () => {
    // Guards against regression if FORBIDDEN_KEYS is edited without care
    for (const k of ["body", "ciphertext", "password", "token", "api_key", "cookie"]) {
      expect(FORBIDDEN_KEYS).toContain(k);
    }
  });
});
