// src/lib/nex-native/calls/group-call-service.ts
//
// Server-side helpers for nex_group_call_session + nex_group_call_participant
// (migration 133). Thin wrappers over nexSupabaseAdmin. Policy
// decisions (who can start, who can invite) live in the server
// actions · this layer trusts its callers.
//
// The 4-participant hard cap is enforced by a DB trigger, so these
// helpers surface the resulting error as a typed reason rather than
// trying to pre-validate.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";
// §16.48.25 Lane 1 · roster authorization guard. listParticipants is a
// service-role read that bypasses RLS; the guard forces callers to pass
// a server-resolved account id and denies callers who are neither the
// host nor an active participant.
import type { RosterAdminLike } from "./roster-authorization";
import { assertCanViewSession } from "./roster-authorization";

// The concrete SupabaseClient satisfies RosterAdminLike structurally at
// runtime, but its generic/deep types defeat TS's assignability check.
// A one-time narrow cast keeps the call-site tidy.
const rosterAdmin: RosterAdminLike =
  nexSupabaseAdmin as unknown as RosterAdminLike;

/** Returned when a roster read is denied by the authorization guard. */
export type ListParticipantsDenial = {
  denied: true;
  reason: "unauthenticated" | "session_not_found" | "not_member" | "error";
};

export type ListParticipantsResult =
  | { denied: false; participants: GroupCallParticipantRow[] }
  | ListParticipantsDenial;

export type GroupCallMediaType = "audio" | "video";
export type GroupCallState = "ringing" | "live" | "ended";
export type GroupParticipantRole = "host" | "guest";

export interface GroupCallSessionRow {
  id: NexUuid;
  host_account_id: NexUuid;
  media_type: GroupCallMediaType;
  state: GroupCallState;
  started_at: string;
  live_at: string | null;
  ended_at: string | null;
  from_call_link_id: NexUuid | null;
}

export interface GroupCallParticipantRow {
  id: NexUuid;
  session_id: NexUuid;
  account_id: NexUuid;
  role: GroupParticipantRole;
  invited_at: string;
  joined_at: string | null;
  left_at: string | null;
  removed_by: NexUuid | null;
}

export interface CreateGroupCallSessionInput {
  hostAccountId: NexUuid;
  mediaType: GroupCallMediaType;
  /** account_ids to pre-invite as guest participants (host is auto-added). */
  inviteeAccountIds?: NexUuid[];
  /** Optional link that spawned this session (nex_call_link.id). */
  fromCallLinkId?: NexUuid | null;
}

/** Creates the session + the host participant row atomically-ish. If
 *  pre-invitees exceed the 4-cap, the trigger will reject · we return
 *  what fits + a `rejected` count so the caller can surface it. */
export async function createGroupCallSession(
  input: CreateGroupCallSessionInput,
): Promise<{
  session: GroupCallSessionRow;
  participants: GroupCallParticipantRow[];
  rejectedCount: number;
}> {
  const admin = nexSupabaseAdmin;

  const { data: session, error: sessionErr } = await admin
    .from("nex_group_call_session")
    .insert({
      host_account_id: input.hostAccountId,
      media_type: input.mediaType,
      state: "ringing",
      from_call_link_id: input.fromCallLinkId ?? null,
    })
    .select("*")
    .single();
  if (sessionErr || !session) {
    throw new Error(
      `group-call-service.createGroupCallSession: ${sessionErr?.message ?? "no session"}`,
    );
  }

  // §16.48.25 Lane 2 · 2026-11-20 · do NOT write joined_at for the host
  // at session creation time. joined_at means "peer connection confirmed
  // live by the server"; the host still needs to mount GroupCallEngine
  // and complete WebRTC negotiation before that is true. The row is
  // inserted with joined_at NULL; `confirmRoomJoin` is the only trusted
  // writer of joined_at.
  //
  // For the W2 1:1→group upgrade path (the caller in
  // chat/peer/.../_add-to-call-action.ts), the host IS currently in a
  // 1:1 call but that 1:1 lives in `nex_peer_call`, not this group
  // session — so the host is not yet in THIS session's room at creation.
  interface InsertableParticipant {
    session_id: NexUuid;
    account_id: NexUuid;
    role: GroupParticipantRole;
  }
  const participantsToInsert: InsertableParticipant[] = [
    {
      session_id: session.id,
      account_id: input.hostAccountId,
      role: "host",
    },
    ...(input.inviteeAccountIds ?? [])
      .filter((id) => id !== input.hostAccountId)
      .slice(0, 3) // host + 3 guests = 4 cap
      .map<InsertableParticipant>((id) => ({
        session_id: session.id,
        account_id: id,
        role: "guest",
      })),
  ];
  const rejectedCount =
    (input.inviteeAccountIds?.length ?? 0) -
    (participantsToInsert.length - 1 /* host */);

  const participants: GroupCallParticipantRow[] = [];
  for (const row of participantsToInsert) {
    const { data, error } = await admin
      .from("nex_group_call_participant")
      .insert(row)
      .select("*")
      .single();
    if (error) {
      // 23505 = unique violation (already a participant) · skip
      // P0001 = our 4-cap trigger · skip + bump rejected
      if (error.code === "23505") continue;
      throw new Error(
        `group-call-service.createGroupCallSession/participants: ${error.message}`,
      );
    }
    if (data) participants.push(data as GroupCallParticipantRow);
  }

  return { session: session as GroupCallSessionRow, participants, rejectedCount: Math.max(0, rejectedCount) };
}

