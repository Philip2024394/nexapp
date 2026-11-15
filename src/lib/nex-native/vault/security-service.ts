// src/lib/nex-native/vault/security-service.ts
//
// Vault security service · Phase 1 · owner-authorised 2026-11-15.
// -----------------------------------------------------------------------------
// Three concerns, one service:
//   1. recordPinAttempt    — insert nex_vault_pin_attempt row + a matching
//                            nex_vault_security_event row for the drawer.
//      Called on every PIN unlock, success or failure, from any route.
//   2. lockout bookkeeping — bumpConsecutiveFailures / resetCounter /
//                            getLockoutStatus. Three-strike rule is
//                            enforced here · routes must call checkLockout
//                            BEFORE attempting the crypto path and bump
//                            the counter AFTER a failure, so a leaked
//                            session cannot race the check.
//   3. security events     — createSecurityEvent / listRecentSecurityEvents
//                            / markSecurityEventsRead. Drives the side
//                            drawer badge + feed.
//
// Zero commercial code. Zero cross-account writes · every function scopes
// by accountId. All writes use the service-role admin client (matches
// pre-existing pin_attempt + recovery_attempt pattern); RLS is left
// disabled on these tables intentionally (see migration 346 header).

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

// Three strikes · owner-sealed 2026-11-15. After this many consecutive
// failures the account enters reset_required state and the PIN entry
// route refuses further attempts until the email reset flow clears it.
export const VAULT_PIN_LOCKOUT_THRESHOLD = 3;

export type AttemptSource = "device_pin" | "account_pin_escrow";

export type VaultSecurityEventType =
  | "pin_attempt_failed"
  | "pin_attempt_success_new_device"
  | "lockout_triggered"
  | "pin_reset_requested"
  | "pin_reset_completed"
  | "device_approved"
  | "device_revoked";

export interface NetworkContext {
  ipAddress: string | null;
  ipCountry: string | null;
  userAgentFamily: string | null;
}

export interface LockoutStatus {
  consecutiveFailures: number;
  attemptsRemaining: number; // never negative
  locked: boolean;
  resetRequired: boolean;
  lockedAt: string | null;
  lastFailureAt: string | null;
}

// -----------------------------------------------------------------------------
// Attempt recording · note on separation of concerns
// -----------------------------------------------------------------------------
// The row insert into `nex_vault_pin_attempt` is owned by the sealed
// pin-rate-limit module's `recordPinAttempt` / `recordRecoveryAttempt`
// helpers · they predate migration 346 and already track a different
// (5-in-15min + 10-in-24h) rate limit. This module LAYERS ON TOP:
//   · network context fields (ip_address, ip_country, user_agent_family,
//     attempt_source) are backfilled via `annotatePinAttemptContext`
//     AFTER the sealed insert · keeps writes atomic enough and avoids
//     duplicating the row.
//   · drawer events are emitted here via `emitPinAttemptEvent`.
// Callers in Phase 2 routes invoke BOTH: the sealed recorder (keeps
// rate-limit working) + this annotation + this event emitter (adds the
// 3-strike lockout + drawer surface).

export async function annotatePinAttemptContext(input: {
  accountId: string;
  deviceId: string;
  success: boolean;
  source: AttemptSource;
  network: NetworkContext;
}): Promise<void> {
  const { accountId, deviceId, success, source, network } = input;

  // Patch the most-recent attempt row for this (account, device, success)
  // combo so we don't accidentally overwrite an earlier attempt that
  // already has context. Scoped update · still account-safe because
  // every filter is account_id-anchored.
  const { data: latest, error: readErr } = await nexSupabaseAdmin
    .from("nex_vault_pin_attempt")
    .select("id")
    .eq("account_id", accountId)
    .eq("device_id", deviceId)
    .eq("success", success)
    .is("attempt_source", null)
    .order("attempted_at", { ascending: false })
    .limit(1);
  if (readErr) {
    throw new Error(`pin_attempt_context_read_failed: ${readErr.message}`);
  }
  const rowId = latest?.[0]?.id as string | undefined;
  if (!rowId) {
    // The sealed recorder didn't insert · nothing to annotate.
    return;
  }
  const { error: updErr } = await nexSupabaseAdmin
    .from("nex_vault_pin_attempt")
    .update({
      ip_address: network.ipAddress,
      ip_country: network.ipCountry,
      user_agent_family: network.userAgentFamily,
      attempt_source: source,
    })
    .eq("id", rowId)
    .eq("account_id", accountId);
  if (updErr) {
    throw new Error(`pin_attempt_context_update_failed: ${updErr.message}`);
  }
}

