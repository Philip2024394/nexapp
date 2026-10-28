// src/lib/nex-native/emergency/_rate-limit.ts
//
// NEX Emergency Help · disclosure-read rate limiter.
// Owner-authorised 2026-10-25 (sealed Decision #7 · 20 reads/profile/
// caller/hour).
//
// The disclosure gate consults this store on every read. The 21st
// read in a one-hour window returns `rate_limit_exceeded` and the
// gate writes an audit event with `kind = 'read_denied'`.
//
// Two implementations:
//   · InMemoryRateLimiter    · for tests + dev (no DB)
//   · DatabaseRateLimiter    · interface only · the real server
//     action implements it against nex.emergency_profile_rate_limit
//     from migration 225 (not applied until authorised)
//
// The in-memory limiter is NOT a security boundary · it does not
// survive process restart and is per-replica. The database limiter
// is the real enforcement path.

export const EMERGENCY_READS_PER_HOUR_LIMIT = 20;

export interface RateLimiterKey {
  readonly readerAccountId: string;
  readonly profileAccountId: string;
}

export interface RateLimiterOutcome {
  readonly allowed: boolean;
  readonly readsSoFarInWindow: number;
  readonly windowStartMs: number;
  readonly windowEndMs: number;
}

export interface RateLimiter {
  /** Attempt to record a read · returns outcome. If allowed, the
   *  caller MUST proceed with the read; the counter is incremented
   *  only on `allowed = true` (the DB-backed implementation uses
   *  an UPSERT with a bounded CHECK to make this atomic). */
  recordAttempt(
    key: RateLimiterKey,
    nowMs?: number,
  ): Promise<RateLimiterOutcome>;

  /** Peek at the current count without recording an attempt. */
  peek(key: RateLimiterKey, nowMs?: number): Promise<number>;

  /** Reset a specific key · for admin unblock / tests. */
  reset(key: RateLimiterKey): Promise<void>;
}

// ─── In-memory implementation ───────────────────────────────────────

function hourWindowStartMs(nowMs: number): number {
  return Math.floor(nowMs / 3_600_000) * 3_600_000;
}

function keyString(key: RateLimiterKey): string {
  return `${key.readerAccountId}:${key.profileAccountId}`;
}

export function createInMemoryRateLimiter(options?: {
  readonly limit?: number;
}): RateLimiter {
  const limit = options?.limit ?? EMERGENCY_READS_PER_HOUR_LIMIT;
  const windows = new Map<string, { windowStart: number; count: number }>();

  function evictStale(nowMs: number): void {
    const cutoff = hourWindowStartMs(nowMs) - 3_600_000;
    for (const [k, v] of windows) {
      if (v.windowStart < cutoff) windows.delete(k);
    }
  }

  return {
    async recordAttempt(key, nowMsArg): Promise<RateLimiterOutcome> {
      const nowMs = nowMsArg ?? Date.now();
      evictStale(nowMs);
      const windowStart = hourWindowStartMs(nowMs);
      const k = keyString(key);
      const existing = windows.get(k);
      const current =
        existing && existing.windowStart === windowStart
          ? existing
          : { windowStart, count: 0 };

      if (current.count >= limit) {
        windows.set(k, current);
        return {
          allowed: false,
          readsSoFarInWindow: current.count,
          windowStartMs: windowStart,
          windowEndMs: windowStart + 3_600_000,
        };
      }

      current.count += 1;
      windows.set(k, current);
      return {
        allowed: true,
        readsSoFarInWindow: current.count,
        windowStartMs: windowStart,
        windowEndMs: windowStart + 3_600_000,
      };
    },
    async peek(key, nowMsArg): Promise<number> {
      const nowMs = nowMsArg ?? Date.now();
      const windowStart = hourWindowStartMs(nowMs);
      const existing = windows.get(keyString(key));
      if (!existing || existing.windowStart !== windowStart) return 0;
      return existing.count;
    },
    async reset(key): Promise<void> {
      windows.delete(keyString(key));
    },
  };
}
