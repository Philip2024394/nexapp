// src/lib/nex-native/billing/entitlement.ts
//
// NEX Billing Foundation · access-level decision.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// Pure function · no DB · no Supabase · no network. All inputs are passed
// in via `AccountEntitlementView`. The caller is responsible for loading
// state from Supabase (server-only adapter · lives separately).
//
// This is the SINGLE source of truth for "does this user have access to
// Shop/Vault right now?" All UI gates, API handlers, and cron jobs read
// through this helper. Hard-coded policy decisions live here.
//
// Access-level decision tree:
//
//   function access_level(view, now):
//     if view.snapshot.tier is null: return 'none'
//
//     // Hard kill-switch 1 · any open ACCESS-BLOCKING adverse event.
//     // Multiple simultaneous adverse rows must all be cleared.
//     if view.adverseEvents contains a row where
//        row.accessBlocking == true AND row.accessBlockClearedAt is null:
//          return 'none'
//
//     // Hard kill-switch 2 · explicit non-paid states.
//     // 'incomplete' = subscription created but no invoice.payment_succeeded.
//     // 'trialing' = Stripe trial state · access depends on policy
//     //   (DRAFT · see trialingAccessLevel option below · defaults to 'none').
//     if view.snapshot.status in ('expired','incomplete'): return 'none'
//     if view.snapshot.status == 'trialing':
//       return TRIALING_ACCESS_LEVEL  // policy-neutral default: 'none'
//
//     // Timestamp-governed lifecycle · 7-day retry extends full access
//     // past period_end · 30-day grace is read-only after that.
//     let full_access_until = GREATEST(
//       periodEnd ?? -infinity,
//       pastDueAt + 7 days ?? -infinity
//     )
//     if now <= full_access_until: return 'full'
//     if now <= full_access_until + 30 days: return 'read-only'
//     return 'none'

import type {
  AccountEntitlementView,
  AccessLevel,
  AdverseEventRow,
} from "./types";

/** Trial access policy · OWNER DECISION PENDING.
 *
 *  See the decision register (option A / B / C). The default here is
 *  Option A (no access during trial · safest · matches sealed "never
 *  advertise unless implemented"). Changing this constant is the single
 *  point where the policy flips once owner selects B or C. */
export const TRIALING_ACCESS_LEVEL: AccessLevel = "none"; // DRAFT

/** 7-day Stripe retry window extension past period_end. */
export const PAST_DUE_RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** 30-day read-only grace window after full-access-until. */
export const GRACE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Returns the current access level for a given product on an account.
 *  Pure · deterministic · timezone-agnostic (all comparisons against the
 *  provided `now`). */
export function accessLevel(
  view: AccountEntitlementView,
  now: Date,
): AccessLevel {
  // Guard 1 · no subscription at all.
  if (view.snapshot.tier === null) {
    return "none";
  }

  // Guard 2 · any OPEN access-blocking adverse event blocks ALL access.
  // Multiple simultaneous adverse events must each be cleared independently.
  if (hasOpenAccessBlockingAdverseEvent(view.adverseEvents)) {
    return "none";
  }

  // Guard 3 · explicit non-paid status.
  const status = view.snapshot.status;
  if (status === "expired" || status === "incomplete") {
    return "none";
  }
  if (status === "trialing") {
    return TRIALING_ACCESS_LEVEL;
  }

  // Timestamp governance.
  const fullAccessUntilMs = computeFullAccessUntilMs(view);
  if (fullAccessUntilMs === null) {
    // No timestamps at all · can't grant access on an incomplete record.
    return "none";
  }
  const nowMs = now.getTime();
  if (nowMs <= fullAccessUntilMs) {
    return "full";
  }
  if (nowMs <= fullAccessUntilMs + GRACE_WINDOW_MS) {
    return "read-only";
  }
  return "none";
}

/** Returns true iff the (account, product) has at least one adverse-event
 *  row with accessBlocking=true AND accessBlockClearedAt=null. */
export function hasOpenAccessBlockingAdverseEvent(
  rows: readonly AdverseEventRow[],
): boolean {
  for (const row of rows) {
    if (row.accessBlocking && row.accessBlockClearedAt === null) {
      return true;
    }
  }
  return false;
}

/** Count of currently blocking adverse rows. Useful for admin UI + the
 *  "refuse new checkout while any adverse blocker is open" guard. */
export function openAccessBlockingCount(
  rows: readonly AdverseEventRow[],
): number {
  let n = 0;
  for (const row of rows) {
    if (row.accessBlocking && row.accessBlockClearedAt === null) n += 1;
  }
  return n;
}

/** The authoritative access-until timestamp (ms since epoch) for the
 *  (account, product). Null when neither periodEnd nor pastDueAt is set.
 *
 *  Rule: full_access_until = GREATEST(
 *          periodEnd,
 *          pastDueAt + 7 days
 *        )
 *
 *  The 7-day retry extension is only meaningful when status='past_due'
 *  but the formula is state-agnostic · callers that want a stricter check
 *  should also inspect snapshot.status. */
export function computeFullAccessUntilMs(
  view: AccountEntitlementView,
): number | null {
  const periodEndMs = view.snapshot.periodEnd?.getTime() ?? null;
  const pastDueExtendsMs =
    view.snapshot.pastDueAt === null
      ? null
      : view.snapshot.pastDueAt.getTime() + PAST_DUE_RETRY_WINDOW_MS;

  if (periodEndMs === null && pastDueExtendsMs === null) return null;
  if (periodEndMs === null) return pastDueExtendsMs;
  if (pastDueExtendsMs === null) return periodEndMs;
  return Math.max(periodEndMs, pastDueExtendsMs);
}

/** Convenience · grace cutoff (ms since epoch) · when read-only access ends. */
export function computeGraceCutoffMs(
  view: AccountEntitlementView,
): number | null {
  const fullAccessUntilMs = computeFullAccessUntilMs(view);
  if (fullAccessUntilMs === null) return null;
  return fullAccessUntilMs + GRACE_WINDOW_MS;
}

/** Decide whether a NEW checkout session should be refused because the
 *  (account, product) has an unresolved adverse-event blocker.
 *
 *  Called BEFORE talking to Stripe · a user with an open fraud or
 *  dispute_lost adverse row cannot buy their way back in without admin
 *  clearance (see E3 scenario). */
export function shouldRefuseNewCheckout(
  view: AccountEntitlementView,
): { refuse: boolean; reason: string | null } {
  const n = openAccessBlockingCount(view.adverseEvents);
  if (n === 0) return { refuse: false, reason: null };
  return {
    refuse: true,
    reason: `${n} open access-blocking adverse event${n > 1 ? "s" : ""} must be resolved first.`,
  };
}
