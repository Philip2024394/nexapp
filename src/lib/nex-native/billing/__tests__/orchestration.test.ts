// src/lib/nex-native/billing/__tests__/orchestration.test.ts
//
// NEX Billing Foundation · orchestration-layer E1–E7 tests.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// Exercises the full flow: Stripe-event payload → webhook-processor →
// in-memory BillingStore → entitlement.accessLevel(). Complements the
// pure-logic tests in entitlement.test.ts by proving the integration
// surface behaves correctly end-to-end against the store contract.

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryBillingStore } from "./in-memory-store";
import { processStripeEvent } from "../webhook-processor";
import { accessLevel } from "../entitlement";
import { createCheckoutSession } from "../checkout-session";
import { reconcilePendingMappings } from "../reconciliation";
import { buildPriceRegistry, PRICE_ENV_VARS } from "../price-registry";
import {
  cancelAtPeriodEnd,
  computeCancellationTimeline,
} from "../cancellation";
import {
  enforceShopProductLimit,
  enforceVideoSlotLimit,
  enforceVideoLengthLimit,
  enforceVaultFileSize,
  enforceVaultStorageQuota,
  enforceFreeListingAllowance,
  enforceAdditionalListingPayment,
  SHOP_STANDARD_PRODUCT_CAP,
  SHOP_STANDARD_VIDEO_SLOT_CAP,
  VAULT_FILE_MAX_BYTES,
  VAULT_STORAGE_CAP_BYTES,
  NEX_SELL_EXTRA_LISTING_CENTS_EUR,
} from "../enforcement";
import type { StripeWebhookEvent, NexProduct } from "../types";

// ---------------------------------------------------------------------------
// Event factory helpers
// ---------------------------------------------------------------------------

const unix = (d: Date) => Math.floor(d.getTime() / 1000);

const subscriptionCreatedEvent = (
  id: string,
  subId: string,
  customerId: string,
  priceId: string,
  stripeStatus: "incomplete" | "trialing" = "incomplete",
  createdAt: Date = new Date("2026-11-02T00:00:00Z"),
): StripeWebhookEvent => ({
  id,
  type: "customer.subscription.created",
  created: unix(createdAt),
  apiVersion: "2024-06-20",
  data: {
    object: {
      id: subId,
      customer: customerId,
      status: stripeStatus,
      items: { data: [{ price: { id: priceId } }] },
    },
  },
});

const invoicePaymentSucceededEvent = (
  id: string,
  subId: string,
  invoiceId: string,
  periodEnd: Date,
  createdAt?: Date,
): StripeWebhookEvent => ({
  id,
  type: "invoice.payment_succeeded",
  created: unix(createdAt ?? new Date("2026-11-02T01:00:00Z")),
  apiVersion: "2024-06-20",
  data: {
    object: {
      id: invoiceId,
      subscription: subId,
      period_end: unix(periodEnd),
    },
  },
});

const invoicePaymentFailedEvent = (
  id: string,
  subId: string,
  invoiceId: string,
  createdAt: Date,
): StripeWebhookEvent => ({
  id,
  type: "invoice.payment_failed",
  created: unix(createdAt),
  apiVersion: "2024-06-20",
  data: {
    object: {
      id: invoiceId,
      subscription: subId,
    },
  },
});

const subscriptionDeletedEvent = (
  id: string,
  subId: string,
  createdAt: Date,
): StripeWebhookEvent => ({
  id,
  type: "customer.subscription.deleted",
  created: unix(createdAt),
  apiVersion: "2024-06-20",
  data: { object: { id: subId } },
});

const subscriptionCancelAtPeriodEndEvent = (
  id: string,
  subId: string,
  createdAt: Date,
): StripeWebhookEvent => ({
  id,
  type: "customer.subscription.updated",
  created: unix(createdAt),
  apiVersion: "2024-06-20",
  data: { object: { id: subId, cancel_at_period_end: true } },
});

const chargeRefundedEvent = (
  id: string,
  chargeId: string,
  subId: string,
  invoiceId: string,
  periodEnd: Date,
  amount: number,
  amountRefunded: number,
  refundId: string,
  createdAt?: Date,
): StripeWebhookEvent => ({
  id,
  type: "charge.refunded",
  created: unix(createdAt ?? new Date("2026-11-02T02:00:00Z")),
  apiVersion: "2024-06-20",
  data: {
    object: {
      id: chargeId,
      subscription: subId,
      invoice: invoiceId,
      period_end: unix(periodEnd),
      amount,
      amount_refunded: amountRefunded,
      refunds: { data: [{ id: refundId }] },
    },
  },
});

const disputeCreatedEvent = (
  id: string,
  disputeId: string,
  chargeId: string,
  subId: string,
  invoiceId: string,
  periodEnd: Date,
  createdAt: Date,
): StripeWebhookEvent => ({
  id,
  type: "charge.dispute.created",
  created: unix(createdAt),
  apiVersion: "2024-06-20",
  data: {
    object: {
      id: disputeId,
      charge: chargeId,
      subscription: subId,
      invoice: invoiceId,
      period_end: unix(periodEnd),
    },
  },
});

