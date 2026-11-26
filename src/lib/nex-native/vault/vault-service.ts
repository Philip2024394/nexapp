// src/lib/nex-native/vault/vault-service.ts
//
// vault-service · commercial and access logic for the NEX Vault.
// --------------------------------------------------------------------------
// Cycle-14 F1 (2026-11-25) · the sealed Vault entitlement contract is
// "paid vault_tier OR active 7-day vault_trial_used_at". This module is
// the single source of truth for the decision; `src/app/nex-native/vault/
// page.tsx` delegates its gate to `effectiveVaultAccess` below so the
// page and the service can never disagree about who has Vault access.
// The input type is kept local to this module rather than carved from
// `NexAccountRow` because the shared row type does not yet carry the
// `vault_tier` / `vault_trial_used_at` columns (migrations 207 + 257).
// Callers pass whatever subset of nex_account they have read and the
// service answers correctly whether vault_tier is NULL or absent.

import "server-only";

/** The length of the Vault free trial window in milliseconds. */
const VAULT_TRIAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Minimum column shape `effectiveVaultAccess` requires. */
export interface VaultEntitlementInputs {
  readonly vault_tier: string | null | undefined;
  readonly vault_trial_used_at: string | null | undefined;
}

/**
 * Returns whether the account has active access to the Vault.
 *
 * Uses the "Lazy Downgrade" pattern: checks for a paid tier first,
 * then falls back to checking if the 7-day trial is still active.
 *
 * Shop subscription is deliberately NOT part of this check · owner-
 * sealed 2026-11-25: "NEX Vault must remain separate from Shop
 * subscriptions."
 */
export function effectiveVaultAccess(account: VaultEntitlementInputs): boolean {
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
  account: VaultEntitlementInputs
): Promise<{ ok: true; expiresAt: string } | { ok: false; reason: string }> {
  if (account.vault_trial_used_at) {
    return { ok: false, reason: "trial_already_used" };
  }

  // Note: The actual DB update should be handled by a server action
  // that calls this logic and performs the nexSupabaseAdmin.update.
  return { ok: true, expiresAt: new Date(Date.now() + VAULT_TRIAL_WINDOW_MS).toISOString() };
}
