// src/lib/nex-native/music/music-rate-limit.ts
//
// Owner-authorised 2026-10-29 (Stage 5C · H3 proposal approved by
// owner on same day) · in-memory per-process rate limiter for the
// four counter-mutation actions on music tracks.
//
// Scope (approved):
//   preview          60 / account / hour
//   like toggle      30 / account / hour
//   share            10 / account / hour
//   soft delete      20 / account / hour
//
// Explicitly RESERVED for separate authorisation (NOT wired here):
//   permanent delete  5 / account / hour  (hard-delete action)
//
// Honest limitations · documented so no caller treats this as
// production enforcement:
//
//   1. STATE RESETS on dev-server restart. The in-memory Map is
//      process-local. Any restart (Turbopack HMR often does NOT
//      reset the module, but a full `npm run dev` restart does)
//      zeros every bucket.
//   2. NOT MULTI-WORKER SAFE. Each Node worker holds its own Map;
//      a load-balanced production deployment lets a client reach
//      N × the per-worker limit by hitting different workers.
//   3. NOT PRODUCTION ENFORCEMENT. The sealed DRAFT §2.2 production
//      path is a DB-backed `nex_music_rate_limit` table (mirroring
//      `watch-listing-rate-limit-service.ts`). This module exists
//      ONLY as a development-safety brake until that production
//      path is authorised and shipped.
//   4. UPLOAD LIMITS ARE A SEPARATE SCOPE. DRAFT §2.2 defines
//      10/hour · 50/day · 500/30d upload limits; they live in a
//      different authorisation gate and are not enforced here.
//
// Window: current UTC hour (floor of `now_ms / 3_600_000`). When
// the hour rolls over, the bucket for an `(action, accountId)` key
// is reset lazily on the next check.

import "server-only";

export type NexMusicRateLimitAction =
  | "preview"
  | "like"
  | "share"
  | "soft_delete";

/** Owner-approved 2026-10-29 · development-only hourly ceilings.
 *  Any change here must be re-authorised by the owner. */
const HOURLY_LIMITS: Readonly<Record<NexMusicRateLimitAction, number>> = {
  preview: 60,
  like: 30,
  share: 10,
  soft_delete: 20,
};

interface Bucket {
  windowStartHour: number;
  count: number;
}

const buckets: Map<string, Bucket> = new Map();

function hourFloor(nowMs: number): number {
  return Math.floor(nowMs / (60 * 60 * 1000));
}

export interface RateLimitCheckOk {
  readonly ok: true;
  readonly remaining: number;
}

export interface RateLimitCheckBlocked {
  readonly ok: false;
  readonly limit: number;
  readonly resetInSeconds: number;
}

export type RateLimitCheck = RateLimitCheckOk | RateLimitCheckBlocked;

/** Record an attempt and return whether it is allowed. On
 *  allow, the counter is incremented. On block, the counter is
 *  NOT incremented and the caller returns a rate-limited error. */
export function recordRateLimitedAttempt(
  action: NexMusicRateLimitAction,
  accountId: string,
  nowMs: number = Date.now(),
): RateLimitCheck {
  const limit = HOURLY_LIMITS[action];
  const key = `${action}:${accountId}`;
  const windowStartHour = hourFloor(nowMs);
  const existing = buckets.get(key);
  if (!existing || existing.windowStartHour !== windowStartHour) {
    // Fresh window.
    if (limit < 1) {
      // Defensive · 0-limit would mean "always block"; we treat as
      // misconfiguration and allow a single attempt rather than
      // deadlock the UI.
      return { ok: true, remaining: 0 };
    }
    buckets.set(key, { windowStartHour, count: 1 });
    return { ok: true, remaining: limit - 1 };
  }
  if (existing.count >= limit) {
    const nextWindowMs = (windowStartHour + 1) * 60 * 60 * 1000;
    return {
      ok: false,
      limit,
      resetInSeconds: Math.max(1, Math.ceil((nextWindowMs - nowMs) / 1000)),
    };
  }
  existing.count += 1;
  return { ok: true, remaining: limit - existing.count };
}

/** Diagnostics-only · the number of accounts with an active
 *  bucket for an action. Not called from production paths. */
export function musicRateLimitActiveAccountCount(
  action: NexMusicRateLimitAction,
): number {
  const nowHour = hourFloor(Date.now());
  let n = 0;
  for (const [key, bucket] of buckets) {
    if (key.startsWith(`${action}:`) && bucket.windowStartHour === nowHour) {
      n += 1;
    }
  }
  return n;
}

/** Test-only · reset the in-memory state. Used by the Stage 5C
 *  authorised integration tests. NEVER called from production
 *  paths. */
export function __resetMusicRateLimits__(): void {
  buckets.clear();
}
