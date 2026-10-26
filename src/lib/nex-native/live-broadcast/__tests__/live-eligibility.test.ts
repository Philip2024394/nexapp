// src/lib/nex-native/live-broadcast/__tests__/live-eligibility.test.ts
//
// R9 (2026-10-27) · Live-eligibility contract tests.
// Focused on the discriminated-union output of resolveLiveEligibility.

import { describe, it, expect, vi } from "vitest";

// Shim `server-only` for the vitest module graph · matches the
// pattern used in live-session-service.test.ts (line 30).
vi.mock("server-only", () => ({}));

import {
  resolveLiveEligibility,
  type LiveEligibilityAccount,
} from "../live-eligibility";

/* Fixed epoch so trial-expired / lapsed classifications are
   deterministic. 2026-06-15T12:00:00Z. */
const NOW_MS = Date.UTC(2026, 5, 15, 12, 0, 0);

function acc(
  overrides: Partial<LiveEligibilityAccount> = {},
): LiveEligibilityAccount {
  return {
    business_trial_status: null,
    tier: "gratis",
    bisnis_expires_at: null,
    themes_trial_used_at: null,
    ...overrides,
  };
}

describe("resolveLiveEligibility", () => {
  it("returns not-signed-in for a null account", () => {
    const r = resolveLiveEligibility(null, NOW_MS);
    expect(r).toEqual({ ok: false, reason: "not-signed-in" });
  });

  it("rejects a bare free-tier account", () => {
    const r = resolveLiveEligibility(acc(), NOW_MS);
    expect(r).toEqual({ ok: false, reason: "free-tier" });
  });

  it("accepts a paid Bisnis account whose subscription has not lapsed", () => {
    const r = resolveLiveEligibility(
      acc({
        tier: "bisnis",
        bisnis_expires_at: new Date(NOW_MS + 86_400_000).toISOString(),
      }),
      NOW_MS,
    );
    expect(r).toEqual({ ok: true, mode: "paid-bisnis" });
  });

  it("rejects a Bisnis account whose subscription has lapsed", () => {
    const r = resolveLiveEligibility(
      acc({
        tier: "bisnis",
        bisnis_expires_at: new Date(NOW_MS - 86_400_000).toISOString(),
      }),
      NOW_MS,
    );
    expect(r).toEqual({ ok: false, reason: "lapsed" });
  });

  it("accepts an account on an active business trial", () => {
    const r = resolveLiveEligibility(
      acc({ business_trial_status: "active" }),
      NOW_MS,
    );
    expect(r).toEqual({ ok: true, mode: "trial" });
  });

  it("rejects an account whose trial has expired", () => {
    const r = resolveLiveEligibility(
      acc({ business_trial_status: "expired" }),
      NOW_MS,
    );
    expect(r).toEqual({ ok: false, reason: "trial-expired" });
  });

  it("accepts a pro-tier account", () => {
    const r = resolveLiveEligibility(acc({ tier: "pro" }), NOW_MS);
    expect(r).toEqual({ ok: true, mode: "paid-pro" });
  });
});
