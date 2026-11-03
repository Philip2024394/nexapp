// src/lib/nex-native/billing/__tests__/entitlement.test.ts
//
// NEX Billing Foundation · E1-E7 acceptance tests (pure-logic layer).
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// These tests exercise the pure entitlement.access_level() function against
// hand-crafted state fixtures matching the seven mandatory scenarios E1-E7.
//
// SCOPE LIMITATION · HONEST:
//   · These are PURE-LOGIC tests. They prove the access decision is
//     correct given a particular state in nex_account + nex_billing_adverse_event.
//   · They do NOT prove the webhook handler produces that state from a
//     Stripe event (that requires the webhook-processor module + a Postgres
//     scratch DB · neither authorised yet).
//   · They do NOT prove migration 258 applies cleanly (requires authorised
//     Postgres rehearsal).
//
// What they DO prove:
//   · The access rule correctly handles multi-adverse-event state (E1).
//   · Historical refunds against old periods do NOT block later paid
//     periods (E2).
//   · An open adverse row refuses new-checkout gate (E3 · via helper).
//   · Stale subscription IDs on an event-log row do not corrupt access (E4
//     · via subscription-ID scoping assertions).
//   · The 7-day retry + 30-day grace windows compute correctly (E7).
//
// E5 and E6 are PROCESSOR concerns (atomic claim + reconciliation of
// pending-checkout-mapping) · documented in this file as "deferred to the
// webhook-processor tests" which require either real Postgres or a more
// detailed in-memory store.

import { describe, it, expect } from "vitest";
import {
  accessLevel,
  openAccessBlockingCount,
  shouldRefuseNewCheckout,
  computeFullAccessUntilMs,
  computeGraceCutoffMs,
  TRIALING_ACCESS_LEVEL,
} from "../entitlement";
import type {
  AccountEntitlementView,
  AdverseEventRow,
  ProductBillingSnapshot,
  AdverseType,
  SubscriptionStatus,
} from "../types";

// ---------------------------------------------------------------------------
// Test fixtures · factory helpers
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(now: Date, days: number): Date {
  return new Date(now.getTime() + days * DAY_MS);
}

function makeSnapshot(
  overrides: Partial<ProductBillingSnapshot> = {},
): ProductBillingSnapshot {
  return {
    product: "shop",
    tier: "unlimited",
    status: "active" as SubscriptionStatus,
    periodEnd: null,
    pastDueAt: null,
    stripeCustomerId: "cus_test",
    stripeSubscriptionId: "sub_test",
    stripePriceId: "price_shop_unlimited",
    ...overrides,
  };
}

function makeAdverseRow(
  overrides: Partial<AdverseEventRow> = {},
): AdverseEventRow {
  return {
    id: `ae_${Math.random().toString(36).slice(2, 10)}`,
    nexAccountId: "acct_test",
    product: "shop",
    adverseType: "dispute_pending" as AdverseType,
    stripeSubscriptionId: "sub_test",
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
    accessBlockClearedAt: null,
    accessBlockClearedBy: null,
    openedAt: new Date(),
    openedByEventId: null,
    adminActionId: null,
    ...overrides,
  };
}

function makeView(
  snapshot: Partial<ProductBillingSnapshot>,
  adverseEvents: readonly AdverseEventRow[] = [],
): AccountEntitlementView {
  return {
    accountId: "acct_test",
    product: snapshot.product ?? "shop",
    snapshot: makeSnapshot(snapshot),
    adverseEvents,
  };
}

