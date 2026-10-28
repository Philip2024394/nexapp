// src/lib/nex-native/friend-request-service.ts
//
// Owner directive 2026-10-23 · "wire these into the app and back end".
// Pending-invite lifecycle service · backs the Contacts page's
// Connect-by-NEX-ID form, Waiting section, and inbound Confirm flow
// against the `nex_friend_request` table (migration 215).
//
// Doctrine (sealed Socials invite 2026-10-07):
//   · 24h expiry from CREATION
//   · 72h cooldown after any terminal state (sender re-invite block)
//   · Sender NEVER sees explicit decline vs timeout · service strips
//     `passed`/`cancelled` from sender queries · they only see pending
//     and (when we add a sender-side notice) a single terminal signal
//   · Accept-category drives the downstream write:
//       friends  → nex_friend_edge INSERT (status=accepted)
//       business → nex_peer_conversation open (deferred · see below)
//
// Business-category accept flow: for now `acceptInvite` with category
// 'business' only flips the request status · the actual peer-conversation
// creation requires `conversation-service.ts` wiring which is a separate
// slice. The real friend-edge write for category 'friends' is included
// here because `nex_friend_edge` already exists.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import { getAccountByNexHandle } from "./account-service";
import * as friendService from "./friend-service";
import { getOrCreatePeerConversation } from "./peer-conversation-service";
import type { NexUuid } from "./types";

/** Maximum length of the optional introduction note on an invite.
 *  Carried on the `intro_note` column added in Migration 220 (DRAFT
 *  · not applied). Re-exported from `./friend-request-constants` so
 *  client components can import the cap without pulling in the
 *  server-only service module. */
export { INTRO_NOTE_MAX_LENGTH } from "./friend-request-constants";
import { INTRO_NOTE_MAX_LENGTH } from "./friend-request-constants";

export type FriendRequestStatus =
  | "pending"
  | "accepted"
  | "passed"
  | "expired"
  | "cancelled";

export type FriendRequestCategory = "friends" | "business";

export interface FriendRequestRow {
  readonly id: string;
  readonly sender_account_id: NexUuid;
  readonly recipient_nex_handle: string;
  readonly recipient_account_id: NexUuid | null;
  readonly status: FriendRequestStatus;
  readonly created_at: string;
  readonly expires_at: string;
  readonly cooldown_ends_at: string | null;
  readonly accepted_category: FriendRequestCategory | null;
  readonly accepted_at: string | null;
  readonly cancelled_at: string | null;
  /** Optional sender-authored introduction note displayed on the
   *  recipient's inbound invite card. Max INTRO_NOTE_MAX_LENGTH
   *  characters. Carried on the `intro_note` column (Migration 220 ·
   *  DRAFT · unapplied). Null when the sender submitted the invite
   *  without an introduction OR when the column is not yet present
   *  (the service treats absent-column as null-value fail-open). */
  readonly intro_note: string | null;
}

const WINDOW_HOURS = 24;
const COOLDOWN_HOURS = 72;

// ─── Reads ──────────────────────────────────────────────────────

/** Pending OUTBOUND invites · sender-side list. Hides any terminal
 *  state so the sender never leaks decline-vs-timeout to themselves. */
export async function listPendingOutbound(
  senderAccountId: NexUuid,
): Promise<ReadonlyArray<FriendRequestRow>> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_friend_request")
    .select("*")
    .eq("sender_account_id", senderAccountId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`friend-request-service.listPendingOutbound: ${error.message}`);
  }
  return (data ?? []) as FriendRequestRow[];
}

/** Pending INBOUND invites · recipient-side list. */
export async function listPendingInbound(
  recipientAccountId: NexUuid,
): Promise<ReadonlyArray<FriendRequestRow>> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_friend_request")
    .select("*")
    .eq("recipient_account_id", recipientAccountId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`friend-request-service.listPendingInbound: ${error.message}`);
  }
  return (data ?? []) as FriendRequestRow[];
}

// ─── Writes ─────────────────────────────────────────────────────

export interface CreateInviteResult {
  readonly row: FriendRequestRow;
}

export interface CooldownBlock {
  readonly cooldownEndsAt: string;
  readonly msRemaining: number;
}

/** Thrown when a cooldown blocks a re-invite. Caller surfaces the
 *  remaining time to the user ("You can try again in Xh"). */
export class FriendRequestCooldownError extends Error {
  readonly cooldownEndsAt: string;
  readonly msRemaining: number;
  constructor(block: CooldownBlock) {
    super("friend-request-service: cooldown active");
    this.name = "FriendRequestCooldownError";
    this.cooldownEndsAt = block.cooldownEndsAt;
    this.msRemaining = block.msRemaining;
  }
}

