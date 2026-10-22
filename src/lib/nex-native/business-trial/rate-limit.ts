// src/lib/nex-native/business-trial/rate-limit.ts
//
// G1 · In-memory advisory rate limiter for Business Trial endpoints.
// ===================================================================
//
// Why this is in-memory (A3 Option β-simplified · owner directive
// 2026-10-22):
//   The owner directive A3 explicitly says "Preserve unrelated community
//   limits and behaviours." Extending the shared `nex_community_rate_limit`
//   table's CHECK constraint would mix trial concerns into community
//   infrastructure. Adding a new DB-backed rate-limit table would expand
//   G1 scope beyond the authorised shape (4 columns + trigger + pilot audit
//   table only).
//
//   This in-memory implementation keeps G1 schema untouched. It is
//   HONEST about its limitations.
//
// Honest limitations:
//   · In-process only · multiple Next.js server instances do NOT share state.
//     Multi-process rate limiting requires a shared store (Redis · DB table).
//     For a pilot behind NEX_BUSINESS_TRIAL_ENABLED=false this is acceptable.
//   · Non-atomic between read and write · two near-simultaneous requests can
//     both pass the gate before either increments the counter. Advisory only.
//   · DB preconditions remain AUTHORITATIVE · one-trial-per-lifetime (K1)
//     is enforced by `business_trial_status IS NULL` + SELECT ... FOR UPDATE
//     in the service layer. Rate-limit race cannot cause duplicate trials.
//
// A5 PROPOSED values (owner directive 2026-10-22 · AWAITING APPROVAL):
//   · trial_start: 5 per hour per account
//   · trial_opt_out_conversion: 10 per hour per account
//   · trial_resume_conversion_interest: 10 per hour per account
//
// These values are PROPOSED until owner records approval in Section N of
// the trial doctrine. If owner approves different values, update the
// TRIAL_RATE_LIMITS constant below.

import "server-only";

export type NexBusinessTrialRateLimitAction =
  | "trial_start"
  | "trial_opt_out_conversion"
  | "trial_resume_conversion_interest";

export interface NexBusinessTrialRateLimitConfig {
  readonly windowMinutes: number;
  readonly maxPerWindow: number;
}

/** A5 PROPOSED values (AWAITING OWNER APPROVAL). */
export const TRIAL_RATE_LIMITS: Record<
  NexBusinessTrialRateLimitAction,
  NexBusinessTrialRateLimitConfig
> = {
  trial_start: { windowMinutes: 60, maxPerWindow: 5 },
  trial_opt_out_conversion: { windowMinutes: 60, maxPerWindow: 10 },
  trial_resume_conversion_interest: { windowMinutes: 60, maxPerWindow: 10 },
};

/** Error thrown when a trial rate limit is hit. API routes map this to HTTP 429. */
export class NexBusinessTrialRateLimitError extends Error {
  readonly code = "rate_limited" as const;
  constructor(
    readonly action: NexBusinessTrialRateLimitAction,
    readonly windowMinutes: number,
    readonly maxPerWindow: number,
  ) {
    super(
      `nex-business-trial: rate limit · action=${action} · ${maxPerWindow} per ${windowMinutes}min window reached`,
    );
    this.name = "NexBusinessTrialRateLimitError";
  }
}

// ---------------------------------------------------------------------------
// Internal state · per-process in-memory counter
// ---------------------------------------------------------------------------

type BucketKey = `${string}::${NexBusinessTrialRateLimitAction}::${number}`;

interface Bucket {
  readonly key: BucketKey;
  readonly windowStartMs: number;
  count: number;
}

const buckets = new Map<BucketKey, Bucket>();

function floorWindow(nowMs: number, windowMinutes: number): number {
  const windowMs = windowMinutes * 60_000;
  return Math.floor(nowMs / windowMs) * windowMs;
}

/** Opportunistic cleanup · removes buckets whose window has elapsed +
 *  one full window (gives replay traffic headroom · avoids unbounded growth). */
function cleanup(nowMs: number): void {
  for (const [key, bucket] of buckets.entries()) {
    const config = Object.values(TRIAL_RATE_LIMITS).find(
      (c) => c.windowMinutes * 60_000 === nowMs - bucket.windowStartMs,
    );
    const windowMs = (config?.windowMinutes ?? 60) * 60_000;
    if (nowMs - bucket.windowStartMs > windowMs * 2) {
      buckets.delete(key);
    }
  }
}

/** Record one attempt for (account, action). Throws NexBusinessTrialRateLimitError
 *  if the counter has reached the configured max for the current window.
 *  Otherwise increments and returns.
 *
 *  Advisory only. DB preconditions remain authoritative.
 */
export function recordTrialRateLimit(
  accountId: string,
  action: NexBusinessTrialRateLimitAction,
  nowMs: number = Date.now(),
): void {
  const config = TRIAL_RATE_LIMITS[action];
  const windowStartMs = floorWindow(nowMs, config.windowMinutes);
  const key: BucketKey = `${accountId}::${action}::${windowStartMs}`;

  // Opportunistic cleanup (every 100 calls on average)
  if (buckets.size > 0 && Math.random() < 0.01) {
    cleanup(nowMs);
  }

  const existing = buckets.get(key);
  if (existing) {
    if (existing.count >= config.maxPerWindow) {
      throw new NexBusinessTrialRateLimitError(
        action,
        config.windowMinutes,
        config.maxPerWindow,
      );
    }
    existing.count += 1;
    return;
  }

  buckets.set(key, { key, windowStartMs, count: 1 });
}

/** Testing helper · clears all buckets. Not exported from production bundle;
 *  used only by vitest tests. */
export function __resetTrialRateLimitForTests(): void {
  buckets.clear();
}

/** Testing helper · inspect current bucket counts for assertions. */
export function __getTrialRateLimitSnapshotForTests(): ReadonlyMap<BucketKey, Bucket> {
  return new Map(buckets);
}
