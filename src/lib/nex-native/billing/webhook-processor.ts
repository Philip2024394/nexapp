// src/lib/nex-native/billing/webhook-processor.ts
//
// NEX Billing Foundation · Stripe webhook event processor.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// Pure(ish) event dispatcher. Takes a parsed Stripe event + a BillingStore
// implementation + a time source. Returns the resulting EventOutcome.
//
// Honours the design decisions:
//   1. Atomic claim via store.claimEvent (INSERT ON CONFLICT DO NOTHING
//      RETURNING under the hood).
//   2. customer.subscription.created DOES NOT grant paid access · sets
//      status='incomplete' · waits for invoice.payment_succeeded.
//   3. Checkout verified via durable DB row BEFORE Stripe metadata.
//   4. Stale-subscription events skipped.
//   5. Multiple simultaneous adverse events each produce a separate row.
//   6. Lost disputes close the Stripe side but DO NOT clear access.
//   7. Partial refunds never block access · logged as historical.
//   8. Full refund of OLDER paid period · blocking=false (historical) when
//      a later paid period is intact · blocking=true otherwise.
//   9. Event arriving before checkout mapping · logged outcome=
//      'pending_checkout_mapping' and reconciled later by reconciliation.ts.
//  10. Shop and Vault are independent · product is derived from
//      store.resolveAccountBySubscription so no cross-product writes.
//
// Signature verification is caller's responsibility (lives in the API
// route handler · see stripe-signature.ts · not built this phase). This
// module assumes the event has already been verified.

import type {
  StripeWebhookEvent,
  EventOutcome,
  NexProduct,
  SubscriptionStatus,
  AdverseType,
  DisputeStripeStatus,
  ShopTier,
  VaultTier,
} from "./types";
import type { BillingStore } from "./store";
import type { PriceRegistry } from "./price-registry";

export interface ProcessEventResult {
  readonly outcome: EventOutcome;
  readonly outcomeDetail: string | null;
}

/** Options parameter for processStripeEvent · forward-compatible. */
export interface ProcessEventOptions {
  /** Price registry · optional. If omitted, tier resolution falls back
   *  to defensive null (fail-closed · tier stays null · caller surfaces
   *  the misconfiguration). Tests inject a registry; production code
   *  passes `getPriceRegistry()`. */
  readonly priceRegistry?: PriceRegistry;
}

/** Process one Stripe webhook event. Returns the outcome actually recorded.
 *  Idempotent: safe to call with duplicate deliveries · the store's atomic
 *  claim ensures only one call applies the state change. */
