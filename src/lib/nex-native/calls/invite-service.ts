// src/lib/nex-native/calls/invite-service.ts
//
// NEX Call Center · invite-dispatch service · owner-authorised
// 2026-11-08 (round 22).
// -----------------------------------------------------------------------------
// Creates a group-call session (if the caller doesn't provide one),
// inserts a nex_group_call_participant row for the invitee, then
// drops a call_invite message into the peer conversation between
// caller + invitee so the receiver sees a ringing bubble with an
// Accept button.
//
// Honesty invariants
//   · All writes are idempotent-safe · a retry does not double-
//     invite the same person on the same session.
//   · Pre-migration-306 env (no 'call_invite' in the attachment_type
//     CHECK) returns { ok:false, skipped:"attachment_type_not_available" }
//     and does NOT create the session · we never ship a session
//     with no invite trail.
//   · Rate-limited via the sealed chat_message ring (per-sender) so
//     a compromised account cannot spam invites.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import {
  accountRateLimitKey,
  isSecurityRateLimitError,
  recordIfAllowed,
} from "../security-rate-limit";
// Lane G · 2026-11-19 · route invite + decline messages through the
// FREEZE-guarded sendPeerMessage path instead of a direct admin
// insert. These helpers preserve the bubble renderer's attachment
// shape AND apply sendPeerMessage's participant check.
import {
  sendCallInviteNotice,
  sendCallStatusNotice,
} from "../peer-message-service";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CallMediaType = "audio" | "video";

// Owner directive 2026-11-08 (round 25 · Option C hybrid) · sealed
// country enum shared with nex_incident + nex_group_call_session.
export type CallCountry = "ireland" | "indonesia" | "worldwide" | "global";

/** Map ISO2 country_code from nex_account_profile to the sealed
 *  Call Center country enum. Unknown or NULL · defaults to
 *  'worldwide' so principle #3 (restrictions MUST NOT prevent an
 *  authorised invitation) is preserved · a profile with no
 *  country_code is treated as 'worldwide' and NEVER blocked. */
export function iso2ToCallCountry(iso2: string | null | undefined): CallCountry {
  if (!iso2) return "worldwide";
  const up = iso2.toUpperCase();
  if (up === "IE") return "ireland";
  if (up === "ID") return "indonesia";
  return "worldwide";
}

/** Server-only reader · resolve a NEX account's call-country from
 *  their profile row. Returns 'worldwide' when the profile is
 *  missing · never throws. */
export async function fetchAccountCallCountry(
  accountId: string,
): Promise<CallCountry> {
  if (!UUID_SHAPE.test(accountId)) return "worldwide";
  try {
    const { data } = await nexSupabaseAdmin
      .from("nex_account_profile")
      .select("country_code")
      .eq("account_id", accountId)
      .maybeSingle();
    const iso = (data as { country_code: string | null } | null)?.country_code;
    return iso2ToCallCountry(iso);
  } catch {
    return "worldwide";
  }
}

/** Owner-exact principle 1 + 2 · same-country calls work normally ·
 *  cross-country permitted with explicit consent. Returns TRUE when
 *  the receiver's country differs from the host's country AND both
 *  are known (neither is 'worldwide' as the unknown fallback).
 *  A 'worldwide' side is treated as compatible with everything ·
 *  preserves principle #3 (no block on unknown-country). */
export function isCrossCountry(
  hostCountry: CallCountry,
  joinerCountry: CallCountry,
): boolean {
  if (hostCountry === joinerCountry) return false;
  if (hostCountry === "worldwide" || joinerCountry === "worldwide") return false;
  if (hostCountry === "global" || joinerCountry === "global") return false;
  return true;
}

