"use server";

// src/lib/nex-native/follow/follow-actions.ts
//
// Stage 1 Follow server actions · owner-authorised 2026-10-30 per
// `docs/doctrine/nex-follow-architecture-draft-2026-10-30.md` §16
// + Stage 1 preparation §13.6.
//
// Three actions ship Stage 1:
//   · followAction        → creates the (follower, followee) row
//   · unfollowAction      → deletes the (follower, followee) row
//   · isFollowingAction   → read-only state query
//
// Explicitly WITHDRAWN from Stage 1 per §13.1:
//   · listFollowersAction / listFollowingAction  → ship with the
//     scrollable list UI in Stage 2
//   · blockAction / unblockAction  → reuse the sealed
//     nex_friend_edge.status='blocked' primitive (Q-A)
//
// Deferred to Stage 2+ per §12.5:
//   · approveFollowAction / rejectFollowAction   → D1 approve-mode
//   · exportFollowGraphAction                    → GDPR export
//   · recomputeCountersAction                    → SQL-only in Stage 1
//
// Enforcement order (hot path):
//   1 · resolveSessionWithDevOverride              → not-signed-in
//   2 · validate followeeId format                 → invalid-input
//   3 · self-follow check                          → self-follow
//   4 · rate limit (HARD 20/60s · SOFT 50/5min)    → rate-limited | abuse-flag
//   5 · block check (nex_friend_edge both ways)    → blocked
//   6 · existence check (followee account exists)  → not-found
//   7 · insertFollow (idempotent via PK)           → ok
//
// All error codes + counter emissions flow through follow-observability.ts.

import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  insertFollow,
  deleteFollow,
  getFollowState,
  isBlockedBetween,
  accountExists,
  readFollowCounts,
} from "./follow-repository";
import {
  checkFollowAttempt,
  checkUnfollowAttempt,
} from "./follow-rate-limit";
import {
  emitActionCounter,
  emitChurnFlagged,
  emitErrorCounter,
  log,
} from "./follow-observability";
import type {
  NexFollowCounts,
  NexFollowErrorCode,
  NexFollowResult,
  NexFollowSource,
  NexFollowStatePayload,
} from "./types";

/** UUID shape check · defence-in-depth above the DB's own type
 *  checking. Rejects obvious garbage at the action boundary. */
function isUuidLike(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
}

function err(
  code: NexFollowErrorCode,
  message: string,
): NexFollowResult<never> {
  emitErrorCounter(code);
  return { ok: false, code, message };
}

/** followAction · creates a one-way follow from the signed-in viewer
 *  to the target account. Idempotent · a repeat call returns the
 *  same success without creating a duplicate row (PK constraint
 *  coalesces concurrent writes). */
