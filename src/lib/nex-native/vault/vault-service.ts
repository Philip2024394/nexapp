// src/lib/nex-native/vault/vault-service.ts
//
// vault-service · commercial and access logic for the NEX Vault.
// --------------------------------------------------------------------------

import "server-only";

/**
 * Shape of the Vault-entitlement fields this service expects on an
 * account row.
 *
 * Note (2026-11-06 · scope reduction Phase 4): the Vault Entitlements
 * Policy is LOCKED decisions-only and the `vault_tier` /
 * `vault_trial_used_at` columns are NOT yet present on `nex_account`.
 * This local shape makes the file typecheck without asserting that
 * the columns live on `NexAccountRow` — once the migration lands and
 * `NexAccountRow` is updated, callers can pass a `Pick<NexAccountRow,
 * "vault_tier" | "vault_trial_used_at">` here directly.
 */
export interface VaultEntitlementRow {
  vault_tier?: string | null;
  vault_trial_used_at?: string | null;
}

/** The length of the Vault free trial window in milliseconds. */
const VAULT_TRIAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Returns whether the account has active access to the Vault.
 *
 * Uses the "Lazy Downgrade" pattern: checks for a paid tier first,
 * then falls back to checking if the 7-day trial is still active.
 */
export function effectiveVaultAccess(account: VaultEntitlementRow): boolean {
  // 1. Paid access (any tier other than 'gratis')
  if (account.vault_tier && account.vault_tier !== "gratis") {
    return true;
  }

  // 2. Trial access ( Lazy check: used_at + 7 days > now)
  if (account.vault_trial_used_at) {
    const startMs = new Date(account.vault_trial_used_at).getTime();
    if (!Number.isFinite(startMs)) return false;
    return startMs + VAULT_TRIAL_WINDOW_MS > Date.now();
  }

  return false;
}

/**
 * Activates the one-shot 7-day Vault trial for an account.
 * Returns the expiry timestamp if successful.
 */
export async function activateVaultTrial(
  account: VaultEntitlementRow
): Promise<{ ok: true; expiresAt: string } | { ok: false; reason: string }> {
  if (account.vault_trial_used_at) {
    return { ok: false, reason: "trial_already_used" };
  }

  // Note: The actual DB update should be handled by a server action
  // that calls this logic and performs the nexSupabaseAdmin.update.
  return { ok: true, expiresAt: new Date(Date.now() + VAULT_TRIAL_WINDOW_MS).toISOString() };
}
