// src/lib/nex-native/billing/__tests__/in-memory-store.ts
//
// NEX Billing Foundation · test-harness in-memory store.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// Faithful mock of the BillingStore interface. Mirrors the Postgres
// semantics that matter for correctness:
//   · claimEvent uses an in-memory Map; the second claim returns isClaimed=false
//   · insertCheckoutSession enforces UNIQUE(stripeIdempotencyKey)
//   · insertAdverseEvent enforces the four partial-unique rules (open-dispute,
//     refund-id, origin-event, admin-action)
//   · clearAdverseEvent only clears when accessBlockClearedAt is still null
//
// Used by orchestration-layer E1–E7 tests. Not shipped to production.

import type {
  BillingStore,
  ClaimedEventRow,
  CheckoutSessionRow,
  InsertAdverseInput,
  InsertCheckoutSessionInput,
  UpdateProductSubscriptionInput,
} from "../store";
import type {
  AccountEntitlementView,
  AdverseEventRow,
  AdverseType,
  DisputeStripeStatus,
  AccessBlockClearedBy,
  EventLogRow,
  EventOutcome,
  NexProduct,
  ProductBillingSnapshot,
  ShopTier,
  SubscriptionStatus,
  VaultTier,
} from "../types";

type ProductColumns = {
  tier: ShopTier | VaultTier | null;
  status: SubscriptionStatus | null;
  periodEnd: Date | null;
  pastDueAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
};

interface AccountRow {
  readonly accountId: string;
  shop: ProductColumns;
  vault: ProductColumns;
}

const emptyProductColumns = (): ProductColumns => ({
  tier: null,
  status: null,
  periodEnd: null,
  pastDueAt: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  stripePriceId: null,
});

let seq = 0;
const nextId = (prefix: string) => `${prefix}_${++seq}`;

export class InMemoryBillingStore implements BillingStore {
  private accounts: Map<string, AccountRow> = new Map();
  private events: Map<string, EventLogRow> = new Map();
  private checkoutSessions: Map<string, CheckoutSessionRow> = new Map();
  private checkoutByStripeId: Map<string, string> = new Map(); // stripeSessionId -> internalId
  private checkoutByIdempotency: Map<string, string> = new Map();
  private adverseEvents: Map<string, AdverseEventRow> = new Map();

  /** Ensure an account row exists. Test helpers may call this directly. */
  ensureAccount(accountId: string): AccountRow {
    let row = this.accounts.get(accountId);
    if (!row) {
      row = {
        accountId,
        shop: emptyProductColumns(),
        vault: emptyProductColumns(),
      };
      this.accounts.set(accountId, row);
    }
    return row;
  }

  /** Test-only direct seeder. */
  seedProduct(
    accountId: string,
    product: NexProduct,
    patch: Partial<ProductColumns>,
  ): void {
    const row = this.ensureAccount(accountId);
    const slot = product === "shop" ? row.shop : row.vault;
    Object.assign(slot, patch);
  }

  // --- claim/finalize ------------------------------------------------------

  async claimEvent(
    input: Parameters<BillingStore["claimEvent"]>[0],
  ): Promise<ClaimedEventRow> {
    const existing = this.events.get(input.stripeEventId);
    if (existing) {
      return { stripeEventId: input.stripeEventId, isClaimed: false };
    }
    const row: EventLogRow = {
      stripeEventId: input.stripeEventId,
      stripeEventType: input.stripeEventType,
      stripeEventCreated: input.stripeEventCreated,
      outcome: "processing",
      outcomeDetail: null,
      processedAt: null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      stripeInvoiceId: input.stripeInvoiceId ?? null,
      stripeDisputeId: input.stripeDisputeId ?? null,
      stripeRefundId: input.stripeRefundId ?? null,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
      invoicePeriodStart: input.invoicePeriodStart ?? null,
      invoicePeriodEnd: input.invoicePeriodEnd ?? null,
      nexAccountId: input.nexAccountId ?? null,
      product: input.product ?? null,
    };
    this.events.set(input.stripeEventId, row);
    return { stripeEventId: input.stripeEventId, isClaimed: true };
  }

  async finalizeEvent(input: {
    stripeEventId: string;
    outcome: EventOutcome;
    outcomeDetail?: string | null;
  }): Promise<void> {
    const row = this.events.get(input.stripeEventId);
    if (!row) {
      throw new Error(
        `finalizeEvent called for unclaimed event ${input.stripeEventId}`,
      );
    }
    this.events.set(input.stripeEventId, {
      ...row,
      outcome: input.outcome,
      outcomeDetail: input.outcomeDetail ?? null,
      processedAt: new Date(),
    });
  }

  // --- read ---------------------------------------------------------------