export async function processStripeEvent(
  event: StripeWebhookEvent,
  store: BillingStore,
  now: Date,
  options: ProcessEventOptions = {},
): Promise<ProcessEventResult> {
  // 1 · Extract Stripe identifiers from the event payload (narrow slice)
  const ids = extractStripeIds(event);

  // 2 · Resolve the (account, product) · may be null for events we can't
  //      map to an account yet (e.g., checkout.session.completed before
  //      the local row is written · handled below)
  let resolved: { accountId: string; product: NexProduct } | null = null;
  if (ids.subscriptionId) {
    resolved = await store.resolveAccountBySubscription(ids.subscriptionId);
  }

  // 3 · Atomic claim · duplicates are naturally skipped at the DB layer
  const claim = await store.claimEvent({
    stripeEventId: event.id,
    stripeEventType: event.type,
    stripeEventCreated: new Date(event.created * 1000),
    stripeApiVersion: event.apiVersion,
    stripeCustomerId: ids.customerId,
    stripeSubscriptionId: ids.subscriptionId,
    stripeInvoiceId: ids.invoiceId,
    stripePaymentIntentId: ids.paymentIntentId,
    stripeChargeId: ids.chargeId,
    stripeDisputeId: ids.disputeId,
    stripeRefundId: ids.refundId,
    stripeCheckoutSessionId: ids.checkoutSessionId,
    invoicePeriodStart: ids.invoicePeriodStart,
    invoicePeriodEnd: ids.invoicePeriodEnd,
    nexAccountId: resolved?.accountId ?? null,
    product: resolved?.product ?? null,
  });

  if (!claim.isClaimed) {
    return {
      outcome: "skipped_duplicate_already_processed",
      outcomeDetail: `Stripe event ${event.id} already claimed · no-op.`,
    };
  }

  // 4 · Dispatch by event type · each handler decides outcome + state
  let result: ProcessEventResult;
  try {
    switch (event.type) {
      case "checkout.session.completed":
        result = await handleCheckoutSessionCompleted(event, ids, store);
        break;
      case "customer.subscription.created":
        result = await handleSubscriptionCreated(
          event,
          ids,
          resolved,
          store,
          options.priceRegistry,
        );
        break;
      case "customer.subscription.updated":
        result = await handleSubscriptionUpdated(event, ids, resolved, store);
        break;
      case "customer.subscription.deleted":
        result = await handleSubscriptionDeleted(event, ids, resolved, store);
        break;
      case "invoice.payment_succeeded":
        result = await handleInvoicePaymentSucceeded(event, ids, resolved, store);
        break;
      case "invoice.payment_failed":
        result = await handleInvoicePaymentFailed(event, ids, resolved, store, now);
        break;
      case "charge.refunded":
        result = await handleChargeRefunded(event, ids, resolved, store);
        break;
      case "charge.dispute.created":
        result = await handleDisputeCreated(event, ids, resolved, store);
        break;
      case "charge.dispute.closed":
        result = await handleDisputeClosed(event, ids, resolved, store, now);
        break;
      // Round 31a2 · Stripe Connect side · updates nex_business row
      // owning the account_id. Does NOT touch nex_account subscription
      // state (different domain). Fail-soft when account_id doesn't
      // match any NEX business.
      case "account.updated": {
        const { handleConnectAccountUpdatedEvent } = await import(
          "./stripe-connect-service"
        );
        const obj = (event.data as { object?: unknown }).object as
          | {
              id?: string;
              charges_enabled?: boolean;
              payouts_enabled?: boolean;
              country?: string | null;
              requirements?: { currently_due?: string[] } | null;
            }
          | undefined;
        if (!obj?.id) {
          result = {
            outcome: "error",
            outcomeDetail: "account.updated · missing account id in payload",
          };
          break;
        }
        const connectResult = await handleConnectAccountUpdatedEvent({
          id: obj.id,
          charges_enabled: obj.charges_enabled,
          payouts_enabled: obj.payouts_enabled,
          country: obj.country ?? null,
          requirements: obj.requirements ?? null,
        });
        if (connectResult.ok) {
          result = {
            outcome: "applied",
            outcomeDetail: `Connect account.updated · business=${connectResult.businessId} · charges_enabled=${connectResult.charges_enabled}`,
          };
        } else {
          const connectReason = connectResult.reason;
          result = {
            outcome:
              connectReason === "no_business_for_account" ? "applied" : "error",
            outcomeDetail: `Connect account.updated · ${connectReason}`,
          };
        }
        break;
      }
      default:
        result = {
          outcome: "applied",
          outcomeDetail: `Unhandled event type: ${event.type} (logged for audit)`,
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result = { outcome: "error", outcomeDetail: msg };
  }

  // 5 · Finalize the event log row with the computed outcome
  await store.finalizeEvent({
    stripeEventId: event.id,
    outcome: result.outcome,
    outcomeDetail: result.outcomeDetail,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Event-specific handlers
// ---------------------------------------------------------------------------

interface StripeIds {
  readonly customerId: string | null;
  readonly subscriptionId: string | null;
  readonly invoiceId: string | null;
  readonly paymentIntentId: string | null;
  readonly chargeId: string | null;
  readonly disputeId: string | null;
  readonly refundId: string | null;
  readonly checkoutSessionId: string | null;
  readonly invoicePeriodStart: Date | null;
  readonly invoicePeriodEnd: Date | null;
}

function extractStripeIds(event: StripeWebhookEvent): StripeIds {
  const o = event.data.object;
  const g = (key: string): string | null => {
    const v = (o as Record<string, unknown>)[key];
    return typeof v === "string" ? v : null;
  };
  const date = (key: string): Date | null => {
    const v = (o as Record<string, unknown>)[key];
    return typeof v === "number" ? new Date(v * 1000) : null;
  };
  return {
    customerId: g("customer"),
    subscriptionId:
      g("subscription") ?? (event.type.startsWith("customer.subscription.") ? g("id") : null),
    invoiceId: g("invoice") ?? (event.type.startsWith("invoice.") ? g("id") : null),
    paymentIntentId: g("payment_intent"),
    chargeId: g("charge") ?? (event.type.startsWith("charge.") ? g("id") : null),
    disputeId: event.type.startsWith("charge.dispute.") ? g("id") : null,
    refundId: event.type === "charge.refunded" ? extractRefundId(o) : null,
    checkoutSessionId:
      event.type.startsWith("checkout.session.") ? g("id") : null,
    invoicePeriodStart: date("period_start"),
    invoicePeriodEnd: date("period_end"),
  };
}

function extractRefundId(object: Record<string, unknown>): string | null {
  // Stripe charge.refunded puts the refund in the `refunds.data[]` array ·
  // we take the most recent one as the triggering refund.
  const refunds = object.refunds as
    | { data?: Array<{ id?: string }> }
    | undefined;
  const latest = refunds?.data?.[refunds.data.length - 1];
  return typeof latest?.id === "string" ? latest.id : null;
}

async function handleCheckoutSessionCompleted(
  event: StripeWebhookEvent,
  ids: StripeIds,
  store: BillingStore,
): Promise<ProcessEventResult> {
  const sessionId = ids.checkoutSessionId;
  if (!sessionId) {
    return {
      outcome: "error",
      outcomeDetail: "checkout.session.completed has no session id",
    };
  }
  // Look up our durable row by Stripe session ID (which was recorded by
  // the create-checkout-session server action BEFORE this webhook could
  // fire). If the row doesn't exist, EITHER the server action's commit
  // was delayed OR we're seeing a session we never created.
  const row = await store.readCheckoutSessionByStripeSessionId(sessionId);
  if (!row) {
    return {
      outcome: "pending_checkout_mapping",
      outcomeDetail:
        `No local checkout_session row for Stripe session ${sessionId} · reconciliation will retry.`,
    };
  }

  // Capture subscription + customer on the row. Do NOT provision access
  // yet · wait for invoice.payment_succeeded.
  const o = event.data.object as Record<string, unknown>;
  const subId = typeof o.subscription === "string" ? o.subscription : null;
  const custId = typeof o.customer === "string" ? o.customer : null;

  await store.updateCheckoutSession(row.internalSessionId, {
    stripeCheckoutSessionId: sessionId,
    stripeCustomerId: custId,
    stripeSubscriptionId: subId,
    status: "completed",
    completedAt: new Date(event.created * 1000),
  });

  // Pre-bind the subscription/customer on nex_account so later events can
  // resolve by subscription_id. Tier is set at subscription.created · we
  // DO NOT set status='active' here (payment not yet confirmed).
  if (subId !== null) {
    await store.updateProductSubscription(row.nexAccountId, row.product, {
      stripeCustomerId: custId,
      stripeSubscriptionId: subId,
      // tier is set at subscription.created · don't overwrite here
    });
  }

  return {
    outcome: "applied",
    outcomeDetail: `Checkout session ${sessionId} verified · awaiting payment confirmation.`,
  };
}

async function handleSubscriptionCreated(
  event: StripeWebhookEvent,
  ids: StripeIds,
  resolved: { accountId: string; product: NexProduct } | null,
  store: BillingStore,
  priceRegistry: PriceRegistry | undefined,
): Promise<ProcessEventResult> {
  if (!resolved) {
    return {
      outcome: "pending_checkout_mapping",
      outcomeDetail:
        `No account mapped to subscription ${ids.subscriptionId} · reconciliation will retry.`,
    };
  }
  const o = event.data.object as Record<string, unknown>;
  const items = o.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
  const priceId = items?.data?.[0]?.price?.id ?? null;
  const resolvedTier = resolveTierFromPriceId(
    resolved.product,
    priceId,
    priceRegistry,
  );
  if (priceId !== null && resolvedTier === null) {
    // Fail-closed · we received a subscription with a price we don't
    // recognise. Do NOT assign any entitlement. Log the event with a
    // specific outcome so an operator can investigate.
    return {
      outcome: "error",
      outcomeDetail:
        `Subscription ${ids.subscriptionId} references unknown Stripe price ID · tier not assigned. Review billing/price-registry configuration.`,
    };
  }
  const tier = resolvedTier;
  const stripeStatus = typeof o.status === "string" ? o.status : null;

  // customer.subscription.created · status may be 'incomplete' (card auth
  // pending) OR 'trialing' (Stripe-managed trial). Only invoice.payment_
  // succeeded flips to 'active'.
  const status: SubscriptionStatus =
    stripeStatus === "trialing" ? "trialing" : "incomplete";

  await store.updateProductSubscription(resolved.accountId, resolved.product, {
    tier,
    status,
    stripePriceId: priceId,
    stripeSubscriptionId: ids.subscriptionId,
    stripeCustomerId: ids.customerId,
    // periodEnd set by invoice.payment_succeeded (not here · we don't trust
    // a period until we see a successful payment)
  });

  return {
    outcome: "applied",
    outcomeDetail: `Subscription ${ids.subscriptionId} created · status=${status} · access not yet granted.`,
  };
}

async function handleSubscriptionUpdated(
  event: StripeWebhookEvent,
  ids: StripeIds,
  resolved: { accountId: string; product: NexProduct } | null,
  store: BillingStore,
): Promise<ProcessEventResult> {
  if (!resolved) {
    return {
      outcome: "skipped_unknown_sub",
      outcomeDetail: `No account for subscription ${ids.subscriptionId}`,
    };
  }
  const o = event.data.object as Record<string, unknown>;
  const cancelAtPeriodEnd = o.cancel_at_period_end === true;
  if (cancelAtPeriodEnd) {
    // User scheduled cancellation at period end · keep paid access until
    // period_end then transition to grace via subscription.deleted
    await store.updateProductSubscription(resolved.accountId, resolved.product, {
      status: "cancelled",
    });
    return {
      outcome: "applied",
      outcomeDetail: `Subscription ${ids.subscriptionId} will cancel at period end.`,
    };
  }
  return {
    outcome: "applied",
    outcomeDetail: `Subscription ${ids.subscriptionId} updated (no state change).`,
  };
}

async function handleSubscriptionDeleted(
  event: StripeWebhookEvent,
  ids: StripeIds,
  resolved: { accountId: string; product: NexProduct } | null,
  store: BillingStore,
): Promise<ProcessEventResult> {
  if (!resolved) {
    return {
      outcome: "skipped_unknown_sub",
      outcomeDetail: `No account for subscription ${ids.subscriptionId}`,
    };
  }
  // Transition to grace (read-only until period_end + 30 days per entitlement rule)
  await store.updateProductSubscription(resolved.accountId, resolved.product, {
    status: "grace",
  });
  return {
    outcome: "applied",
    outcomeDetail: `Subscription ${ids.subscriptionId} deleted · status=grace`,
  };
}

async function handleInvoicePaymentSucceeded(
  event: StripeWebhookEvent,
  ids: StripeIds,
  resolved: { accountId: string; product: NexProduct } | null,
  store: BillingStore,
): Promise<ProcessEventResult> {
  if (!resolved) {
    return {
      outcome: "pending_checkout_mapping",
      outcomeDetail: `No account for subscription ${ids.subscriptionId} · will retry`,
    };
  }
  const o = event.data.object as Record<string, unknown>;
  const periodEnd = typeof o.period_end === "number" ? new Date(o.period_end * 1000) : null;
  // First invoice payment OR renewal · both flip to active + clear past_due
  await store.updateProductSubscription(resolved.accountId, resolved.product, {
    status: "active",
    periodEnd,
    pastDueAt: null,
  });
  return {
    outcome: "applied",
    outcomeDetail: `Invoice ${ids.invoiceId} paid · status=active`,
  };
}

async function handleInvoicePaymentFailed(
  event: StripeWebhookEvent,
  ids: StripeIds,
  resolved: { accountId: string; product: NexProduct } | null,
  store: BillingStore,
  now: Date,
): Promise<ProcessEventResult> {
  if (!resolved) {
    return {
      outcome: "skipped_unknown_sub",
      outcomeDetail: `No account for subscription ${ids.subscriptionId}`,
    };
  }
  // Read current view · past_due_at is set ONCE (never regresses on repeat
  // failed-renewal attempts)
  const view = await store.readProductView(resolved.accountId, resolved.product);
  const pastDueAt = view?.snapshot.pastDueAt ?? null;
  await store.updateProductSubscription(resolved.accountId, resolved.product, {
    status: "past_due",
    pastDueAt: pastDueAt ?? now, // set-once semantics
  });
  return {
    outcome: "applied",
    outcomeDetail: `Payment failed on invoice ${ids.invoiceId} · status=past_due`,
  };
}

async function handleChargeRefunded(
  event: StripeWebhookEvent,
  ids: StripeIds,
  resolved: { accountId: string; product: NexProduct } | null,
  store: BillingStore,
): Promise<ProcessEventResult> {
  if (!resolved) {
    return {
      outcome: "skipped_unknown_sub",
      outcomeDetail: `No account for charge ${ids.chargeId}`,
    };
  }
  const o = event.data.object as Record<string, unknown>;
  const amount = typeof o.amount === "number" ? o.amount : 0;
  const amountRefunded = typeof o.amount_refunded === "number" ? o.amount_refunded : 0;
  const isFull = amount > 0 && amountRefunded >= amount;

  if (!isFull) {
    // Partial refund · log historical only (never blocks)
    await store.insertAdverseEvent({
      nexAccountId: resolved.accountId,
      product: resolved.product,
      adverseType: "partial_refund",
      stripeSubscriptionId: ids.subscriptionId,
      stripeInvoiceId: ids.invoiceId,
      stripePaymentIntentId: ids.paymentIntentId,
      stripeChargeId: ids.chargeId,
      stripeDisputeId: null,
      stripeRefundId: ids.refundId,
      invoicePeriodStart: ids.invoicePeriodStart,
      invoicePeriodEnd: ids.invoicePeriodEnd,
      stripeDisputeStatus: null,
      stripeDisputeClosedAt: null,
      accessBlocking: false,
      openedByEventId: event.id,
      adminActionId: null,
    });
    return {
      outcome: "skipped_partial_refund_historical",
      outcomeDetail: `Partial refund ${ids.refundId} · logged historical only`,
    };
  }

  // Full refund · access-blocking only if the target period is the CURRENT
  // paid period (not an older one that has been superseded by a later paid
  // period)
  const view = await store.readProductView(resolved.accountId, resolved.product);
  const currentPeriodEnd = view?.snapshot.periodEnd ?? null;
  const targetPeriodEnd = ids.invoicePeriodEnd;
  const isOlderPeriod =
    targetPeriodEnd !== null &&
    currentPeriodEnd !== null &&
    targetPeriodEnd.getTime() < currentPeriodEnd.getTime();

  await store.insertAdverseEvent({
    nexAccountId: resolved.accountId,
    product: resolved.product,
    adverseType: "full_refund",
    stripeSubscriptionId: ids.subscriptionId,
    stripeInvoiceId: ids.invoiceId,
    stripePaymentIntentId: ids.paymentIntentId,
    stripeChargeId: ids.chargeId,
    stripeDisputeId: null,
    stripeRefundId: ids.refundId,
    invoicePeriodStart: ids.invoicePeriodStart,
    invoicePeriodEnd: ids.invoicePeriodEnd,
    stripeDisputeStatus: null,
    stripeDisputeClosedAt: null,
    accessBlocking: !isOlderPeriod, // historical when older period, blocking otherwise
    openedByEventId: event.id,
    adminActionId: null,
  });

  return {
    outcome: "applied",
    outcomeDetail: isOlderPeriod
      ? `Full refund of older period ${targetPeriodEnd?.toISOString()} · historical (not blocking)`
      : `Full refund of current period · access blocked`,
  };
}

async function handleDisputeCreated(
  event: StripeWebhookEvent,
  ids: StripeIds,
  resolved: { accountId: string; product: NexProduct } | null,
  store: BillingStore,
): Promise<ProcessEventResult> {
  if (!resolved) {
    return {
      outcome: "skipped_unknown_sub",
      outcomeDetail: `No account for dispute ${ids.disputeId}`,
    };
  }
  await store.insertAdverseEvent({
    nexAccountId: resolved.accountId,
    product: resolved.product,
    adverseType: "dispute_pending",
    stripeSubscriptionId: ids.subscriptionId,
    stripeInvoiceId: ids.invoiceId,
    stripePaymentIntentId: ids.paymentIntentId,
    stripeChargeId: ids.chargeId,
    stripeDisputeId: ids.disputeId,
    stripeRefundId: null,
    invoicePeriodStart: ids.invoicePeriodStart,
    invoicePeriodEnd: ids.invoicePeriodEnd,
    stripeDisputeStatus: "pending",
    stripeDisputeClosedAt: null,
    accessBlocking: true,
    openedByEventId: event.id,
    adminActionId: null,
  });
  return {
    outcome: "applied",
    outcomeDetail: `Dispute ${ids.disputeId} opened · access blocked`,
  };
}

async function handleDisputeClosed(
  event: StripeWebhookEvent,
  ids: StripeIds,
  resolved: { accountId: string; product: NexProduct } | null,
  store: BillingStore,
  now: Date,
): Promise<ProcessEventResult> {
  if (!ids.disputeId || !resolved) {
    return {
      outcome: "skipped_unknown_sub",
      outcomeDetail: `Missing dispute ID or account for dispute.closed`,
    };
  }
  const o = event.data.object as Record<string, unknown>;
  const stripeStatus =
    typeof o.status === "string" ? (o.status as DisputeStripeStatus) : "other";

  const openRow = await store.findOpenAdverseByDisputeId(ids.disputeId);
  if (!openRow) {
    return {
      outcome: "applied",
      outcomeDetail: `Dispute ${ids.disputeId} close event received · no matching open adverse row (already resolved)`,
    };
  }

  // Stripe-side resolution ALWAYS recorded. Access-side clearing ONLY on
  // 'won'. 'lost' leaves access blocked (requires admin to clear).
  const closedAt = new Date(event.created * 1000);
  if (stripeStatus === "won") {
    await store.updateDisputeStripeResolution({
      adverseEventId: openRow.id,
      stripeDisputeStatus: "won",
      stripeDisputeClosedAt: closedAt,
      // Keep adverseType = 'dispute_pending' · we're clearing the block
    });
    await store.clearAdverseEvent({
      adverseEventId: openRow.id,
      clearedAt: now,
      clearedBy: "dispute_won",
    });
    return {
      outcome: "applied",
      outcomeDetail: `Dispute ${ids.disputeId} won · access block cleared`,
    };
  }
  if (stripeStatus === "lost") {
    await store.updateDisputeStripeResolution({
      adverseEventId: openRow.id,
      stripeDisputeStatus: "lost",
      stripeDisputeClosedAt: closedAt,
      adverseType: "dispute_lost", // upgrade adverse type · still blocking
    });
    // Deliberately do NOT clearAdverseEvent · access remains blocked
    return {
      outcome: "applied",
      outcomeDetail: `Dispute ${ids.disputeId} lost · access STILL blocked (admin must clear)`,
    };
  }
  // Other closures (warning_closed, charge_refunded, etc.) · record only
  await store.updateDisputeStripeResolution({
    adverseEventId: openRow.id,
    stripeDisputeStatus: stripeStatus,
    stripeDisputeClosedAt: closedAt,
  });
  return {
    outcome: "applied",
    outcomeDetail: `Dispute ${ids.disputeId} closed · status=${stripeStatus}`,
  };
}

/** Resolve a Stripe price ID to a (product, tier) using the configured
 *  registry. Returns null if the registry is absent, if the price ID is
 *  unknown, or if the resolved product does not match the expected
 *  product (defense-in-depth · the sub was already resolved to a product
 *  via resolveAccountBySubscription · the price must agree). */
function resolveTierFromPriceId(
  expectedProduct: NexProduct,
  priceId: string | null,
  registry: PriceRegistry | undefined,
): ShopTier | VaultTier | null {
  if (priceId === null) return null;
  if (!registry) return null;
  const resolved = registry.resolveTierForPriceId(priceId);
  if (resolved === null) return null;
  if (resolved.product !== expectedProduct) return null;
  return resolved.tier;
}

/** Admin API: revoke access via fraud/admin adverse event.
 *  Not called from webhooks · exposed here so admin UI (future) can import
 *  from the same module.
 */
export async function adminRevokeAccess(
  input: {
    accountId: string;
    product: NexProduct;
    reason: "fraud" | "admin";
    adminActionId: string;
  },
  store: BillingStore,
): Promise<{ inserted: boolean; detail: string }> {
  const row = await store.insertAdverseEvent({
    nexAccountId: input.accountId,
    product: input.product,
    adverseType: input.reason,
    stripeSubscriptionId: null,
    stripeInvoiceId: null,
    stripePaymentIntentId: null,
    stripeChargeId: null,
    stripeDisputeId: null,
    stripeRefundId: null,
    invoicePeriodStart: null,
    invoicePeriodEnd: null,
    stripeDisputeStatus: null,
    stripeDisputeClosedAt: null,
    accessBlocking: true,
    openedByEventId: null,
    adminActionId: input.adminActionId,
  });
  if (!row) {
    return {
      inserted: false,
      detail: `Admin action ${input.adminActionId} already recorded (dedupe)`,
    };
  }
  return {
    inserted: true,
    detail: `Admin ${input.reason} revocation inserted · access blocked`,
  };
}

/** Admin API: clear a fraud/admin revocation. Refuses to clear a
 *  dispute/refund adverse event · those have their own resolution paths. */
export async function adminClearRevocation(
  input: {
    adverseEventId: string;
    adverseType: AdverseType;
    now: Date;
  },
  store: BillingStore,
): Promise<{ cleared: boolean; detail: string }> {
  if (input.adverseType !== "fraud" && input.adverseType !== "admin" && input.adverseType !== "dispute_lost") {
    return {
      cleared: false,
      detail: `Cannot admin-clear adverse_type=${input.adverseType} · only fraud, admin, or dispute_lost`,
    };
  }
  const ok = await store.clearAdverseEvent({
    adverseEventId: input.adverseEventId,
    clearedAt: input.now,
    clearedBy: "admin",
  });
  return {
    cleared: ok,
    detail: ok
      ? `Admin cleared adverse event ${input.adverseEventId}`
      : `Adverse event ${input.adverseEventId} not found or already cleared`,
  };
}