// ===========================================================================
// E1 · Two disputes open simultaneously · one won, one lost
// ===========================================================================
describe("E1 · two disputes open simultaneously · one won, one lost", () => {
  it("blocks access while both are open", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    const view = makeView(
      { periodEnd: daysFromNow(now, 10), status: "active" },
      [
        makeAdverseRow({
          id: "ae_d1",
          adverseType: "dispute_pending",
          stripeDisputeId: "dp_1",
          stripeDisputeStatus: "pending",
          accessBlocking: true,
          accessBlockClearedAt: null,
        }),
        makeAdverseRow({
          id: "ae_d2",
          adverseType: "dispute_pending",
          stripeDisputeId: "dp_2",
          stripeDisputeStatus: "pending",
          accessBlocking: true,
          accessBlockClearedAt: null,
        }),
      ],
    );
    expect(accessLevel(view, now)).toBe("none");
    expect(openAccessBlockingCount(view.adverseEvents)).toBe(2);
  });

  it("still blocks access after only one is resolved (won)", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    const view = makeView(
      { periodEnd: daysFromNow(now, 10), status: "active" },
      [
        // D1 resolved: won + cleared
        makeAdverseRow({
          id: "ae_d1",
          adverseType: "dispute_pending",
          stripeDisputeId: "dp_1",
          stripeDisputeStatus: "won",
          stripeDisputeClosedAt: new Date("2026-11-01T00:00:00Z"),
          accessBlocking: true,
          accessBlockClearedAt: new Date("2026-11-01T00:00:00Z"),
          accessBlockClearedBy: "dispute_won",
        }),
        // D2 still pending
        makeAdverseRow({
          id: "ae_d2",
          adverseType: "dispute_pending",
          stripeDisputeId: "dp_2",
          stripeDisputeStatus: "pending",
          accessBlocking: true,
          accessBlockClearedAt: null,
        }),
      ],
    );
    expect(accessLevel(view, now)).toBe("none");
    expect(openAccessBlockingCount(view.adverseEvents)).toBe(1);
  });

  it("still blocks access when D2 is LOST (Stripe-resolved · access-still-blocked)", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    const view = makeView(
      { periodEnd: daysFromNow(now, 10), status: "active" },
      [
        makeAdverseRow({
          id: "ae_d1",
          stripeDisputeStatus: "won",
          stripeDisputeClosedAt: new Date("2026-11-01T00:00:00Z"),
          accessBlocking: true,
          accessBlockClearedAt: new Date("2026-11-01T00:00:00Z"),
          accessBlockClearedBy: "dispute_won",
        }),
        // D2 lost · Stripe-closed BUT NEX access-block NOT cleared.
        // Needs admin action.
        makeAdverseRow({
          id: "ae_d2",
          adverseType: "dispute_lost",
          stripeDisputeStatus: "lost",
          stripeDisputeClosedAt: new Date("2026-11-01T12:00:00Z"),
          accessBlocking: true,
          accessBlockClearedAt: null, // critical · lost ≠ access-cleared
        }),
      ],
    );
    expect(accessLevel(view, now)).toBe("none");
    expect(openAccessBlockingCount(view.adverseEvents)).toBe(1);
  });

  it("restores access only after admin clears the lost dispute", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    const view = makeView(
      { periodEnd: daysFromNow(now, 10), status: "active" },
      [
        makeAdverseRow({
          id: "ae_d1",
          stripeDisputeStatus: "won",
          stripeDisputeClosedAt: new Date("2026-11-01T00:00:00Z"),
          accessBlocking: true,
          accessBlockClearedAt: new Date("2026-11-01T00:00:00Z"),
          accessBlockClearedBy: "dispute_won",
        }),
        makeAdverseRow({
          id: "ae_d2",
          adverseType: "dispute_lost",
          stripeDisputeStatus: "lost",
          stripeDisputeClosedAt: new Date("2026-11-01T12:00:00Z"),
          accessBlocking: true,
          accessBlockClearedAt: new Date("2026-11-01T18:00:00Z"), // admin
          accessBlockClearedBy: "admin",
        }),
      ],
    );
    expect(accessLevel(view, now)).toBe("full");
    expect(openAccessBlockingCount(view.adverseEvents)).toBe(0);
  });
});