export async function emitPinAttemptEvent(input: {
  accountId: string;
  deviceId: string;
  success: boolean;
  source: AttemptSource;
  network: NetworkContext;
  isNewDevice?: boolean;
}): Promise<void> {
  const { accountId, deviceId, success, source, network, isNewDevice } = input;
  // Suppress drawer spam on routine same-device success.
  const shouldEmitEvent = !success || isNewDevice === true;
  if (!shouldEmitEvent) return;

  await createSecurityEvent({
    accountId,
    type: success ? "pin_attempt_success_new_device" : "pin_attempt_failed",
    network,
    deviceId,
    details: { source },
  });
}

// -----------------------------------------------------------------------------
// Lockout bookkeeping
// -----------------------------------------------------------------------------

export async function getLockoutStatus(
  accountId: string,
): Promise<LockoutStatus> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_pin_lockout")
    .select(
      "consecutive_failures, last_failure_at, locked_at, reset_required",
    )
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) {
    throw new Error(`lockout_read_failed: ${error.message}`);
  }
  const consecutive = data?.consecutive_failures ?? 0;
  const resetRequired = data?.reset_required ?? false;
  return {
    consecutiveFailures: consecutive,
    attemptsRemaining: Math.max(
      0,
      VAULT_PIN_LOCKOUT_THRESHOLD - consecutive,
    ),
    locked: resetRequired || consecutive >= VAULT_PIN_LOCKOUT_THRESHOLD,
    resetRequired,
    lockedAt: data?.locked_at ?? null,
    lastFailureAt: data?.last_failure_at ?? null,
  };
}

/** Insert or bump the lockout counter. Caller must have just recorded
 *  a failed attempt. Returns the fresh status so the caller can decide
 *  whether to emit the `lockout_triggered` security event. */
export async function bumpLockoutOnFailure(input: {
  accountId: string;
  network: NetworkContext;
}): Promise<LockoutStatus> {
  const { accountId, network } = input;
  const nowIso = new Date().toISOString();

  // Read-modify-write so we can keep the threshold logic in one place.
  // Accepting the small race window: two concurrent failures from the
  // same leaked session might both bump by one. The resulting counter
  // is still monotonically non-decreasing · the user is never LESS
  // locked by concurrency.
  const current = await getLockoutStatus(accountId);
  const nextCount = current.consecutiveFailures + 1;
  const nextReset =
    current.resetRequired || nextCount >= VAULT_PIN_LOCKOUT_THRESHOLD;
  const lockedAt =
    current.lockedAt ??
    (nextCount >= VAULT_PIN_LOCKOUT_THRESHOLD ? nowIso : null);

  const { error } = await nexSupabaseAdmin
    .from("nex_vault_pin_lockout")
    .upsert(
      {
        account_id: accountId,
        consecutive_failures: nextCount,
        first_failure_at:
          current.consecutiveFailures === 0
            ? nowIso
            : undefined /* preserve existing on upsert */,
        last_failure_at: nowIso,
        locked_at: lockedAt,
        reset_required: nextReset,
        updated_at: nowIso,
      },
      { onConflict: "account_id" },
    );
  if (error) {
    throw new Error(`lockout_write_failed: ${error.message}`);
  }

  const emitLockoutEvent =
    !current.locked && nextCount >= VAULT_PIN_LOCKOUT_THRESHOLD;
  if (emitLockoutEvent) {
    await createSecurityEvent({
      accountId,
      type: "lockout_triggered",
      network,
      details: { threshold: VAULT_PIN_LOCKOUT_THRESHOLD },
    });
  }

  return {
    consecutiveFailures: nextCount,
    attemptsRemaining: Math.max(0, VAULT_PIN_LOCKOUT_THRESHOLD - nextCount),
    locked: nextReset || nextCount >= VAULT_PIN_LOCKOUT_THRESHOLD,
    resetRequired: nextReset,
    lockedAt,
    lastFailureAt: nowIso,
  };
}

