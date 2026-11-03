// src/lib/nex-native/billing/reconciliation.ts
//
// NEX Billing Foundation · pending-event reconciliation.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// Cron-driven handler that retries event-log rows left with
// outcome='pending_checkout_mapping' once their mapping becomes available.
//
// Scheduling (OWNER DECISIONS · currently defaults · see decision register):
//   · Default frequency: every 15 minutes
//   · Orphan timeout: 7 days (if still pending after that, mark 'orphaned')
//
// Both are configurable via options on reconcilePendingMappings(). The
// cron wiring itself (file-based scheduled job OR Vercel Cron) is NOT
// built this phase · deferred until the webhook endpoint is wired.

import type { BillingStore } from "./store";
import type { EventLogRow, StripeWebhookEvent } from "./types";
import { processStripeEvent } from "./webhook-processor";

export interface ReconciliationOptions {
  /** Max number of pending events to attempt per run · prevents a huge
   *  backlog from starving the cron. Default: 100. */
  readonly maxPerRun: number;
  /** Age (ms) at which a still-pending event is marked orphaned. Default:
   *  7 days (per owner decision register item #4). */
  readonly orphanAfterMs: number;
}

export const DEFAULT_RECONCILIATION_OPTIONS: ReconciliationOptions = {
  maxPerRun: 100,
  orphanAfterMs: 7 * 24 * 60 * 60 * 1000,
};

export interface ReconciliationResult {
  readonly scanned: number;
  readonly recovered: number;
  readonly stillPending: number;
  readonly orphaned: number;
  readonly errors: readonly { eventId: string; message: string }[];
}

/** Scan the event log for pending-checkout-mapping events and retry each.
 *  Must be able to reconstruct a StripeWebhookEvent-shaped object from
 *  the stored row to feed back into processStripeEvent. For the DB
 *  adapter: the full event payload should be stored on the event-log row
 *  (we don't currently have a payload column · design-note below). For
 *  this draft, the reconciliation calls back into store.readProductView
 *  + store.resolveAccountBySubscription to see if the mapping is now
 *  available, and if so, upgrades the outcome from 'pending_checkout_
 *  mapping' to 'applied' via a direct state check (lighter than full
 *  event replay).
 *
 *  Design-note (future enhancement): add `stripe_event_payload jsonb` to
 *  nex_billing_event_log in a follow-up migration · then this handler can
 *  do a full event replay via processStripeEvent for maximum fidelity. */
