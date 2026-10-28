// src/lib/nex-native/watches/watch-listing-rate-limit-service.ts
//
// R5 · DB-backed account-scoped rate limiter · server-only.
// -----------------------------------------------------------------------------
// Uses the atomic UPSERT inside the plpgsql function
// `nex_watch_listing_increment_rate_limit` (migration 232 · NOT
// APPLIED) so increments are correct across concurrent requests and
// multiple server instances · no two-step read-then-write race in app
// code.
//
// Fail posture
//   · DB errors FAIL-CLOSED by default · the caller sees a rate-limit
//     error and the mutation is rejected. This is the safer default
//     for a public-write surface.
//   · Clock-skew between app instances is tolerated by flooring every
//     caller's timestamp to the shared window start on the way in.

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  WATCH_LISTING_RATE_LIMITS,
  windowStartIso,
  isCountOverLimit,
  type WatchListingRateLimitAction,
} from "./watch-listing-rate-limit-config";

export class WatchListingRateLimitError extends Error {
  readonly code: "rate_limited" | "db_error";
  readonly action: WatchListingRateLimitAction;
  readonly retryAfterSeconds: number | null;
  constructor(args: {
    code: "rate_limited" | "db_error";
    action: WatchListingRateLimitAction;
    message: string;
    retryAfterSeconds?: number | null;
  }) {
    super(args.message);
    this.name = "WatchListingRateLimitError";
    this.code = args.code;
    this.action = args.action;
    this.retryAfterSeconds = args.retryAfterSeconds ?? null;
  }
}

/** Increment the counter for (accountId, action) in the current window.
 *  Throws WatchListingRateLimitError when the counter has crossed the
 *  configured max. Fail-closed on DB errors. */
export async function recordWatchListingRateLimit(args: {
  readonly accountId: string;
  readonly action: WatchListingRateLimitAction;
  readonly nowMs?: number;
}): Promise<void> {
  const now = args.nowMs ?? Date.now();
  const config = WATCH_LISTING_RATE_LIMITS[args.action];
  const windowStart = windowStartIso(now, config.windowMinutes);

  const { data, error } = await nexSupabaseAdmin.rpc(
    "nex_watch_listing_increment_rate_limit",
    {
      p_account_id: args.accountId,
      p_action: args.action,
      p_window_start: windowStart,
    },
  );

  if (error) {
    throw new WatchListingRateLimitError({
      code: "db_error",
      action: args.action,
      message: `rate-limit RPC failed · ${error.message}`,
    });
  }

  const newCount = typeof data === "number" ? data : Number(data);
  if (!Number.isFinite(newCount)) {
    throw new WatchListingRateLimitError({
      code: "db_error",
      action: args.action,
      message: "rate-limit RPC returned non-numeric count",
    });
  }

  if (isCountOverLimit(args.action, newCount)) {
    // Compute approximate retry-after · the number of seconds remaining
    // in the current window.
    const windowMs = config.windowMinutes * 60_000;
    const bucketStartMs = Date.parse(windowStart);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucketStartMs + windowMs - now) / 1000),
    );
    throw new WatchListingRateLimitError({
      code: "rate_limited",
      action: args.action,
      message: `rate limit exceeded for ${args.action} · ${config.maxPerWindow} per ${config.windowMinutes}min`,
      retryAfterSeconds,
    });
  }
}
