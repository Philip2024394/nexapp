// src/lib/nex-native/follow/__tests__/follow-rate-limit.test.ts
//
// Unit tests for the Stage 1 in-memory Follow rate limiter.
// Owner-authorised 2026-10-30 per Stage 1 preparation §13.4.
//
// Coverage:
//   · 20 follows/60s HARD limit (rejects 21st)
//   · 50 follows/5min SOFT limit (allows + flags)
//   · 3 unfollows/24h SOFT limit (allows + flags on 4th)
//   · Window rollover resets bucket
//   · Honest limitation documented in header (not a test, but
//     verified by inspection)
//
// All tests use the test-only reset helper between cases.

import { describe, it, expect, beforeEach, vi } from "vitest";

// Stub the `server-only` guard · tests run in a Node context, not a
// browser bundle, so the guard would throw spuriously. Matches the
// sealed pattern established in `active-slot-repository.test.ts`.
vi.mock("server-only", () => ({}));

import {
  recordFollowRateLimitAttempt,
  checkFollowAttempt,
  checkUnfollowAttempt,
  __resetFollowRateLimitsForTests__,
} from "../follow-rate-limit";

const DEWI = "00000000-0000-0000-0000-000000000001";
const HENDRA = "00000000-0000-0000-0000-000000000002";
const NOW = 1_793_300_000_000; // deterministic test time

describe("follow-rate-limit · HARD follow_60s", () => {
  beforeEach(() => __resetFollowRateLimitsForTests__());

  it("allows the first 20 follow attempts in a 60s window", () => {
    for (let i = 0; i < 20; i++) {
      const r = recordFollowRateLimitAttempt("follow_60s", DEWI, NOW);
      expect(r.ok, `attempt ${i + 1}`).toBe(true);
    }
  });

  it("rejects the 21st follow attempt in the same window", () => {
    for (let i = 0; i < 20; i++) {
      recordFollowRateLimitAttempt("follow_60s", DEWI, NOW);
    }
    const r = recordFollowRateLimitAttempt("follow_60s", DEWI, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.limit).toBe(20);
      expect(r.windowMs).toBe(60_000);
      expect(r.resetInMs).toBeGreaterThan(0);
      expect(r.resetInMs).toBeLessThanOrEqual(60_000);
    }
  });

  it("resets after the window rolls (next window = NOW + 60s)", () => {
    for (let i = 0; i < 20; i++) {
      recordFollowRateLimitAttempt("follow_60s", DEWI, NOW);
    }
    const next = recordFollowRateLimitAttempt("follow_60s", DEWI, NOW + 60_000);
    expect(next.ok).toBe(true);
  });

  it("tracks different accounts independently", () => {
    for (let i = 0; i < 20; i++) {
      recordFollowRateLimitAttempt("follow_60s", DEWI, NOW);
    }
    const other = recordFollowRateLimitAttempt("follow_60s", HENDRA, NOW);
    expect(other.ok).toBe(true);
  });
});

describe("follow-rate-limit · SOFT follow_5min abuse flag", () => {
  beforeEach(() => __resetFollowRateLimitsForTests__());

  it("allows up to 50 follows in a 5min window without flagging", () => {
    for (let i = 0; i < 50; i++) {
      const r = recordFollowRateLimitAttempt("follow_5min", DEWI, NOW);
      expect(r.ok, `attempt ${i + 1}`).toBe(true);
      if (r.ok) expect("flagged" in r).toBe(false);
    }
  });

  it("flags the 51st+ attempt (still allowed)", () => {
    for (let i = 0; i < 50; i++) {
      recordFollowRateLimitAttempt("follow_5min", DEWI, NOW);
    }
    const r51 = recordFollowRateLimitAttempt("follow_5min", DEWI, NOW);
    expect(r51.ok).toBe(true);
    if (r51.ok) {
      expect("flagged" in r51 && r51.flagged === true).toBe(true);
      if ("flagged" in r51) expect(r51.reason).toBe("follow_5min");
    }
  });
});

describe("follow-rate-limit · SOFT unfollow_24h churn signal", () => {
  beforeEach(() => __resetFollowRateLimitsForTests__());

  it("allows the first 3 unfollows of the same target in 24h", () => {
    const key = `${DEWI}:${HENDRA}`;
    for (let i = 0; i < 3; i++) {
      const r = recordFollowRateLimitAttempt("unfollow_24h", key, NOW);
      expect(r.ok, `attempt ${i + 1}`).toBe(true);
      if (r.ok) expect("flagged" in r).toBe(false);
    }
  });

  it("flags the 4th unfollow of the same target (still allowed)", () => {
    const key = `${DEWI}:${HENDRA}`;
    for (let i = 0; i < 3; i++) {
      recordFollowRateLimitAttempt("unfollow_24h", key, NOW);
    }
    const r4 = recordFollowRateLimitAttempt("unfollow_24h", key, NOW);
    expect(r4.ok).toBe(true);
    if (r4.ok) {
      expect("flagged" in r4 && r4.flagged === true).toBe(true);
      if ("flagged" in r4) expect(r4.reason).toBe("unfollow_24h");
    }
  });

  it("tracks (follower, followee) pairs independently", () => {
    const key1 = `${DEWI}:${HENDRA}`;
    const key2 = `${DEWI}:00000000-0000-0000-0000-000000000003`;
    for (let i = 0; i < 3; i++) {
      recordFollowRateLimitAttempt("unfollow_24h", key1, NOW);
    }
    const other = recordFollowRateLimitAttempt("unfollow_24h", key2, NOW);
    expect(other.ok).toBe(true);
    if (other.ok) expect("flagged" in other).toBe(false);
  });
});

describe("follow-rate-limit · convenience wrappers", () => {
  beforeEach(() => __resetFollowRateLimitsForTests__());

  it("checkFollowAttempt returns both HARD and abuseFlag results", () => {
    const r = checkFollowAttempt(DEWI, NOW);
    expect(r.hard.ok).toBe(true);
    expect(r.abuseFlag.ok).toBe(true);
  });

  it("checkUnfollowAttempt keys on (follower, followee)", () => {
    const r = checkUnfollowAttempt(DEWI, HENDRA, NOW);
    expect(r.ok).toBe(true);
  });
});
