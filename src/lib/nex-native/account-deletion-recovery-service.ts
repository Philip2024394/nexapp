// src/lib/nex-native/account-deletion-recovery-service.ts
//
// NEX Account Deletion recovery · HQ-only retry of the Supabase Auth
// deletion step for accounts stuck in half-state (soft-deleted on
// NEX, Auth user still present).
// Owner-authorised 2026-11-08.
// -----------------------------------------------------------------------------
// Scenario
//   The sealed deleteOwnAccount workflow (account-deletion-service.ts)
//   runs steps 1-6 (attempted audit → session invalidation →
//   soft-delete → actor pseudonymisation → Supabase Auth delete →
//   completed audit). If step 5 fails with a real error (not "user
//   not found"), the account is scrubbed on NEX but the Auth user
//   still exists. The user cannot restore their account · it is
//   irreversibly scrubbed · but their Supabase Auth login still
//   works until Auth deletion completes.
//
// Recovery
//   An HQ operator calls retryAccountDeletionAuthStep(hqAccountId,
//   targetAccountId). The function:
//     1. Verifies the target row is soft-deleted (deleted_at set)
//        AND still has supabase_user_id. Refuses any other state.
//     2. Emits security.account.delete.attempted · actor is the HQ
//        operator · metadata.initiator="admin" · metadata.stage=
//        "recovery".
//     3. Calls auth.admin.deleteUser. "Not found" → success. Any
//        other error → failed audit + returns auth_delete_failed.
//     4. Calls nex_account_finalize_deletion (migration 299) to null
//        supabase_user_id · idempotent via deleted_at guard.
//     5. Emits security.account.delete.completed · actor is the HQ
//        operator · metadata.stage="recovery". Fail-loud · if this
//        audit fails the caller must be told so a reconciler surfaces
//        the orphan.
//
// Safety invariants
//   · The HQ server action calls requireHqAdmin BEFORE invoking this
//     service. This service does NOT re-check the HQ role · it
//     trusts the caller. Server-side enforcement is at the entry
//     point (the server action in HQ page).
//   · Never restores identity data. Never clears deleted_at. Never
//     changes display_name back. GDPR pseudonymisation from
//     migration 294 (if 294 is applied and was run during the
//     original attempt) is NOT reversed.
//   · Idempotent · running after a successful recovery sees supabase
//     _user_id NULL and returns { ok: true, already_complete: true }.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import {
  isAuditWriteError,
  recordAuditEvent,
} from "./security-audit-service";

export type RecoveryOutcome =
  | {
      ok: true;
      already_complete?: boolean;
      audit_log_ids?: { attempted: number | null; completed: number | null };
    }
  | {
      ok: false;
      error:
        | "target_not_found"
        | "target_not_soft_deleted"
        | "audit_unavailable"
        | "audit_completion_failed"
        | "auth_delete_failed"
        | "finalize_failed";
      detail?: string;
    };

export interface RetryInput {
  readonly hqAccountId: string;
  readonly targetAccountId: string;
}

