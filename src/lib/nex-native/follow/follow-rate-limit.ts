// src/lib/nex-native/follow/follow-rate-limit.ts
//
// Owner-authorised 2026-10-30 · in-memory per-process rate limiter
// for the Stage 1 Follow actions. Numbers come from §16 D3:
//
//   · follow:   20 per account per 60 seconds   · HARD reject
//   · follow:   50 per account per 5 minutes    · ABUSE FLAG (allow + log)
//   · unfollow:  3 per (follower,followee) per 24 hours · CHURN FLAG (allow + log)
//
// HONEST LIMITATIONS (per Stage 1 preparation §13.4):
//
//   1. PER-PROCESS ONLY. The limiter state lives in an in-memory Map
//      inside this Node process. A multi-worker deployment (e.g.,
//      two Vercel instances handling the same account's requests)
//      will NOT share limiter state. Effective per-account limit
//      under N workers = N × the configured per-process limit.
//
//   2. RESETS ON RESTART. The Map is process-local. Any Node restart
//      (deployment, OOM kill, crash recovery) zeros every bucket.
//
//   3. NOT A GLOBAL ABUSE-PREVENTION GUARANTEE. This limiter is a
//      PER-PROCESS SAFETY BRAKE that catches obvious client-side
//      loops and well-behaved abuse. A determined attacker who can
//      hit multiple instances OR time their requests across restarts
//      can exceed the stated rate.
//
//   4. PRODUCTION-GRADE ENFORCEMENT is DEFERRED to Stage 2 via a
//      DB-backed `nex_follow_rate_limit` table following the sealed
//      `watch-listing-rate-limit-service.ts` pattern. Stage 2
//      approval required.
//
// Any claim that this limiter "enforces" the D3 numbers across the
// system is incorrect. The numbers are per-process soft caps, not
// global guarantees.

import "server-only";

/** The three rate-limited action classes · chosen so the churn
 *  signal (unfollow) keys on the (follower, followee) pair, while
 *  the follow signal keys on the follower only. */
export type FollowRateLimitAction =
  | "follow_60s"      // hard  · 20/60s per follower
  | "follow_5min"     // soft  · 50/5min per follower · abuse flag
  | "unfollow_24h";   // soft  · 3/24h per (follower,followee) · churn flag

export interface FollowRateLimitWindow {
  readonly limit: number;
  readonly windowMs: number;
  /** When true, exceeding the limit RETURNS the limited result and
   *  the caller rejects. When false, exceeding only EMITS a flag
   *  (logged) · the caller still succeeds. */
  readonly hard: boolean;
}

/** Sealed per §16 D3 · changing these requires a doctrine amendment. */
export const FOLLOW_RATE_LIMITS: Readonly<
  Record<FollowRateLimitAction, FollowRateLimitWindow>
> = {
  follow_60s: {
    limit: 20,
    windowMs: 60 * 1000,
    hard: true,
  },
  follow_5min: {
    limit: 50,
    windowMs: 5 * 60 * 1000,
    hard: false,
  },
  unfollow_24h: {
    limit: 3,
    windowMs: 24 * 60 * 60 * 1000,
    hard: false,
  },
};

interface Bucket {
  readonly windowStartMs: number;
  count: number;
}

const buckets: Map<string, Bucket> = new Map();

export interface FollowRateLimitAllowed {
  readonly ok: true;
  readonly remaining: number;
}
export interface FollowRateLimitRejected {
  readonly ok: false;
  readonly limit: number;
  readonly windowMs: number;
  readonly resetInMs: number;
}
export interface FollowRateLimitFlagged {
  readonly ok: true;
  readonly flagged: true;
  readonly reason: FollowRateLimitAction;
}

export type FollowRateLimitResult =
  | FollowRateLimitAllowed
  | FollowRateLimitRejected
  | FollowRateLimitFlagged;

/** Record an attempt against one rate-limit window. For HARD windows
 *  (`follow_60s`), returns `{ok:false, ...}` when the limit is
 *  exceeded and does NOT increment the counter. For SOFT windows
 *  (`follow_5min`, `unfollow_24h`), always allows the attempt and
 *  returns `{ok:true, flagged:true, reason}` when the limit is
 *  exceeded · the counter DOES increment either way.
 *
 *  The key is composed by the caller · for follow actions use the
 *  follower account id; for the churn signal use `${follower}:${followee}`
 *  so a user unfollowing-refollowing one specific person is tracked
 *  distinctly from their aggregate unfollow volume. */
export function recordFollowRateLimitAttempt(
  action: FollowRateLimitAction,
  key: string,
  nowMs: number = Date.now(),
): FollowRateLimitResult {
  const spec = FOLLOW_RATE_LIMITS[action];
  const bucketKey = `${action}:${key}`;
  const existing = buckets.get(bucketKey);
  const windowStartMs = Math.floor(nowMs / spec.windowMs) * spec.windowMs;

  if (!existing || existing.windowStartMs !== windowStartMs) {
    // Fresh window.
    buckets.set(bucketKey, { windowStartMs, count: 1 });
    return { ok: true, remaining: Math.max(0, spec.limit - 1) };
  }

  // Within an active window.
  if (existing.count >= spec.limit) {
    if (spec.hard) {
      // HARD · reject · do NOT increment the counter so the client
      // can retry just after the window rolls without being double-
      // penalised.
      const resetInMs = Math.max(1, windowStartMs + spec.windowMs - nowMs);
      return { ok: false, limit: spec.limit, windowMs: spec.windowMs, resetInMs };
    }
    // SOFT · allow but flag · still increment so continued abuse
    // keeps triggering the flag on each subsequent attempt.
    existing.count += 1;
    return { ok: true, flagged: true, reason: action };
  }

  existing.count += 1;
  return { ok: true, remaining: spec.limit - existing.count };
}

/** Convenience checker for the followAction. Returns the HARD rate
 *  limiter's reject result (if any) plus the SOFT abuse-flag signal. */
export function checkFollowAttempt(
  followerId: string,
  nowMs: number = Date.now(),
): {
  readonly hard: FollowRateLimitResult;
  readonly abuseFlag: FollowRateLimitResult;
} {
  return {
    hard: recordFollowRateLimitAttempt("follow_60s", followerId, nowMs),
    abuseFlag: recordFollowRateLimitAttempt("follow_5min", followerId, nowMs),
  };
}

/** Convenience checker for the unfollowAction. Returns ONLY the
 *  churn signal (no hard limit on unfollow). */
export function checkUnfollowAttempt(
  followerId: string,
  followeeId: string,
  nowMs: number = Date.now(),
): FollowRateLimitResult {
  return recordFollowRateLimitAttempt(
    "unfollow_24h",
    `${followerId}:${followeeId}`,
    nowMs,
  );
}

/** Test-only · reset the in-memory state. Never called from
 *  production paths. Matches the sealed convention from
 *  `src/lib/nex-native/music/music-rate-limit.ts`. */
export function __resetFollowRateLimitsForTests__(): void {
  buckets.clear();
}
