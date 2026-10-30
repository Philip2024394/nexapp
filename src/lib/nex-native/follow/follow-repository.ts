// src/lib/nex-native/follow/follow-repository.ts
//
// DB-adjacent helpers for the Follow module. All functions are
// `"server-only"` and query via the sealed `nexSupabaseAdmin` client
// (service_role · bypasses RLS). The action layer in
// `follow-actions.ts` is the ONLY caller for mutations · it enforces
// session + rate-limit + block checks before invoking the repository.
//
// Owner-authorised 2026-10-30 per Stage 1 preparation §13.6.
//
// Block enforcement reuses the sealed `nex_friend_edge.status='blocked'`
// primitive per §12 Q-A · no parallel block table exists.

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import type {
  NexFollowCounts,
  NexFollowRow,
  NexFollowSource,
  NexFollowState,
} from "./types";

/** Insert a follow row. Idempotent via PK · if the row already
 *  exists, the INSERT is a no-op and we return `{created: false}`.
 *
 *  Honest limitation: PostgreSQL's `ON CONFLICT DO NOTHING RETURNING`
 *  returns 0 rows on conflict, so we distinguish NEW vs EXISTING by
 *  the rowCount of the RETURNING clause. */
export async function insertFollow(args: {
  readonly followerId: string;
  readonly followeeId: string;
  readonly source: NexFollowSource;
}): Promise<{ readonly created: boolean }> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_follow")
    .insert({
      follower_id: args.followerId,
      followee_id: args.followeeId,
      source: args.source,
    })
    .select("follower_id");
  if (error) {
    // 23505 = unique_violation (PK collision) · treat as idempotent success.
    if (error.code === "23505") return { created: false };
    throw new Error(`insertFollow: ${error.message}`);
  }
  return { created: (data?.length ?? 0) > 0 };
}

/** Delete a follow row. Returns true if a row was deleted, false if
 *  there was no matching row. Idempotent · a second call returns
 *  false without error. */
export async function deleteFollow(args: {
  readonly followerId: string;
  readonly followeeId: string;
}): Promise<{ readonly deleted: boolean }> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_follow")
    .delete()
    .eq("follower_id", args.followerId)
    .eq("followee_id", args.followeeId)
    .select("follower_id");
  if (error) throw new Error(`deleteFollow: ${error.message}`);
  return { deleted: (data?.length ?? 0) > 0 };
}

/** Resolve the follow state between two accounts. Stage 1 only emits
 *  "not-following" or "following" (never "pending" · see types.ts). */
export async function getFollowState(args: {
  readonly followerId: string;
  readonly followeeId: string;
}): Promise<NexFollowState> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_follow")
    .select("follower_id")
    .eq("follower_id", args.followerId)
    .eq("followee_id", args.followeeId)
    .maybeSingle();
  if (error) throw new Error(`getFollowState: ${error.message}`);
  return data ? "following" : "not-following";
}

/** Block check · reuses the sealed `nex_friend_edge.status='blocked'`
 *  primitive per §12 Q-A. Returns true if EITHER party has blocked
 *  the other (the canonical pair query doesn't care about direction).
 *
 *  Query shape (verified against the sealed friend-edge canonical
 *  pair rule `a_account_id < b_account_id`):
 *      WHERE a_account_id = LEAST($follower, $followee)
 *        AND b_account_id = GREATEST($follower, $followee)
 *        AND status = 'blocked'
 *  Single primary-key lookup · O(1). */
export async function isBlockedBetween(args: {
  readonly a: string;
  readonly b: string;
}): Promise<boolean> {
  const [low, high] = args.a < args.b ? [args.a, args.b] : [args.b, args.a];
  const { data, error } = await nexSupabaseAdmin
    .from("nex_friend_edge")
    .select("a_account_id")
    .eq("a_account_id", low)
    .eq("b_account_id", high)
    .eq("status", "blocked")
    .maybeSingle();
  if (error) throw new Error(`isBlockedBetween: ${error.message}`);
  return data !== null;
}

/** Returns the followee account's `id`, or null if the account doesn't
 *  exist. Used by the followAction to return `not-found` cleanly. */
export async function accountExists(accountId: string): Promise<boolean> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select("id")
    .eq("id", accountId)
    .maybeSingle();
  if (error) throw new Error(`accountExists: ${error.message}`);
  return data !== null;
}

/** Read an account's current denormalised follower/following counts.
 *  Reads the two columns added in migration 238 · zero COUNT(*)
 *  queries · O(1). Returns zeroed counts if the account doesn't
 *  exist (callers should check accountExists first if they need to
 *  distinguish). */
export async function readFollowCounts(
  accountId: string,
): Promise<NexFollowCounts> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select("followers_count, following_count")
    .eq("id", accountId)
    .maybeSingle<{ followers_count: number; following_count: number }>();
  if (error) throw new Error(`readFollowCounts: ${error.message}`);
  return {
    followersCount: data?.followers_count ?? 0,
    followingCount: data?.following_count ?? 0,
  };
}

/** Paginated helper for Stage 2 list consumers. Shipped as part of
 *  the repository layer so Stage 2 can enable the list actions
 *  without additional repo work · the ACTIONS are not shipped in
 *  Stage 1 per §13.1. */
export async function listFollowers(args: {
  readonly accountId: string;
  readonly cursorCreatedAt?: string | null;
  readonly limit?: number;
}): Promise<{ readonly rows: readonly NexFollowRow[]; readonly nextCursor: string | null }> {
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  let q = nexSupabaseAdmin
    .from("nex_follow")
    .select("follower_id, followee_id, created_at, source")
    .eq("followee_id", args.accountId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (args.cursorCreatedAt) q = q.lt("created_at", args.cursorCreatedAt);
  const { data, error } = await q;
  if (error) throw new Error(`listFollowers: ${error.message}`);
  const rows = (data ?? []) as NexFollowRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]!.created_at : null;
  return { rows: page, nextCursor };
}

/** Paginated helper for Stage 2 list consumers (following direction). */
export async function listFollowing(args: {
  readonly accountId: string;
  readonly cursorCreatedAt?: string | null;
  readonly limit?: number;
}): Promise<{ readonly rows: readonly NexFollowRow[]; readonly nextCursor: string | null }> {
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  let q = nexSupabaseAdmin
    .from("nex_follow")
    .select("follower_id, followee_id, created_at, source")
    .eq("follower_id", args.accountId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (args.cursorCreatedAt) q = q.lt("created_at", args.cursorCreatedAt);
  const { data, error } = await q;
  if (error) throw new Error(`listFollowing: ${error.message}`);
  const rows = (data ?? []) as NexFollowRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]!.created_at : null;
  return { rows: page, nextCursor };
}