export async function getGroupCallSession(
  sessionId: NexUuid,
): Promise<GroupCallSessionRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_group_call_session")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) {
    throw new Error(`group-call-service.getGroupCallSession: ${error.message}`);
  }
  return (data as GroupCallSessionRow | null) ?? null;
}

/**
 * §16.48.25 Lane 1 · roster read requires caller identity and passes
 * through the shared authorization guard before the service-role query.
 * Callers MUST pass `callerAccountId` resolved from the authenticated
 * server session (never from client input). Denial returns a reason
 * rather than throwing so callers can render an empty-roster view
 * without leaking "this session exists but you're not in it".
 */
export async function listParticipants(
  sessionId: NexUuid,
  callerAccountId: NexUuid | null,
): Promise<ListParticipantsResult> {
  const gate = await assertCanViewSession({
    callerAccountId,
    sessionId,
    admin: rosterAdmin,
  });
  if (!gate.ok) {
    return { denied: true, reason: gate.reason };
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_group_call_participant")
    .select("*")
    .eq("session_id", sessionId)
    .order("invited_at", { ascending: true });
  if (error) {
    throw new Error(`group-call-service.listParticipants: ${error.message}`);
  }
  return {
    denied: false,
    participants: (data as GroupCallParticipantRow[]) ?? [],
  };
}

/** Upserts a participant row (idempotent for a given account+session).
 *  Returns null if the row already exists + was already joined (no-op). */
export async function joinGroupCallSession(input: {
  sessionId: NexUuid;
  accountId: NexUuid;
  role?: GroupParticipantRole;
}): Promise<GroupCallParticipantRow | null> {
  const admin = nexSupabaseAdmin;
  const nowIso = new Date().toISOString();

  // Try UPDATE first (existing row from pre-invite).
  const { data: updated, error: updErr } = await admin
    .from("nex_group_call_participant")
    .update({ joined_at: nowIso, left_at: null })
    .eq("session_id", input.sessionId)
    .eq("account_id", input.accountId)
    .select("*")
    .maybeSingle();
  if (updErr) {
    throw new Error(`group-call-service.joinGroupCallSession/update: ${updErr.message}`);
  }
  if (updated) {
    await promoteSessionToLive(input.sessionId);
    return updated as GroupCallParticipantRow;
  }

  // Not pre-invited · insert fresh.
  const { data: inserted, error: insErr } = await admin
    .from("nex_group_call_participant")
    .insert({
      session_id: input.sessionId,
      account_id: input.accountId,
      role: input.role ?? "guest",
      joined_at: nowIso,
    })
    .select("*")
    .single();
  if (insErr) {
    // 23505 = already a participant · race with another join
    if (insErr.code === "23505") return null;
    throw new Error(
      `group-call-service.joinGroupCallSession/insert: ${insErr.message}`,
    );
  }
  await promoteSessionToLive(input.sessionId);
  return inserted as GroupCallParticipantRow;
}

/** Flips state=ringing→live on first non-host join. */
async function promoteSessionToLive(sessionId: NexUuid): Promise<void> {
  await nexSupabaseAdmin
    .from("nex_group_call_session")
    .update({ state: "live", live_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("state", "ringing");
}

export async function leaveGroupCallSession(input: {
  sessionId: NexUuid;
  accountId: NexUuid;
}): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_group_call_participant")
    .update({ left_at: new Date().toISOString() })
    .eq("session_id", input.sessionId)
    .eq("account_id", input.accountId)
    .is("left_at", null);
  if (error) {
    throw new Error(`group-call-service.leaveGroupCallSession: ${error.message}`);
  }
  await maybeEndSession(input.sessionId);
}

/** If the last joined participant leaves, flip state=ended. Exported
 *  2026-11-19 (§16.33) so the preview-page decline path can call it
 *  after flipping participant.left_at · prior to this export the
 *  decline path only wrote the participant row, leaving session.state
 *  at 'ringing' indefinitely for 1:1 calls. Idempotent + safe for
 *  multi-participant sessions · it only ends when EVERY participant
 *  has left_at set, so a decline by B while C is still pending leaves
 *  the session ringing for C. */
export async function maybeEndSessionIfAllParticipantsLeft(
  sessionId: NexUuid,
): Promise<void> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_group_call_participant")
    .select("id", { count: "exact", head: false })
    .eq("session_id", sessionId)
    .is("left_at", null);
  if (error) return;
  if ((data?.length ?? 0) === 0) {
    await nexSupabaseAdmin
      .from("nex_group_call_session")
      .update({ state: "ended", ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .in("state", ["ringing", "live"]);
  }
}

/** Legacy internal alias · kept so leaveGroupCallSession can continue
 *  to call the private name without touching its own semantics. */
async function maybeEndSession(sessionId: NexUuid): Promise<void> {
  return maybeEndSessionIfAllParticipantsLeft(sessionId);
}

export async function endGroupCallSession(
  sessionId: NexUuid,
  hostAccountId: NexUuid,
): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_group_call_session")
    .update({ state: "ended", ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("host_account_id", hostAccountId)
    .in("state", ["ringing", "live"]);
  if (error) {
    throw new Error(`group-call-service.endGroupCallSession: ${error.message}`);
  }
}

/** Links a session to the call-link row that spawned it (phase 2+3 bridge). */
export async function linkSessionToCallLink(
  sessionId: NexUuid,
  callLinkId: NexUuid,
): Promise<void> {
  await nexSupabaseAdmin
    .from("nex_group_call_session")
    .update({ from_call_link_id: callLinkId })
    .eq("id", sessionId);

  await nexSupabaseAdmin
    .from("nex_call_link")
    .update({ group_call_session_id: sessionId })
    .eq("id", callLinkId);
}