  async readProductView(
    accountId: string,
    product: NexProduct,
  ): Promise<AccountEntitlementView | null> {
    const row = this.accounts.get(accountId);
    if (!row) return null;
    const slot = product === "shop" ? row.shop : row.vault;
    const snapshot: ProductBillingSnapshot = {
      product,
      tier: slot.tier,
      status: slot.status,
      periodEnd: slot.periodEnd,
      pastDueAt: slot.pastDueAt,
      stripeCustomerId: slot.stripeCustomerId,
      stripeSubscriptionId: slot.stripeSubscriptionId,
      stripePriceId: slot.stripePriceId,
    };
    const adverseEvents: AdverseEventRow[] = [];
    for (const ev of this.adverseEvents.values()) {
      if (ev.nexAccountId === accountId && ev.product === product) {
        adverseEvents.push(ev);
      }
    }
    return { accountId, product, snapshot, adverseEvents };
  }

  async resolveAccountBySubscription(
    stripeSubscriptionId: string,
  ): Promise<{ accountId: string; product: NexProduct } | null> {
    for (const row of this.accounts.values()) {
      if (row.shop.stripeSubscriptionId === stripeSubscriptionId) {
        return { accountId: row.accountId, product: "shop" };
      }
      if (row.vault.stripeSubscriptionId === stripeSubscriptionId) {
        return { accountId: row.accountId, product: "vault" };
      }
    }
    return null;
  }

  // --- checkout sessions ---------------------------------------------------

  async readCheckoutSession(
    internalSessionId: string,
  ): Promise<CheckoutSessionRow | null> {
    return this.checkoutSessions.get(internalSessionId) ?? null;
  }

  async readCheckoutSessionByStripeSessionId(
    stripeCheckoutSessionId: string,
  ): Promise<CheckoutSessionRow | null> {
    const id = this.checkoutByStripeId.get(stripeCheckoutSessionId);
    return id ? (this.checkoutSessions.get(id) ?? null) : null;
  }

  async insertCheckoutSession(
    input: InsertCheckoutSessionInput,
  ): Promise<CheckoutSessionRow> {
    const existing = this.checkoutByIdempotency.get(input.stripeIdempotencyKey);
    if (existing) {
      throw new Error(
        `duplicate stripe_idempotency_key ${input.stripeIdempotencyKey}`,
      );
    }
    const id = nextId("cs");
    const row: CheckoutSessionRow = {
      internalSessionId: id,
      nexAccountId: input.nexAccountId,
      product: input.product,
      intendedTier: input.intendedTier,
      stripeIdempotencyKey: input.stripeIdempotencyKey,
      stripeCheckoutSessionId: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      status: "pending",
      createdAt: new Date(),
      completedAt: null,
    };
    this.checkoutSessions.set(id, row);
    this.checkoutByIdempotency.set(input.stripeIdempotencyKey, id);
    return row;
  }

  async updateCheckoutSession(
    internalSessionId: string,
    patch: Partial<
      Pick<
        CheckoutSessionRow,
        | "stripeCheckoutSessionId"
        | "stripeCustomerId"
        | "stripeSubscriptionId"
        | "status"
        | "completedAt"
      >
    >,
  ): Promise<void> {
    const row = this.checkoutSessions.get(internalSessionId);
    if (!row) throw new Error(`checkout session ${internalSessionId} not found`);
    const next = { ...row, ...patch };
    this.checkoutSessions.set(internalSessionId, next);
    if (
      patch.stripeCheckoutSessionId &&
      patch.stripeCheckoutSessionId !== row.stripeCheckoutSessionId
    ) {
      this.checkoutByStripeId.set(
        patch.stripeCheckoutSessionId,
        internalSessionId,
      );
    }
  }

  // --- product subscription patch -----------------------------------------

  async updateProductSubscription(
    accountId: string,
    product: NexProduct,
    patch: UpdateProductSubscriptionInput,
  ): Promise<void> {
    const row = this.ensureAccount(accountId);
    const slot = product === "shop" ? row.shop : row.vault;
    if (patch.tier !== undefined) slot.tier = patch.tier;
    if (patch.status !== undefined) slot.status = patch.status;
    if (patch.periodEnd !== undefined) slot.periodEnd = patch.periodEnd;
    if (patch.pastDueAt !== undefined) slot.pastDueAt = patch.pastDueAt;
    if (patch.stripeCustomerId !== undefined)
      slot.stripeCustomerId = patch.stripeCustomerId;
    if (patch.stripeSubscriptionId !== undefined)
      slot.stripeSubscriptionId = patch.stripeSubscriptionId;
    if (patch.stripePriceId !== undefined)
      slot.stripePriceId = patch.stripePriceId;
  }