const disputeClosedEvent = (
  id: string,
  disputeId: string,
  subId: string,
  status: "won" | "lost",
  createdAt: Date,
): StripeWebhookEvent => ({
  id,
  type: "charge.dispute.closed",
  created: unix(createdAt),
  apiVersion: "2024-06-20",
  data: {
    object: {
      id: disputeId,
      subscription: subId,
      status,
    },
  },
});

const checkoutSessionCompletedEvent = (
  id: string,
  stripeSessionId: string,
  customerId: string,
  subId: string,
  createdAt: Date,
): StripeWebhookEvent => ({
  id,
  type: "checkout.session.completed",
  created: unix(createdAt),
  apiVersion: "2024-06-20",
  data: {
    object: {
      id: stripeSessionId,
      customer: customerId,
      subscription: subId,
    },
  },
});

// ---------------------------------------------------------------------------
// Shared setup: seed an account + attach a shop subscription
// ---------------------------------------------------------------------------

async function seedShopActive(
  store: InMemoryBillingStore,
  accountId: string,
  subId: string,
  priceId: string,
  periodEnd: Date,
): Promise<void> {
  // 1 · subscription.created
  await processStripeEvent(
    subscriptionCreatedEvent(
      `evt_sub_created_${subId}`,
      subId,
      `cus_${accountId}`,
      priceId,
    ),
    store,
    new Date("2026-11-02T00:00:00Z"),
  );
  // Account row doesn't exist yet · subscription.created tries to resolve
  // and fails. We seed the mapping manually (as a successful checkout
  // flow would). This mirrors the real flow where checkout.session.
  // completed binds the subscription to the account BEFORE
  // subscription.created arrives.
  store.seedProduct(accountId, "shop", {
    stripeSubscriptionId: subId,
    stripeCustomerId: `cus_${accountId}`,
    stripePriceId: priceId,
    tier: priceId.includes("unlimited") ? "unlimited" : "standard",
    status: "incomplete",
  });
  // 2 · invoice.payment_succeeded flips to active
  await processStripeEvent(
    invoicePaymentSucceededEvent(
      `evt_inv_succ_${subId}`,
      subId,
      `inv_${subId}_1`,
      periodEnd,
    ),
    store,
    new Date("2026-11-02T01:00:00Z"),
  );
}

// ---------------------------------------------------------------------------
// E1 · two concurrent disputes · one won, one lost · each independently tracked
// ---------------------------------------------------------------------------

describe("E1 · multi-dispute · one won, one lost", () => {
  let store: InMemoryBillingStore;

  beforeEach(async () => {
    store = new InMemoryBillingStore();
    await seedShopActive(
      store,
      "acct_e1",
      "sub_e1",
      "price_shop_standard",
      new Date("2026-12-02T00:00:00Z"),
    );
  });

  it("blocks access after first dispute opens", async () => {
    await processStripeEvent(
      disputeCreatedEvent(
        "evt_d1_open",
        "dp_1",
        "ch_1",
        "sub_e1",
        "inv_a",
        new Date("2026-12-02T00:00:00Z"),
        new Date("2026-11-05T00:00:00Z"),
      ),
      store,
      new Date("2026-11-05T00:00:00Z"),
    );
    const view = await store.readProductView("acct_e1", "shop");
    expect(view).not.toBeNull();
    expect(accessLevel(view!, new Date("2026-11-05T01:00:00Z"))).toBe("none");
  });

  it("remains blocked after second dispute opens", async () => {
    await processStripeEvent(
      disputeCreatedEvent(
        "evt_d1_open",
        "dp_1",
        "ch_1",
        "sub_e1",
        "inv_a",
        new Date("2026-12-02T00:00:00Z"),
        new Date("2026-11-05T00:00:00Z"),
      ),
      store,
      new Date("2026-11-05T00:00:00Z"),
    );
    await processStripeEvent(
      disputeCreatedEvent(
        "evt_d2_open",
        "dp_2",
        "ch_2",
        "sub_e1",
        "inv_b",
        new Date("2026-12-02T00:00:00Z"),
        new Date("2026-11-06T00:00:00Z"),
      ),
      store,
      new Date("2026-11-06T00:00:00Z"),
    );
    const view = await store.readProductView("acct_e1", "shop");
    expect(view!.adverseEvents.length).toBe(2);
    expect(accessLevel(view!, new Date("2026-11-06T01:00:00Z"))).toBe("none");
  });

  it("winning dispute 1 does NOT restore access while dispute 2 still open", async () => {
    await processStripeEvent(
      disputeCreatedEvent(
        "evt_d1_open",
        "dp_1",
        "ch_1",
        "sub_e1",
        "inv_a",
        new Date("2026-12-02T00:00:00Z"),
        new Date("2026-11-05T00:00:00Z"),
      ),
      store,
      new Date("2026-11-05T00:00:00Z"),
    );
    await processStripeEvent(
      disputeCreatedEvent(
        "evt_d2_open",
        "dp_2",
        "ch_2",
        "sub_e1",
        "inv_b",
        new Date("2026-12-02T00:00:00Z"),
        new Date("2026-11-06T00:00:00Z"),
      ),
      store,
      new Date("2026-11-06T00:00:00Z"),
    );
    await processStripeEvent(
      disputeClosedEvent(
        "evt_d1_won",
        "dp_1",
        "sub_e1",
        "won",
        new Date("2026-11-10T00:00:00Z"),
      ),
      store,
      new Date("2026-11-10T00:00:00Z"),
    );
    const view = await store.readProductView("acct_e1", "shop");
    const stillOpen = view!.adverseEvents.filter(
      (e) => e.accessBlockClearedAt === null,
    );
    expect(stillOpen).toHaveLength(1);
    expect(stillOpen[0].stripeDisputeId).toBe("dp_2");
    expect(accessLevel(view!, new Date("2026-11-10T01:00:00Z"))).toBe("none");
  });

  it("losing dispute 2 keeps access blocked indefinitely until admin clears", async () => {
    await processStripeEvent(
      disputeCreatedEvent(
        "evt_d1_open",
        "dp_1",
        "ch_1",
        "sub_e1",
        "inv_a",
        new Date("2026-12-02T00:00:00Z"),
        new Date("2026-11-05T00:00:00Z"),
      ),
      store,
      new Date("2026-11-05T00:00:00Z"),
    );
    await processStripeEvent(
      disputeCreatedEvent(
        "evt_d2_open",
        "dp_2",
        "ch_2",
        "sub_e1",
        "inv_b",
        new Date("2026-12-02T00:00:00Z"),
        new Date("2026-11-06T00:00:00Z"),
      ),
      store,
      new Date("2026-11-06T00:00:00Z"),
    );
    await processStripeEvent(
      disputeClosedEvent(
        "evt_d1_won",
        "dp_1",
        "sub_e1",
        "won",
        new Date("2026-11-10T00:00:00Z"),
      ),
      store,
      new Date("2026-11-10T00:00:00Z"),
    );
    await processStripeEvent(
      disputeClosedEvent(
        "evt_d2_lost",
        "dp_2",
        "sub_e1",
        "lost",
        new Date("2026-11-12T00:00:00Z"),
      ),
      store,
      new Date("2026-11-12T00:00:00Z"),
    );
    const view = await store.readProductView("acct_e1", "shop");
    const lostRow = view!.adverseEvents.find((e) => e.stripeDisputeId === "dp_2");
    expect(lostRow?.adverseType).toBe("dispute_lost");
    expect(lostRow?.stripeDisputeStatus).toBe("lost");
    expect(lostRow?.accessBlockClearedAt).toBeNull();
    expect(accessLevel(view!, new Date("2026-11-12T01:00:00Z"))).toBe("none");
    // Even far in the future · still blocked
    expect(accessLevel(view!, new Date("2027-05-01T00:00:00Z"))).toBe("none");
  });
});

