// src/lib/nex-native/chat/chat-rate-limit.ts
//
// NEX Chat · rolling-window rate limiter.
//
// Ported from src/lib/nex-native/community/rate-limit.ts +
// src/lib/nex-native/community/types.ts (NexCommunityRateLimitError)
// as part of Phase 1c Batch 1 · scope-reduction pre-move extract.
// The community surface is being removed (Batch 5); this module
// takes ownership of the one rate-limited action the chat surface
// relies on (`peer_message_guest`) so chat remains self-contained
// after the community tree is deleted.
//
// Storage posture
//   · Reads/writes the existing `nex_community_rate_limit` table.
//     The table name is historical · a future migration renames it
//     (`nex_chat_rate_limit` is the intended final name). Keeping
//     the current table avoids introducing a schema change in the
//     non-destructive move batch.
//
// A tiny primitive that reads/writes the rate-limit table. The
// window is floored to the nearest `windowMinutes` minute boundary so
// multiple concurrent calls agree on the same bucket.
//
// Not atomic in the strict sense — two concurrent calls to recordIfAllowed
// at a cold bucket could both pass. For the current guest-chat caller
// (10/hour per provisional account) this is acceptable. If stricter
// serialisation becomes needed we can move to a Postgres advisory lock
// or a stored procedure.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";

/** Chat-owned rate-limit action set. Currently only one key · the
 *  guest-chat follow-up throttle (Stage 1.1 · 2026-10-14). Add new
 *  keys here when a new chat surface introduces its own cap.
 *
 *  Historical note · the community surface defined 14 related action
 *  keys (notice_create, card_create, ...) that are being deleted
 *  alongside the community tree (Batch 5). Only the chat-owned key
 *  is ported. */
export type NexChatRateLimitAction = "peer_message_guest";

export const NEX_CHAT_RATE_LIMITS: Record<
  NexChatRateLimitAction,
  { windowMinutes: number; maxPerWindow: number }
> = {
  // peer_message_guest · 10 messages per rolling 60-minute window per
  // provisional account. Starting hypothesis per the design contract
  // §4.2 · requires live-traffic validation before being tightened
  // or loosened.
  peer_message_guest: { windowMinutes: 60, maxPerWindow: 10 },
};

/** Error thrown by the service layer when a rate limit is hit. The
 *  API route / server action maps this to HTTP 429 / reason:
 *  "rate_limited". */
export class NexChatRateLimitError extends Error {
  readonly code = "rate_limited" as const;
  constructor(
    readonly action: string,
    readonly windowMinutes: number,
    readonly maxPerWindow: number,
  ) {
    super(
      `nex-chat: rate limit · action=${action} · ${maxPerWindow} per ${windowMinutes}min window reached`,
    );
    this.name = "NexChatRateLimitError";
  }
}

type RateLimitedAction = NexChatRateLimitAction;

function floorWindow(nowMs: number, windowMinutes: number): Date {
  const windowMs = windowMinutes * 60_000;
  return new Date(Math.floor(nowMs / windowMs) * windowMs);
}

/** Check if the account is allowed to perform `action` right now. If
 *  allowed, increments the counter and returns. If not, throws
 *  NexChatRateLimitError. */
export async function recordIfAllowed(
  accountId: NexUuid,
  action: RateLimitedAction,
): Promise<void> {
  const config = NEX_CHAT_RATE_LIMITS[action];
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
    throw new Error(`chat-rate-limit.read · ${readErr.message}`);
  }
  const currentCount = existing?.count ?? 0;
  if (currentCount >= config.maxPerWindow) {
    throw new NexChatRateLimitError(
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
    throw new Error(`chat-rate-limit.write · ${writeErr.message}`);
  }
}
