// src/lib/nex-native/billing/store.ts
//
// NEX Billing Foundation · store interface.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// All DB mutations the billing modules need go through this interface.
// Keeps the pure logic (webhook-processor, checkout-session, reconciliation,
// enforcement) decoupled from Supabase so vitest can exercise it with an
// in-memory implementation. The real Supabase adapter is a server-only
// module that implements this interface (lives in a separate file, not
// built this phase · requires scratch Postgres rehearsal first).

import type {
  NexProduct,
  AccountEntitlementView,
  AdverseEventRow,
  AdverseType,
  DisputeStripeStatus,
  AccessBlockClearedBy,
  EventLogRow,
  EventOutcome,
  SubscriptionStatus,
  ShopTier,
  VaultTier,
} from "./types";

export interface ClaimedEventRow {
  readonly stripeEventId: string;
  readonly isClaimed: boolean; // true = this call owns the event, false = duplicate
}

export interface InsertAdverseInput {
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
  readonly openedByEventId: string | null;
  readonly adminActionId: string | null;
}

export interface UpdateProductSubscriptionInput {
  readonly tier?: ShopTier | VaultTier | null;
  readonly status?: SubscriptionStatus | null;
  readonly periodEnd?: Date | null;
  readonly pastDueAt?: Date | null;
  readonly stripeCustomerId?: string | null;
  readonly stripeSubscriptionId?: string | null;
  readonly stripePriceId?: string | null;
}

export interface CheckoutSessionRow {
  readonly internalSessionId: string;
  readonly nexAccountId: string;
  readonly product: NexProduct;
  readonly intendedTier: string;
  readonly stripeIdempotencyKey: string;
  readonly stripeCheckoutSessionId: string | null;
  readonly stripeCustomerId: string | null;
  readonly stripeSubscriptionId: string | null;
  readonly status:
    | "pending"
    | "awaiting_payment"
    | "completed"
    | "abandoned"
    | "orphaned";
  readonly createdAt: Date;
  readonly completedAt: Date | null;
}

export interface InsertCheckoutSessionInput {
  readonly nexAccountId: string;
  readonly product: NexProduct;
  readonly intendedTier: string;
  readonly stripeIdempotencyKey: string;
}

export interface BillingStore {
  /** Atomic event claim.
   *  Returns `{isClaimed: true, ...}` if this call owns the row.
   *  Returns `{isClaimed: false, ...}` if a prior call already claimed it.
   *  Implementation MUST use `INSERT ... ON CONFLICT (stripe_event_id) DO NOTHING RETURNING`
   *  to make the claim atomic. */
  claimEvent(input: {
    stripeEventId: string;
    stripeEventType: string;
    stripeEventCreated: Date;
    stripeApiVersion: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripeInvoiceId?: string | null;
    stripePaymentIntentId?: string | null;
    stripeChargeId?: string | null;
    stripeDisputeId?: string | null;
    stripeRefundId?: string | null;
    stripeCheckoutSessionId?: string | null;
    invoicePeriodStart?: Date | null;
    invoicePeriodEnd?: Date | null;
    nexAccountId?: string | null;
    product?: NexProduct | null;
  }): Promise<ClaimedEventRow>;

  /** Finalize an event's outcome in nex_billing_event_log · called in the
   *  same transaction as any state mutations. */
  finalizeEvent(input: {
    stripeEventId: string;
    outcome: EventOutcome;
    outcomeDetail?: string | null;
  }): Promise<void>;

  /** Read a (account, product)'s billing picture · the thing accessLevel()
   *  consumes. */
  readProductView(
    accountId: string,
    product: NexProduct,
  ): Promise<AccountEntitlementView | null>;

  /** Resolve an account from a Stripe subscription ID (searches both
   *  shop_stripe_subscription_id and vault_stripe_subscription_id). */
  resolveAccountBySubscription(
    stripeSubscriptionId: string,
  ): Promise<{ accountId: string; product: NexProduct } | null>;

  /** Read a specific checkout session row by internal_session_id. */
  readCheckoutSession(
    internalSessionId: string,
  ): Promise<CheckoutSessionRow | null>;

  /** Read a checkout session by Stripe session ID (used by
   *  checkout.session.completed webhook to resolve mapping). */
  readCheckoutSessionByStripeSessionId(
    stripeCheckoutSessionId: string,
  ): Promise<CheckoutSessionRow | null>;

  /** Insert a pending checkout session row. Returns the row. Fails if the
   *  idempotency key already exists (caller must dedupe). */
  insertCheckoutSession(
    input: InsertCheckoutSessionInput,
  ): Promise<CheckoutSessionRow>;

  /** Update a checkout session row (binding Stripe IDs, status). */
  updateCheckoutSession(
    internalSessionId: string,
    patch: Partial<
      Pick<
        CheckoutSessionRow,
        "stripeCheckoutSessionId"
        | "stripeCustomerId"
        | "stripeSubscriptionId"
        | "status"
        | "completedAt"
      >
    >,
  ): Promise<void>;

  /** Patch the per-product subscription columns on nex_account. */
  updateProductSubscription(
    accountId: string,
    product: NexProduct,
    patch: UpdateProductSubscriptionInput,
  ): Promise<void>;

  /** Insert an adverse-event row. Returns the inserted row. Returns null
   *  if a UNIQUE constraint fires (duplicate dispute or refund). */
  insertAdverseEvent(
    input: InsertAdverseInput,
  ): Promise<AdverseEventRow | null>;

  /** Mark an open adverse-event row as cleared.
   *  Only clears if the row is currently open (access_block_cleared_at IS NULL).
   *  Returns true if a row was updated. */
  clearAdverseEvent(input: {
    adverseEventId: string;
    clearedAt: Date;
    clearedBy: AccessBlockClearedBy;
  }): Promise<boolean>;

  /** Find a single OPEN adverse-event row by Stripe dispute ID. Used to
   *  resolve dispute.closed events back to the originating open row. */
  findOpenAdverseByDisputeId(
    stripeDisputeId: string,
  ): Promise<AdverseEventRow | null>;

  /** Update a dispute's Stripe-side resolution (does NOT clear access
   *  automatically · caller decides). Used by dispute.closed handler. */
  updateDisputeStripeResolution(input: {
    adverseEventId: string;
    stripeDisputeStatus: DisputeStripeStatus;
    stripeDisputeClosedAt: Date;
    adverseType?: AdverseType;
  }): Promise<void>;

  /** Enumerate event-log rows awaiting pending-checkout-mapping. */
  findPendingCheckoutMappingEvents(limit: number): Promise<EventLogRow[]>;
}