// ---------------------------------------------------------------------------
// E2 · old-period full refund does NOT block when a later paid period intact
// ---------------------------------------------------------------------------

describe("E2 · old-period full refund with later paid period intact", () => {
  let store: InMemoryBillingStore;

  beforeEach(async () => {
    store = new InMemoryBillingStore();
    await seedShopActive(
      store,
      "acct_e2",
      "sub_e2",
      "price_shop_standard",
      new Date("2026-12-02T00:00:00Z"),
    );
    // Renew with a later invoice · brings periodEnd to 2027-01-02
    await processStripeEvent(
      invoicePaymentSucceededEvent(
        "evt_inv_renew",
        "sub_e2",
        "inv_e2_renew",
        new Date("2027-01-02T00:00:00Z"),
        new Date("2026-12-02T00:00:00Z"),
      ),
      store,
      new Date("2026-12-02T00:00:00Z"),
    );
  });

  it("refunds older period as historical (access_blocking=false)", async () => {
    await processStripeEvent(
      chargeRefundedEvent(
        "evt_refund_old",
        "ch_old",
        "sub_e2",
        "inv_e2_old",
        new Date("2026-12-02T00:00:00Z"), // older period
        1999,
        1999,
        "re_old",
        new Date("2026-12-10T00:00:00Z"),
      ),
      store,
      new Date("2026-12-10T00:00:00Z"),
    );
    const view = await store.readProductView("acct_e2", "shop");
    const refundRow = view!.adverseEvents.find((e) => e.stripeRefundId === "re_old");
    expect(refundRow?.accessBlocking).toBe(false);
    expect(accessLevel(view!, new Date("2026-12-10T01:00:00Z"))).toBe("full");
  });

  it("refunds current period as access-blocking", async () => {
    await processStripeEvent(
      chargeRefundedEvent(
        "evt_refund_curr",
        "ch_curr",
        "sub_e2",
        "inv_e2_renew",
        new Date("2027-01-02T00:00:00Z"), // same as current periodEnd
        1999,
        1999,
        "re_curr",
        new Date("2026-12-10T00:00:00Z"),
      ),
      store,
      new Date("2026-12-10T00:00:00Z"),
    );
    const view = await store.readProductView("acct_e2", "shop");
    const refundRow = view!.adverseEvents.find((e) => e.stripeRefundId === "re_curr");
    expect(refundRow?.accessBlocking).toBe(true);
    expect(accessLevel(view!, new Date("2026-12-10T01:00:00Z"))).toBe("none");
  });

  it("partial refund never blocks regardless of period", async () => {
    await processStripeEvent(
      chargeRefundedEvent(
        "evt_refund_partial",
        "ch_part",
        "sub_e2",
        "inv_e2_renew",
        new Date("2027-01-02T00:00:00Z"),
        1999,
        500,
        "re_part",
        new Date("2026-12-10T00:00:00Z"),
      ),
      store,
      new Date("2026-12-10T00:00:00Z"),
    );
    const view = await store.readProductView("acct_e2", "shop");
    const refundRow = view!.adverseEvents.find((e) => e.stripeRefundId === "re_part");
    expect(refundRow?.adverseType).toBe("partial_refund");
    expect(refundRow?.accessBlocking).toBe(false);
    expect(accessLevel(view!, new Date("2026-12-10T01:00:00Z"))).toBe("full");
  });
});

