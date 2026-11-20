// src/lib/nex-native/calls/roster-authorization.ts
//
// NEX Gate A Connected Matrix §16.48.25 · Lane 1 · shared roster
// authorization guard. Dated 2026-11-20.
//
// Purpose
// -------
// Any service-role read of nex_group_call_participant / nex_group_call_session
// bypasses RLS and therefore needs its own authorization check before it
// returns a roster. This module is the single server-side gate that
// callers (preview page, future RPC wrappers, `listParticipants`) use
// to decide: can this caller see this session's roster?
//
// Caller identity is supplied by the invoking code from the authenticated
// NEX session (resolveNexAppSessionFromContext / resolveSessionWithDevOverride).
// The guard NEVER reads request cookies/headers/body itself — it would
// otherwise need `server-only` and couldn't be unit-tested with injected
// mocks. Callers MUST pass `callerAccountId` from a session they already
// resolved · never from a URL query / form body / client payload.
//
// Decision policy
// ---------------
// A caller may view a session's roster if and only if ONE of:
//   (H) caller is the session's host_account_id (even if no participant row exists — W1 case), OR
//   (P) caller has an active participant row (left_at IS NULL) on this session.
// Anyone else — including a signed-in user who swaps in another session UUID —
// is denied.
//
// Fail-closed
// -----------
// Any DB error, unknown session, or null callerAccountId returns a reason
// code (never throws). Callers treat anything other than `{ ok: true }`
// as "deny, serve the empty-roster view".
//
// Shape of the admin handle
// -------------------------
// Minimal interface so the module can be unit-tested with a stub. The
// real `nexSupabaseAdmin` satisfies this shape.

export type AssertResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "session_not_found"
        | "not_member"
        | "error";
    };

// Minimal admin-client surface the guard uses. Defined narrowly so tests
// can inject a stub without reaching for @supabase/supabase-js types.
export interface RosterAdminLike {
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: string): {
        maybeSingle(): Promise<{
          data: Record<string, unknown> | null;
          error: { message: string } | null;
        }>;
        eq(col: string, val: string): {
          is(col: string, val: null): {
            maybeSingle(): Promise<{
              data: Record<string, unknown> | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };
}

export interface AssertCanViewSessionInput {
  /**
   * Caller's nex_account.id. Resolved by the invoking code from the
   * authenticated server session. Pass `null` when no session.
   */
  callerAccountId: string | null;
  /** nex_group_call_session.id to gate access for. */
  sessionId: string;
  /** Service-role Supabase handle (for lookups that bypass RLS). */
  admin: RosterAdminLike;
}

/**
 * Returns `{ ok: true }` if the caller is either the session host or a
 * non-left participant. Otherwise returns `{ ok: false, reason: ... }`.
 * NEVER throws — a thrown DB error is caught and surfaced as
 * `{ ok: false, reason: "error" }`.
 */
export async function assertCanViewSession(
  input: AssertCanViewSessionInput,
): Promise<AssertResult> {
  const { callerAccountId, sessionId, admin } = input;

  if (!callerAccountId) {
    return { ok: false, reason: "unauthenticated" };
  }

  // 1. Resolve session; need host_account_id to cover the W1 case where
  //    the creator has no participant row (invite-RPC path, mig-357).
  let hostAccountId: string | null = null;
  try {
    const sess = await admin
      .from("nex_group_call_session")
      .select("host_account_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (sess.error) {
      return { ok: false, reason: "error" };
    }
    if (!sess.data) {
      return { ok: false, reason: "session_not_found" };
    }
    const raw = sess.data["host_account_id"];
    hostAccountId = typeof raw === "string" ? raw : null;
  } catch {
    return { ok: false, reason: "error" };
  }

  if (hostAccountId && hostAccountId === callerAccountId) {
    return { ok: true };
  }

  // 2. Membership check · active (non-left) participant row.
  try {
    const part = await admin
      .from("nex_group_call_participant")
      .select("id")
      .eq("session_id", sessionId)
      .eq("account_id", callerAccountId)
      .is("left_at", null)
      .maybeSingle();
    if (part.error) {
      return { ok: false, reason: "error" };
    }
    if (part.data) {
      return { ok: true };
    }
  } catch {
    return { ok: false, reason: "error" };
  }

  return { ok: false, reason: "not_member" };
}