// ===========================================================================
// E2 · Full refund of an older paid period after a newer period has been paid
// ===========================================================================
describe("E2 · old-period refund does not block later paid period", () => {
  it("historical refund (access_blocking=false) does not block access", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    // Current paid period P2 extends to Dec 30
    const view = makeView(
      { periodEnd: new Date("2026-12-30T00:00:00Z"), status: "active" },
      [
        // Refund of period P1 (ended Oct 30 · before P2) · historical only.
        // The webhook handler (NOT TESTED HERE · lives in webhook-processor
        // module when built) is responsible for setting access_blocking=false
        // when target_period_end < latest_paid_period_end.
        makeAdverseRow({
          id: "ae_refund_old",
          adverseType: "full_refund",
          stripeRefundId: "re_old_P1",
          stripeDisputeId: null,
          invoicePeriodStart: new Date("2026-10-01T00:00:00Z"),
          invoicePeriodEnd: new Date("2026-10-30T00:00:00Z"),
          accessBlocking: false, // KEY · historical, not blocking
          accessBlockClearedAt: null,
        }),
      ],
    );
    expect(accessLevel(view, now)).toBe("full");
    expect(openAccessBlockingCount(view.adverseEvents)).toBe(0);
  });

  it("full refund of CURRENT period DOES block access", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    const view = makeView(
      { periodEnd: new Date("2026-12-30T00:00:00Z"), status: "active" },
      [
        // Refund of the CURRENT period (P2) · webhook sets access_blocking=true.
        makeAdverseRow({
          id: "ae_refund_current",
          adverseType: "full_refund",
          stripeRefundId: "re_current_P2",
          invoicePeriodStart: new Date("2026-11-01T00:00:00Z"),
          invoicePeriodEnd: new Date("2026-12-30T00:00:00Z"),
          accessBlocking: true, // webhook decided this · same period as current
          accessBlockClearedAt: null,
        }),
      ],
    );
    expect(accessLevel(view, now)).toBe("none");
  });

  it("partial refund never blocks regardless of period", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    const view = makeView(
      { periodEnd: new Date("2026-12-30T00:00:00Z"), status: "active" },
      [
        makeAdverseRow({
          id: "ae_partial",
          adverseType: "partial_refund",
          stripeRefundId: "re_partial",
          invoicePeriodStart: new Date("2026-11-01T00:00:00Z"),
          invoicePeriodEnd: new Date("2026-12-30T00:00:00Z"),
          accessBlocking: false,
          accessBlockClearedAt: null,
        }),
      ],
    );
    expect(accessLevel(view, now)).toBe("full");
  });
});

// ===========================================================================
// E3 · Unresolved dispute prevents new checkout from bypassing restriction
// ===========================================================================
describe("E3 · open adverse event refuses new checkout", () => {
  it("shouldRefuseNewCheckout returns true when any blocker is open", () => {
    const view = makeView({ tier: null }, [
      // Even with no current subscription, an unresolved historical blocker
      // must prevent a new checkout session.
      makeAdverseRow({
        id: "ae_unresolved",
        adverseType: "dispute_lost",
        stripeDisputeStatus: "lost",
        stripeDisputeId: "dp_old",
        accessBlocking: true,
        accessBlockClearedAt: null,
      }),
    ]);
    const r = shouldRefuseNewCheckout(view);
    expect(r.refuse).toBe(true);
    expect(r.reason).toContain("1 open access-blocking adverse event");
  });

  it("shouldRefuseNewCheckout returns false when all events cleared", () => {
    const view = makeView({ tier: null }, [
      makeAdverseRow({
        id: "ae_resolved",
        stripeDisputeStatus: "won",
        accessBlocking: true,
        accessBlockClearedAt: new Date(),
        accessBlockClearedBy: "dispute_won",
      }),
    ]);
    const r = shouldRefuseNewCheckout(view);
    expect(r.refuse).toBe(false);
    expect(r.reason).toBeNull();
  });
});

// ===========================================================================
// E4 · Delayed old-subscription event doesn't alter current subscription
// ===========================================================================
describe("E4 · stale-subscription scoping protects the current entitlement", () => {
  it("current subscription state is unaffected by orphan adverse row with different sub_id", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    // Current subscription SUB-B is active · period extends to Dec 2.
    // An old adverse row references SUB-A (a historical subscription).
    // The entitlement rule queries by (account, product) · it doesn't scope
    // adverse events by subscription · so if a stale row is incorrectly
    // flagged access_blocking=true, access would be denied.
    //
    // This test documents the EXPECTED behaviour: webhook handler must set
    // access_blocking=false (historical) for adverse rows targeting an old
    // subscription · the handler relies on the stripe_subscription_id
    // comparison before inserting. This test validates the access rule
    // honours whatever the webhook decided.
    const view = makeView(
      {
        stripeSubscriptionId: "sub_B",
        periodEnd: new Date("2026-12-02T00:00:00Z"),
        status: "active",
      },
      [
        // Old adverse row from SUB-A · correctly marked historical by the
        // handler · access_blocking=false
        makeAdverseRow({
          id: "ae_old_sub",
          stripeSubscriptionId: "sub_A",
          adverseType: "full_refund",
          stripeRefundId: "re_old_sub_A",
          invoicePeriodStart: new Date("2026-09-01T00:00:00Z"),
          invoicePeriodEnd: new Date("2026-09-30T00:00:00Z"),
          accessBlocking: false, // webhook correctly marked historical
          accessBlockClearedAt: null,
        }),
      ],
    );
    expect(accessLevel(view, now)).toBe("full");
  });

  it("even an open adverse row with wrong sub_id (buggy webhook) still blocks · defense-in-depth", () => {
    // Owner-flagged risk: a bug in the webhook sets access_blocking=true
    // on a stale-subscription adverse event. The entitlement rule errs on
    // the side of DENY because that's the safer failure mode. This test
    // documents that behaviour so a future refactor doesn't accidentally
    // "fix" it to grant access.
    const now = new Date("2026-11-02T00:00:00Z");
    const view = makeView(
      {
        stripeSubscriptionId: "sub_B",
        periodEnd: new Date("2026-12-02T00:00:00Z"),
        status: "active",
      },
      [
        makeAdverseRow({
          id: "ae_buggy",
          stripeSubscriptionId: "sub_A", // old sub
          adverseType: "full_refund",
          stripeRefundId: "re_buggy",
          accessBlocking: true, // webhook mistake
          accessBlockClearedAt: null,
        }),
      ],
    );
    expect(accessLevel(view, now)).toBe("none"); // deny · safer
  });
});

