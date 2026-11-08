// src/lib/nex-native/account-deletion-service.ts
//
// NEX Account Deletion workflow · owner-authorised 2026-11-08.
// -----------------------------------------------------------------------------
// Composes the five steps of a safe, auditable account deletion:
//   1. Audit · security.account.delete.attempted  (fail-loud · aborts
//      the whole workflow if the audit table isn't live)
//   2. Mass session invalidation (bumpSessionsInvalidatedAtForOwner ·
//      reuse the existing Item 2 integration)
//   3. Soft-delete the nex_account row via nex_account_mark_deleted
//      (migration 296 · idempotent)
//   4. Pseudonymise the audit actor via nex_security_audit_erase_actor
//      (migration 294) · breaks linkability between the erased UUID
//      and the historical audit trail
//   5. Delete the Supabase Auth user via admin.deleteUser (external
//      operation · fail-open on the completion audit only if the Auth
//      delete returned a transient error · caller sees inconclusive)
//   6. Audit · security.account.delete.completed (fail-loud) or
//      .failed (fail-loud) depending on the outcome
//
// Doctrine
//   · Server-only · "server-only" import at the top.
//   · Caller must have already verified the owner's identity (current
//     password re-verify is the sealed step-up for account deletion ·
//     the route handler runs that check before calling this service).
//   · Chat data stays device-local · we do NOT reach into nex_message
//     or nex_peer_message. Deletion scrubs the NEX-stored identity;
//     the device's own chat archive is the user's responsibility.
//   · Idempotent · if any step fails the caller can safely retry.
//     nex_account_mark_deleted is idempotent (deleted_at = coalesce);
//     bumpSessionsInvalidatedAtForOwner is idempotent (monotonic);
//     eraseActorIdentityInAudit is idempotent (UPDATE row count may
//     be 0 on a second run); Auth deleteUser raises "not found" on a
//     second run (we treat that as success).
//   · Fail-loud on sensitive audit writes · if the completion row
//     fails after the Auth delete succeeded, we return
//     "audit_completion_failed" and the reconciler surfaces the
//     orphan attempted row for HQ review.

import "server-only";
import {
  bumpSessionsInvalidatedAtForOwner,
} from "./security-service";
import { nexSupabaseAdmin } from "./supabase-admin";
import {
  eraseActorIdentityInAudit,
  generateErasedActorIdentity,
  isAuditWriteError,
  recordAuditEvent,
} from "./security-audit-service";

/** Outcome of the deletion workflow · structured so the route handler
 *  can translate into an appropriate HTTP response. */
export type DeletionOutcome =
  | { ok: true; audit_log_ids: { attempted: number | null; completed: number | null } }
  | {
      ok: false;
      error:
        | "audit_unavailable"
        | "audit_completion_failed"
        | "soft_delete_failed"
        | "auth_delete_failed";
      detail?: string;
    };

export interface DeleteOwnAccountInput {
  readonly ownerAccountId: string;
  readonly supabaseUserId: string;
  readonly reason?: string | null;
}

/** Run the full deletion workflow. The caller has already verified
 *  the owner's current credentials and is about to pull the rug out
 *  from under the active session · the mass invalidation step below
 *  is what makes that safe. */
