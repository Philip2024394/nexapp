// src/lib/nex-native/community/rate-limit.ts
//
// NEX Community Noticeboard · rolling-window rate limiter.
//
// A tiny primitive that reads/writes nex_community_rate_limit. The
// window is floored to the nearest `windowMinutes` minute boundary so
// multiple concurrent calls agree on the same bucket.
//
// Not atomic in the strict sense — two concurrent calls to recordIfAllowed
// at a cold bucket could both pass. For Phase 1 (community-notice
// authoring, 3/hour per account) this is acceptable. If stricter
// serialisation becomes needed we can move to a Postgres advisory lock
// or a stored procedure.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";
import {
  NEX_COMMUNITY_RATE_LIMITS,
  NexCommunityRateLimitError,
} from "./types";

type RateLimitedAction = keyof typeof NEX_COMMUNITY_RATE_LIMITS;

function floorWindow(nowMs: number, windowMinutes: number): Date {
  const windowMs = windowMinutes * 60_000;
  return new Date(Math.floor(nowMs / windowMs) * windowMs);
}

/** Check if the account is allowed to perform `action` right now. If
 *  allowed, increments the counter and returns. If not, throws
 *  NexCommunityRateLimitError. */
export async function recordIfAllowed(
  accountId: NexUuid,
  action: RateLimitedAction,
): Promise<void> {
  const config = NEX_COMMUNITY_RATE_LIMITS[action];
  const windowStart = floorWindow(Date.now(), config.windowMinutes).toISOString();

  // Read current counter for this (account, action, window).
  const { data: existing, error: readErr } = await nexSupabaseAdmin
    .from("nex_community_rate_limit")
    .select("count")
    .eq("account_id", accountId)
    .eq("action", action)
    .eq("window_started_at", windowStart)
    .maybeSingle();
  if (readErr) {
    throw new Error(`community-rate-limit.read · ${readErr.message}`);
  }
  const currentCount = existing?.count ?? 0;
  if (currentCount >= config.maxPerWindow) {
    throw new NexCommunityRateLimitError(
      action,
      config.windowMinutes,
      config.maxPerWindow,
    );
  }

  // Upsert the incremented value. Supabase upsert with the primary key
  // triple matches the composite PK (account_id, action, window_started_at).
  const { error: writeErr } = await nexSupabaseAdmin
    .from("nex_community_rate_limit")
    .upsert(
      {
        account_id: accountId,
        action,
        window_started_at: windowStart,
        count: currentCount + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id,action,window_started_at" },
    );
  if (writeErr) {
    throw new Error(`community-rate-limit.write · ${writeErr.message}`);
  }
}