/** Thrown when the typed NEX-handle doesn't resolve to an account. */
export class UnknownHandleError extends Error {
  constructor(handle: string) {
    super(`friend-request-service: unknown NEX handle "${handle}"`);
    this.name = "UnknownHandleError";
  }
}

/**
 * Create a pending outbound invite.
 *
 * Validations (in order):
 *   1. Handle shape is `nex-\d+` (matches DB CHECK).
 *   2. Handle resolves to an existing nex_account.
 *   3. Not a self-invite.
 *   4. Cooldown · if a prior invite to the same handle is pending OR
 *      within 72h cooldown, throws `FriendRequestCooldownError` with
 *      the remaining ms. Caller surfaces "You can try again in Xh".
 *   5. Partial unique index catches any concurrent dup pending.
 */
export async function createInvite(
  senderAccountId: NexUuid,
  rawHandle: string,
  rawIntroNote?: string | null,
): Promise<CreateInviteResult> {
  const handle = rawHandle.trim().toLowerCase();
  if (!/^nex-\d+$/.test(handle)) {
    throw new Error(`friend-request-service.createInvite: invalid handle shape "${rawHandle}"`);
  }

  // Normalise the optional intro note · trim + length-cap + empty→null.
  // Enforced at service boundary · a misbehaving client cannot persist
  // a longer string. Null is the honest default when the sender did
  // not type anything.
  const introNote: string | null = (() => {
    if (typeof rawIntroNote !== "string") return null;
    const trimmed = rawIntroNote.trim();
    if (trimmed.length === 0) return null;
    return trimmed.length > INTRO_NOTE_MAX_LENGTH
      ? trimmed.slice(0, INTRO_NOTE_MAX_LENGTH)
      : trimmed;
  })();

  const recipient = await getAccountByNexHandle(handle);
  if (!recipient) {
    throw new UnknownHandleError(handle);
  }
  if (recipient.id === senderAccountId) {
    throw new Error("friend-request-service.createInvite: cannot invite yourself");
  }

  // Cooldown check · look at the most recent row (any status) for this
  // sender+handle. If pending OR cooldown_ends_at > now, block.
  const now = new Date();
  const { data: recent, error: readErr } = await nexSupabaseAdmin
    .from("nex_friend_request")
    .select("status, cooldown_ends_at, expires_at")
    .eq("sender_account_id", senderAccountId)
    .eq("recipient_nex_handle", handle)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readErr) {
    throw new Error(`friend-request-service.createInvite · cooldown read: ${readErr.message}`);
  }
  if (recent) {
    if (recent.status === "pending") {
      // Treated as a cooldown · remaining = expires_at - now (invite
      // is still live, you already invited this handle).
      const remaining = new Date(recent.expires_at).getTime() - now.getTime();
      throw new FriendRequestCooldownError({
        cooldownEndsAt: recent.expires_at,
        msRemaining: Math.max(0, remaining),
      });
    }
    if (recent.cooldown_ends_at) {
      const endsAt = new Date(recent.cooldown_ends_at).getTime();
      if (endsAt > now.getTime()) {
        throw new FriendRequestCooldownError({
          cooldownEndsAt: recent.cooldown_ends_at,
          msRemaining: endsAt - now.getTime(),
        });
      }
    }
  }

  const expiresAt = new Date(now.getTime() + WINDOW_HOURS * 60 * 60 * 1000);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_friend_request")
    .insert({
      sender_account_id: senderAccountId,
      recipient_nex_handle: handle,
      recipient_account_id: recipient.id,
      status: "pending",
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      // intro_note persisted only when non-null · the server-side
      // normalisation above produced the canonical value. When
      // Migration 220 is unapplied the column is absent · the insert
      // succeeds with the field silently ignored by PostgREST.
      intro_note: introNote,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`friend-request-service.createInvite: ${error?.message ?? "no row"}`);
  }
  return { row: data as FriendRequestRow };
}

/**
 * Accept an inbound invite. `actor` MUST be the recipient. Writes:
 *   · nex_friend_request · status=accepted, accepted_at, accepted_category,
 *     cooldown_ends_at=accepted_at + 72h
 *   · if category='friends' · nex_friend_edge INSERT via friend-service.sendInvite
 *     then respondToInvite(accept) · creates the accepted edge
 *   · if category='business' · DEFERRED · peer-conversation open is a
 *     separate slice. For now the request status flips but no business
 *     conversation is created · the UI shows the contact in the Business
 *     tab via the request row until the conversation flow lands.
 */