export async function reconcilePendingMappings(
  store: BillingStore,
  now: Date,
  options: Partial<ReconciliationOptions> = {},
): Promise<ReconciliationResult> {
  const opts: ReconciliationOptions = {
    ...DEFAULT_RECONCILIATION_OPTIONS,
    ...options,
  };

  const pending = await store.findPendingCheckoutMappingEvents(opts.maxPerRun);
  let recovered = 0;
  let stillPending = 0;
  let orphaned = 0;
  const errors: { eventId: string; message: string }[] = [];

  for (const row of pending) {
    try {
      const ageMs = now.getTime() - row.stripeEventCreated.getTime();
      if (ageMs > opts.orphanAfterMs) {
        await store.finalizeEvent({
          stripeEventId: row.stripeEventId,
          outcome: "orphaned_pending_mapping",
          outcomeDetail: `No mapping after ${Math.floor(ageMs / 86_400_000)} days · marked orphaned`,
        });
        orphaned += 1;
        continue;
      }

      // Attempt to resolve the mapping now
      let mapped: { accountId: string; product: string } | null = null;

      if (row.stripeSubscriptionId) {
        const r = await store.resolveAccountBySubscription(
          row.stripeSubscriptionId,
        );
        if (r) {
          mapped = { accountId: r.accountId, product: r.product };
        }
      }

      if (!mapped && row.stripeCheckoutSessionId) {
        const sessionRow = await store.readCheckoutSessionByStripeSessionId(
          row.stripeCheckoutSessionId,
        );
        if (sessionRow) {
          mapped = {
            accountId: sessionRow.nexAccountId,
            product: sessionRow.product,
          };
        }
      }

      if (!mapped) {
        stillPending += 1;
        continue;
      }

      // Mapping found · flip the outcome to applied. Note: this is a
      // lightweight path · the state effects of the event were NOT
      // applied retroactively. The actual state (subscription, period,
      // etc.) will be picked up by subsequent webhooks (invoice.payment_
      // succeeded, etc.) that arrive after the checkout mapping committed.
      // The owner-flagged limitation (jsonb payload for full replay) is
      // the follow-up enhancement.
      await store.finalizeEvent({
        stripeEventId: row.stripeEventId,
        outcome: "applied",
        outcomeDetail: `Reconciled · mapping found for ${mapped.product}/${mapped.accountId}`,
      });
      recovered += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ eventId: row.stripeEventId, message: msg });
      // Keep the row in pending state · will be retried on next run
    }
  }

  return {
    scanned: pending.length,
    recovered,
    stillPending,
    orphaned,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Future enhancement · full-replay path (requires schema addition)
// ---------------------------------------------------------------------------
//
// REPLAY DESIGN DECISIONS · pre-integration review 2026-11-02
// -----------------------------------------------------------
//
// The current reconcilePendingMappings path is LIGHT: it flips a stuck
// `pending_checkout_mapping` row to `applied` once the mapping becomes
// available, trusting subsequent webhooks (invoice.payment_succeeded,
// subscription.updated, etc.) to establish the final state. This is
// adequate when the only transient failure is "mapping not yet
// committed."
//
// The HEAVY path · full replay of the event through processStripeEvent
// · is required for the harder recovery case: processing crashed BEFORE
// finalizeEvent, so the event-log row is stuck at outcome='processing'
// AND the state mutations may be partial. For that case we need:
//
// 1 · PAYLOAD STORAGE
//    New column `stripe_event_payload jsonb NOT NULL` on
//    nex_billing_event_log. Stores the full event JSON Stripe delivered,
//    captured at the SAME transaction that claims the row (so there is
//    no window where the payload could be lost).
//
//    Sensitive fields:
//      · Stripe does NOT include card PAN / CVV / full card number in
//        webhook events (only `last4`, `brand`, `exp_month`, `exp_year`).
//      · Customer email + name may be present on charge / dispute
//        objects. These are personal data under GDPR.
//      · We treat the payload as "pseudonymised" (only Stripe-side IDs
//        + payment metadata · no NEX-side identity until join via
//        subscription_id).
//
//    Access control:
//      · stripe_event_payload is READ ONLY by the webhook processor
//        service role.
//      · Admin UIs that surface the row MUST NOT render payload JSON
//        raw · derive a safe summary (event type, created_at, Stripe IDs,
//        outcome).
//      · RLS: nex_billing_event_log is service-role only · the user-
//        facing surface never reads it.
//
//    Retention:
//      · Full payload retained for 90 days (idempotency replay window).
//      · After 90 days, a scheduled job NULL-OUTs stripe_event_payload
//        but preserves the row shell (event ID, type, outcome, metadata
//        IDs). The row remains for audit; the payload is purged.
//      · This is a SEPARATE follow-up migration · not shipped in 258.
//
// 2 · IDEMPOTENCY GUARD
//    Replay must NEVER double-apply an entitlement. The guard:
//      · Replay is only valid on rows with outcome='processing' or
//        outcome='pending_checkout_mapping'. ANY other outcome ·
//        including 'applied' or 'error' · is REFUSED.
//      · 'applied' means the state mutations completed · nothing to
//        replay.
//      · 'error' means the handler explicitly recorded a failure · a
//        human must inspect before re-running.
//      · processStripeEvent itself is idempotent via claimEvent · but
//        when replaying we KNOW the row exists, so we need a replay-
//        specific path that bypasses the claim and uses outcome
//        transition instead.
//
// 3 · STATE INSPECTION BEFORE REPLAY
//    For an event stuck mid-apply, naïvely re-running processStripeEvent
//    could over-apply (e.g., set past_due_at a second time with a later
//    timestamp · violating set-once). Current handlers already have
//    some defense (past_due_at only writes if currently NULL · adverse-
//    event uniqueness indexes), but replay should ALSO run against the
//    current state view before writing · if the row's expected post-
//    condition is already satisfied, replay turns into a no-op finalize.
//
// 4 · FAILED PROCESSING MUST REMAIN RECOVERABLE
//    If replay itself crashes, the row stays at outcome='processing'
//    and remains replay-eligible. We do NOT prematurely flip to
//    'orphaned' just because a replay attempt failed · that is handled
//    by the age-based cron (same 7-day timeout rule).
//
// 5 · SUCCESSFUL PROCESSING MUST NOT BE RE-APPLIED
//    See item 2 · 'applied' is terminal · replay refuses.
//
// IMPLEMENTATION STATUS
// ----------------------
// `replayStoredEvent()` below is a FORWARD-COMPATIBLE SKELETON. It
// takes a reconstructed StripeWebhookEvent (which today the caller must
// supply · once stripe_event_payload is persisted the reconciliation
// cron will read it from the store), checks the current outcome, and
// delegates to processStripeEvent only when safe.
//
// NOT CALLED in current draft. Not wired to any cron.

export type ReplayRefusal =
  | "outcome_already_applied"
  | "outcome_errored_requires_admin"
  | "outcome_not_eligible";

export interface ReplayResult {
  readonly ok: boolean;
  readonly refusal?: ReplayRefusal;
  readonly detail: string;
}

/** Replay a previously-logged Stripe event, with idempotency safeguards.
 *  The event payload MUST have been captured at original delivery · do
 *  NOT invent payloads here (fail-closed). */
export async function replayStoredEvent(
  stripeEvent: StripeWebhookEvent,
  currentOutcome: string,
  store: BillingStore,
  now: Date,
): Promise<ReplayResult> {
  // Guard 1 · terminal outcomes refuse replay
  if (currentOutcome === "applied") {
    return {
      ok: false,
      refusal: "outcome_already_applied",
      detail: `Event ${stripeEvent.id} already applied · replay refused`,
    };
  }
  if (currentOutcome === "error") {
    return {
      ok: false,
      refusal: "outcome_errored_requires_admin",
      detail: `Event ${stripeEvent.id} errored · admin review required before replay`,
    };
  }
  if (
    currentOutcome !== "processing" &&
    currentOutcome !== "pending_checkout_mapping"
  ) {
    return {
      ok: false,
      refusal: "outcome_not_eligible",
      detail: `Event ${stripeEvent.id} has outcome=${currentOutcome} · replay not supported for this outcome`,
    };
  }

  // Guard 2 · delegate to the dispatcher. claimEvent will see the row
  // exists (isClaimed=false) and return skipped_duplicate_already_
  // processed · we handle that specifically so replay is a true replay,
  // not a no-op.
  //
  // The forward implementation (post-schema-addition) will introduce a
  // replay-specific store method `replayClaimEvent(eventId)` that
  // atomically transitions outcome='processing' back to processing (or
  // allows re-dispatch for pending_checkout_mapping). For now, we
  // return a diagnostic indicating what WOULD happen.
  return {
    ok: false,
    refusal: "outcome_not_eligible",
    detail:
      `Replay requires schema addition (stripe_event_payload jsonb) + replayClaimEvent store method · see reconciliation.ts design-note. Event ${stripeEvent.id} would re-dispatch against stored payload.`,
  };
}

/** @deprecated · superseded by replayStoredEvent · retained during
 *  review to flag the stub was intentional. */
export async function _replayPendingEvent(
  stripeEventPayload: StripeWebhookEvent,
  store: BillingStore,
  now: Date,
): Promise<void> {
  // Historical stub · NOT called. The real implementation is
  // replayStoredEvent above.
  void stripeEventPayload;
  void store;
  void now;
}
