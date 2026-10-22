// src/lib/nex-native/business-trial/entitlements.ts
//
// G1 · K14 Option β · Separate Shop-only trial entitlement model.
// ===============================================================
//
// Why this exists (sealed per owner authorisation 2026-10-22):
//   The Business Trial MUST NOT elevate `effectiveTier()` to `'bisnis'`.
//   An active Themes Trial does elevate it (migration 089 unchanged).
//   The Business Trial unlocks ONLY the Shop surface.
//
// Reader contract:
//   Shop code calls `effectiveTrialEntitlements(account)` and reads
//   the `.shop` boolean. Non-Shop code (Vault · premium Themes · premium
//   Intros · P1 verified badge · P2 boosted messages · P3 cancel-anytime)
//   reads `effectiveTier()` ONLY, never this helper.
//
// Explicit allowlist · Business Trial unlocks ONLY `.shop`. Every other
// field is explicitly `false` when the trial is active. This is tested
// by negative-access tests T20-T25.

import "server-only";
import type { NexAccountRow } from "../types";

/** Per-feature entitlement shape (K14 Option β).
 *  Each field explicitly denies non-Shop surfaces during trial state. */
export interface NexBusinessTrialEntitlements {
  /** Shop surface entitlement · ONLY field the Business Trial grants. */
  readonly shop: boolean;
  /** Vault access · always false during Business Trial · Vault governed
   *  exclusively by the sealed Vault Entitlements Policy. */
  readonly vault: boolean;
  /** Premium Theme application · always false · themes governed by
   *  nex_theme_ownership (migration 194). */
  readonly themes_premium: boolean;
  /** Premium Intro features · always false · intros governed by
   *  Three-Product DRAFT (not yet sealed). */
  readonly intros_premium: boolean;
  /** P1 verified badge · always false · deferred per Package Contract DRAFT. */
  readonly p1_verified: boolean;
  /** P2 boosted messages · always false · deferred. */
  readonly p2_boosted: boolean;
  /** P3 cancel-anytime · always false · deferred. */
  readonly p3_cancel: boolean;
}

/** Returns the per-feature entitlement shape for the current trial state.
 *
 *  Rule (K14 Option β · sealed owner authorisation 2026-10-22):
 *    When `business_trial_status === 'active'`, `shop` is TRUE and every
 *    other field is FALSE. In every other state (NULL · converted · expired),
 *    `shop` is also FALSE (converted accounts receive Shop access via the
 *    normal `effectiveTier()` → 'bisnis' path, not via trial entitlements).
 *
 *  This helper is PURE · it reads only `business_trial_status`.
 *  It does NOT read `business_trial_end_at` because the service layer
 *  guarantees that `business_trial_status='active'` is cleared by the
 *  future G4 cron at expiry. If `effectiveTier()`-aware callers need
 *  a time-correct view, they should also inspect `effectiveTier()`.
 */
export function effectiveTrialEntitlements(
  account: Pick<NexAccountRow, "business_trial_status">,
): NexBusinessTrialEntitlements {
  const isTrialActive = account.business_trial_status === "active";
  return {
    shop: isTrialActive,
    vault: false,
    themes_premium: false,
    intros_premium: false,
    p1_verified: false,
    p2_boosted: false,
    p3_cancel: false,
  };
}

/** Helper for Shop-related gates. Returns true if the account should
 *  receive Shop entitlement either via paid tier OR via active trial.
 *  Non-Shop gates MUST NOT consume this helper · they read effectiveTier()
 *  directly and ignore trial state. */
export function hasShopAccess(
  account: Pick<NexAccountRow, "business_trial_status" | "tier" | "bisnis_expires_at" | "themes_trial_used_at">,
  nowMs: number = Date.now(),
): boolean {
  // Active Business Trial grants Shop
  if (account.business_trial_status === "active") {
    return true;
  }
  // Paid Bisnis tier grants Shop (unlapsed)
  if (account.tier === "bisnis" || account.tier === "pro") {
    if (!account.bisnis_expires_at) {
      // Paid plans without expiry (e.g. pro) · grant
      return account.tier === "pro";
    }
    const expiresMs = new Date(account.bisnis_expires_at).getTime();
    if (nowMs < expiresMs) {
      return true;
    }
  }
  // Active themes-trial elevates effectiveTier() to 'bisnis' which
  // grants Shop. We check themes-trial here to match the sealed
  // elevation behaviour (K1 themes-trial unchanged).
  if (account.themes_trial_used_at) {
    const trialStartMs = new Date(account.themes_trial_used_at).getTime();
    const trialEndMs = trialStartMs + 168 * 60 * 60 * 1000;
    if (nowMs < trialEndMs) {
      return true;
    }
  }
  return false;
}