/** Clear the counter on a successful unlock. Does NOT touch
 *  reset_required · an email-reset flow is the only path out of that
 *  state (Phase 2). If reset_required is true, callers should refuse
 *  the attempt BEFORE reaching here. */
export async function clearLockoutOnSuccess(
  accountId: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await nexSupabaseAdmin
    .from("nex_vault_pin_lockout")
    .upsert(
      {
        account_id: accountId,
        consecutive_failures: 0,
        first_failure_at: null,
        last_failure_at: null,
        locked_at: null,
        // reset_required NOT touched here · see docstring.
        updated_at: nowIso,
      },
      { onConflict: "account_id" },
    );
  if (error) {
    throw new Error(`lockout_clear_failed: ${error.message}`);
  }
}

/** Called by the Phase 2 email-reset-confirm route after the reset
 *  token has been validated. Zeroes the counter AND reset_required. */
export async function clearLockoutAfterReset(
  accountId: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await nexSupabaseAdmin
    .from("nex_vault_pin_lockout")
    .upsert(
      {
        account_id: accountId,
        consecutive_failures: 0,
        first_failure_at: null,
        last_failure_at: null,
        locked_at: null,
        reset_required: false,
        updated_at: nowIso,
      },
      { onConflict: "account_id" },
    );
  if (error) {
    throw new Error(`lockout_reset_failed: ${error.message}`);
  }
}

// -----------------------------------------------------------------------------
// Security events feed (side drawer)
// -----------------------------------------------------------------------------

export async function createSecurityEvent(input: {
  accountId: string;
  type: VaultSecurityEventType;
  network: NetworkContext;
  deviceId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_vault_security_event")
    .insert({
      account_id: input.accountId,
      event_type: input.type,
      ip_address: input.network.ipAddress,
      ip_country: input.network.ipCountry,
      user_agent_family: input.network.userAgentFamily,
      device_id: input.deviceId ?? null,
      details: input.details ?? null,
    });
  if (error) {
    throw new Error(`security_event_insert_failed: ${error.message}`);
  }
}

export interface VaultSecurityEventRow {
  id: string;
  type: VaultSecurityEventType;
  occurredAt: string;
  ipAddress: string | null;
  ipCountry: string | null;
  userAgentFamily: string | null;
  deviceId: string | null;
  details: Record<string, unknown> | null;
  readAt: string | null;
}

export async function listRecentSecurityEvents(input: {
  accountId: string;
  limit?: number;
}): Promise<VaultSecurityEventRow[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 50, 200));
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_security_event")
    .select(
      "id, event_type, occurred_at, ip_address, ip_country, user_agent_family, device_id, details, read_at",
    )
    .eq("account_id", input.accountId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`security_event_list_failed: ${error.message}`);
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    type: r.event_type as VaultSecurityEventType,
    occurredAt: r.occurred_at as string,
    ipAddress: (r.ip_address as string | null) ?? null,
    ipCountry: (r.ip_country as string | null) ?? null,
    userAgentFamily: (r.user_agent_family as string | null) ?? null,
    deviceId: (r.device_id as string | null) ?? null,
    details: (r.details as Record<string, unknown> | null) ?? null,
    readAt: (r.read_at as string | null) ?? null,
  }));
}

export async function markAllSecurityEventsRead(input: {
  accountId: string;
}): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_security_event")
    .update({ read_at: nowIso })
    .eq("account_id", input.accountId)
    .is("read_at", null)
    .select("id");
  if (error) {
    throw new Error(`security_event_mark_read_failed: ${error.message}`);
  }
  return (data ?? []).length;
}

export async function countUnreadSecurityEvents(input: {
  accountId: string;
}): Promise<number> {
  const { count, error } = await nexSupabaseAdmin
    .from("nex_vault_security_event")
    .select("id", { count: "exact", head: true })
    .eq("account_id", input.accountId)
    .is("read_at", null);
  if (error) {
    throw new Error(`security_event_count_failed: ${error.message}`);
  }
  return count ?? 0;
}