// ===========================================================================
// E5 · Webhook before checkout mapping (orchestration · partially covered here)
// ===========================================================================
describe("E5 · access level during pending-checkout-mapping (orchestration note)", () => {
  it("account with no tier returns 'none' regardless of inflight checkout", () => {
    // The webhook-processor module (built separately · requires the DB
    // adapter) handles the pending-mapping lifecycle. From the entitlement
    // rule's perspective, until the checkout + first invoice.payment_succeeded
    // complete, the account's tier remains NULL and access is 'none'.
    const view = makeView({ tier: null, status: null });
    expect(accessLevel(view, new Date())).toBe("none");
  });

  it("account with incomplete status (sub created · no payment yet) returns 'none'", () => {
    // customer.subscription.created transitions status to 'incomplete'.
    // 'incomplete' explicitly denies access until invoice.payment_succeeded
    // flips it to 'active'. See 258 CHECK extension + entitlement rule.
    const view = makeView({
      tier: "unlimited",
      status: "incomplete",
      periodEnd: new Date("2026-12-01T00:00:00Z"),
    });
    expect(accessLevel(view, new Date())).toBe("none");
  });
});

// ===========================================================================
// E6 · Duplicate webhook deliveries · atomic claim (orchestration · deferred)
// ===========================================================================
describe("E6 · duplicate webhook delivery semantics (orchestration note)", () => {
  // Full test requires the webhook-processor module backed by a Postgres
  // scratch DB (not authorised yet). What the entitlement module guarantees:
  // regardless of HOW MANY webhook deliveries arrive, the ACCESS DECISION is
  // a pure function of the stored state · so if the atomic claim prevents
  // double-processing, access can't be double-affected.
  it("re-reading the same state yields the same access decision (determinism)", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    const view = makeView(
      { periodEnd: daysFromNow(now, 10), status: "active" },
      [],
    );
    const first = accessLevel(view, now);
    const second = accessLevel(view, now);
    expect(first).toBe(second);
    expect(first).toBe("full");
  });
});

