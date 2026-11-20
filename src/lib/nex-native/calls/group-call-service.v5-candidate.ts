// src/lib/nex-native/calls/group-call-service.v5-candidate.ts
//
// CANDIDATE WRAPPER · FAIL-CLOSED · DEFAULT-OFF · 2026-11-19
// ============================================================================
// Production code does NOT import this file.
// Activation requires separate authorisation naming the target DB
// (sandbox `kdstoyyeygcopkogqsyv` or prod `ijvqdvsvwtwxzcqmoqit`)
// AND a feature flag flip (planned: `NEX_CREATE_CALL_SESSION_TX=1`)
// that routes `createGroupCallSession` callers through this wrapper.
// Neither the feature flag nor the activation are approved as of 2026-11-19.
//
// This file intentionally has no `server-only` import so it can be
// imported into vitest unit tests without a side-effect error.
// `server-only` will be added when activation is authorised and the
// file is wired into production code.
//
// WHAT THIS WRAPPER DOES
// ----------------------
// Routes the session-creation write path through the PL/pgSQL RPC
// `nex_create_group_call_session_tx` defined in:
//   nex-supabase/candidate-migrations/
//     CANDIDATE_nex_call_session_create_rpc_v5_w2_PREVIEW.sql
//
// The RPC runs the session INSERT + all participant INSERTs inside a
// single DB transaction. If any step fails, the whole transaction rolls
// back — no orphan session rows.
//
// RELATIONSHIP TO v4 CANDIDATE
// ----------------------------
// v4 (`nex_invite_to_call_tx`) covers the INVITE flow (existing session
// or new session + single invitee + peer-message). This wrapper covers
// the SESSION-CREATION flow (new session + host + up to 3 initial
// guests). They are independent and can be applied/activated in any order.
// ADDS-ALONGSIDE v4 — does NOT supersede it.
//
// WHAT IS NOT DONE IN THIS WRAPPER (preserved in group-call-service.ts)
// -----------------------------------------------------------------------
// · resolveNexAppSessionFromContext / dev-impersonation — stays in callers
// · Chat message sending (sendPeerMessage) — stays in callers
// · getOrCreatePeerConversation — stays in callers
// · joinGroupCallSession / leaveGroupCallSession / endGroupCallSession
// · maybeEndSessionIfAllParticipantsLeft
// · linkSessionToCallLink
//
// HOSTACCOUNTID NOTE
// ------------------
// The `hostAccountId` field is included in `CreateGroupCallSessionV5Input`
// for caller-signature compatibility with the existing
// `CreateGroupCallSessionInput` type. However, the server-side RPC
// IGNORES any host account ID passed by the caller — it always derives
// the host from `auth.uid()` via `nex_account.supabase_user_id`. This
// is by design: SECURITY DEFINER prevents impersonation.
// ============================================================================

import type {
  GroupCallSessionRow,
  GroupCallParticipantRow,
  GroupCallMediaType,
} from "./group-call-service";
import type { NexUuid } from "../types";