  // --- adverse events ------------------------------------------------------

  async insertAdverseEvent(
    input: InsertAdverseInput,
  ): Promise<AdverseEventRow | null> {
    // Enforce partial unique rules
    if (input.stripeDisputeId) {
      for (const ev of this.adverseEvents.values()) {
        if (
          ev.stripeDisputeId === input.stripeDisputeId &&
          ev.nexAccountId === input.nexAccountId &&
          ev.product === input.product &&
          ev.accessBlockClearedAt === null
        ) {
          return null; // open-dispute uniqueness violation
        }
      }
    }
    if (input.stripeRefundId) {
      for (const ev of this.adverseEvents.values()) {
        if (
          ev.stripeRefundId === input.stripeRefundId &&
          ev.nexAccountId === input.nexAccountId &&
          ev.product === input.product
        ) {
          return null; // refund-id uniqueness
        }
      }
    }
    if (input.openedByEventId) {
      for (const ev of this.adverseEvents.values()) {
        if (
          ev.openedByEventId === input.openedByEventId &&
          ev.nexAccountId === input.nexAccountId &&
          ev.product === input.product
        ) {
          return null;
        }
      }
    }
    if (input.adminActionId) {
      for (const ev of this.adverseEvents.values()) {
        if (
          ev.adminActionId === input.adminActionId &&
          ev.nexAccountId === input.nexAccountId &&
          ev.product === input.product
        ) {
          return null;
        }
      }
    }
    const id = nextId("adv");
    const row: AdverseEventRow = {
      id,
      nexAccountId: input.nexAccountId,
      product: input.product,
      adverseType: input.adverseType,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeInvoiceId: input.stripeInvoiceId,
      stripePaymentIntentId: input.stripePaymentIntentId,
      stripeChargeId: input.stripeChargeId,
      stripeDisputeId: input.stripeDisputeId,
      stripeRefundId: input.stripeRefundId,
      invoicePeriodStart: input.invoicePeriodStart,
      invoicePeriodEnd: input.invoicePeriodEnd,
      stripeDisputeStatus: input.stripeDisputeStatus,
      stripeDisputeClosedAt: input.stripeDisputeClosedAt,
      accessBlocking: input.accessBlocking,
      accessBlockClearedAt: null,
      accessBlockClearedBy: null,
      openedAt: new Date(),
      openedByEventId: input.openedByEventId,
      adminActionId: input.adminActionId,
    };
    this.adverseEvents.set(id, row);
    return row;
  }

  async clearAdverseEvent(input: {
    adverseEventId: string;
    clearedAt: Date;
    clearedBy: AccessBlockClearedBy;
  }): Promise<boolean> {
    const row = this.adverseEvents.get(input.adverseEventId);
    if (!row || row.accessBlockClearedAt !== null) return false;
    this.adverseEvents.set(input.adverseEventId, {
      ...row,
      accessBlockClearedAt: input.clearedAt,
      accessBlockClearedBy: input.clearedBy,
    });
    return true;
  }

  async findOpenAdverseByDisputeId(
    stripeDisputeId: string,
  ): Promise<AdverseEventRow | null> {
    for (const ev of this.adverseEvents.values()) {
      if (
        ev.stripeDisputeId === stripeDisputeId &&
        ev.accessBlockClearedAt === null
      ) {
        return ev;
      }
    }
    return null;
  }

  async updateDisputeStripeResolution(input: {
    adverseEventId: string;
    stripeDisputeStatus: DisputeStripeStatus;
    stripeDisputeClosedAt: Date;
    adverseType?: AdverseType;
  }): Promise<void> {
    const row = this.adverseEvents.get(input.adverseEventId);
    if (!row) throw new Error(`adverse event ${input.adverseEventId} not found`);
    this.adverseEvents.set(input.adverseEventId, {
      ...row,
      stripeDisputeStatus: input.stripeDisputeStatus,
      stripeDisputeClosedAt: input.stripeDisputeClosedAt,
      adverseType: input.adverseType ?? row.adverseType,
    });
  }

  async findPendingCheckoutMappingEvents(
    limit: number,
  ): Promise<EventLogRow[]> {
    const out: EventLogRow[] = [];
    for (const row of this.events.values()) {
      if (row.outcome === "pending_checkout_mapping") {
        out.push(row);
        if (out.length >= limit) break;
      }
    }
    return out;
  }

  // --- test introspection --------------------------------------------------

  _dumpEvents(): EventLogRow[] {
    return [...this.events.values()];
  }
  _dumpAdverseEvents(): AdverseEventRow[] {
    return [...this.adverseEvents.values()];
  }
  _dumpCheckoutSessions(): CheckoutSessionRow[] {
    return [...this.checkoutSessions.values()];
  }
}