// ===========================================================================
// E7 · Failed renewal followed by successful retry
// ===========================================================================
describe("E7 · 7-day retry window extends full access past period_end", () => {
  it("during past_due · full access while now <= past_due_at + 7 days", () => {
    const now = new Date("2026-11-05T00:00:00Z");
    // Payment failed Nov 1 · period_end Nov 3 · past_due_at = Nov 1.
    // Retry window: Nov 1 + 7d = Nov 8. Now Nov 5 → still full access.
    const view = makeView({
      status: "past_due",
      periodEnd: new Date("2026-11-03T00:00:00Z"),
      pastDueAt: new Date("2026-11-01T00:00:00Z"),
    });
    expect(accessLevel(view, now)).toBe("full");
    const expectedUntil = new Date("2026-11-08T00:00:00Z").getTime();
    expect(computeFullAccessUntilMs(view)).toBe(expectedUntil);
  });

  it("after retry succeeds · status flips to active · period_end advances · past_due_at cleared", () => {
    // Webhook of invoice.payment_succeeded sets status='active', updates
    // period_end to new current_period_end, nulls past_due_at.
    const now = new Date("2026-11-05T00:00:00Z");
    const view = makeView({
      status: "active",
      periodEnd: new Date("2026-12-05T00:00:00Z"),
      pastDueAt: null,
    });
    expect(accessLevel(view, now)).toBe("full");
  });

  it("after 7-day retry expires without recovery · 30-day read-only grace", () => {
    const now = new Date("2026-11-10T00:00:00Z"); // day 9 after past_due_at
    const view = makeView({
      status: "grace",
      periodEnd: new Date("2026-11-03T00:00:00Z"),
      pastDueAt: new Date("2026-11-01T00:00:00Z"),
    });
    expect(accessLevel(view, now)).toBe("read-only");
  });

  it("after 7-day retry + 30-day grace both expire · no access", () => {
    const now = new Date("2026-12-10T00:00:00Z"); // past grace cutoff
    const view = makeView({
      status: "grace",
      periodEnd: new Date("2026-11-03T00:00:00Z"),
      pastDueAt: new Date("2026-11-01T00:00:00Z"),
    });
    expect(accessLevel(view, now)).toBe("none");
    const cutoff = computeGraceCutoffMs(view);
    expect(cutoff).not.toBeNull();
    expect(cutoff).toBeLessThan(now.getTime());
  });

  it("full_access_until GREATEST rule · period_end wins when later than past_due extension", () => {
    const view = makeView({
      status: "past_due",
      periodEnd: new Date("2026-12-01T00:00:00Z"), // 30 days from past_due_at
      pastDueAt: new Date("2026-11-01T00:00:00Z"), // + 7 days = Nov 8
    });
    // GREATEST(Dec 1, Nov 8) = Dec 1
    expect(computeFullAccessUntilMs(view)).toBe(
      new Date("2026-12-01T00:00:00Z").getTime(),
    );
  });

  it("full_access_until GREATEST rule · past_due extension wins when later than period_end", () => {
    const view = makeView({
      status: "past_due",
      periodEnd: new Date("2026-11-03T00:00:00Z"), // short period
      pastDueAt: new Date("2026-11-01T00:00:00Z"), // + 7d = Nov 8
    });
    // GREATEST(Nov 3, Nov 8) = Nov 8
    expect(computeFullAccessUntilMs(view)).toBe(
      new Date("2026-11-08T00:00:00Z").getTime(),
    );
  });
});

// ===========================================================================
// Policy-neutral default guard · DRAFT trialing policy
// ===========================================================================
describe("trialing status · policy default is 'none' (option A · owner decision pending)", () => {
  it("TRIALING_ACCESS_LEVEL constant drives trial access", () => {
    // This test exists so a future PR that flips the constant to 'full' or
    // 'read-only' triggers a CI failure requiring explicit owner authorisation
    // of the policy change.
    expect(TRIALING_ACCESS_LEVEL).toBe("none");
  });

  it("account in 'trialing' status returns TRIALING_ACCESS_LEVEL", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    const view = makeView({
      status: "trialing",
      periodEnd: daysFromNow(now, 7),
    });
    expect(accessLevel(view, now)).toBe(TRIALING_ACCESS_LEVEL);
  });
});

// ===========================================================================
// Shop/Vault independence
// ===========================================================================
describe("Shop and Vault access is computed independently", () => {
  it("adverse events for Vault do not affect Shop access and vice-versa", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    const shopView: AccountEntitlementView = {
      accountId: "acct_test",
      product: "shop",
      snapshot: makeSnapshot({
        product: "shop",
        tier: "unlimited",
        status: "active",
        periodEnd: daysFromNow(now, 10),
      }),
      // Caller passes only Shop's adverse events · Vault rows must be
      // excluded upstream. This test documents the contract.
      adverseEvents: [],
    };

    const vaultView: AccountEntitlementView = {
      accountId: "acct_test",
      product: "vault",
      snapshot: makeSnapshot({
        product: "vault",
        tier: "5gb",
        status: "active",
        periodEnd: daysFromNow(now, 10),
      }),
      adverseEvents: [
        makeAdverseRow({
          product: "vault",
          adverseType: "fraud",
          stripeDisputeId: null,
          stripeRefundId: null,
          accessBlocking: true,
          accessBlockClearedAt: null,
          adminActionId: "fraud_vault_only_1",
        }),
      ],
    };

    expect(accessLevel(shopView, now)).toBe("full");
    expect(accessLevel(vaultView, now)).toBe("none");
  });
});
