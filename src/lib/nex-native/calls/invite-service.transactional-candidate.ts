// src/lib/nex-native/calls/invite-service.transactional-candidate.ts
//
// UNACTIVATED candidate wrapper · REVIEW REQUIRED · 2026-11-19 (§16.33)
// -----------------------------------------------------------------------------
// Production code does NOT import this file. It is a reviewable
// candidate for the TypeScript side of the inviteToCall atomicity
// fix. The paired database object (SECURITY DEFINER PL/pgSQL
// function `nex_invite_to_call_tx`) lives at
// `nex-supabase/candidate-migrations/C001_nex_group_call_invite_transactional.sql`
// and is UNAPPLIED.
//
// Activation requires (see candidate-migrations/README-UNAPPLIED.md):
//   1. Owner authorisation naming the target DB (sandbox
//      kdstoyyeygcopkogqsyv or prod ijvqdvsvwtwxzcqmoqit).
//   2. The candidate SQL moved to `nex-supabase/migrations/` with a
//      real numeric prefix + matching rollback + a dedicated
//      `apply-migration-<n>-sandbox.mjs` script.
//   3. A feature flag (planned: `NEX_INVITE_CALL_TX=1`) that routes
//      the existing `inviteToCall` through this wrapper · the
//      existing direct-write path remains as a fallback until
//      BROWSER-tier verification passes.
//
// This file intentionally has no `server-only` import so it can be
// imported into vitest mocked tests without a side-effect.
// Production callers will route through the shared invite-service
// entry point (not this file) once the feature flag is live · at
// which point `server-only` will be added.
//
// What this wrapper does NOT do (preserved in `invite-service.ts`)
//   · Rate limiting · stays in `enforceRateLimit` before the RPC call.
//   · Freeze-guard / participant-of-conversation check · the SQL
//     path does not re-implement sendPeerMessage's TypeScript
//     invariants · they are enforced BEFORE we would call the RPC
//     by reusing the current `inviteToCall` prelude up to the writes.
//   · Push notification · fail-soft post-RPC in the service layer.
//   · Pre-306 CHECK handling · identical regex to today.

// Minimal SupabaseAdmin shape · we only need `.rpc()` + `.from()`
// for the error-mapping branches. The real client is injected at
// activation time; this candidate accepts it as an argument so the
// tests can hand in a stub.
interface AdminLike {
  rpc(
    name: string,
    params: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
}

export type CallMediaType = "audio" | "video";

export interface InviteToCallTxInput {
  readonly selfSupabaseUserId: string;
  readonly inviteeAccountId: string;
  readonly mediaType: CallMediaType;
  readonly hostCountry: string;
  readonly attachmentMeta: Record<string, unknown>;
  readonly inviteBody: string;
  readonly existingSessionId?: string | null;
}

export type InviteToCallTxErrorCode =
  | "caller_identity_mismatch"
  | "caller_account_not_found"
  | "self_invite_denied"
  | "invalid_media_type"
  | "session_not_owned"
  | "participant_insert_failed"
  | "conversation_create_failed"
  | "message_insert_failed"
  | "attachment_type_not_available"
  | "rpc_shape_error"
  | "rpc_unavailable";

export interface InviteToCallTxResult {
  readonly ok: boolean;
  readonly sessionId?: string;
  readonly participantId?: string;
  readonly conversationId?: string;
  readonly messageId?: string;
  readonly skipped?: "already_invited" | "attachment_type_not_available";
  readonly error?: InviteToCallTxErrorCode;
}

interface RpcRow {
  readonly out_session_id: string | null;
  readonly out_participant_id: string | null;
  readonly out_conversation_id: string | null;
  readonly out_message_id: string | null;
  readonly out_skipped: string | null;
}

/** CANDIDATE wrapper · routes the four current `inviteToCall`
 *  writes through a single PL/pgSQL function. Not imported by
 *  production code. */
export async function inviteToCallTransactionalCandidate(
  admin: AdminLike,
  input: InviteToCallTxInput,
): Promise<InviteToCallTxResult> {
  const { data, error } = await admin.rpc("nex_invite_to_call_tx", {
    p_self_supabase_user_id: input.selfSupabaseUserId,
    p_invitee_account_id: input.inviteeAccountId,
    p_media_type: input.mediaType,
    p_host_country: input.hostCountry,
    p_attachment_meta: input.attachmentMeta,
    p_invite_body: input.inviteBody,
    p_existing_session_id: input.existingSessionId ?? null,
  });

  if (error) {
    const msg = error.message ?? "";
    // Pre-306 CHECK regex · identical to the direct-insert path.
    if (/check constraint|nex_peer_message_attachment_type_check/i.test(msg)) {
      return { ok: false, skipped: "attachment_type_not_available" };
    }
    // Function missing · the RPC has not been applied to this DB.
    // The TypeScript caller is expected to fall back to the legacy
    // direct-write path when it receives this code (controlled by
    // the planned feature flag).
    if (/function.*does not exist|42883/i.test(msg)) {
      return { ok: false, error: "rpc_unavailable" };
    }
    if (/caller_identity_mismatch/.test(msg)) {
      return { ok: false, error: "caller_identity_mismatch" };
    }
    if (/caller_account_not_found/.test(msg)) {
      return { ok: false, error: "caller_account_not_found" };
    }
    if (/self_invite_denied/.test(msg)) {
      return { ok: false, error: "self_invite_denied" };
    }
    if (/invalid_media_type/.test(msg)) {
      return { ok: false, error: "invalid_media_type" };
    }
    if (/session_not_owned/.test(msg)) {
      return { ok: false, error: "session_not_owned" };
    }
    // Participant 4-cap trigger surfaces as a RAISE EXCEPTION ·
    // generic bucket.
    return { ok: false, error: "message_insert_failed" };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "rpc_shape_error" };
  }
  const row = data[0] as RpcRow;

  if (row.out_skipped === "already_invited") {
    return {
      ok: true,
      sessionId: row.out_session_id ?? undefined,
      participantId: row.out_participant_id ?? undefined,
      skipped: "already_invited",
    };
  }

  if (!row.out_session_id || !row.out_participant_id || !row.out_conversation_id || !row.out_message_id) {
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