// ---------------------------------------------------------------------------
// E3 · new checkout refused while open blocking adverse exists
// ---------------------------------------------------------------------------

describe("E3 · new checkout refused when blocker open", () => {
  it("refuses new Shop checkout with open blocker", async () => {
    const store = new InMemoryBillingStore();
    await seedShopActive(
      store,
      "acct_e3",
      "sub_e3",
      "price_shop_standard",
      new Date("2026-12-02T00:00:00Z"),
    );
    await processStripeEvent(
      disputeCreatedEvent(
        "evt_e3_disp",
        "dp_e3",
        "ch_e3",
        "sub_e3",
        "inv_e3",
        new Date("2026-12-02T00:00:00Z"),
        new Date("2026-11-05T00:00:00Z"),
      ),
      store,
      new Date("2026-11-05T00:00:00Z"),
    );

    const stripeMock = {
      createCheckoutSession: async () => ({
        id: "cs_stripe_1",
        url: "https://checkout.stripe/x",
      }),
    };
    const result = await createCheckoutSession(
      {
        nexAccountId: "acct_e3",
        product: "shop",
        intendedTier: "unlimited",
        successUrl: "https://nex/app/success",
        cancelUrl: "https://nex/app/cancel",
        getPriceIdForTier: () => "price_shop_unlimited",
      },
      store,
      stripeMock,
      new Date("2026-11-05T01:00:00Z"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("blocked_by_adverse_event");
    }
  });

  it("permits checkout when no blocker exists", async () => {
    const store = new InMemoryBillingStore();
    let stripeCalled = 0;
    const stripeMock = {
      createCheckoutSession: async () => {
        stripeCalled += 1;
        return { id: "cs_stripe_new", url: "https://checkout.stripe/go" };
      },
    };
    const result = await createCheckoutSession(
      {
        nexAccountId: "acct_e3_clean",
        product: "shop",
        intendedTier: "standard",
        successUrl: "https://nex/app/success",
        cancelUrl: "https://nex/app/cancel",
        getPriceIdForTier: () => "price_shop_standard",
      },
      store,
      stripeMock,
      new Date("2026-11-05T00:00:00Z"),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toContain("checkout.stripe");
      expect(stripeCalled).toBe(1);
    }
    // Durable row written with stripeCheckoutSessionId
    const sessions = store._dumpCheckoutSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].stripeCheckoutSessionId).toBe("cs_stripe_new");
    expect(sessions[0].status).toBe("awaiting_payment");
  });
});

// ---------------------------------------------------------------------------
// E4 · stale-subscription events are scoped by product (defense-in-depth)
// ---------------------------------------------------------------------------

describe("E4 · stale subscription scoping", () => {
  it("ignores events for subscription IDs we don't know", async () => {
    const store = new InMemoryBillingStore();
    const result = await processStripeEvent(
      invoicePaymentFailedEvent(
        "evt_unknown",
        "sub_phantom",
        "inv_x",
        new Date("2026-11-05T00:00:00Z"),
      ),
      store,
      new Date("2026-11-05T00:00:00Z"),
    );
    expect(result.outcome).toBe("skipped_unknown_sub");
  });

  it("Shop event never touches Vault columns", async () => {
    const store = new InMemoryBillingStore();
    await seedShopActive(
      store,
      "acct_e4",
      "sub_e4_shop",
      "price_shop_standard",
      new Date("2026-12-02T00:00:00Z"),
    );
    // Vault remains null
    const vaultView = await store.readProductView("acct_e4", "vault");
    expect(vaultView!.snapshot.tier).toBeNull();
    expect(vaultView!.snapshot.status).toBeNull();
    // Shop populated
    const shopView = await store.readProductView("acct_e4", "shop");
    expect(shopView!.snapshot.tier).toBe("standard");
    expect(shopView!.snapshot.status).toBe("active");
  });
});

// ---------------------------------------------------------------------------
// E5 · pending-checkout-mapping and reconciliation
// ---------------------------------------------------------------------------

