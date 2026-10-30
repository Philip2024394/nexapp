// src/lib/nex-native/follow/types.ts
//
// Shared types for the sealed NEX Follow module (Stage 1).
// Owner-authorised 2026-10-30 per `docs/doctrine/nex-follow-
// architecture-draft-2026-10-30.md` §16 + Stage 1 preparation §13.6.

import type { NexUuid } from "@/lib/nex-native/types";

/** Discovery-path attribution recorded on follow creation. Strict
 *  CHECK list sealed at Stage 1 (per §12 O-4 + §13.1). Extending
 *  this list is a follow-up migration + a doctrine amendment. */
export type NexFollowSource = "music" | "live" | "profile";

/** The caller-observable follow state between two accounts. The
 *  "pending" state is RESERVED for D1 Stage 2+ approve-mode; Stage 1
 *  only emits "not-following" or "following". */
export type NexFollowState = "not-following" | "pending" | "following";

/** A persisted follow row (nex_follow table). */
export interface NexFollowRow {
  readonly follower_id: NexUuid;
  readonly followee_id: NexUuid;
  readonly created_at: string;      // ISO
  readonly source: NexFollowSource | null;
}

/** Sealed error codes returned by the follow server actions. */
export type NexFollowErrorCode =
  | "not-signed-in"
  | "invalid-input"
  | "self-follow"
  | "blocked"                   // either direction of nex_friend_edge block
  | "not-found"                 // followee account doesn't exist
  | "rate-limited"              // hit the 20/60s limiter
  | "churn-flagged"             // 3 unfollows/24h · soft signal, action still succeeds
  | "internal";

/** Discriminated-union result type matching the sealed NexMusicResult
 *  pattern (see src/app/nex-native/create/upload-music/_actions.ts). */
export type NexFollowResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly code: NexFollowErrorCode; readonly message: string };

/** Returned by followAction / unfollowAction / isFollowingAction. */
export interface NexFollowStatePayload {
  readonly state: NexFollowState;
}

/** Account-level follow counters as denormalised on nex_account.
 *  Both counts are integer, non-negative. */
export interface NexFollowCounts {
  readonly followersCount: number;
  readonly followingCount: number;
}
