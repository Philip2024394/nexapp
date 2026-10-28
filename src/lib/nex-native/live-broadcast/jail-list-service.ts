// src/lib/nex-native/live-broadcast/jail-list-service.ts
//
// Owner-authorised 2026-10-29 · Jail Phase B.
//
// Server-side source of truth for the viewer-side 10-minute jail
// enforced in migration 234 (`public.nex_live_jail`). Three gate
// points call `isAccountJailedByBroadcaster()`:
//
//   1. send-live-comment server action
//   2. send-DM-to-broadcaster peer-message action
//   3. (optional) start-live-session rejection if the broadcaster
//      has been jailed by someone they're trying to broadcast to
//      (symmetric case; not implemented in this slice)
//
// Doctrine:
//   - Lazy release: a row is "active" iff
//       `ends_at > now() AND released_at IS NULL`.
//     No cron job clears the row. The index
//     `idx_nex_live_jail_active_by_viewer` is partial on
//     `released_at IS NULL`, so queries are O(1)-ish on the hot
//     path.
//   - The row persists forever once written · audit log for the
//     broadcaster ("who did I jail this quarter?").
//   - This module uses the service-role Supabase admin client.
//     Jails are written only by server actions · the sealed RLS
//     at migration 234 explicitly denies authenticated INSERT.

import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

type NexUuid = string;

/** Record a new 10-minute jail. Idempotent per (viewer, broadcaster,
 *  session) · the sealed UNIQUE constraint rejects re-jails of the
 *  same viewer on the same broadcast · the caller should treat the
 *  duplicate-key error as "already jailed", not as a failure. */
export async function issueJail(args: {
  readonly viewerAccountId: NexUuid;
  readonly broadcasterAccountId: NexUuid;
  readonly sessionId: NexUuid;
  readonly durationMs?: number;
}): Promise<void> {
  const durationMs = args.durationMs ?? 10 * 60 * 1000;
  const now = new Date();
  const endsAt = new Date(now.getTime() + durationMs);
  const { error } = await nexSupabaseAdmin.from("nex_live_jail").insert({
    viewer_id: args.viewerAccountId,
    broadcaster_id: args.broadcasterAccountId,
    session_id: args.sessionId,
    started_at: now.toISOString(),
    ends_at: endsAt.toISOString(),
  });
  if (error) {
    // 23505 = unique-violation · owner-sealed semantic is "no double
    // jail on same (viewer, broadcaster, session)" · treat as no-op.
    if (error.code === "23505") return;
    throw new Error(`jail-list.issueJail: ${error.message}`);
  }
}

/** Return TRUE when the viewer is currently jailed by this specific
 *  broadcaster. Called synchronously inside the sealed comment-send
 *  + DM-send action paths. Fail-CLOSED: on query error the gate
 *  denies (returns true), consistent with sealed R9 posture that
 *  broadcasters' moderation decisions must not be silently bypassed
 *  by transient DB hiccups. */
export async function isAccountJailedByBroadcaster(
  viewerAccountId: NexUuid,
  broadcasterAccountId: NexUuid,
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_live_jail")
    .select("id")
    .eq("viewer_id", viewerAccountId)
    .eq("broadcaster_id", broadcasterAccountId)
    .gt("ends_at", nowIso)
    .is("released_at", null)
    .limit(1);
  if (error) {
    // Honest fail-closed: DB hiccup must not silently un-jail.
    console.error("jail-list.isJailed: fail-closed on error", error.message);
    return true;
  }
  return (data?.length ?? 0) > 0;
}

/** Return the remaining jail duration in milliseconds, or 0 if not
 *  currently jailed. Used by the viewer-side muted-composer state
 *  to show "9:52 remaining" without a separate time-fetch round
 *  trip. */
export async function getRemainingJailMs(
  viewerAccountId: NexUuid,
  broadcasterAccountId: NexUuid,
): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_live_jail")
    .select("ends_at")
    .eq("viewer_id", viewerAccountId)
    .eq("broadcaster_id", broadcasterAccountId)
    .gt("ends_at", nowIso)
    .is("released_at", null)
    .order("ends_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return 0;
  const endsAt = new Date(data[0]!.ends_at as string).getTime();
  return Math.max(0, endsAt - Date.now());
}
