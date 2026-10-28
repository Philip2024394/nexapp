// src/lib/nex-native/watches/watch-listing-rate-limit-config.ts
//
// Pure config + floor helper for the watch-listing rate limiter.
// Test-safe · no server-only guard · no DB touch.
//
// Policy
//   · create_draft · 10 drafts per hour per account.
//     Rationale · an honest seller lists a few watches an hour; 10/hour
//     is generous for a legitimate retailer uploading a batch, tight
//     enough to deter spam. Tunable; owner may adjust before applying
//     migration 232.

export type WatchListingRateLimitAction = "create_draft";

export interface WatchListingRateLimitConfig {
  readonly windowMinutes: number;
  readonly maxPerWindow: number;
}

export const WATCH_LISTING_RATE_LIMITS: Record<
  WatchListingRateLimitAction,
  WatchListingRateLimitConfig
> = {
  create_draft: { windowMinutes: 60, maxPerWindow: 10 },
};

/** Pure · floor a timestamp to the start of its enclosing window.
 *  Keeps rate-limit buckets aligned across instances so UPSERT
 *  conflict resolution is deterministic. */
export function floorToWindowStart(nowMs: number, windowMinutes: number): number {
  const windowMs = windowMinutes * 60_000;
  return Math.floor(nowMs / windowMs) * windowMs;
}

/** Pure · ISO-8601 string for the current bucket start. */
export function windowStartIso(nowMs: number, windowMinutes: number): string {
  return new Date(floorToWindowStart(nowMs, windowMinutes)).toISOString();
}

/** Pure · evaluate whether a new count violates the policy. */
export function isCountOverLimit(
  action: WatchListingRateLimitAction,
  newCount: number,
): boolean {
  return newCount > WATCH_LISTING_RATE_LIMITS[action].maxPerWindow;
}