export async function followAction(input: {
  readonly followeeId: string;
  readonly source: NexFollowSource;
}): Promise<NexFollowResult<NexFollowStatePayload>> {
  const start = Date.now();

  // 1 · session
  const session = await resolveSessionWithDevOverride();
  if (!session) return err("not-signed-in", "Sign in required");
  const followerId = session.account.id;

  // 2 · input shape
  if (!isUuidLike(input.followeeId)) {
    return err("invalid-input", "followeeId must be a UUID");
  }
  if (input.source !== "music" && input.source !== "live" && input.source !== "profile") {
    return err("invalid-input", `source must be one of music|live|profile · got ${String(input.source)}`);
  }

  // 3 · self-follow (defence in depth · DB CHECK also blocks)
  if (followerId === input.followeeId) {
    return err("self-follow", "You cannot follow yourself");
  }

  // 4 · rate limit (HARD 20/60s · SOFT 50/5min abuse-flag)
  const rl = checkFollowAttempt(followerId);
  if (!rl.hard.ok) {
    const resetSec = Math.ceil(rl.hard.resetInMs / 1000);
    return err(
      "rate-limited",
      `Too many follow attempts · ${rl.hard.limit}/${Math.round(rl.hard.windowMs / 1000)}s · try again in ${resetSec}s`,
    );
  }
  if (rl.abuseFlag.ok && "flagged" in rl.abuseFlag) {
    // SOFT · log but continue · surfaces in moderation observability.
    log.warn("follow_abuse_flag", {
      followerId,
      followeeId: input.followeeId,
      reason: rl.abuseFlag.reason,
    });
  }

  // 5 · block check (either direction)
  try {
    const blocked = await isBlockedBetween({ a: followerId, b: input.followeeId });
    if (blocked) return err("blocked", "This follow is blocked");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error("follow_block_check_failed", { followerId, followeeId: input.followeeId, msg });
    return err("internal", `Block check failed: ${msg}`);
  }

  // 6 · followee existence
  try {
    const exists = await accountExists(input.followeeId);
    if (!exists) return err("not-found", "Followee account does not exist");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error("follow_exists_check_failed", { followeeId: input.followeeId, msg });
    return err("internal", `Account lookup failed: ${msg}`);
  }

  // 7 · insert (idempotent · PK ON CONFLICT DO NOTHING semantics in
  //          repository)
  try {
    await insertFollow({
      followerId,
      followeeId: input.followeeId,
      source: input.source,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error("follow_insert_failed", { followerId, followeeId: input.followeeId, msg });
    return err("internal", `Follow insert failed: ${msg}`);
  }

  emitActionCounter("ok");
  log.info("follow_ok", {
    followerId,
    followeeId: input.followeeId,
    source: input.source,
    latencyMs: Date.now() - start,
  });

  return { ok: true, data: { state: "following" } };
}

/** unfollowAction · deletes the (follower, followee) row if present.
 *  Idempotent · unfollow of a non-follow returns `{state:'not-following'}`
 *  without error. */
export async function unfollowAction(input: {
  readonly followeeId: string;
}): Promise<NexFollowResult<NexFollowStatePayload>> {
  const start = Date.now();

  const session = await resolveSessionWithDevOverride();
  if (!session) return err("not-signed-in", "Sign in required");
  const followerId = session.account.id;

  if (!isUuidLike(input.followeeId)) {
    return err("invalid-input", "followeeId must be a UUID");
  }
  if (followerId === input.followeeId) {
    // Self-unfollow is a no-op · harmless, return not-following cleanly.
    return { ok: true, data: { state: "not-following" } };
  }

  // Churn-signal check (SOFT · never blocks)
  const churn = checkUnfollowAttempt(followerId, input.followeeId);
  if (churn.ok && "flagged" in churn) {
    emitChurnFlagged();
    log.warn("unfollow_churn_flag", {
      followerId,
      followeeId: input.followeeId,
      reason: churn.reason,
    });
  }

  try {
    await deleteFollow({ followerId, followeeId: input.followeeId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error("unfollow_delete_failed", { followerId, followeeId: input.followeeId, msg });
    return err("internal", `Unfollow failed: ${msg}`);
  }

  emitActionCounter("ok");
  log.info("unfollow_ok", {
    followerId,
    followeeId: input.followeeId,
    latencyMs: Date.now() - start,
  });

  return { ok: true, data: { state: "not-following" } };
}

/** isFollowingAction · read-only state query. Returns the current
 *  follow state between the signed-in viewer and the target account.
 *  Used by the FollowButton for SSR initial state + post-mount
 *  reconciliation. */
export async function isFollowingAction(input: {
  readonly followeeId: string;
}): Promise<NexFollowResult<NexFollowStatePayload>> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return err("not-signed-in", "Sign in required");
  const followerId = session.account.id;

  if (!isUuidLike(input.followeeId)) {
    return err("invalid-input", "followeeId must be a UUID");
  }
  if (followerId === input.followeeId) {
    // You cannot follow yourself · consistent read.
    return { ok: true, data: { state: "not-following" } };
  }

  try {
    const state = await getFollowState({ followerId, followeeId: input.followeeId });
    return { ok: true, data: { state } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error("is_following_failed", { followerId, followeeId: input.followeeId, msg });
    return err("internal", `State query failed: ${msg}`);
  }
}

/** getFollowCountsAction · read-only follower + following counts for
 *  a public account. Owner-authorised 2026-10-30 · Stage 2 companion
 *  to isFollowingAction, lets client surfaces (Live viewer) fetch
 *  the trigger-maintained counts from nex_account after broadcaster
 *  identity resolves client-side. No auth required · counts are a
 *  public social signal per §16 D2 default. */
export async function getFollowCountsAction(input: {
  readonly accountId: string;
}): Promise<NexFollowResult<NexFollowCounts>> {
  if (!isUuidLike(input.accountId)) {
    return err("invalid-input", "accountId must be a UUID");
  }
  try {
    const counts = await readFollowCounts(input.accountId);
    return { ok: true, data: counts };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error("read_follow_counts_failed", { accountId: input.accountId, msg });
    return err("internal", `Count read failed: ${msg}`);
  }
}
