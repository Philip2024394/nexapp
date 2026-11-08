// src/lib/nex-native/billing/types.ts
//
// NEX Billing Foundation · shared types.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// Types in this module describe the SHAPE of the data stored on
// nex_account + nex_billing_event_log + nex_billing_adverse_event +
// nex_billing_checkout_session. The actual Supabase persistence lives in
// server-only modules that read these types. The pure logic (entitlement
// decision, webhook event processing) consumes these types without any
// Supabase binding so vitest can exercise it with in-memory stubs.

export type NexProduct = "shop" | "vault";

/** NEX Shop package. Migration 257 CHECK originally allowed
 *  ('standard','unlimited') for the 3-tier model. Owner-sealed 2026-11-08
 *  Scope Reduction collapses this to a single `shop` tier · migration 310
 *  extends the CHECK to accept all three (new 'shop' + grandfathered
 *  'standard' | 'unlimited' for any historical rows). Round 30 (2026-11-08)
 *  makes 'shop' the canonical new value · all new subscriptions write 'shop'. */
export type ShopTier = "shop" | "standard" | "unlimited";

/** NEX Vault storage tier. 257 CHECK · code mirrors. */
export type VaultTier = "gratis" | "5gb" | "25gb" | "50gb" | "100gb";

/** Subscription lifecycle status. 258 extends 257's enum with
 *  'incomplete' (subscription created · no successful payment) and
 *  'trialing' (Stripe trial · access per policy decision). */
export type SubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "grace"
  | "cancelled"
  | "expired";

/** Access decision returned by entitlement.access_level(). */
export type AccessLevel = "full" | "read-only" | "none";

/** Adverse-event type (nex_billing_adverse_event.adverse_type CHECK). */
export type AdverseType =
  | "full_refund"
  | "partial_refund"
  | "dispute_pending"
  | "dispute_lost"
  | "fraud"
  | "admin";

export type DisputeStripeStatus =
  | "pending"
  | "won"
  | "lost"
  | "warning_closed"
  | "charge_refunded"
  | "other";

export type AccessBlockClearedBy =
  | "dispute_won"
  | "admin"
  | "superseded"
  | "other";

/** Snapshot of a nex_account row's billing-relevant columns, scoped to
 *  one product so the entitlement helper never cross-reads Shop/Vault. */
export interface ProductBillingSnapshot {
  readonly product: NexProduct;
  readonly tier: ShopTier | VaultTier | null;
  readonly status: SubscriptionStatus | null;
  readonly periodEnd: Date | null;
  readonly pastDueAt: Date | null;
  readonly stripeCustomerId: string | null;
  readonly stripeSubscriptionId: string | null;
  readonly stripePriceId: string | null;
}

/** One row of nex_billing_adverse_event, scoped to one product. */
export interface AdverseEventRow {
  readonly id: string;
  readonly nexAccountId: string;
  readonly product: NexProduct;
  readonly adverseType: AdverseType;

  readonly stripeSubscriptionId: string | null;
  readonly stripeInvoiceId: string | null;
  readonly stripePaymentIntentId: string | null;
  readonly stripeChargeId: string | null;
  readonly stripeDisputeId: string | null;
  readonly stripeRefundId: string | null;
  readonly invoicePeriodStart: Date | null;
  readonly invoicePeriodEnd: Date | null;

  readonly stripeDisputeStatus: DisputeStripeStatus | null;
  readonly stripeDisputeClosedAt: Date | null;

  readonly accessBlocking: boolean;
  readonly accessBlockClearedAt: Date | null;
  readonly accessBlockClearedBy: AccessBlockClearedBy | null;

  readonly openedAt: Date;
  readonly openedByEventId: string | null;
  readonly adminActionId: string | null;
}

/** Compose a product's billing picture for the entitlement rule. */
export interface AccountEntitlementView {
  readonly accountId: string;
  readonly product: NexProduct;
  readonly snapshot: ProductBillingSnapshot;
  /** All adverse rows for this (account, product), open or historical.
   *  The entitlement rule reads only the OPEN BLOCKING subset. */
  readonly adverseEvents: readonly AdverseEventRow[];
}

/** Minimal store interface used by the pure logic. Supabase binding lives
 *  in a separate server-only adapter that implements this interface. */
export interface BillingReadStore {
  readProductView(
    accountId: string,
    product: NexProduct,
  ): Promise<AccountEntitlementView | null>;
}

/** Shape of a Stripe webhook event · narrow slice we actually read. */
export interface StripeWebhookEvent {
  readonly id: string;
  readonly type: string;
  readonly created: number; // Stripe's unix seconds
  readonly apiVersion: string;
  readonly data: {
    readonly object: Record<string, unknown>;
  };
}

/** Outcome enum for nex_billing_event_log.outcome column. */
export type EventOutcome =
  | "processing"
  | "applied"
  | "skipped_duplicate_already_processed"
  | "skipped_stale_subscription"
  | "skipped_partial_refund_historical"
  | "skipped_unverified_checkout"
  | "skipped_unknown_sub"
  | "pending_checkout_mapping"
  | "orphaned_pending_mapping"
  | "error";

/** Row shape of nex_billing_event_log for inspection + mocking. */
export interface EventLogRow {
  readonly stripeEventId: string;
  readonly stripeEventType: string;
  readonly stripeEventCreated: Date;
  readonly outcome: EventOutcome;
  readonly outcomeDetail: string | null;
  readonly processedAt: Date | null;
  readonly stripeSubscriptionId: string | null;
  readonly stripeInvoiceId: string | null;
  readonly stripeDisputeId: string | null;
  readonly stripeRefundId: string | null;
  readonly stripeCheckoutSessionId: string | null;
  readonly invoicePeriodStart: Date | null;
  readonly invoicePeriodEnd: Date | null;
  readonly nexAccountId: string | null;
  readonly product: NexProduct | null;
}
