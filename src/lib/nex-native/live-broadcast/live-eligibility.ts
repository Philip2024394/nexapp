// src/lib/nex-native/live-broadcast/live-eligibility.ts
//
// Owner-approved 2026-10-27 · R9 Live-eligibility contract.
//
// Public Live broadcasting is a Shop membership benefit. This helper
// is the SINGLE server-side authority for the question "is this
// account allowed to start a public Live broadcast or publish a
// public seller video?". It is a thin wrapper around the sealed
// `hasShopAccess()` helper (business-trial/entitlements.ts :: K14
// Option β · 2026-10-22) · it does NOT duplicate or reimplement
// tier logic.
//
// What this helper is / is NOT:
//   · IS   the gate used by `/go-live` server shell, `startLive
//           SessionAction`, and `publishUploadedVideo` when
//           `visibility === "public"`.
//   · IS   a pure read of fields already on `nex_account` · zero
//           network/db calls here · callers resolve the account row
//           and hand it in.
//   · IS   trial-aware · Shop trial (business_trial_status="active")
//           grants eligibility, matching the sealed Trial contract.
//   · NOT  a Vault grant · Vault remains governed by the sealed
//           Vault Entitlements Policy 2026-10-20.
//   · NOT  a bitrate / viewer / audience cap · those are architectural
//           and live inside broadcast-engine.ts (MAX_VIEWERS=10 is
//           sealed · do not raise · see cost-safe audit 2026-10-27).
//   · NOT  a fair-use quota check · duration + monthly hours live in
//           a separate `live-fair-use.ts` module when authorised.
//
// Owner directive 2026-10-27 (verbatim):
//   "Shop membership grants seller video uploads and Live
//    broadcasting eligibility. It does not automatically grant
//    Vault, unlimited streaming, unlimited storage, or unlimited
//    viewers."
//
// Server-only · never shipped to the client. Callers that need a
// client-side read of eligibility (e.g. to show the right CTA) go
// through a server action that returns the discriminated-union
// result below.

import "server-only";
import { hasShopAccess } from "../business-trial/entitlements";
import type { NexAccountRow } from "../types";

/** Discriminated-union result · caller branches on `ok` and reads
 *  either `mode` (success) or `reason` (failure). The `reason`
 *  strings are stable · they appear in client UX copy + telemetry. */
export type LiveEligibility =
  | { readonly ok: true; readonly mode: "paid-bisnis" | "paid-pro" | "trial" | "themes-trial" }
  | {
      readonly ok: false;
      readonly reason:
        | "not-signed-in"
        | "free-tier"
        | "trial-expired"
        | "lapsed";
    };

/** The exact Pick of `nex_account` columns this helper reads.
 *  Mirrors `hasShopAccess`'s shape so callers that already have a
 *  full `NexAccountRow` (or the same Pick) can pass straight
 *  through. */
export type LiveEligibilityAccount = Pick<
  NexAccountRow,
  "business_trial_status" | "tier" | "bisnis_expires_at" | "themes_trial_used_at"
>;

/** Resolve eligibility for a given account.
 *
 *  Pass `null` when the caller has no signed-in account (guest) ·
 *  the helper returns `{ ok: false, reason: "not-signed-in" }`.
 *
 *  Pass the account row (or the typed Pick above) otherwise ·
 *  the helper routes the account through `hasShopAccess()` and
 *  classifies the success mode so UX / telemetry can tell paid
 *  from trial from pro. The classification is PURELY diagnostic
 *  · access decisions depend only on `.ok`.
 *
 *  `nowMs` defaults to `Date.now()` · pass a fixed epoch in tests
 *  for deterministic lapsed/trial-expired coverage.
 */
export function resolveLiveEligibility(
  account: LiveEligibilityAccount | null,
  nowMs: number = Date.now(),
): LiveEligibility {
  if (!account) {
    return { ok: false, reason: "not-signed-in" };
  }

  // Delegate the ACCESS decision to the sealed helper. We NEVER
  // re-derive tier semantics in this module · a single source of
  // truth is the whole point.
  const allowed = hasShopAccess(account, nowMs);

  if (!allowed) {
    // Classify the failure so client UX can speak honestly ("your
    // trial ended" vs "you're on the free plan").
    if (
      account.tier === "bisnis" &&
      account.bisnis_expires_at !== null &&
      typeof account.bisnis_expires_at === "string"
    ) {
      const expiresMs = new Date(account.bisnis_expires_at).getTime();
      if (Number.isFinite(expiresMs) && nowMs >= expiresMs) {
        return { ok: false, reason: "lapsed" };
      }
    }
    // Treat BOTH null AND undefined as "never had a trial" · the
    // sealed Supabase `nex_account` schema does not currently carry
    // the `business_trial_status` column (verified read-only on
    // 2026-10-27 against project ijvqdvsvwtwxzcqmoqit), so PostgREST
    // returns `undefined` for this field for every real production
    // account. Without this guard, every ineligible real account
    // would classify as "trial-expired" instead of "free-tier".
    if (
      account.business_trial_status !== null &&
      account.business_trial_status !== undefined &&
      account.business_trial_status !== "active"
    ) {
      // "expired" / "converted" / "cancelled" land here · the
      // reason is "trial-expired" so the client copy can nudge
      // toward conversion rather than show the generic upsell.
      return { ok: false, reason: "trial-expired" };
    }
    return { ok: false, reason: "free-tier" };
  }

  // Classify the success mode. Order matches the "best signal"
  // priority · explicit paid plans trump trials.
  if (account.tier === "pro") {
    return { ok: true, mode: "paid-pro" };
  }
  if (account.tier === "bisnis") {
    return { ok: true, mode: "paid-bisnis" };
  }
  if (account.business_trial_status === "active") {
    return { ok: true, mode: "trial" };
  }
  if (account.themes_trial_used_at) {
    return { ok: true, mode: "themes-trial" };
  }
  // Defensive · if hasShopAccess granted but we can't classify
  // the mode, prefer the paid-bisnis label so metrics don't lie
  // in the other direction.
  return { ok: true, mode: "paid-bisnis" };
}