export async function retryAccountDeletionAuthStep(
  input: RetryInput,
): Promise<RecoveryOutcome> {
  const { hqAccountId, targetAccountId } = input;

  // Step 1 · inspect target state
  const lookup = await nexSupabaseAdmin
    .from("nex_account")
    .select("supabase_user_id, deleted_at")
    .eq("id", targetAccountId)
    .maybeSingle();
  if (lookup.error || !lookup.data) {
    return { ok: false, error: "target_not_found" };
  }
  const row = lookup.data as {
    supabase_user_id: string | null;
    deleted_at: string | null;
  };
  if (!row.deleted_at) {
    return { ok: false, error: "target_not_soft_deleted" };
  }
  if (!row.supabase_user_id) {
    // Nothing to do · already reconciled (second-run safety).
    return { ok: true, already_complete: true };
  }

  // Step 2 · attempted audit · fail-loud
  let attemptedLogId: number | null = null;
  try {
    const r = await recordAuditEvent({
      event: "security.account.delete.attempted",
      outcome: "attempted",
      actorAccountId: hqAccountId,
      actorIdentity: `acct:${hqAccountId}`,
      targetType: "nex_account",
      targetId: targetAccountId,
      metadata: {
        initiator: "admin",
        stage: "recovery",
      },
    });
    attemptedLogId = r.logId ?? null;
  } catch (auditErr) {
    if (isAuditWriteError(auditErr)) {
      return { ok: false, error: "audit_unavailable", detail: auditErr.message };
    }
    throw auditErr;
  }

  // Step 3 · Supabase Auth delete
  const del = await nexSupabaseAdmin.auth.admin.deleteUser(row.supabase_user_id);
  if (del.error) {
    const msg = del.error.message;
    if (!/not.*found|does not exist/i.test(msg)) {
      void recordAuditEvent({
        event: "security.account.delete.failed",
        outcome: "failed",
        actorAccountId: hqAccountId,
        actorIdentity: `acct:${hqAccountId}`,
        targetType: "nex_account",
        targetId: targetAccountId,
        metadata: {
          error_code: "auth_delete_failed_in_recovery",
          partial_state: "soft_deleted_erased_no_auth_delete",
          stage: "recovery",
        },
      }).catch(() => undefined);
      return { ok: false, error: "auth_delete_failed", detail: msg };
    }
    // "not found" means a prior retry (or concurrent operator) already
    // deleted the Auth row · fall through to finalize.
  }

  // Step 4 · finalize · null supabase_user_id via SECURITY DEFINER
  const fin = await nexSupabaseAdmin.rpc("nex_account_finalize_deletion", {
    _account_id: targetAccountId,
  });
  if (fin.error) {
    const msg = fin.error.message;
    void recordAuditEvent({
      event: "security.account.delete.failed",
      outcome: "failed",
      actorAccountId: hqAccountId,
      actorIdentity: `acct:${hqAccountId}`,
      targetType: "nex_account",
      targetId: targetAccountId,
      metadata: {
        error_code: "finalize_failed",
        partial_state: "soft_deleted_auth_deleted_fk_still_set",
        stage: "recovery",
      },
    }).catch(() => undefined);
    return { ok: false, error: "finalize_failed", detail: msg };
  }

  // Step 5 · completion audit · fail-loud · if THIS fails the auth
  // was deleted and FK nulled but there is no completion record. The
  // orphaned attempted row is surfaced by the reconciler.
  let completedLogId: number | null = null;
  try {
    const r = await recordAuditEvent({
      event: "security.account.delete.completed",
      outcome: "completed",
      actorAccountId: hqAccountId,
      actorIdentity: `acct:${hqAccountId}`,
      targetType: "nex_account",
      targetId: targetAccountId,
      metadata: { stage: "recovery" },
    });
    completedLogId = r.logId ?? null;
  } catch (auditErr) {
    if (isAuditWriteError(auditErr)) {
      return {
        ok: false,
        error: "audit_completion_failed",
        detail:
          "recovery completed but audit completion row did not persist · reconciler will surface the orphan",
      };
    }
    throw auditErr;
  }

  return {
    ok: true,
    audit_log_ids: { attempted: attemptedLogId, completed: completedLogId },
  };
}

// ─── Reader for the HQ page ──────────────────────────────────────────

export interface HalfStateRow {
  readonly account_id: string;
  readonly deleted_at: string;
  readonly deletion_reason: string | null;
}

/** Returns accounts in the half-state (deleted_at set AND supabase
 *  _user_id still set). Caller must be HQ-gated. */
export async function fetchHalfStateAccounts(
  limit = 100,
): Promise<readonly HalfStateRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select("id, deleted_at, deletion_reason")
    .not("deleted_at", "is", null)
    .not("supabase_user_id", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  type Row = { id: string; deleted_at: string; deletion_reason: string | null };
  return ((data ?? []) as Row[]).map((r) => ({
    account_id: r.id,
    deleted_at: r.deleted_at,
    deletion_reason: r.deletion_reason,
  }));
}
