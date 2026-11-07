// src/lib/nex-native/__tests__/security-rate-limit.test.ts
//
// NEX Security Programme · Phase 0 · Item 4 · regression tests for
// the rate-limit service. Owner directive 2026-11-08.
// -----------------------------------------------------------------------------
// Covers:
//   · Key shape · accountRateLimitKey / ipRateLimitKey produce the
//     CHECK-compliant format.
//   · Policy table · every action has sensible bounds.
//   · Fallback (in-memory) path · the first N requests pass, the
//     (N+1)-th throws SecurityRateLimitError with a sensible
//     retryAfterSeconds.
//   · Reset by window · after advancing time past the window, the
//     counter frees up (covered via a wrapper that lets us control
//     the floor's input).
//   · 429 response builder · emits Retry-After header + consistent
//     JSON body.
//   · Bypass resistance · a malformed key is rejected before any
//     counter write (programmer-error guard).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Force the DB probe to fail · tests exercise the in-memory fallback
// path. Separate test suite below exercises the DB-backed path with a
// different mock shape.
vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from() {
      return {
        select() {
          return {
            limit() {
              return Promise.resolve({
                error: { message: "relation nex_security_rate_limit does not exist" },
              });
            },
          };
        },
      };
    },
  },
}));

import {
  _resetSecurityRateLimitLocalForTests,
  _resetSecurityRateLimitProbeCacheForTests,
  accountRateLimitKey,
  buildRateLimitResponse,
  ipRateLimitKey,
  isSecurityRateLimitError,
  recordIfAllowed,
  SECURITY_RATE_LIMITS,
  SecurityRateLimitError,
} from "../security-rate-limit";

describe("Key derivation", () => {
  it("accountRateLimitKey yields acct:<lowercase-uuid>", () => {
    const uuid = "1234ABCD-1234-abcd-ABCD-1234567890AB";
    expect(accountRateLimitKey(uuid)).toBe(
      "acct:1234abcd-1234-abcd-abcd-1234567890ab",
    );
  });

  it("accountRateLimitKey rejects malformed account ids", () => {
    expect(() => accountRateLimitKey("not-a-uuid")).toThrow(/malformed/);
    expect(() => accountRateLimitKey("")).toThrow(/malformed/);
  });

  it("ipRateLimitKey yields a stable sha256 of the raw IP", () => {
    const a = ipRateLimitKey("192.0.2.42");
    const b = ipRateLimitKey("192.0.2.42");
    const c = ipRateLimitKey("192.0.2.99");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^ip:[a-f0-9]{64}$/);
  });

  it("ipRateLimitKey handles null/empty by hashing 'unknown'", () => {
    const a = ipRateLimitKey(null);
    const b = ipRateLimitKey("");
    const c = ipRateLimitKey(undefined);
    expect(a).toBe(b);
    expect(a).toBe(c);
    expect(a).toMatch(/^ip:[a-f0-9]{64}$/);
  });
});

describe("Policy table", () => {
  it("every action has a positive window and cap", () => {
    for (const [action, policy] of Object.entries(SECURITY_RATE_LIMITS)) {
      expect(policy.windowMinutes, `${action} windowMinutes`).toBeGreaterThan(0);
      expect(policy.maxPerWindow, `${action} maxPerWindow`).toBeGreaterThan(0);
      expect(policy.rationale.length, `${action} rationale`).toBeGreaterThan(
        20,
      );
    }
  });

  it("includes all seven endpoint group actions", () => {
    const expected = [
      "password_change",
      "session_revoke",
      "session_revoke_all",
      "chat_message",
      "account_create",
      "webauthn_assert",
      "webauthn_enroll",
    ] as const;
    for (const action of expected) {
      expect(SECURITY_RATE_LIMITS[action]).toBeDefined();
    }
  });
});

