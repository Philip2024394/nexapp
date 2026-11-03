// src/lib/nex-native/billing/cancellation.ts
//
// NEX Billing Foundation · cancellation + grace handling.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// Shop and Vault cancellation are INDEPENDENT. Cancelling one does not
// cancel the other.
//
// Two cancel paths:
//   · User-initiated cancellation at Stripe (cancel_at_period_end=true)
//     The sub remains active until period_end · access continues through
//     period_end · then subscription.deleted arrives and we flip to grace.
//   · Immediate cancel (admin override, rare).
//
// On status=cancelled:
//   · access_level() still returns 'full' until period_end
//   · 'full' until GREATEST(period_end, past_due_at + 7d) · typically period_end
//   · 'read-only' for 30 days after that
//   · 'none' after the 30-day grace cutoff
//   · Vault 'read-only' means files still viewable + downloadable, no uploads
//   · Shop 'read-only' means existing products still visible, no new/edit
//
// This module ONLY encapsulates the pure cancel-request intent and the
// Stripe call wiring. The actual state transitions (status=cancelled,
// status=grace, status=expired) are performed by webhook-processor.ts in
// response to Stripe's events. We never flip state locally without a
// webhook · that would race Stripe's source of truth.

import type { BillingStore } from "./store";
import type { NexProduct } from "./types";
import { GRACE_WINDOW_MS, PAST_DUE_RETRY_WINDOW_MS } from "./entitlement";

export interface StripeSubscriptionApi {
  /** Mirror of stripe.subscriptions.update(subId, {cancel_at_period_end:true}). */
  cancelAtPeriodEnd(stripeSubscriptionId: string): Promise<{
    id: string;
    cancelAt: number | null; // unix seconds
    status: string;
  }>;
}

export interface CancelInput {
  readonly nexAccountId: string;
  readonly product: NexProduct;
}

export interface CancelResult {
  readonly ok: true;
  readonly stripeSubscriptionId: string;
  readonly accessUntil: Date | null; // when 'full' ends (null if already none)
  readonly graceUntil: Date | null; // when 'read-only' grace ends
}

export interface CancelRefused {
  readonly ok: false;
  readonly code:
    | "no_subscription"
    | "wrong_product"
    | "stripe_error"
    | "account_not_found";
  readonly reason: string;
}

export async function cancelAtPeriodEnd(
  input: CancelInput,
  store: BillingStore,
  stripe: StripeSubscriptionApi,
): Promise<CancelResult | CancelRefused> {
  const view = await store.readProductView(input.nexAccountId, input.product);
  if (!view) {
    return {
      ok: false,
      code: "account_not_found",
      reason: `No ${input.product} record for account ${input.nexAccountId}`,
    };
  }
  const subId = view.snapshot.stripeSubscriptionId;
  if (!subId) {
    return {
      ok: false,
      code: "no_subscription",
      reason: `No Stripe ${input.product} subscription linked to account`,
    };
  }

  try {
    await stripe.cancelAtPeriodEnd(subId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      code: "stripe_error",
      reason: `Stripe cancel request failed: ${msg}`,
    };
  }

  // We DO NOT patch nex_account state here · we wait for Stripe's webhook
  // (customer.subscription.updated with cancel_at_period_end=true) to call
  // the webhook-processor which flips status='cancelled'. This keeps us
  // honest about Stripe being the source of truth.

  const periodEndMs = view.snapshot.periodEnd?.getTime() ?? null;
  const pastDueMs = view.snapshot.pastDueAt?.getTime() ?? null;
  const fullUntilMs = periodEndMs
    ? Math.max(periodEndMs, (pastDueMs ?? 0) + PAST_DUE_RETRY_WINDOW_MS)
    : null;

  return {
    ok: true,
    stripeSubscriptionId: subId,
    accessUntil: fullUntilMs ? new Date(fullUntilMs) : null,
    graceUntil:
      fullUntilMs !== null ? new Date(fullUntilMs + GRACE_WINDOW_MS) : null,
  };
}

/** Pure calculation · given the current snapshot, when does the user lose
 *  full access, and when does read-only grace expire?
 *  Mirrors the GREATEST(periodEnd, pastDueAt+7d) + 30d rule in
 *  entitlement.ts without re-executing the full access-level decision. */
export function computeCancellationTimeline(input: {
  periodEnd: Date | null;
  pastDueAt: Date | null;
}): { fullAccessUntil: Date | null; graceUntil: Date | null } {
  if (!input.periodEnd) {
    return { fullAccessUntil: null, graceUntil: null };
  }
  const periodEndMs = input.periodEnd.getTime();
  const pastDueCutoffMs = input.pastDueAt
    ? input.pastDueAt.getTime() + PAST_DUE_RETRY_WINDOW_MS
    : 0;
  const fullMs = Math.max(periodEndMs, pastDueCutoffMs);
  return {
    fullAccessUntil: new Date(fullMs),
    graceUntil: new Date(fullMs + GRACE_WINDOW_MS),
  };
}
