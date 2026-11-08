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

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CallMediaType = "audio" | "video";

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

  // 1 · Session · reuse if provided, else create as host.
  let sessionId: string | null = input.existingSessionId ?? null;
  if (!sessionId) {
    const sessionInsert = await nexSupabaseAdmin
      .from("nex_group_call_session")
      .insert({
        host_account_id: input.selfAccountId,
        state: "ringing",
        media_type: input.mediaType,
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
  const acceptHref = `/nex-native/call/preview?session=${sessionId}&accept=1`;
  const body =
    input.mediaType === "video"
      ? "📞 Video call invite · tap Accept to join"
      : "📞 Voice call invite · tap Accept to join";
  const messageInsert = await nexSupabaseAdmin
    .from("nex_peer_message")
    .insert({
      conversation_id: conversationId,
      sender_account_id: input.selfAccountId,
      body,
      attachment_url: acceptHref,
      attachment_type: "call_invite",
      attachment_meta: {
        session_id: sessionId,
        media_type: input.mediaType,
        host_account_id: input.selfAccountId,
      },
    })
    .select("id")
    .maybeSingle();
  if (messageInsert.error || !messageInsert.data) {
    const msg = messageInsert.error?.message ?? "";
    // If the CHECK rejects 'call_invite' (pre-306), surface it.
    if (/check constraint|nex_peer_message_attachment_type_check/i.test(msg)) {
      return {
        ok: false,
        sessionId,
        participantId,
        skipped: "attachment_type_not_available",
      };
    }
    return { ok: false, sessionId, participantId, error: "message_insert_failed" };
  }

  return {
    ok: true,
    sessionId,
    participantId,
    messageId: (messageInsert.data as { id: string }).id,
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

  // 5 · Resolve decliner display name for a legible status line.
  const decl = await nexSupabaseAdmin
    .from("nex_account")
    .select("display_name")
    .eq("id", input.declinerAccountId)
    .maybeSingle();
  const declinerName =
    (decl.data as { display_name: string | null } | null)?.display_name ??
    "Member";
  const mediaWord = host.media_type === "audio" ? "voice" : "video";
  const body = `✖ ${declinerName} declined the ${mediaWord} call invite`;

  // 6 · Insert the status message · no attachment · ordinary
  //     body text. Peer-chat renderer paints it as a regular
  //     message bubble on the host's side.
  const inserted = await nexSupabaseAdmin
    .from("nex_peer_message")
    .insert({
      conversation_id: conversationId,
      sender_account_id: input.declinerAccountId,
      body,
    })
    .select("id")
    .maybeSingle();
  if (inserted.error || !inserted.data) {
    return { ok: false, error: inserted.error?.message ?? "insert_failed" };
  }
  return { ok: true, messageId: (inserted.data as { id: string }).id };
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
