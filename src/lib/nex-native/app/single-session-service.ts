// src/lib/nex-native/app/single-session-service.ts
//
// Phase 4 · single-session enforcement. Owner-authorised 2026-11-15.
// -----------------------------------------------------------------------------
// Enforces "one user signed into one account at a time".
//
// Backed by migration 348:
//   · public.nex_account.active_single_session_id    uuid NULL
//   · public.nex_session.superseded_at               timestamptz NULL
//   · public.nex_session.superseded_reason           text NULL
//
// Call-sites:
//   1. signInAction (src/app/nex-native/_actions.ts)
//      calls claimSingleSession AFTER the nex_session row has been minted
//      by the session resolver's touchNexSession path. The claim swaps
//      the account's pointer to the fresh session AND marks every other
//      live session on the account as superseded. The returned list of
//      superseded IDs is available if a future phase wants to emit per-
//      site drawer events (Phase 3 already has its own drawer surface
//      and does not depend on this).
//
//   2. resolveFromUser (src/lib/nex-native/app/session.ts) hook
//      calls isSessionSuperseded on the current session key. If true,
//      the resolver returns null (identical behaviour to revoked_at).
//
// Account scoping is non-negotiable:
//   · every write filters by account_id · a supersession on account A
//     cannot touch any session on account B.
//   · the resolver check reads only the row keyed by the current
//     session's sha256(access_token) · it cannot see other accounts.
//
// All reads/writes go through nexSupabaseAdmin (service-role) · matches
// the pattern used by the sealed touchNexSession helper. RLS on
// nex_session is unchanged by this phase.

import "server-only";
import { createHash } from "node:crypto";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

/** sha256 of the input as lowercase hex (64 chars). Matches the
 *  encoding used by session.ts for `supabase_session_key`. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export interface ClaimSingleSessionInput {
  accountId: string;
  /** The nex_session.id of the freshly minted session for this sign-in.
   *  Caller is responsible for ensuring the row exists first (e.g. the
   *  session resolver's touchNexSession has upserted it). */
  nexSessionId: string;
}

export interface ClaimSingleSessionResult {
  /** The session ID now recorded as the account's active single session. */
  activeSessionId: string;
  /** IDs of previously-live sessions that this claim just marked as
   *  superseded. Empty on fresh sign-in (no prior live sessions).
   *  A future caller may emit per-site drawer events from this list. */
  supersededSessionIds: string[];
}

/**
 * Atomically claim the single-session slot for `accountId` with
 * `nexSessionId`. Every OTHER live session on the account is marked
 * superseded in the same pass.
 *
 * Semantics:
 *   · "Live" = revoked_at IS NULL AND superseded_at IS NULL
 *   · The newly claimed session is NOT marked superseded (it is live).
 *   · The account's `active_single_session_id` is set to `nexSessionId`.
 *
 * Idempotent under same inputs: re-claiming with the same nexSessionId
 * on an unchanged state produces no-op side effects (the session is
 * already live, the pointer is already set, no other live sessions to
 * supersede).
 */
export async function claimSingleSession(
  input: ClaimSingleSessionInput,
): Promise<ClaimSingleSessionResult> {
  const { accountId, nexSessionId } = input;
  if (!accountId || !nexSessionId) {
    throw new Error(
      "claimSingleSession: accountId and nexSessionId are required",
    );
  }
  const nowIso = new Date().toISOString();

  // 1 · Mark every OTHER live session on this account as superseded.
  //     Filter rules (all account-scoped):
  //       account_id = $accountId
  //       id != $nexSessionId          (do not supersede ourselves)
  //       superseded_at IS NULL        (don't touch already-superseded)
  //       revoked_at    IS NULL        (don't touch explicitly revoked)
  //     We also return the list of affected IDs so the caller can emit
  //     per-site drawer events if they want to.
  const { data: superseded, error: supersedeErr } = await nexSupabaseAdmin
    .from("nex_session")
    .update({
      superseded_at: nowIso,
      superseded_reason: "single_session_claimed",
    })
    .eq("account_id", accountId)
    .neq("id", nexSessionId)
    .is("superseded_at", null)
    .is("revoked_at", null)
    .select("id");
  if (supersedeErr) {
    throw new Error(
      `single_session_supersede_failed: ${supersedeErr.message}`,
    );
  }

  const supersededSessionIds: string[] = Array.isArray(superseded)
    ? superseded
        .map((r) => (r as { id?: unknown }).id)
        .filter((v): v is string => typeof v === "string")
    : [];

  // 2 · Point the account at the new active session. Scoped by
  //     account_id · no service-role writes to other accounts.
  const { error: pointerErr } = await nexSupabaseAdmin
    .from("nex_account")
    .update({ active_single_session_id: nexSessionId })
    .eq("id", accountId);
  if (pointerErr) {
    throw new Error(
      `single_session_pointer_failed: ${pointerErr.message}`,
    );
  }

  return { activeSessionId: nexSessionId, supersededSessionIds };
}

/**
 * Read-only check used by the session resolver. Returns true when the
 * session row identified by `nexSessionId` has `superseded_at` set.
 *
 * Returns false when:
 *   · the session row does not exist (treated as "not superseded"; the
 *     caller's own existence/validity checks will handle missing rows)
 *   · the row exists and superseded_at IS NULL
 *
 * Never throws for "not found" · on actual DB errors it throws so the
 * caller (session.ts) can log and fail-open (same convention as the
 * sibling revoked_at check).
 */
export async function isSessionSuperseded(
  nexSessionId: string,
): Promise<boolean> {
  if (!nexSessionId) return false;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_session")
    .select("superseded_at")
    .eq("id", nexSessionId)
    .maybeSingle();
  if (error) {
    throw new Error(`single_session_read_failed: ${error.message}`);
  }
  if (!data) return false;
  const supersededAt = (data as { superseded_at?: string | null })
    .superseded_at;
  return supersededAt !== null && supersededAt !== undefined;
}

/**
 * Convenience helper used by session.ts to check supersession when it
 * has an account_id + supabase_session_key (sha256 hex) pair but not
 * a nex_session.id. Scoped to (account_id, supabase_session_key) so a
 * supersession on another account cannot ever return true here.
 */
export async function isSessionSupersededByKey(input: {
  accountId: string;
  supabaseSessionKey: string;
}): Promise<boolean> {
  const { accountId, supabaseSessionKey } = input;
  if (!accountId || !supabaseSessionKey) return false;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_session")
    .select("superseded_at")
    .eq("account_id", accountId)
    .eq("supabase_session_key", supabaseSessionKey)
    .maybeSingle();
  if (error) {
    throw new Error(`single_session_read_failed: ${error.message}`);
  }
  if (!data) return false;
  const supersededAt = (data as { superseded_at?: string | null })
    .superseded_at;
  return supersededAt !== null && supersededAt !== undefined;
}