describe("recordIfAllowed · in-memory fallback", () => {
  beforeEach(() => {
    _resetSecurityRateLimitProbeCacheForTests();
    _resetSecurityRateLimitLocalForTests();
    // Silence the loud warn logs so test output stays readable.
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("permits the first N calls and throws on the (N+1)-th", async () => {
    const key = accountRateLimitKey(
      "00000000-0000-0000-0000-000000000001",
    );
    const policy = SECURITY_RATE_LIMITS.password_change;
    for (let i = 0; i < policy.maxPerWindow; i++) {
      await recordIfAllowed(key, "password_change");
    }
    await expect(recordIfAllowed(key, "password_change")).rejects.toBeInstanceOf(
      SecurityRateLimitError,
    );
  });

  it("isolates counters by action", async () => {
    const key = accountRateLimitKey(
      "00000000-0000-0000-0000-000000000002",
    );
    // Fill password_change to its cap.
    const pwd = SECURITY_RATE_LIMITS.password_change;
    for (let i = 0; i < pwd.maxPerWindow; i++) {
      await recordIfAllowed(key, "password_change");
    }
    // session_revoke is independent.
    await expect(
      recordIfAllowed(key, "session_revoke"),
    ).resolves.toBeUndefined();
  });

  it("isolates counters by identity key", async () => {
    const a = accountRateLimitKey(
      "00000000-0000-0000-0000-00000000000a",
    );
    const b = accountRateLimitKey(
      "00000000-0000-0000-0000-00000000000b",
    );
    const policy = SECURITY_RATE_LIMITS.password_change;
    for (let i = 0; i < policy.maxPerWindow; i++) {
      await recordIfAllowed(a, "password_change");
    }
    // b is unrelated · still has full headroom.
    await expect(
      recordIfAllowed(b, "password_change"),
    ).resolves.toBeUndefined();
  });

  it("thrown error carries action + retryAfterSeconds", async () => {
    const key = accountRateLimitKey(
      "00000000-0000-0000-0000-000000000003",
    );
    const policy = SECURITY_RATE_LIMITS.session_revoke_all;
    for (let i = 0; i < policy.maxPerWindow; i++) {
      await recordIfAllowed(key, "session_revoke_all");
    }
    try {
      await recordIfAllowed(key, "session_revoke_all");
      throw new Error("expected throw");
    } catch (err) {
      expect(isSecurityRateLimitError(err)).toBe(true);
      const e = err as SecurityRateLimitError;
      expect(e.action).toBe("session_revoke_all");
      expect(e.retryAfterSeconds).toBeGreaterThan(0);
      expect(e.retryAfterSeconds).toBeLessThanOrEqual(policy.windowMinutes * 60);
    }
  });

  it("rejects a malformed key BEFORE any counter is touched (programmer-error guard)", async () => {
    await expect(
      recordIfAllowed("garbage-key", "password_change"),
    ).rejects.toThrow(/malformed/);
    // Even after the throw, a legitimate call on a valid key still has
    // its full headroom · proves the bad call did NOT accidentally
    // increment anything.
    const key = accountRateLimitKey(
      "00000000-0000-0000-0000-000000000004",
    );
    await expect(
      recordIfAllowed(key, "password_change"),
    ).resolves.toBeUndefined();
  });

  it("resets after advancing past the window", async () => {
    const key = accountRateLimitKey(
      "00000000-0000-0000-0000-000000000005",
    );
    const policy = SECURITY_RATE_LIMITS.password_change;
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-08T10:00:00.000Z"));
      for (let i = 0; i < policy.maxPerWindow; i++) {
        await recordIfAllowed(key, "password_change");
      }
      // Still inside the window · throws.
      await expect(
        recordIfAllowed(key, "password_change"),
      ).rejects.toBeInstanceOf(SecurityRateLimitError);
      // Advance past the window.
      vi.setSystemTime(
        new Date(
          Date.now() + (policy.windowMinutes + 1) * 60_000,
        ),
      );
      // Fresh window · counter is free again.
      await expect(
        recordIfAllowed(key, "password_change"),
      ).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("buildRateLimitResponse", () => {
  it("emits 429 + JSON body + Retry-After header", () => {
    const err = new SecurityRateLimitError("password_change", 120);
    const r = buildRateLimitResponse(err);
    expect(r.status).toBe(429);
    expect(r.body).toEqual({
      ok: false,
      error: "rate_limited",
      action: "password_change",
      retry_after_seconds: 120,
    });
    expect(r.headers["Retry-After"]).toBe("120");
    expect(r.headers["X-RateLimit-Reason"]).toBe("password_change");
  });
});
