// src/lib/nex-native/calls/group-call-join.v5-candidate.ts
//
// CANDIDATE · FAIL-CLOSED · DEFAULT-OFF · REVIEW REQUIRED · 2026-11-19
// -----------------------------------------------------------------------
// Production code does NOT import this file.
//
// Activation requires ALL of the following (none are authorised as of
// 2026-11-19):
//   1. Owner authorisation naming the target DB
//      (sandbox `kdstoyyeygcopkogqsyv` or prod `ijvqdvsvwtwxzcqmoqit`).
//   2. The candidate SQL
//      `CANDIDATE_nex_call_participant_join_rpc_v5_w3_PREVIEW.sql`
//      promoted to `nex-supabase/migrations/` with a real numeric prefix,
//      matching rollback, and a dedicated `apply-migration-<n>-sandbox.mjs`
//      script.
//   3. A feature flag (planned: `NEX_JOIN_CALL_TX=1`) that routes the
//      existing `joinGroupCallSession` through this wrapper. The existing
//      direct-write path in `group-call-service.ts` remains as a fallback
//      until BROWSER-tier verification passes.
//
// W3 severity note:
//   No grep-confirmed live caller for `joinGroupCallSession` exists in
//   `src/app/` as of 2026-11-19. The W3 severity flag (INSERT-fallback
//   race without FOR UPDATE lock) is THEORETICAL until a live caller is
//   identified. This wrapper is authored for safety-first atomicity; it
//   does not indicate the race has been observed in production.
//
// This file intentionally has no `server-only` import so it can be
// imported into vitest mocked tests without a side-effect. `server-only`
// will be added when this wrapper is activated.
//
// Relationship to other wrappers:
//   This is a SEPARATE file from `invite-service.transactional-candidate.ts`
//   (the v4 / invite-flow wrapper). Both can coexist. This wrapper covers
//   the join-side operation; v4 covers the invite-side operation.

// ── Minimal AdminLike interface ──────────────────────────────────────────
// Only `.rpc()` is required; injected by caller or test so no real Supabase
// client is imported at module resolution time.
interface AdminLike {
  rpc(
    name: string,
    params: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
}

// ── Types ────────────────────────────────────────────────────────────────

export type NexUuid = string;

export type JoinRole = "host" | "guest";
// NOTE: 'cohost' is intentionally excluded. mig-133 defines the participant
// role CHECK as IN ('host', 'guest'). 'cohost' would violate this constraint.
// When the schema CHECK is extended, update this union type and the RPC.

export interface JoinGroupCallSessionV5Input {
  readonly sessionId: NexUuid;
  readonly role?: JoinRole;
}

export interface JoinGroupCallSessionV5Result {
  readonly participantId: NexUuid;
  readonly wasUpdate: boolean;        // true = UPDATE path (pre-invited row existed)
  readonly sessionPromoted: boolean;  // true = session promoted ringing→live
}

// ── Named error classes ───────────────────────────────────────────────────

/** RPC function does not exist in the target DB (42883). The TypeScript
 *  caller should fall back to the legacy `joinGroupCallSession` path. */
export class V5RpcUnavailableError extends Error {
  readonly code = "rpc_unavailable" as const;
  constructor(message = "nex_join_group_call_session_tx not found in DB (42883)") {
    super(message);
    this.name = "V5RpcUnavailableError";
  }
}

/** auth.uid() was NULL or no nex_account matched (42501). */
export class CallerIdentityRequiredError extends Error {
  readonly code = "caller_identity_required" as const;
  constructor(message = "caller identity required (42501)") {
    super(message);
    this.name = "CallerIdentityRequiredError";
  }
}

/** p_role value rejected by the RPC (22023). */
export class InvalidRoleError extends Error {
  readonly code = "invalid_role" as const;
  constructor(message = "invalid role: must be host or guest (22023)") {
    super(message);
    this.name = "InvalidRoleError";
  }
}

/** Session not found or other 22023/42501 input validation failure that
 *  is not a role error. */
export class InvalidSessionError extends Error {
  readonly code = "invalid_session" as const;
  constructor(message = "session not found or invalid input (22023/42501)") {
    super(message);
    this.name = "InvalidSessionError";
  }
}

// ── Internal RPC row shape ───────────────────────────────────────────────

interface RpcRow {
  readonly out_participant_id: string | null;
  readonly out_was_update: boolean;
  readonly out_session_promoted: boolean;
}

// ── Wrapper function ─────────────────────────────────────────────────────

/**
 * CANDIDATE wrapper for `nex_join_group_call_session_tx`.
 *
 * NOT called by production code. Activation requires owner authorisation
 * + feature flag `NEX_JOIN_CALL_TX=1` (see file header).
 *
 * `accountId` is NOT accepted as a parameter; identity is resolved
 * server-side via `auth.uid()` inside the RPC.
 *
 * Returns null only if the RPC returns an empty rowset (unexpected DB
 * condition); all error conditions throw named errors.
 *
 * @throws {V5RpcUnavailableError}       42883 — RPC not applied to this DB
 * @throws {CallerIdentityRequiredError} 42501 — auth.uid() NULL or no account
 * @throws {InvalidRoleError}            22023 role message — bad role value
 * @throws {InvalidSessionError}         22023/42501 non-role — session missing
 */
export async function joinGroupCallSessionV5Candidate(
  admin: AdminLike,
  input: JoinGroupCallSessionV5Input,
): Promise<JoinGroupCallSessionV5Result | null> {
  const { sessionId, role = "guest" } = input;

  const { data, error } = await admin.rpc("nex_join_group_call_session_tx", {
    p_session_id: sessionId,
    p_role: role,
  });

  if (error) {
    const msg = error.message ?? "";
    const code = error.code ?? "";

    // 42883 · RPC not yet applied to this DB · caller should fall back.
    if (code === "42883" || /function.*does not exist|42883/i.test(msg)) {
      throw new V5RpcUnavailableError(msg);
    }

    // 22023 · input validation failure · distinguish role vs session.
    if (code === "22023" || /22023/.test(msg)) {
      if (/invalid_role/i.test(msg)) {
        throw new InvalidRoleError(msg);
      }
      throw new InvalidSessionError(msg);
    }

    // 42501 · caller identity / session-not-found.
    if (code === "42501" || /42501/.test(msg)) {
      if (/session_not_found/i.test(msg)) {
        throw new InvalidSessionError(msg);
      }
      throw new CallerIdentityRequiredError(msg);
    }

    // 23505 · unique_violation at the TS layer.
    // Should NOT reach here because the SQL catches it internally and
    // converts it to was_update=TRUE. If it does arrive, treat as an
    // idempotent join (safe, fail-closed).
    if (code === "23505" || /23505|unique.violation/i.test(msg)) {
      // We cannot reconstruct the participant_id here without a re-fetch.
      // Return null so the caller can decide to fall back to the legacy path.
      return null;
    }

    // All other errors (including P0001 from the 4-cap trigger) → rethrow.
    throw new Error(`joinGroupCallSessionV5Candidate: ${msg}`);
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const row = data[0] as RpcRow;
  if (!row.out_participant_id) {
    return null;
  }

  return {
    participantId: row.out_participant_id,
    wasUpdate: row.out_was_update,
    sessionPromoted: row.out_session_promoted,
  };
}