// ── Minimal admin-client shape (injected at call-site / test) ────────────────
// Only `.rpc()` is required. The real nexSupabaseAdmin satisfies this.
export interface AdminLike {
  rpc(
    name: string,
    params: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
}

// ── Input shape ──────────────────────────────────────────────────────────────
export interface CreateGroupCallSessionV5Input {
  /**
   * Included for signature compatibility with CreateGroupCallSessionInput.
   * The server-side RPC IGNORES this value — it derives the host from
   * auth.uid(). Do not rely on this field having any effect server-side.
   */
  hostAccountId: NexUuid;
  mediaType: GroupCallMediaType;
  /** Up to 3 initial guest account IDs. Server enforces the cap. */
  inviteeAccountIds?: NexUuid[];
  /** Optional call-link that spawned this session (nex_call_link.id). */
  fromCallLinkId?: NexUuid | null;
  /** Host's country string (e.g. 'ireland'). */
  hostCountry?: string;
}

// ── Output shape (matches createGroupCallSession return contract) ─────────────
export interface CreateGroupCallSessionV5Result {
  session: GroupCallSessionRow;
  participants: GroupCallParticipantRow[];
  rejectedCount: number;
}

// ── Error classes ─────────────────────────────────────────────────────────────

/**
 * Thrown when `nex_create_group_call_session_tx` does not exist in the
 * target DB (SQLSTATE 42883 · function does not exist). This means the
 * candidate migration has not been applied. The operator should fall back
 * to the direct-write path in `group-call-service.ts`.
 */
export class V5RpcUnavailableError extends Error {
  readonly code = "rpc_unavailable" as const;
  constructor(detail: string) {
    super(`nex_create_group_call_session_tx not found in target DB: ${detail}`);
    this.name = "V5RpcUnavailableError";
  }
}

/**
 * Thrown when auth.uid() is NULL (SQLSTATE 42501 · caller_identity_required).
 * The caller is not authenticated.
 */
export class V5CallerIdentityRequiredError extends Error {
  readonly code = "caller_identity_required" as const;
  constructor(detail: string) {
    super(`caller identity required: ${detail}`);
    this.name = "V5CallerIdentityRequiredError";
  }
}

/**
 * Thrown when the participant cap trigger fires (SQLSTATE P0001 or the
 * trigger's bespoke message text). Maps to the same conceptual bucket
 * as the `error.code === "23505"`-adjacent branch in group-call-service.ts
 * but surfaces with a more specific code so callers can distinguish it.
 */
export class V5ParticipantCapExceededError extends Error {
  readonly code = "participant_cap_exceeded" as const;
  constructor(detail: string) {
    super(`group call participant cap exceeded: ${detail}`);
    this.name = "V5ParticipantCapExceededError";
  }
}

// ── RPC row shape (what the DB RETURNS TABLE produces) ───────────────────────
interface RpcOutRow {
  out_session_id: string | null;
  out_participants: unknown; // JSONB · array of participant objects
  out_rejected_count: number | null;
}

// Shape of a single participant object inside out_participants JSONB array.
// The RPC emits these fields via jsonb_build_object.
interface ParticipantJsonbItem {
  id: string;
  session_id: string;
  account_id: string;
  role: "host" | "guest";
  invited_at: string;
  joined_at: string | null;
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * CANDIDATE · default-off · not wired to any production caller.
 *
 * Routes session creation through `nex_create_group_call_session_tx`.
 * Returns the same shape as `createGroupCallSession` in group-call-service.ts
 * so a future feature-flag switch is a one-line substitution at call-sites.
 *
 * @param admin - An AdminLike client (nexSupabaseAdmin in production; stub in tests)
 * @param input - Session creation parameters
 */
export async function createGroupCallSessionV5Candidate(
  admin: AdminLike,
  input: CreateGroupCallSessionV5Input,
): Promise<CreateGroupCallSessionV5Result> {
  // Server-side .slice(0, 3) mirrors the TS-layer slice in group-call-service.ts.
  // The RPC also caps to 3 as defence-in-depth, but we do it here too so the
  // rejectedCount calculation is consistent on the TS side.
  const rawInvitees = input.inviteeAccountIds ?? [];
  const cappedInvitees = rawInvitees.slice(0, 3);
  const tsCappedRejected = Math.max(0, rawInvitees.length - cappedInvitees.length);

  const { data, error } = await admin.rpc("nex_create_group_call_session_tx", {
    p_media_type:          input.mediaType,
    p_from_call_link_id:   input.fromCallLinkId ?? null,
    p_host_country:        input.hostCountry ?? "",
    p_invitee_account_ids: cappedInvitees,
  });

  // ── Error mapping ──────────────────────────────────────────────────────────
  if (error) {
    const msg = error.message ?? "";
    const code = error.code ?? "";

    // 42883 · function does not exist · RPC not yet applied to this DB
    if (code === "42883" || /function.*does not exist/i.test(msg)) {
      throw new V5RpcUnavailableError(msg);
    }

    // 42501 · caller_identity_required or caller_account_not_found
    if (code === "42501" || /caller_identity_required|caller_account_not_found/i.test(msg)) {
      throw new V5CallerIdentityRequiredError(msg);
    }

    // 22023 · invalid_media_type
    if (code === "22023" || /invalid_media_type/i.test(msg)) {
      const err = new Error(`invalid media type: ${msg}`);
      (err as NodeJS.ErrnoException).code = "22023";
      throw err;
    }

    // P0001 · trigger RAISE EXCEPTION from nex_group_call_participant_cap_tr
    // The trigger message is: "nex_group_call_participant: session <id> already has 4 participants"
    if (code === "P0001" || /already has 4 participants/i.test(msg)) {
      throw new V5ParticipantCapExceededError(msg);
    }

    // All other errors — rethrow with context
    throw new Error(`group-call-service.v5-candidate.createGroupCallSessionV5Candidate: ${msg}`);
  }

  // ── Shape validation ───────────────────────────────────────────────────────
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      "group-call-service.v5-candidate: RPC returned empty rowset (rpc_shape_error)",
    );
  }