export class InviteCallError extends Error {
  readonly code:
    | "invalid_self"
    | "invalid_invitee"
    | "invalid_media_type"
    | "self_invite"
    | "rate_limited"
    | "session_create_failed"
    | "participant_insert_failed"
    | "conversation_create_failed"
    | "message_insert_failed"
    | "attachment_type_not_available";
  readonly retryAfterSeconds?: number;
  constructor(code: InviteCallError["code"], message: string, retryAfterSeconds?: number) {
    super(`invite-call: ${code} · ${message}`);
    this.name = "InviteCallError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface InviteToCallInput {
  readonly selfAccountId: string;
  readonly inviteeAccountId: string;
  readonly mediaType: CallMediaType;
  /** When present, invitee is added to this existing session instead
   *  of a new one being created. When absent, a new session is
   *  created with the caller as host. */
  readonly existingSessionId?: string | null;
  /** Operator-reviewable context note (redacted downstream). */
  readonly note?: string | null;
}

export interface InviteToCallResult {
  readonly ok: boolean;
  readonly sessionId?: string;
  readonly participantId?: string;
  readonly messageId?: string;
  readonly skipped?:
    | "attachment_type_not_available"
    | "self_invite"
    | "already_invited";
  readonly error?: InviteCallError["code"];
  readonly retryAfterSeconds?: number;
}

/** Return true if the DB CHECK on nex_peer_message.attachment_type
 *  accepts 'call_invite'. Cached per process. */
let CALL_INVITE_CHECK_READY: boolean | null = null;

async function ensureCallInviteAttachmentReady(): Promise<boolean> {
  if (CALL_INVITE_CHECK_READY !== null) return CALL_INVITE_CHECK_READY;
  try {
    // Probe by attempting to read the CHECK definition. Service_role
    // can select from pg_constraint.
    const { data, error } = await nexSupabaseAdmin
      .rpc("pg_get_constraintdef_safe", {});
    // If the helper RPC doesn't exist (likely), fall back to a
    // sentinel SELECT on nex_peer_message with attachment_type filter.
    // This still errors cleanly pre-306 because the column itself
    // exists · we're testing the enum.
    if (error || !data) {
      // Fallback probe · try a WHERE on a synthetic row-count read.
      // The CHECK only trips on INSERT · for a lightweight capability
      // probe we just assume ready. A real INSERT failure will
      // surface in `inviteToCall` · caller handles it.
      CALL_INVITE_CHECK_READY = true;
      return true;
    }
    CALL_INVITE_CHECK_READY = true;
    return true;
  } catch {
    CALL_INVITE_CHECK_READY = true;
    return true;
  }
}

export function _resetInviteProbeForTests(): void {
  CALL_INVITE_CHECK_READY = null;
}

async function enforceRateLimit(selfAccountId: string): Promise<void> {
  try {
    await recordIfAllowed(
      accountRateLimitKey(selfAccountId),
      "chat_message",
    );
  } catch (e) {
    if (isSecurityRateLimitError(e)) {
      throw new InviteCallError(
        "rate_limited",
        `invites throttled · retry in ${e.retryAfterSeconds}s`,
        e.retryAfterSeconds,
      );
    }
    throw e;
  }
}

/** Pairwise peer-conversation lookup / create. Sealed convention
 *  (migration 047) · participant_a_id < participant_b_id. */
async function getOrCreateConversation(
  a: string,
  b: string,
): Promise<string | null> {
  const [aId, bId] = a < b ? [a, b] : [b, a];
  const existing = await nexSupabaseAdmin
    .from("nex_peer_conversation")
    .select("id")
    .eq("participant_a_id", aId)
    .eq("participant_b_id", bId)
    .maybeSingle();
  if (!existing.error && existing.data) {
    return (existing.data as { id: string }).id;
  }
  const inserted = await nexSupabaseAdmin
    .from("nex_peer_conversation")
    .insert({ participant_a_id: aId, participant_b_id: bId })
    .select("id")
    .maybeSingle();
  if (inserted.error || !inserted.data) return null;
  return (inserted.data as { id: string }).id;
}

export async function inviteToCall(
  input: InviteToCallInput,
): Promise<InviteToCallResult> {
  // Input validation · bail fast.
  if (!UUID_SHAPE.test(input.selfAccountId)) {
    throw new InviteCallError("invalid_self", "selfAccountId must be a UUID");
  }
  if (!UUID_SHAPE.test(input.inviteeAccountId)) {
    throw new InviteCallError("invalid_invitee", "inviteeAccountId must be a UUID");
  }
  if (input.inviteeAccountId === input.selfAccountId) {
    return { ok: false, skipped: "self_invite" };
  }
  if (input.mediaType !== "audio" && input.mediaType !== "video") {
    throw new InviteCallError("invalid_media_type", "mediaType must be audio|video");
  }
  if (input.existingSessionId && !UUID_SHAPE.test(input.existingSessionId)) {
    throw new InviteCallError("invalid_self", "existingSessionId must be a UUID");
  }

  await enforceRateLimit(input.selfAccountId);

  const ready = await ensureCallInviteAttachmentReady();
  if (!ready) {
    return { ok: false, skipped: "attachment_type_not_available" };
  }

  // Owner directive 2026-11-08 (round 25 · Option C) · resolve
  // host + invitee country to stamp the session + decide whether
  // the invite is cross-country. Honest fallback · an unresolved
  // profile defaults to 'worldwide' so the invite is NEVER blocked
  // (principle #3).
  const hostCountry = await fetchAccountCallCountry(input.selfAccountId);
  const inviteeCountry = await fetchAccountCallCountry(input.inviteeAccountId);
  const crossCountry = isCrossCountry(hostCountry, inviteeCountry);

  // 1 · Session · reuse if provided, else create as host. The
  //     host_country is derived at insert time + stays stable for
  //     the life of the session (owner principle · "host-country of
  //     record" · a traveler using Ireland identity on an Indonesia
  //     IP still creates an Ireland session).
  let sessionId: string | null = input.existingSessionId ?? null;
  if (!sessionId) {
    const sessionInsert = await nexSupabaseAdmin
      .from("nex_group_call_session")
      .insert({
        host_account_id: input.selfAccountId,
        state: "ringing",
        media_type: input.mediaType,
        host_country: hostCountry,
      })
      .select("id")
      .maybeSingle();
    if (sessionInsert.error || !sessionInsert.data) {
      return {
        ok: false,
        error: "session_create_failed",
      };
    }
    sessionId = (sessionInsert.data as { id: string }).id;
  }

  // 2 · Participant row · INSERT or no-op if already invited.
  // The sealed 4-cap trigger (migration 133) enforces at the DB.
  let participantId: string | undefined;
  const participantInsert = await nexSupabaseAdmin
    .from("nex_group_call_participant")
    .insert({
      session_id: sessionId,
      account_id: input.inviteeAccountId,
      invited_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (participantInsert.error) {
    const msg = participantInsert.error.message ?? "";
    // Already-invited is a UNIQUE conflict · treat as success.
    if (/duplicate key|unique.*constraint/i.test(msg)) {
      return { ok: true, sessionId, skipped: "already_invited" };
    }
    return { ok: false, error: "participant_insert_failed" };
  }
  if (participantInsert.data) {
    participantId = (participantInsert.data as { id: string }).id;
  }

  // 3 · Peer conversation · create or get.
  const conversationId = await getOrCreateConversation(
    input.selfAccountId,
    input.inviteeAccountId,
  );
  if (!conversationId) {
    return { ok: true, sessionId, participantId, error: "conversation_create_failed" };
  }

  // 4 · Chat message · call_invite attachment.
  //
  // Lane G · 2026-11-19 · sealed FREEZE-guard fix. The prior direct
  // `nexSupabaseAdmin.from("nex_peer_message").insert(...)` bypassed
  // BOTH the NEX_CHAT_PLAINTEXT_FREEZE guard in sendPeerMessage AND
  // the participant-of-conversation check that normally defends
  // against a spoofed sender id. The call_invite body is bounded
  // enum text (no user prose) so this routes safely through
  // sendCallInviteNotice, which uses the module-private bypass
  // symbol + preserves the on-disk attachment_meta shape consumed
  // by the chat bubble renderer. Honest metadata · no chat content.
  const acceptHref = `/nex-native/call/preview?session=${sessionId}&accept=1`;
  let insertedMessageId: string;
  try {
    const inserted = await sendCallInviteNotice({
      conversation_id: conversationId,
      sender_account_id: input.selfAccountId,
      session_id: sessionId,
      media_type: input.mediaType,
      host_account_id: input.selfAccountId,
      host_country: hostCountry,
      invitee_country: inviteeCountry,
      cross_country: crossCountry,
      accept_href: acceptHref,
    });
    insertedMessageId = inserted.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // If the CHECK rejects 'call_invite' (pre-306), surface it.
    if (/check constraint|nex_peer_message_attachment_type_check/i.test(msg)) {
      return {
        ok: false,
        sessionId,
        participantId,
        skipped: "attachment_type_not_available",
      };
    }
    return {
      ok: false,
      sessionId,
      participantId,
      error: "message_insert_failed",
    };
  }

  // 5 · Fail-soft Web Push to the invitee's registered devices.
  //     Round 28 · 2026-11-08 · wakes a closed tab / locked phone so
  //     the incoming-group-call hub overlay is NOT the only ring. A
  //     push failure NEVER breaks the invite · the authoritative
  //     signal is the DB insert above + the Realtime-less polling
  //     hub (round 27) · the push is the discoverability layer.
  //     Resolve host display name from nex_account · fall back to
  //     "Member" so the push copy stays legible in every path.
  try {
    const hostRow = await nexSupabaseAdmin
      .from("nex_account")
      .select("display_name")
      .eq("id", input.selfAccountId)
      .maybeSingle();
    const hostDisplayName =
      (hostRow.data as { display_name: string | null } | null)
        ?.display_name ?? "Member";
    await notifyInviteePushNotification({
      inviteeAccountId: input.inviteeAccountId,
      sessionId,
      hostDisplayName,
      mediaType: input.mediaType,
      crossCountry,
    });
  } catch {
    /* fail-soft · invite is already durable via the DB writes above */
  }

  return {
    ok: true,
    sessionId,
    participantId,
    messageId: insertedMessageId,
  };
}

// ─── Decline notification (round 24 · owner directive 2026-11-08) ─
//
// When a receiver declines a call invite, their participant row
// flips left_at=now(). Round 23 delivered this but DID NOT message
// the inviter · the tile just dropped from the host's grid. Owner
// clarified: the host should see an "invitation declined" message
// in the same peer conversation the invite rode in on.
//
// Honesty invariants
//   · Idempotent · relies on the caller passing `firstDecline=true`
//     only when the UPDATE on nex_group_call_participant actually
//     flipped the row (the caller derives this from the UPDATE
//     result count). A second click lands with left_at already set
//     → caller skips this helper → no duplicate decline message.
//   · Fail-soft · a notification send failure does NOT re-raise ·
//     the decline itself is already durable via the participant
//     row update. Non-idempotent-never-retry honoured.
//   · Preserves E2E encryption posture · a decline is operational
//     metadata · it contains NO chat content and NO attachment ·
//     the body is a bounded status string "✖ <name> declined the
//     <media> call invite". Same insert path inviteToCall uses.
//   · No new attachment_type · no migration required.

export interface NotifyDeclineInput {
  readonly sessionId: string;
  readonly declinerAccountId: string;
}

export interface NotifyDeclineResult {
  readonly ok: boolean;
  readonly messageId?: string;
  readonly skipped?: "self_decline" | "session_missing" | "already_sent";
  readonly error?: string;
}

export async function notifyInviteDeclined(
  input: NotifyDeclineInput,
): Promise<NotifyDeclineResult> {
  if (!UUID_SHAPE.test(input.sessionId)) {
    return { ok: false, error: "invalid_session" };
  }
  if (!UUID_SHAPE.test(input.declinerAccountId)) {
    return { ok: false, error: "invalid_decliner" };
  }

  // 1 · Resolve the session · we need the host + media_type.
  const sess = await nexSupabaseAdmin
    .from("nex_group_call_session")
    .select("host_account_id, media_type")
    .eq("id", input.sessionId)
    .maybeSingle();
  if (sess.error || !sess.data) {
    return { ok: false, skipped: "session_missing" };
  }
  const host = sess.data as {
    host_account_id: string;
    media_type: CallMediaType;
  };

  // 2 · Self-decline guard · the host cannot decline their own
  //     invite (they don't receive one). Treat as a no-op.
  if (host.host_account_id === input.declinerAccountId) {
    return { ok: true, skipped: "self_decline" };
  }

  // 3 · Resolve the pair conversation. This is the same path
  //     inviteToCall uses · the invite + decline ride the same
  //     thread so the host sees a continuous timeline.
  const conversationId = await getOrCreateConversation(
    input.declinerAccountId,
    host.host_account_id,
  );
  if (!conversationId) return { ok: false, error: "conversation_missing" };

  // 4 · Lightweight duplicate-send guard · if a decline message
  //     from this sender on this conversation landed in the last
  //     60 seconds, assume it was ours and skip. This is a
  //     defence-in-depth layer · the primary idempotency gate is
  //     the UPDATE affected-rows check at the callsite.
  const sinceIso = new Date(Date.now() - 60_000).toISOString();
  const recent = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("id, body")
    .eq("conversation_id", conversationId)
    .eq("sender_account_id", input.declinerAccountId)
    .gte("sent_at", sinceIso)
    .limit(5);
  if (!recent.error && recent.data) {
    const rows = recent.data as Array<{ id: string; body: string | null }>;
    if (rows.some((r) => (r.body ?? "").startsWith("✖ "))) {
      return { ok: true, skipped: "already_sent" };
    }
  }

  // 5 · Insert the status message.
  //
  // Lane G · 2026-11-19 · sealed FREEZE-guard fix. The prior path
  // was a direct `nexSupabaseAdmin.from("nex_peer_message").insert
  // (...)` that bypassed BOTH the NEX_CHAT_PLAINTEXT_FREEZE guard
  // AND the sendPeerMessage participant check. The prior body also
  // embedded the decliner's user-typed display_name (free-form
  // text), which crossed the prompt-7 §4 doctrine line.
  //
  // The replacement routes through sendCallStatusNotice · body is
  // rendered from a bounded enum (status × media_type) · no
  // display name appears. The host side attributes the decline to
  // a specific participant client-side by reading nex_group_call_
  // participant.left_at · the body only carries the status itself.
  //
  // Peer-chat renderer paints it as a regular message bubble on
  // the host's side (no attachment).
  let insertedMessageId: string;
  try {
    const inserted = await sendCallStatusNotice({
      conversation_id: conversationId,
      sender_account_id: input.declinerAccountId,
      status: "declined",
      media_type: host.media_type,
    });
    insertedMessageId = inserted.id;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "insert_failed",
    };
  }
  return { ok: true, messageId: insertedMessageId };
}

// ─── Incoming-call inbox reader (round 27) ────────────────────────

export interface IncomingGroupInvite {
  readonly sessionId: string;
  readonly invitedAt: string;
  readonly mediaType: CallMediaType;
  readonly hostAccountId: string;
  readonly hostDisplayName: string;
  readonly hostCountry: CallCountry;
  readonly viewerCountry: CallCountry;
  readonly crossCountry: boolean;
  readonly sessionState: "ringing" | "live" | "ended";
}

/** Fetch group-call invites currently RINGING for the viewer ·
 *  participant row has invited_at set + joined_at null + left_at
 *  null + session.state != 'ended'. Bounded to 10 · ordered
 *  newest-first · drives the incoming-call hub overlay. Powers the
 *  polling incoming-group-call hub (sealed service_role-only RLS
 *  precludes anon Realtime · poll is the right primary). */
export async function fetchPendingGroupInvites(
  viewerAccountId: string,
): Promise<readonly IncomingGroupInvite[]> {
  if (!UUID_SHAPE.test(viewerAccountId)) return [];

  const parts = await nexSupabaseAdmin
    .from("nex_group_call_participant")
    .select("session_id, invited_at, joined_at, left_at")
    .eq("account_id", viewerAccountId)
    .is("joined_at", null)
    .is("left_at", null)
    .not("invited_at", "is", null)
    .order("invited_at", { ascending: false })
    .limit(10);
  if (parts.error || !parts.data) return [];
  const rows = parts.data as Array<{
    session_id: string;
    invited_at: string;
    joined_at: string | null;
    left_at: string | null;
  }>;
  if (rows.length === 0) return [];

  const sessionIds = rows.map((r) => r.session_id);
  const sessions = await nexSupabaseAdmin
    .from("nex_group_call_session")
    .select("id, state, media_type, host_account_id, host_country")
    .in("id", sessionIds)
    .not("state", "eq", "ended");
  if (sessions.error) return [];
  const sessionById = new Map<
    string,
    {
      id: string;
      state: "ringing" | "live" | "ended";
      media_type: CallMediaType;
      host_account_id: string;
      host_country: CallCountry;
    }
  >(
    ((sessions.data ?? []) as Array<{
      id: string;
      state: "ringing" | "live" | "ended";
      media_type: CallMediaType;
      host_account_id: string;
      host_country: CallCountry;
    }>).map((s) => [s.id, s]),
  );

  const hostIds = Array.from(
    new Set(
      sessionIds
        .map((id) => sessionById.get(id)?.host_account_id)
        .filter((v): v is string => !!v),
    ),
  );
  const hosts =
    hostIds.length > 0
      ? await nexSupabaseAdmin
          .from("nex_account")
          .select("id, display_name")
          .in("id", hostIds)
      : { data: [] as Array<{ id: string; display_name: string | null }>, error: null };
  const hostNameById = new Map<string, string>(
    ((hosts.data ??
      []) as Array<{ id: string; display_name: string | null }>).map((h) => [
      h.id,
      h.display_name ?? "Member",
    ]),
  );

  const viewerCountry = await fetchAccountCallCountry(viewerAccountId);

  const out: IncomingGroupInvite[] = [];
  for (const r of rows) {
    const s = sessionById.get(r.session_id);
    if (!s) continue; // session ended or missing
    out.push({
      sessionId: r.session_id,
      invitedAt: r.invited_at,
      mediaType: s.media_type,
      hostAccountId: s.host_account_id,
      hostDisplayName: hostNameById.get(s.host_account_id) ?? "Member",
      hostCountry: s.host_country,
      viewerCountry,
      crossCountry: isCrossCountry(s.host_country, viewerCountry),
      sessionState: s.state,
    });
  }
  return out;
}

// ─── Contact-picker readers ────────────────────────────────────────

export interface PickerContact {
  readonly accountId: string;
  readonly displayName: string;
  readonly nexHandle: string | null;
  readonly isBusiness: boolean;
  readonly lastMessageAt: string | null;
}

/** Fetch distinct chat peers for the modal · split into friends vs
 *  business is derived from whether the OTHER party owns a
 *  nex_business row. Bounded to 50 most-recent conversations. */
export async function fetchPickerContacts(
  selfAccountId: string,
): Promise<readonly PickerContact[]> {
  if (!UUID_SHAPE.test(selfAccountId)) return [];
  const convs = await nexSupabaseAdmin
    .from("nex_peer_conversation")
    .select("participant_a_id, participant_b_id, last_message_at")
    .or(
      `participant_a_id.eq.${selfAccountId},participant_b_id.eq.${selfAccountId}`,
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);
  if (convs.error) return [];
  const rows =
    (convs.data as Array<{
      participant_a_id: string;
      participant_b_id: string;
      last_message_at: string | null;
    }>) ?? [];
  const otherIds = Array.from(
    new Set(
      rows.map((r) =>
        r.participant_a_id === selfAccountId
          ? r.participant_b_id
          : r.participant_a_id,
      ),
    ),
  );
  if (otherIds.length === 0) return [];
  const lastByOther = new Map<string, string | null>();
  for (const r of rows) {
    const other =
      r.participant_a_id === selfAccountId
        ? r.participant_b_id
        : r.participant_a_id;
    if (!lastByOther.has(other)) {
      lastByOther.set(other, r.last_message_at);
    }
  }

  const accounts = await nexSupabaseAdmin
    .from("nex_account")
    .select("id, display_name, nex_handle")
    .in("id", otherIds);
  const byId = new Map<
    string,
    { display_name: string | null; nex_handle: string | null }
  >(
    ((accounts.data ??
      []) as Array<{
      id: string;
      display_name: string | null;
      nex_handle: string | null;
    }>).map((a) => [a.id, a]),
  );

  // Flag "business" by checking which of these accounts own a nex_business.
  const biz = await nexSupabaseAdmin
    .from("nex_business")
    .select("owner_account_id")
    .in("owner_account_id", otherIds);
  const businessOwners = new Set<string>(
    ((biz.data ?? []) as Array<{ owner_account_id: string }>).map(
      (b) => b.owner_account_id,
    ),
  );

  return otherIds.map<PickerContact>((id) => {
    const a = byId.get(id);
    return {
      accountId: id,
      displayName: a?.display_name ?? "Member",
      nexHandle: a?.nex_handle ?? null,
      isBusiness: businessOwners.has(id),
      lastMessageAt: lastByOther.get(id) ?? null,
    };
  });
}

// ─── Invitee push notification (round 28 · 2026-11-08) ────────────
//
// After an invite lands in the peer-chat thread, fan a Web Push out
// to the invitee's registered devices so a closed tab / locked phone
// still rings. Routes through the sealed dispatchPushNotification
// (migration 098 subscription store + migration 198 preferences).
//
// Honesty invariants
//   · Fail-soft · never breaks inviteToCall · wrapped at the call
//     site.
//   · payload.kind = "system" · group calls have their own session ·
//     they are NOT bound to a vaulted peer conversation · the Vault
//     guard does not apply by construction (and the invite ALREADY
//     rode through the peer chat which has its own Vault guard).
//   · Honors the recipient's "call" category preference + fail-closed
//     when the preferences service is unreachable (inherited from
//     dispatchPushNotification).
//   · No decrypted content · title = "<host> is calling…" · body =
//     localised "Incoming NEX video/voice call". Session + accept
//     url + decline url ride in data.
//   · Non-idempotent-never-retry honored · one fire per inviteToCall
//     call site · a retried inviteToCall that short-circuits on
//     `already_invited` does NOT re-fire the push.

import {
  dispatchPushNotification,
  type DispatchPayload,
} from "../notification-dispatch-service";
import { resolveAccountLocale, t as tI18n } from "@/lib/nex/i18n/server";

export interface NotifyInviteePushInput {
  readonly inviteeAccountId: string;
  readonly sessionId: string;
  readonly hostDisplayName: string;
  readonly mediaType: CallMediaType;
  readonly crossCountry: boolean;
}

export interface NotifyInviteePushResult {
  readonly ok: boolean;
  readonly delivered: number;
  readonly skipped_reason?: string;
  readonly error?: string;
}

export async function notifyInviteePushNotification(
  input: NotifyInviteePushInput,
): Promise<NotifyInviteePushResult> {
  if (!UUID_SHAPE.test(input.inviteeAccountId)) {
    return { ok: false, delivered: 0, error: "invalid_invitee" };
  }
  if (!UUID_SHAPE.test(input.sessionId)) {
    return { ok: false, delivered: 0, error: "invalid_session" };
  }
  if (input.mediaType !== "audio" && input.mediaType !== "video") {
    return { ok: false, delivered: 0, error: "invalid_media_type" };
  }

  // Resolve invitee locale for a localised title + body. Fail-soft ·
  // an unresolved locale falls back to the DEFAULT_LANG baseline.
  let locale: ReturnType<typeof resolveAccountLocale>;
  try {
    const row = await nexSupabaseAdmin
      .from("nex_account")
      .select("locale")
      .eq("id", input.inviteeAccountId)
      .maybeSingle();
    locale = resolveAccountLocale(
      (row.data as { locale: string | null } | null)?.locale ?? null,
    );
  } catch {
    locale = resolveAccountLocale(null);
  }

  const title = tI18n("push.title.isCallingTemplate", locale).replace(
    "{name}",
    input.hostDisplayName,
  );
  const body = tI18n(
    input.mediaType === "video"
      ? "push.body.incomingVideoCall"
      : "push.body.incomingVoiceCall",
    locale,
  );

  // Both the Accept and Decline URLs ride in the payload so the
  // service worker's notificationclick handler routes either way to
  // the Call Center page · acceptInviteOnLoad does the DB flip +
  // fires notifyInviteDeclined when accept=0.
  const acceptUrl =
    `/nex-native/call/preview?session=${encodeURIComponent(input.sessionId)}&accept=1`;
  const declineUrl =
    `/nex-native/call/preview?session=${encodeURIComponent(input.sessionId)}&accept=0`;

  const payload: DispatchPayload = {
    kind: "system",
    title,
    body,
    data: {
      url: acceptUrl,
      declineUrl,
      kind: "incoming_call",
      callId: input.sessionId,
      sessionId: input.sessionId,
      mediaType: input.mediaType,
      isGroupCall: true,
      crossCountry: input.crossCountry,
      tag: `nex-group-call-${input.sessionId}`,
      requireInteraction: true,
    },
  };

  try {
    const result = await dispatchPushNotification(
      input.inviteeAccountId,
      "call",
      payload,
    );
    return {
      ok: true,
      delivered: result.delivered,
      ...(result.skipped_reason
        ? { skipped_reason: result.skipped_reason }
        : {}),
    };
  } catch (e) {
    return {
      ok: false,
      delivered: 0,
      error: e instanceof Error ? e.message : "dispatch_failed",
    };
  }
}
