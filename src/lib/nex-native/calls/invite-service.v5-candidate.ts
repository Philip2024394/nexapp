// src/lib/nex-native/calls/invite-service.v5-candidate.ts
//
// Production code does NOT import this file.
// Fail-closed default-off · no live caller · activation requires
// separate authorisation naming the target DB + a feature flag flip
// NOT approved as of 2026-11-19.
//
// ─────────────────────────────────────────────────────────────────────
// What this file is
// ─────────────────────────────────────────────────────────────────────
// W1 integration wrapper for the v4 combined preview RPC
// (`nex_invite_to_call_tx` as defined in
// `nex-supabase/candidate-migrations/
//   CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW.sql`
// SHA: de77e9a19eb49df85433bf66969b87a44b05885b302a23559e76134b799bfea7).
//
// Key contract differences from the prior transactional-candidate.ts:
//   · Does NOT accept or forward `selfSupabaseUserId`. The v4 RPC
//     derives caller identity from `auth.uid()` server-side. No
//     client-supplied identity parameter exists in the 7-param
//     signature.
//   · Surfaces `participant_cap_exceeded` as a distinct error code
//     (the prior wrapper bucketed it under `message_insert_failed`).
//   · Surfaces `attachment_url_required` as a distinct error code
//     for the POSIX ERE guard failure (ERRCODE 22023 on the URL guard).
//   · Surfaces `caller_identity_required` as a merged code for both
//     `caller_identity_required` (NULL auth.uid) and
//     `caller_account_not_found` (no nex_account for auth.uid).
//   · 42883 → `rpc_unavailable` with NO silent fallback to direct
//     writes. Fail-closed.
//
// Pre-call invariants this wrapper enforces in TypeScript
// -------------------------------------------------------
//   · selfAccountId must be a valid UUID shape.
//   · inviteeAccountId must be a valid UUID shape.
//   · selfAccountId !== inviteeAccountId.
//   · mediaType must be "audio" | "video".
//   · existingSessionId (if provided) must be a valid UUID shape.
//
// What this wrapper does NOT do
// ------------------------------
//   · Rate limiting — stays in the existing `enforceRateLimit` prelude
//     inside `inviteToCall` in `invite-service.ts`.
//   · Freeze-guard / participant-of-conversation check — preserved in
//     `invite-service.ts` prelude via `sendCallInviteNotice`.
//   · Push notifications — fail-soft post-RPC in the service layer.
//   · Feature-flag read — no toggle/flag reader exported. Gate flip is
//     a separate authorisation; this file exports only the function.
//
// Activation path (not authorised as of 2026-11-19)
// --------------------------------------------------
//   1. Owner authorisation naming target DB (sandbox kdstoyyeygcopkogqsyv).
//   2. v4 SQL promoted to nex-supabase/migrations/ with a real number.
//   3. Feature flag `NEX_INVITE_CALL_TX=1` flip (separate authorisation).
//   4. Import this file from invite-service.ts behind the flag.
//
// This file intentionally has no `server-only` import so it can be
// imported into vitest mocked tests without a side-effect.

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── AdminLike interface ───────────────────────────────────────────────
// Minimal shape required for RPC calls. The real client is injected at
// activation time; tests inject a stub.
interface AdminLike {
  rpc(
    name: string,
    params: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
}

// ── Input type ────────────────────────────────────────────────────────
// No selfSupabaseUserId — identity derives from auth.uid() server-side.
export interface InviteToCallV5Input {
  /** NEX account ID of the calling user (nex_account.id · UUID). */
  readonly selfAccountId: string;
  /** NEX account ID of the invitee (nex_account.id · UUID). */
  readonly inviteeAccountId: string;
  readonly mediaType: "audio" | "video";
  /** Resolved from the host profile before calling. Defaults to
   *  'worldwide' when the profile is missing (principle #3). */
  readonly hostCountry: string;
  /** Attachment meta JSONB for the chat bubble renderer. */
  readonly attachmentMeta: Record<string, unknown>;
  /** Bounded enum text for the invite message body. */
  readonly inviteBody: string;
  /** The accept_href URL — must match the POSIX ERE pattern
   *  `^/nex-native/call/preview\?session=[0-9a-f-]{36}&accept=1$`
   *  or the RPC will raise ERRCODE 22023. */
  readonly attachmentUrl: string;
  /** When present, invitee is added to this existing session instead
   *  of a new one being created. Must be a valid UUID when provided. */
  readonly existingSessionId?: string | null;
}

// ── Error codes ───────────────────────────────────────────────────────
export type InviteToCallV5ErrorCode =
  /** RPC function not found (42883) — v4 not yet applied. Fail-closed;
   *  no silent fallback to direct writes. */
  | "rpc_unavailable"
  /** auth.uid() is NULL or no nex_account row for auth.uid() (42501). */
  | "caller_identity_required"
  /** Self-invite attempted (22023 from SQL or TS pre-check). */
  | "self_invite_denied"
  /** mediaType is not "audio" | "video". */
  | "invalid_media_type"
  /** existingSessionId supplied but not owned by caller (42501). */
  | "session_not_owned"
  /** attachment_url failed the POSIX ERE contract-match (22023). */
  | "attachment_url_required"
  /** mig-133 BEFORE INSERT cap trigger: session already has 4 participants
   *  (P0001). The FOR UPDATE lock in v4 makes this race-safe. */
  | "participant_cap_exceeded"
  /** pre-mig-306 environment: 'call_invite' not in CHECK enum. */
  | "attachment_type_not_available"
  /** RPC returned an unexpected row shape. */
  | "rpc_shape_error"
  /** Input validation failed (UUID shape, media type, self-invite). */
  | "invalid_input";

// ── Result type ───────────────────────────────────────────────────────
export interface InviteToCallV5Result {
  readonly ok: boolean;
  readonly sessionId?: string;
  readonly participantId?: string;
  readonly conversationId?: string;
  readonly messageId?: string;
  /** Set when the invite was a no-op dedup. */
  readonly skipped?: "already_invited" | "attachment_type_not_available";
  readonly error?: InviteToCallV5ErrorCode;
}

// ── Internal RPC row shape ────────────────────────────────────────────
interface RpcRow {
  readonly out_session_id: string | null;
  readonly out_participant_id: string | null;
  readonly out_conversation_id: string | null;
  readonly out_message_id: string | null;
  readonly out_skipped: string | null;
}

// ── Main exported function ────────────────────────────────────────────
/**
 * CANDIDATE wrapper · routes the four `inviteToCall` writes through
 * the v4 combined `nex_invite_to_call_tx` RPC.
 *
 * Not imported by production code. See header for activation path.
 *
 * @param admin  Supabase admin client (or stub in tests).
 * @param input  Call parameters — no selfSupabaseUserId.
 */
export async function inviteToCallV5Candidate(
  admin: AdminLike,
  input: InviteToCallV5Input,
): Promise<InviteToCallV5Result> {
  // ── TypeScript pre-checks (fail-fast before the RPC round-trip) ────
  if (!UUID_SHAPE.test(input.selfAccountId)) {
    return { ok: false, error: "invalid_input" };
  }
  if (!UUID_SHAPE.test(input.inviteeAccountId)) {
    return { ok: false, error: "invalid_input" };
  }
  if (input.selfAccountId === input.inviteeAccountId) {
    return { ok: false, error: "self_invite_denied" };
  }
  if (input.mediaType !== "audio" && input.mediaType !== "video") {
    return { ok: false, error: "invalid_media_type" };
  }
  if (
    input.existingSessionId !== undefined &&
    input.existingSessionId !== null &&
    !UUID_SHAPE.test(input.existingSessionId)
  ) {
    return { ok: false, error: "invalid_input" };
  }

  // ── RPC call · v4 7-param signature (identity from auth.uid()) ─────
  const { data, error } = await admin.rpc("nex_invite_to_call_tx", {
    p_invitee_account_id: input.inviteeAccountId,
    p_media_type: input.mediaType,
    p_host_country: input.hostCountry,
    p_attachment_meta: input.attachmentMeta,
    p_invite_body: input.inviteBody,
    p_attachment_url: input.attachmentUrl,
    p_existing_session_id: input.existingSessionId ?? null,
  });

  // ── Error mapping ──────────────────────────────────────────────────
  if (error) {
    const msg = error.message ?? "";
    const code = error.code ?? "";

    // 42883 · function does not exist — v4 not yet applied.
    // FAIL-CLOSED: no silent fallback to direct writes.
    if (code === "42883" || /function.*does not exist|42883/i.test(msg)) {
      return { ok: false, error: "rpc_unavailable" };
    }

    // Pre-mig-306 CHECK violation on nex_peer_message.attachment_type.
    if (/check constraint|nex_peer_message_attachment_type_check/i.test(msg)) {
      return { ok: false, skipped: "attachment_type_not_available" };
    }

    // 22023 · attachment_url failed POSIX ERE contract-match (v4 guard).
    // Must be tested before the generic 22023 bucket below.
    if (
      /attachment_url_required|call_invite needs a well-formed accept_href/i.test(msg)
    ) {
      return { ok: false, error: "attachment_url_required" };
    }

    // 42501 · caller identity / account resolution failure.
    if (
      /caller_identity_required|caller_account_not_found|42501/i.test(msg) ||
      code === "42501"
    ) {
      return { ok: false, error: "caller_identity_required" };
    }

    // 22023 (self_invite_denied from SQL — belt-and-suspenders).
    if (/self_invite_denied/i.test(msg)) {
      return { ok: false, error: "self_invite_denied" };
    }

    // 22023 (invalid_media_type from SQL).
    if (/invalid_media_type/i.test(msg)) {
      return { ok: false, error: "invalid_media_type" };
    }

    // session_not_owned (42501 from SQL — also caught by 42501 above,
    // but match by name for precision).
    if (/session_not_owned/i.test(msg)) {
      return { ok: false, error: "session_not_owned" };
    }

    // P0001 · mig-133 cap trigger.
    // The FOR UPDATE lock in v4 makes this race-safe, but the trigger
    // is still the hard enforcer. P0001 is the SQLSTATE for RAISE
    // EXCEPTION without a custom ERRCODE.
    if (
      code === "P0001" ||
      /already has 4 participants|participant.*cap/i.test(msg)
    ) {
      return { ok: false, error: "participant_cap_exceeded" };
    }

    // Generic DB error — surface with participant_cap_exceeded only
    // when the message is recognisable; otherwise fall through to
    // a shape/unknown bucket. This is intentionally narrow to avoid
    // masking unexpected errors.
    return { ok: false, error: "rpc_shape_error" };
  }

  // ── Success path ───────────────────────────────────────────────────
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "rpc_shape_error" };
  }

  const row = data[0] as RpcRow;

  // Dedup: participant already invited to this session.
  if (row.out_skipped === "already_invited") {
    return {
      ok: true,
      skipped: "already_invited",
      sessionId: row.out_session_id ?? undefined,
      participantId: row.out_participant_id ?? undefined,
    };
  }

  // Full success: all four IDs must be present.
  if (
    !row.out_session_id ||
    !row.out_participant_id ||
    !row.out_conversation_id ||
    !row.out_message_id
  ) {
    return { ok: false, error: "rpc_shape_error" };
  }

  return {
    ok: true,
    sessionId: row.out_session_id,
    participantId: row.out_participant_id,
    conversationId: row.out_conversation_id,
    messageId: row.out_message_id,
  };
}