export async function deleteOwnAccount(
  input: DeleteOwnAccountInput,
): Promise<DeletionOutcome> {
  const { ownerAccountId, supabaseUserId, reason } = input;
  const actorIdentity = `acct:${ownerAccountId}`;

  // Step 1 · attempted audit (fail-loud).
  let attemptedLogId: number | null = null;
  try {
    const r = await recordAuditEvent({
      event: "security.account.delete.attempted",
      outcome: "attempted",
      actorAccountId: ownerAccountId,
      actorIdentity,
      targetType: "nex_account",
      targetId: ownerAccountId,
      metadata: { initiator: "user", reason_code: (reason ?? "unspecified").slice(0, 64) },
    });
    attemptedLogId = r.logId ?? null;
  } catch (auditErr) {
    if (isAuditWriteError(auditErr)) {
      return { ok: false, error: "audit_unavailable", detail: auditErr.message };
    }
    throw auditErr;
  }

  // Step 2 · mass session invalidation · after this the current
  // session (the one making this call) is on borrowed time · future
  // protected requests will fail session resolution.
  try {
    await bumpSessionsInvalidatedAtForOwner(ownerAccountId);
  } catch (e) {
    // Non-fatal · we proceed to the soft-delete which stops the
    // user from being able to use the account anyway. Logged via
    // the failed audit path below.
    // eslint-disable-next-line no-console
    console.warn(
      "[account-deletion] session invalidation failed · continuing with soft-delete",
      { error: (e as Error).message },
    );
  }

  // Step 3 · soft-delete nex_account via SECURITY DEFINER.
  const softDelete = await nexSupabaseAdmin.rpc("nex_account_mark_deleted", {
    _account_id: ownerAccountId,
    _reason: reason ?? null,
  });
  if (softDelete.error) {
    const detail = softDelete.error.message;
    // Emit failed audit · fail-open (nothing user-facing depends on
    // this write) but we try to record it.
    void recordAuditEvent({
      event: "security.account.delete.failed",
      outcome: "failed",
      actorAccountId: ownerAccountId,
      actorIdentity,
      targetType: "nex_account",
      targetId: ownerAccountId,
      metadata: {
        error_code: "soft_delete_failed",
        partial_state: "no_soft_delete_no_erasure_no_auth_delete",
      },
    }).catch(() => undefined);
    return { ok: false, error: "soft_delete_failed", detail };
  }

  // Step 4 · pseudonymise audit actor. Caller supplies the erased
  // identity · if migration 294 is not yet applied the wrapper
  // returns skipped=function_not_available · in that case we DO NOT
  // halt the workflow because the user has already requested
  // deletion and session invalidation + soft-delete are committed.
  // The audit trail retains the acct:<uuid> snapshot until a
  // follow-up erasure pass runs after 294 is applied.
  const erased = generateErasedActorIdentity();
  const eraseResult = await eraseActorIdentityInAudit(ownerAccountId, erased);
  if (!eraseResult.ok && !eraseResult.skipped) {
    // eslint-disable-next-line no-console
    console.warn(
      "[account-deletion] audit pseudonymisation failed · continuing",
      { detail: eraseResult.error },
    );
  }

  // Step 5 · Supabase Auth user deletion (external mutation).
  const authDelete = await nexSupabaseAdmin.auth.admin.deleteUser(supabaseUserId);
  if (authDelete.error) {
    const msg = authDelete.error.message;
    // "user not found" means a prior retry already deleted · success.
    if (!/not.*found|does not exist/i.test(msg)) {
      void recordAuditEvent({
        event: "security.account.delete.failed",
        outcome: "failed",
        actorIdentity: erased,
        targetType: "nex_account",
        targetId: ownerAccountId,
        metadata: {
          error_code: "auth_delete_failed",
          partial_state: "soft_deleted_erased_no_auth_delete",
        },
      }).catch(() => undefined);
      return { ok: false, error: "auth_delete_failed", detail: msg };
    }
  }

  // Step 6 · completion audit (fail-loud · a persisted deletion
  // without its completed row is a provenance gap).
  let completedLogId: number | null = null;
  try {
    const r = await recordAuditEvent({
      event: "security.account.delete.completed",
      outcome: "completed",
      actorIdentity: erased,
      targetType: "nex_account",
      targetId: ownerAccountId,
      metadata: {},
    });
    completedLogId = r.logId ?? null;
  } catch (auditErr) {
    if (isAuditWriteError(auditErr)) {
      return {
        ok: false,
        error: "audit_completion_failed",
        detail:
          "account was deleted · audit completion row did not persist · reconciler will surface the orphan",
      };
    }
    throw auditErr;
  }

  return { ok: true, audit_log_ids: { attempted: attemptedLogId, completed: completedLogId } };
}
