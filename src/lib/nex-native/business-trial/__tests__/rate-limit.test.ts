// src/lib/nex-native/business-trial/__tests__/rate-limit.test.ts
//
// G1 regression tests · in-memory advisory rate limiter · T29/T30 adjacent.

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  recordTrialRateLimit,
  NexBusinessTrialRateLimitError,
  TRIAL_RATE_LIMITS,
  __resetTrialRateLimitForTests,
} from "../rate-limit";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

beforeEach(() => {
  __resetTrialRateLimitForTests();
});

describe("recordTrialRateLimit · basic admission", () => {
  it("permits first call for trial_start", () => {
    expect(() => recordTrialRateLimit(A, "trial_start")).not.toThrow();
  });

  it("permits up to max_per_window calls", () => {
    const max = TRIAL_RATE_LIMITS.trial_start.maxPerWindow;
    for (let i = 0; i < max; i++) {
      expect(() => recordTrialRateLimit(A, "trial_start")).not.toThrow();
    }
  });

  it("T29 adjacent · (max+1)th call throws NexBusinessTrialRateLimitError", () => {
    const max = TRIAL_RATE_LIMITS.trial_start.maxPerWindow;
    for (let i = 0; i < max; i++) {
      recordTrialRateLimit(A, "trial_start");
    }
    expect(() => recordTrialRateLimit(A, "trial_start")).toThrow(
      NexBusinessTrialRateLimitError,
    );
  });
});

describe("recordTrialRateLimit · scope isolation", () => {
  it("account isolation · one account's quota does not deplete another's", () => {
    const max = TRIAL_RATE_LIMITS.trial_start.maxPerWindow;
    for (let i = 0; i < max; i++) {
      recordTrialRateLimit(A, "trial_start");
    }
    // Account B is a fresh bucket · must still accept
    expect(() => recordTrialRateLimit(B, "trial_start")).not.toThrow();
  });

  it("action isolation · one action's quota does not deplete another's", () => {
    const max = TRIAL_RATE_LIMITS.trial_start.maxPerWindow;
    for (let i = 0; i < max; i++) {
      recordTrialRateLimit(A, "trial_start");
    }
    // Opt-out action is independent
    expect(() => recordTrialRateLimit(A, "trial_opt_out_conversion")).not.toThrow();
    expect(() => recordTrialRateLimit(A, "trial_resume_conversion_interest")).not.toThrow();
  });
});

describe("recordTrialRateLimit · T30 window boundary (rolling)", () => {
  it("counter resets when window elapses · simulated via explicit nowMs", () => {
    const windowMinutes = TRIAL_RATE_LIMITS.trial_start.windowMinutes;
    const max = TRIAL_RATE_LIMITS.trial_start.maxPerWindow;
    const baseMs = 1_000_000_000_000; // arbitrary · must be in the past

    for (let i = 0; i < max; i++) {
      recordTrialRateLimit(A, "trial_start", baseMs);
    }
    expect(() => recordTrialRateLimit(A, "trial_start", baseMs)).toThrow(
      NexBusinessTrialRateLimitError,
    );

    // Advance past the window boundary · new bucket, counter resets
    const nextWindowMs = baseMs + windowMinutes * 60_000 + 1;
    expect(() => recordTrialRateLimit(A, "trial_start", nextWindowMs)).not.toThrow();
  });
});

describe("Error contract", () => {
  it("exposes windowMinutes and maxPerWindow on the error for API-layer response shape", () => {
    const max = TRIAL_RATE_LIMITS.trial_start.maxPerWindow;
    for (let i = 0; i < max; i++) {
      recordTrialRateLimit(A, "trial_start");
    }
    try {
      recordTrialRateLimit(A, "trial_start");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NexBusinessTrialRateLimitError);
      const e = err as NexBusinessTrialRateLimitError;
      expect(e.action).toBe("trial_start");
      expect(e.windowMinutes).toBe(TRIAL_RATE_LIMITS.trial_start.windowMinutes);
      expect(e.maxPerWindow).toBe(TRIAL_RATE_LIMITS.trial_start.maxPerWindow);
      expect(e.code).toBe("rate_limited");
    }
  });
});