describe("E5 · pending-checkout-mapping recovery", () => {
  it("records pending outcome when subscription.created arrives before mapping", async () => {
    const store = new InMemoryBillingStore();
    const result = await processStripeEvent(
      subscriptionCreatedEvent(
        "evt_sub_orphan",
        "sub_orphan",
        "cus_orphan",
        "price_shop_standard",
      ),
      store,
      new Date("2026-11-05T00:00:00Z"),
    );
    expect(result.outcome).toBe("pending_checkout_mapping");
    const pending = await store.findPendingCheckoutMappingEvents(10);
    expect(pending).toHaveLength(1);
    expect(pending[0].stripeEventId).toBe("evt_sub_orphan");
  });

  it("reconciles once the mapping becomes available", async () => {
    const store = new InMemoryBillingStore();
    await processStripeEvent(
      subscriptionCreatedEvent(
        "evt_sub_orphan",
        "sub_orphan",
        "cus_orphan",
        "price_shop_standard",
      ),
      store,
      new Date("2026-11-05T00:00:00Z"),
    );
    // Later · the mapping is established out-of-band
    store.seedProduct("acct_e5", "shop", {
      stripeSubscriptionId: "sub_orphan",
      stripeCustomerId: "cus_orphan",
      tier: "standard",
      status: "incomplete",
    });
    const result = await reconcilePendingMappings(
      store,
      new Date("2026-11-05T01:00:00Z"),
    );
    expect(result.recovered).toBe(1);
    expect(result.stillPending).toBe(0);
    const pendingAfter = await store.findPendingCheckoutMappingEvents(10);
    expect(pendingAfter).toHaveLength(0);
  });

  it("marks events older than 7 days as orphaned", async () => {
    const store = new InMemoryBillingStore();
    await processStripeEvent(
      subscriptionCreatedEvent(
        "evt_sub_ancient",
        "sub_ancient",
        "cus_ancient",
        "price_shop_standard",
        "incomplete",
        new Date("2026-10-20T00:00:00Z"),
      ),
      store,
      new Date("2026-10-20T00:00:00Z"),
    );
    const result = await reconcilePendingMappings(
      store,
      new Date("2026-11-05T00:00:00Z"), // 16 days later
    );
    expect(result.orphaned).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// E6 · duplicate webhook delivery · atomic claim
// ---------------------------------------------------------------------------

describe("E6 · duplicate webhook delivery", () => {
  it("second delivery is skipped by atomic claim", async () => {
    const store = new InMemoryBillingStore();
    await seedShopActive(
      store,
      "acct_e6",
      "sub_e6",
      "price_shop_standard",
      new Date("2026-12-02T00:00:00Z"),
    );
    const event = disputeCreatedEvent(
      "evt_dup",
      "dp_dup",
      "ch_dup",
      "sub_e6",
      "inv_e6",
      new Date("2026-12-02T00:00:00Z"),
      new Date("2026-11-05T00:00:00Z"),
    );
    const r1 = await processStripeEvent(
      event,
      store,
      new Date("2026-11-05T00:00:00Z"),
    );
    const r2 = await processStripeEvent(
      event,
      store,
      new Date("2026-11-05T00:00:00Z"),
    );
    expect(r1.outcome).toBe("applied");
    expect(r2.outcome).toBe("skipped_duplicate_already_processed");
    const view = await store.readProductView("acct_e6", "shop");
    expect(view!.adverseEvents).toHaveLength(1); // not duplicated
  });
});

// ---------------------------------------------------------------------------
// E7 · 7-day retry + 30-day grace with GREATEST rule
// ---------------------------------------------------------------------------

describe("E7 · 7-day retry + 30-day grace", () => {
  it("payment_failed extends full access by 7 days past past_due_at", async () => {
    const store = new InMemoryBillingStore();
    await seedShopActive(
      store,
      "acct_e7",
      "sub_e7",
      "price_shop_standard",
      new Date("2026-11-10T00:00:00Z"),
    );
    const pastDueAt = new Date("2026-11-10T00:00:00Z");
    await processStripeEvent(
      invoicePaymentFailedEvent("evt_fail", "sub_e7", "inv_fail", pastDueAt),
      store,
      pastDueAt,
    );
    const view = await store.readProductView("acct_e7", "shop");
    // GREATEST(periodEnd=2026-11-10, pastDueAt+7d=2026-11-17) = 2026-11-17T00:00
    expect(accessLevel(view!, new Date("2026-11-15T00:00:00Z"))).toBe("full");
    // At the exact cutoff · still 'full' (<=)
    expect(accessLevel(view!, new Date("2026-11-17T00:00:00Z"))).toBe("full");
    // One second after cutoff · transitions to read-only
    expect(accessLevel(view!, new Date("2026-11-17T00:00:01Z"))).toBe(
      "read-only",
    );
    expect(accessLevel(view!, new Date("2026-11-18T01:00:00Z"))).toBe(
      "read-only",
    );
  });

  it("past_due_at is set ONCE (set-once semantics)", async () => {
    const store = new InMemoryBillingStore();
    await seedShopActive(
      store,
      "acct_e7b",
      "sub_e7b",
      "price_shop_standard",
      new Date("2026-11-10T00:00:00Z"),
    );
    const firstFail = new Date("2026-11-10T00:00:00Z");
    const laterFail = new Date("2026-11-15T00:00:00Z");
    await processStripeEvent(
      invoicePaymentFailedEvent("evt_fail_1", "sub_e7b", "inv_fail_1", firstFail),
      store,
      firstFail,
    );
    await processStripeEvent(
      invoicePaymentFailedEvent("evt_fail_2", "sub_e7b", "inv_fail_2", laterFail),
      store,
      laterFail,
    );
    const view = await store.readProductView("acct_e7b", "shop");
    expect(view!.snapshot.pastDueAt?.toISOString()).toBe(firstFail.toISOString());
  });

  it("subscription.deleted puts the user into 30-day read-only grace", async () => {
    const store = new InMemoryBillingStore();
    await seedShopActive(
      store,
      "acct_e7c",
      "sub_e7c",
      "price_shop_standard",
      new Date("2026-11-10T00:00:00Z"),
    );
    await processStripeEvent(
      subscriptionDeletedEvent(
        "evt_del",
        "sub_e7c",
        new Date("2026-11-10T00:00:01Z"),
      ),
      store,
      new Date("2026-11-10T00:00:01Z"),
    );
    const view = await store.readProductView("acct_e7c", "shop");
    expect(view!.snapshot.status).toBe("grace");
    // Just after period_end · now in read-only grace
    expect(accessLevel(view!, new Date("2026-11-10T00:01:00Z"))).toBe(
      "read-only",
    );
    // 29 days later · still read-only
    expect(accessLevel(view!, new Date("2026-12-09T00:00:00Z"))).toBe(
      "read-only",
    );
    // 31 days later · access revoked
    expect(accessLevel(view!, new Date("2026-12-12T00:00:00Z"))).toBe("none");
  });

  it("payment_succeeded clears past_due_at", async () => {
    const store = new InMemoryBillingStore();
    await seedShopActive(
      store,
      "acct_e7d",
      "sub_e7d",
      "price_shop_standard",
      new Date("2026-11-10T00:00:00Z"),
    );
    await processStripeEvent(
      invoicePaymentFailedEvent(
        "evt_fail_d",
        "sub_e7d",
        "inv_fail_d",
        new Date("2026-11-10T00:00:00Z"),
      ),
      store,
      new Date("2026-11-10T00:00:00Z"),
    );
    expect(
      (await store.readProductView("acct_e7d", "shop"))!.snapshot.pastDueAt,
    ).not.toBeNull();
    await processStripeEvent(
      invoicePaymentSucceededEvent(
        "evt_pay_d",
        "sub_e7d",
        "inv_pay_d",
        new Date("2026-12-10T00:00:00Z"),
      ),
      store,
      new Date("2026-11-15T00:00:00Z"),
    );
    const view = await store.readProductView("acct_e7d", "shop");
    expect(view!.snapshot.pastDueAt).toBeNull();
    expect(view!.snapshot.status).toBe("active");
  });
});

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

describe("Cancellation · independent Shop + Vault paths", () => {
  it("cancelling Shop does not affect Vault", async () => {
    const store = new InMemoryBillingStore();
    await seedShopActive(
      store,
      "acct_cx",
      "sub_cx_shop",
      "price_shop_standard",
      new Date("2026-12-02T00:00:00Z"),
    );
    // Add an active Vault subscription too
    store.seedProduct("acct_cx", "vault", {
      stripeSubscriptionId: "sub_cx_vault",
      stripeCustomerId: "cus_cx",
      stripePriceId: "price_vault_5gb",
      tier: "5gb",
      status: "active",
      periodEnd: new Date("2026-12-02T00:00:00Z"),
    });

    let stripeCalls = 0;
    const stripeMock = {
      cancelAtPeriodEnd: async () => {
        stripeCalls += 1;
        return { id: "sub_cx_shop", cancelAt: null, status: "active" };
      },
    };

    const result = await cancelAtPeriodEnd(
      { nexAccountId: "acct_cx", product: "shop" },
      store,
      stripeMock,
    );
    expect(result.ok).toBe(true);
    expect(stripeCalls).toBe(1);

    const vaultView = await store.readProductView("acct_cx", "vault");
    expect(vaultView!.snapshot.status).toBe("active");
    expect(vaultView!.snapshot.stripeSubscriptionId).toBe("sub_cx_vault");
  });

  it("subscription.updated(cancel_at_period_end) flips Shop status=cancelled", async () => {
    const store = new InMemoryBillingStore();
    await seedShopActive(
      store,
      "acct_cx2",
      "sub_cx2",
      "price_shop_standard",
      new Date("2026-12-02T00:00:00Z"),
    );
    await processStripeEvent(
      subscriptionCancelAtPeriodEndEvent(
        "evt_cancel",
        "sub_cx2",
        new Date("2026-11-15T00:00:00Z"),
      ),
      store,
      new Date("2026-11-15T00:00:00Z"),
    );
    const view = await store.readProductView("acct_cx2", "shop");
    expect(view!.snapshot.status).toBe("cancelled");
    // Full access still until period_end
    expect(accessLevel(view!, new Date("2026-11-30T00:00:00Z"))).toBe("full");
    // Then subscription.deleted arrives at period_end
    await processStripeEvent(
      subscriptionDeletedEvent(
        "evt_cancel_delete",
        "sub_cx2",
        new Date("2026-12-02T00:00:00Z"),
      ),
      store,
      new Date("2026-12-02T00:00:00Z"),
    );
    const after = await store.readProductView("acct_cx2", "shop");
    expect(after!.snapshot.status).toBe("grace");
    expect(accessLevel(after!, new Date("2026-12-15T00:00:00Z"))).toBe(
      "read-only",
    );
  });

  it("computeCancellationTimeline mirrors GREATEST rule", () => {
    const timeline = computeCancellationTimeline({
      periodEnd: new Date("2026-11-10T00:00:00Z"),
      pastDueAt: new Date("2026-11-08T00:00:00Z"),
    });
    expect(timeline.fullAccessUntil?.toISOString()).toBe(
      new Date("2026-11-15T00:00:00Z").toISOString(), // pastDueAt + 7d > periodEnd
    );
    expect(timeline.graceUntil?.toISOString()).toBe(
      new Date("2026-12-15T00:00:00Z").toISOString(),
    );
  });
});

// ---------------------------------------------------------------------------
// Enforcement
// ---------------------------------------------------------------------------

describe("Enforcement · Shop product cap", () => {
  it("Standard caps at 50 products", async () => {
    const store = new InMemoryBillingStore();
    await seedShopActive(
      store,
      "acct_f1",
      "sub_f1",
      "price_shop_standard",
      new Date("2026-12-02T00:00:00Z"),
    );
    const view = (await store.readProductView("acct_f1", "shop"))!;
    const ok = enforceShopProductLimit({
      view,
      now: new Date("2026-11-02T00:00:00Z"),
      currentActiveProductCount: 49,
      addingCount: 1,
    });
    expect(ok.ok).toBe(true);

    const bad = enforceShopProductLimit({
      view,
      now: new Date("2026-11-02T00:00:00Z"),
      currentActiveProductCount: 50,
      addingCount: 1,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe("cap_exceeded");
  });

  it("Unlimited bypasses the cap", async () => {
    const store = new InMemoryBillingStore();
    await seedShopActive(
      store,
      "acct_f2",
      "sub_f2",
      "price_shop_unlimited",
      new Date("2026-12-02T00:00:00Z"),
    );
    const view = (await store.readProductView("acct_f2", "shop"))!;
    const ok = enforceShopProductLimit({
      view,
      now: new Date("2026-11-02T00:00:00Z"),
      currentActiveProductCount: 999,
      addingCount: 1,
    });
    expect(ok.ok).toBe(true);
  });

  it("Read-only grace blocks new products", async () => {
    const store = new InMemoryBillingStore();
    await seedShopActive(
      store,
      "acct_f3",
      "sub_f3",
      "price_shop_standard",
      new Date("2026-11-10T00:00:00Z"),
    );
    await processStripeEvent(
      subscriptionDeletedEvent(
        "evt_del_f3",
        "sub_f3",
        new Date("2026-11-10T00:00:01Z"),
      ),
      store,
      new Date("2026-11-10T00:00:01Z"),
    );
    const view = (await store.readProductView("acct_f3", "shop"))!;
    const r = enforceShopProductLimit({
      view,
      now: new Date("2026-11-20T00:00:00Z"), // in read-only grace
      currentActiveProductCount: 10,
      addingCount: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("read_only");
  });
});

describe("Enforcement · Shop video", () => {
  it("Standard caps at 10 video slots", async () => {
    const store = new InMemoryBillingStore();
    await seedShopActive(
      store,
      "acct_v1",
      "sub_v1",
      "price_shop_standard",
      new Date("2026-12-02T00:00:00Z"),
    );
    const view = (await store.readProductView("acct_v1", "shop"))!;
    expect(
      enforceVideoSlotLimit({
        view,
        now: new Date("2026-11-02T00:00:00Z"),
        currentVideoProductCount: 10,
        addingCount: 1,
      }).ok,
    ).toBe(false);
    expect(SHOP_STANDARD_VIDEO_SLOT_CAP).toBe(10);
  });

  it("Video length cap = 20 seconds", () => {
    expect(enforceVideoLengthLimit(20).ok).toBe(true);
    expect(enforceVideoLengthLimit(21).ok).toBe(false);
    expect(enforceVideoLengthLimit(0).ok).toBe(false);
  });

  it("Unlimited bypasses video slot cap", async () => {
    const store = new InMemoryBillingStore();
    await seedShopActive(
      store,
      "acct_v2",
      "sub_v2",
      "price_shop_unlimited",
      new Date("2026-12-02T00:00:00Z"),
    );
    const view = (await store.readProductView("acct_v2", "shop"))!;
    expect(
      enforceVideoSlotLimit({
        view,
        now: new Date("2026-11-02T00:00:00Z"),
        currentVideoProductCount: 999,
        addingCount: 1,
      }).ok,
    ).toBe(true);
  });
});

describe("Enforcement · Vault storage", () => {
  it("file-size cap = 50 MB decimal", () => {
    expect(enforceVaultFileSize(VAULT_FILE_MAX_BYTES).ok).toBe(true);
    expect(enforceVaultFileSize(VAULT_FILE_MAX_BYTES + 1).ok).toBe(false);
    expect(enforceVaultFileSize(0).ok).toBe(false);
  });

  it("5gb tier caps at 5 billion bytes", async () => {
    const store = new InMemoryBillingStore();
    store.seedProduct("acct_vq", "vault", {
      tier: "5gb",
      status: "active",
      periodEnd: new Date("2026-12-02T00:00:00Z"),
      stripeSubscriptionId: "sub_vq",
    });
    const view = (await store.readProductView("acct_vq", "vault"))!;
    const good = enforceVaultStorageQuota({
      view,
      now: new Date("2026-11-02T00:00:00Z"),
      currentUsedBytes: 4_900_000_000,
      addingBytes: 50_000_000,
    });
    expect(good.ok).toBe(true);
    const bad = enforceVaultStorageQuota({
      view,
      now: new Date("2026-11-02T00:00:00Z"),
      currentUsedBytes: 4_999_000_000,
      addingBytes: 2_000_000,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.code).toBe("cap_exceeded");
      expect(bad.cap).toBe(VAULT_STORAGE_CAP_BYTES["5gb"]);
    }
  });
});

describe("Enforcement · NEX Sell listings", () => {
  it("first 3 listings per month are free", () => {
    const r = enforceFreeListingAllowance({
      listingsUsedThisMonth: 0,
      addingCount: 3,
    });
    expect(r.freeCovered).toBe(3);
    expect(r.extraCovered).toBe(0);
    expect(r.extraCostCents).toBe(0);
  });

  it("listing #4 costs €1.30", () => {
    const r = enforceFreeListingAllowance({
      listingsUsedThisMonth: 3,
      addingCount: 1,
    });
    expect(r.freeCovered).toBe(0);
    expect(r.extraCovered).toBe(1);
    expect(r.extraCostCents).toBe(NEX_SELL_EXTRA_LISTING_CENTS_EUR);
  });

  it("mixed batch (2 free + 2 paid)", () => {
    const r = enforceFreeListingAllowance({
      listingsUsedThisMonth: 1,
      addingCount: 4,
    });
    expect(r.freeCovered).toBe(2);
    expect(r.extraCovered).toBe(2);
    expect(r.extraCostCents).toBe(2 * NEX_SELL_EXTRA_LISTING_CENTS_EUR);
  });

  it("additional-listing payment decomposer agrees with allowance", () => {
    const r = enforceFreeListingAllowance({
      listingsUsedThisMonth: 2,
      addingCount: 5,
    });
    const pay = enforceAdditionalListingPayment({ extraCovered: r.extraCovered });
    expect(pay.payCents).toBe(r.extraCostCents);
    expect(pay.currency).toBe("EUR");
    expect(pay.perListingCents).toBe(NEX_SELL_EXTRA_LISTING_CENTS_EUR);
  });
});

// ---------------------------------------------------------------------------
// Checkout → payment flow proof
// ---------------------------------------------------------------------------

describe("Checkout → payment · full happy path", () => {
  it("binds subscription on checkout.session.completed, grants access on invoice.payment_succeeded", async () => {
    const store = new InMemoryBillingStore();
    const stripeMock = {
      createCheckoutSession: async () => ({
        id: "cs_hp_stripe",
        url: "https://checkout.stripe/hp",
      }),
    };
    const checkout = await createCheckoutSession(
      {
        nexAccountId: "acct_hp",
        product: "shop",
        intendedTier: "standard",
        successUrl: "https://nex/app/success",
        cancelUrl: "https://nex/app/cancel",
        getPriceIdForTier: () => "price_shop_standard",
      },
      store,
      stripeMock,
      new Date("2026-11-02T00:00:00Z"),
    );
    expect(checkout.ok).toBe(true);

    // Stripe webhook · checkout.session.completed arrives
    await processStripeEvent(
      checkoutSessionCompletedEvent(
        "evt_hp_cs",
        "cs_hp_stripe",
        "cus_hp",
        "sub_hp",
        new Date("2026-11-02T00:01:00Z"),
      ),
      store,
      new Date("2026-11-02T00:01:00Z"),
    );
    const row = await store.readCheckoutSessionByStripeSessionId("cs_hp_stripe");
    expect(row!.status).toBe("completed");
    expect(row!.stripeSubscriptionId).toBe("sub_hp");

    // Still no paid access until invoice.payment_succeeded
    const preAccess = await store.readProductView("acct_hp", "shop");
    expect(preAccess!.snapshot.stripeSubscriptionId).toBe("sub_hp");

    // Now subscription.created pre-sets tier · requires registry
    const env = new Map<string, string>([
      [PRICE_ENV_VARS.shop.standard, "price_shopstandard01abcd"],
    ]);
    const registry = buildPriceRegistry({ getEnv: (k) => env.get(k) });
    await processStripeEvent(
      subscriptionCreatedEvent(
        "evt_hp_sc",
        "sub_hp",
        "cus_hp",
        "price_shopstandard01abcd",
      ),
      store,
      new Date("2026-11-02T00:02:00Z"),
      { priceRegistry: registry },
    );
    const afterSc = await store.readProductView("acct_hp", "shop");
    expect(afterSc!.snapshot.tier).toBe("standard");
    expect(afterSc!.snapshot.status).toBe("incomplete");
    expect(accessLevel(afterSc!, new Date("2026-11-02T00:03:00Z"))).toBe("none");

    // Payment succeeds · access granted
    await processStripeEvent(
      invoicePaymentSucceededEvent(
        "evt_hp_pay",
        "sub_hp",
        "inv_hp",
        new Date("2026-12-02T00:00:00Z"),
      ),
      store,
      new Date("2026-11-02T00:04:00Z"),
    );
    const afterPay = await store.readProductView("acct_hp", "shop");
    expect(afterPay!.snapshot.status).toBe("active");
    expect(accessLevel(afterPay!, new Date("2026-11-15T00:00:00Z"))).toBe(
      "full",
    );
  });
});