  const row = data[0] as RpcOutRow;

  if (!row.out_session_id) {
    throw new Error(
      "group-call-service.v5-candidate: RPC returned null out_session_id (rpc_shape_error)",
    );
  }

  // ── Reconstruct participants from JSONB ────────────────────────────────────
  // The RPC emits participants as a JSONB array of objects built by
  // jsonb_build_object inside the PL/pgSQL function. We trust this JSONB
  // shape because (a) we own the function definition and (b) the shape is
  // stable — it uses only DB columns that have existed since mig-133.
  // If schema changes, this cast will silently produce partial objects, which
  // is surfaced immediately by TypeScript callers at runtime (missing fields).
  // The alternative (re-fetching rows from the DB) would add a round-trip and
  // is unnecessary given the schema-stable guarantee.
  const participantItems: ParticipantJsonbItem[] = Array.isArray(row.out_participants)
    ? (row.out_participants as ParticipantJsonbItem[])
    : [];

  const participants: GroupCallParticipantRow[] = participantItems.map((p) => ({
    id:          p.id,
    session_id:  p.session_id,
    account_id:  p.account_id,
    role:        p.role,
    invited_at:  p.invited_at,
    joined_at:   p.joined_at ?? null,
    // These fields are not emitted by the RPC JSONB (they are NULL at creation
    // time and not needed by the immediate caller). We fill them with the
    // correct DB default so the returned shape is type-compatible.
    left_at:     null,
    removed_by:  null,
  }));

  // The RPC's out_rejected_count reflects DB-side truncation (input array > 3).
  // We also computed tsCappedRejected above (TS-side slice). They should agree.
  // Use the RPC's value as authoritative; fall back to TS value if null.
  const rejectedCount =
    row.out_rejected_count != null
      ? Math.max(row.out_rejected_count, tsCappedRejected)
      : tsCappedRejected;

  // ── Reconstruct the session row ────────────────────────────────────────────
  // The RPC only returns the session ID; we construct a minimal session object
  // from the inputs because the caller only needs `session.id` immediately
  // (to build joinUrl). A full DB re-fetch is omitted to avoid an extra
  // round-trip; callers that need all columns can call getGroupCallSession().
  const session: GroupCallSessionRow = {
    id:               row.out_session_id as NexUuid,
    host_account_id:  "" as NexUuid, // server-side value; not echoed by RPC
    media_type:       input.mediaType,
    state:            "ringing",
    started_at:       new Date().toISOString(),
    live_at:          null,
    ended_at:         null,
    from_call_link_id: input.fromCallLinkId ?? null,
  };

  return { session, participants, rejectedCount };
}