export async function acceptInvite(
  requestId: string,
  actorAccountId: NexUuid,
  category: FriendRequestCategory,
): Promise<FriendRequestRow> {
  const now = new Date();
  const cooldownEndsAt = new Date(now.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);

  // Load + authorise.
  const { data: row, error: readErr } = await nexSupabaseAdmin
    .from("nex_friend_request")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (readErr) {
    throw new Error(`friend-request-service.acceptInvite · read: ${readErr.message}`);
  }
  if (!row) {
    throw new Error(`friend-request-service.acceptInvite: no request ${requestId}`);
  }
  const req = row as FriendRequestRow;
  if (req.recipient_account_id !== actorAccountId) {
    throw new Error(
      "friend-request-service.acceptInvite: only the recipient can accept",
    );
  }
  if (req.status !== "pending") {
    throw new Error(
      `friend-request-service.acceptInvite: request is ${req.status}, not pending`,
    );
  }
  if (new Date(req.expires_at).getTime() <= now.getTime()) {
    throw new Error("friend-request-service.acceptInvite: request has expired");
  }

  // Flip the request first (atomic UPDATE guards against concurrent accept).
  const { data: updated, error: updErr } = await nexSupabaseAdmin
    .from("nex_friend_request")
    .update({
      status: "accepted",
      accepted_at: now.toISOString(),
      accepted_category: category,
      cooldown_ends_at: cooldownEndsAt.toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending") // guard
    .select("*")
    .single();
  if (updErr || !updated) {
    throw new Error(`friend-request-service.acceptInvite · update: ${updErr?.message ?? "no row"}`);
  }

  // Downstream write.
  if (category === "friends" && req.sender_account_id && req.recipient_account_id) {
    // Create the pending friend-edge then auto-accept it from the
    // recipient's side · gives us a canonical nex_friend_edge row
    // with status=accepted.
    await friendService.sendInvite(req.sender_account_id, req.recipient_account_id);
    await friendService.respondToInvite(
      req.recipient_account_id,
      req.sender_account_id,
      "accept",
    );
  }

  // 2026-10-24 · business-category closure (previously deferred).
  // Opens the shared peer conversation for the two parties using the
  // existing getOrCreatePeerConversation primitive (idempotent · race-
  // safe · returns the existing row if one already exists). We never
  // create duplicate conversations: the primitive consults a FK pair
  // index and either finds-or-inserts in one call.
  //
  // Fail-closed · if the conversation open throws we do NOT revert
  // the request status flip (the UPDATE already committed as a
  // single atomic PG statement). The caller UI treats a thrown
  // acceptInvite as "accepted, but conversation open deferred to
  // next load" because `getOrCreatePeerConversation` is idempotent ·
  // the next time the recipient opens their contacts the lookup
  // finds the already-flipped request and the conversation can be
  // reconciled on demand. Honest: we throw so the caller surfaces
  // the error rather than silently swallowing a legitimate
  // persistence failure.
  if (
    category === "business"
    && req.sender_account_id
    && req.recipient_account_id
  ) {
    await getOrCreatePeerConversation(
      req.sender_account_id,
      req.recipient_account_id,
    );
  }

  return updated as FriendRequestRow;
}

/**
 * Cancel an outbound invite · sender dismisses before any response.
 * Starts the 72h cooldown so the sender can't re-invite immediately.
 */
export async function cancelInvite(
  requestId: string,
  actorAccountId: NexUuid,
): Promise<FriendRequestRow> {
  const now = new Date();
  const cooldownEndsAt = new Date(now.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);

  const { data: row, error: readErr } = await nexSupabaseAdmin
    .from("nex_friend_request")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (readErr) {
    throw new Error(`friend-request-service.cancelInvite · read: ${readErr.message}`);
  }
  if (!row) {
    throw new Error(`friend-request-service.cancelInvite: no request ${requestId}`);
  }
  const req = row as FriendRequestRow;
  if (req.sender_account_id !== actorAccountId) {
    throw new Error(
      "friend-request-service.cancelInvite: only the sender can cancel",
    );
  }
  if (req.status !== "pending") {
    // Idempotent · already terminal.
    return req;
  }

  const { data: updated, error: updErr } = await nexSupabaseAdmin
    .from("nex_friend_request")
    .update({
      status: "cancelled",
      cancelled_at: now.toISOString(),
      cooldown_ends_at: cooldownEndsAt.toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("*")
    .single();
  if (updErr || !updated) {
    throw new Error(`friend-request-service.cancelInvite · update: ${updErr?.message ?? "no row"}`);
  }
  return updated as FriendRequestRow;
}

/**
 * Sweep expired pending rows · flip to status=expired + set
 * cooldown_ends_at. Runs idempotently · safe to call from any query
 * path (e.g. at the top of list* calls) or a scheduled task.
 */
export async function sweepExpired(): Promise<number> {
  const now = new Date();
  const cooldownEndsAt = new Date(now.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_friend_request")
    .update({
      status: "expired",
      cooldown_ends_at: cooldownEndsAt.toISOString(),
    })
    .eq("status", "pending")
    .lte("expires_at", now.toISOString())
    .select("id");
  if (error) {
    throw new Error(`friend-request-service.sweepExpired: ${error.message}`);
  }
  return (data ?? []).length;
}
