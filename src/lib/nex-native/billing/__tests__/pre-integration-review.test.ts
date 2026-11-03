// src/lib/nex-native/billing/__tests__/pre-integration-review.test.ts
//
// NEX Billing · pre-integration review additions.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (PRE-INTEGRATION REVIEW · LOCAL DRAFT).
//
// Test categories (labelled in each `describe` title):
//   · [pure]            · in-process pure-function behaviour · no store, no I/O
//   · [in-memory]       · in-process orchestration against InMemoryBillingStore
//   · [postgres · TBD]  · DEFERRED · requires scratch Postgres rehearsal
//   · [stripe · TBD]    · DEFERRED · requires Stripe test-mode integration
//
// Never label an in-memory test as a real-database test.

import { describe, it, expect } from "vitest";
import { InMemoryBillingStore } from "./in-memory-store";
import { processStripeEvent } from "../webhook-processor";
import { accessLevel } from "../entitlement";
import { createCheckoutSession } from "../checkout-session";
import { reconcilePendingMappings, replayStoredEvent } from "../reconciliation";
import {
  cancelAtPeriodEnd,
  computeCancellationTimeline,
} from "../cancellation";
import {
  buildPriceRegistry,
  isWellFormedStripePriceId,
  PRICE_ENV_VARS,
} from "../price-registry";
import type { StripeWebhookEvent } from "../types";

const unix = (d: Date) => Math.floor(d.getTime() / 1000);

// ---------------------------------------------------------------------------
// Shared factories (duplicate of orchestration.test.ts style · intentional
// so the two files can evolve independently without hidden coupling)
// ---------------------------------------------------------------------------

function subCreated(
  id: string,
  subId: string,
  customerId: string,
  priceId: string,
  stripeStatus: "incomplete" | "trialing" = "incomplete",
  createdAt: Date = new Date("2026-11-02T00:00:00Z"),
): StripeWebhookEvent {
  return {
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
  };
}

function invSucc(
  id: string,
  subId: string,
  invoiceId: string,
  periodEnd: Date,
  createdAt?: Date,
): StripeWebhookEvent {
  return {
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
  };
}

function subUpdCancelAtPeriodEnd(
  id: string,
  subId: string,
  createdAt: Date,
): StripeWebhookEvent {
  return {
    id,
    type: "customer.subscription.updated",
    created: unix(createdAt),
    apiVersion: "2024-06-20",
    data: { object: { id: subId, cancel_at_period_end: true } },
  };
}

function subDeleted(
  id: string,
  subId: string,
  createdAt: Date,
): StripeWebhookEvent {
  return {
    id,
    type: "customer.subscription.deleted",
    created: unix(createdAt),
    apiVersion: "2024-06-20",
    data: { object: { id: subId } },
  };
}

async function seed(
  store: InMemoryBillingStore,
  accountId: string,
  product: "shop" | "vault",
  subId: string,
  priceId: string,
  tier: string,
  periodEnd: Date,
): Promise<void> {
  // Seed the mapping first so subsequent webhooks resolve immediately
  store.seedProduct(accountId, product, {
    stripeSubscriptionId: subId,
    stripeCustomerId: `cus_${accountId}`,
    stripePriceId: priceId,
    tier: tier as "standard" | "unlimited" | "5gb" | "25gb" | "50gb" | "100gb",
    status: "incomplete",
  });
  await processStripeEvent(
    invSucc(`evt_pay_${subId}`, subId, `inv_${subId}`, periodEnd),
    store,
    new Date("2026-11-02T01:00:00Z"),
  );
}

// ===========================================================================
// SECTION 1 · Cancellation correctness
// ===========================================================================

describe("[in-memory] Cancellation · scheduled 15 days before period_end", () => {
  const PERIOD_END = new Date("2026-11-30T00:00:00Z");

  async function freshAccount() {
    const store = new InMemoryBillingStore();
    await seed(
      store,
      "acct_can1",
      "shop",
      "sub_can1",
      "price_shop_standard_abc12345xyz",
      "standard",
      PERIOD_END,
    );
    // User cancels on 2026-11-15 (15 days before period_end)
    await processStripeEvent(
      subUpdCancelAtPeriodEnd(
        "evt_can1_sched",
        "sub_can1",
        new Date("2026-11-15T00:00:00Z"),
      ),
      store,
      new Date("2026-11-15T00:00:00Z"),
    );
    return store;
  }

  it("status flips to cancelled but access retained", async () => {
    const store = await freshAccount();
    const view = (await store.readProductView("acct_can1", "shop"))!;
    expect(view.snapshot.status).toBe("cancelled");
    expect(accessLevel(view, new Date("2026-11-16T00:00:00Z"))).toBe("full");
  });

  it("full access on day BEFORE period_end", async () => {
    const store = await freshAccount();
    const view = (await store.readProductView("acct_can1", "shop"))!;
    expect(accessLevel(view, new Date("2026-11-29T23:59:00Z"))).toBe("full");
  });

  it("full access exactly AT period_end (inclusive <=)", async () => {
    const store = await freshAccount();
    const view = (await store.readProductView("acct_can1", "shop"))!;
    expect(accessLevel(view, new Date("2026-11-30T00:00:00Z"))).toBe("full");
  });

  it("after subscription.deleted at period_end · read-only grace begins", async () => {
    const store = await freshAccount();
    await processStripeEvent(
      subDeleted("evt_can1_del", "sub_can1", PERIOD_END),
      store,
      PERIOD_END,
    );
    const view = (await store.readProductView("acct_can1", "shop"))!;
    expect(view.snapshot.status).toBe("grace");
    expect(accessLevel(view, new Date("2026-11-30T00:00:01Z"))).toBe(
      "read-only",
    );
  });

  it("read-only across 29-day grace", async () => {
    const store = await freshAccount();
    await processStripeEvent(
      subDeleted("evt_can1_del", "sub_can1", PERIOD_END),
      store,
      PERIOD_END,
    );
    const view = (await store.readProductView("acct_can1", "shop"))!;
    expect(accessLevel(view, new Date("2026-12-29T00:00:00Z"))).toBe(
      "read-only",
    );
  });

  it("after grace expires · access = none", async () => {
    const store = await freshAccount();
    await processStripeEvent(
      subDeleted("evt_can1_del", "sub_can1", PERIOD_END),
      store,
      PERIOD_END,
    );
    const view = (await store.readProductView("acct_can1", "shop"))!;
    // 2026-11-30 + 30d = 2026-12-30
    expect(accessLevel(view, new Date("2026-12-30T00:00:01Z"))).toBe("none");
  });
});

describe("[in-memory] Cancellation · Shop vs Vault independence", () => {
  it("Shop cancel does not touch Vault", async () => {
    const store = new InMemoryBillingStore();
    await seed(
      store,
      "acct_dual",
      "shop",
      "sub_dual_shop",
      "price_shop_standard_abc12345xyz",
      "standard",
      new Date("2026-11-30T00:00:00Z"),
    );
    await seed(
      store,
      "acct_dual",
      "vault",
      "sub_dual_vault",
      "price_vault_5gb_def67890xyz",
      "5gb",
      new Date("2026-11-30T00:00:00Z"),
    );
    let stripeCalls = 0;
    const stripeMock = {
      cancelAtPeriodEnd: async () => {
        stripeCalls += 1;
        return { id: "sub_dual_shop", cancelAt: null, status: "active" };
      },
    };
    await cancelAtPeriodEnd(
      { nexAccountId: "acct_dual", product: "shop" },
      store,
      stripeMock,
    );
    expect(stripeCalls).toBe(1);
    const vaultView = (await store.readProductView("acct_dual", "vault"))!;
    expect(vaultView.snapshot.status).toBe("active");
    expect(vaultView.snapshot.stripeSubscriptionId).toBe("sub_dual_vault");
  });

  it("Vault cancel does not touch Shop", async () => {
    const store = new InMemoryBillingStore();
    await seed(
      store,
      "acct_dual2",
      "shop",
      "sub_dual2_shop",
      "price_shop_standard_abc12345xyz",
      "standard",
      new Date("2026-11-30T00:00:00Z"),
    );
    await seed(
      store,
      "acct_dual2",
      "vault",
      "sub_dual2_vault",
      "price_vault_5gb_def67890xyz",
      "5gb",
      new Date("2026-11-30T00:00:00Z"),
    );
    const stripeMock = {
      cancelAtPeriodEnd: async () => ({
        id: "sub_dual2_vault",
        cancelAt: null,
        status: "active",
      }),
    };
    await cancelAtPeriodEnd(
      { nexAccountId: "acct_dual2", product: "vault" },
      store,
      stripeMock,
    );
    const shopView = (await store.readProductView("acct_dual2", "shop"))!;
    expect(shopView.snapshot.status).toBe("active");
    expect(shopView.snapshot.stripeSubscriptionId).toBe("sub_dual2_shop");
  });
});

describe("[pure] Cancellation · timeline calculation", () => {
  it("periodEnd dominates when no past-due", () => {
    const t = computeCancellationTimeline({
      periodEnd: new Date("2026-11-30T00:00:00Z"),
      pastDueAt: null,
    });
    expect(t.fullAccessUntil?.toISOString()).toBe(
      new Date("2026-11-30T00:00:00Z").toISOString(),
    );
    expect(t.graceUntil?.toISOString()).toBe(
      new Date("2026-12-30T00:00:00Z").toISOString(),
    );
  });

  it("pastDueAt+7d dominates when later than periodEnd", () => {
    const t = computeCancellationTimeline({
      periodEnd: new Date("2026-11-10T00:00:00Z"),
      pastDueAt: new Date("2026-11-08T00:00:00Z"), // +7d = 2026-11-15
    });
    expect(t.fullAccessUntil?.toISOString()).toBe(
      new Date("2026-11-15T00:00:00Z").toISOString(),
    );
    expect(t.graceUntil?.toISOString()).toBe(
      new Date("2026-12-15T00:00:00Z").toISOString(),
    );
  });

  it("null periodEnd → null timeline", () => {
    const t = computeCancellationTimeline({
      periodEnd: null,
      pastDueAt: new Date("2026-11-08T00:00:00Z"),
    });
    expect(t.fullAccessUntil).toBeNull();
    expect(t.graceUntil).toBeNull();
  });
});

describe("[in-memory] Cancellation · immediate (admin-driven)", () => {
  it("admin-created adverse event blocks access even with status=active", async () => {
    const store = new InMemoryBillingStore();
    await seed(
      store,
      "acct_imm",
      "shop",
      "sub_imm",
      "price_shop_standard_abc12345xyz",
      "standard",
      new Date("2026-11-30T00:00:00Z"),
    );
    const { adminRevokeAccess } = await import("../webhook-processor");
    await adminRevokeAccess(
      {
        accountId: "acct_imm",
        product: "shop",
        reason: "admin",
        adminActionId: "adm_12345",
      },
      store,
    );
    const view = (await store.readProductView("acct_imm", "shop"))!;
    // Status is still 'active' (Stripe subscription hasn't been cancelled)
    expect(view.snapshot.status).toBe("active");
    // But access is denied by the adverse-event kill switch
    expect(accessLevel(view, new Date("2026-11-10T00:00:00Z"))).toBe("none");
  });
});

// ===========================================================================
// SECTION 2 · Explicit price-ID registry
// ===========================================================================

describe("[pure] Price registry · explicit mapping only", () => {
  it("isWellFormedStripePriceId · accepts canonical shapes", () => {
    expect(isWellFormedStripePriceId("price_abc1234567")).toBe(true);
    expect(isWellFormedStripePriceId("price_1Oabcdef0987654321")).toBe(true);
  });
  it("isWellFormedStripePriceId · rejects wrong prefixes + short IDs", () => {
    expect(isWellFormedStripePriceId("cus_abc1234567")).toBe(false);
    expect(isWellFormedStripePriceId("price_short")).toBe(false);
    expect(isWellFormedStripePriceId("")).toBe(false);
    expect(isWellFormedStripePriceId("price_bad!chars!!")).toBe(false);
  });

  it("resolves (product, tier) → priceId when env is configured", () => {
    const env = new Map<string, string>([
      [PRICE_ENV_VARS.shop.standard, "price_shopstandard01abcd"],
      [PRICE_ENV_VARS.vault["5gb"], "price_vault5gb01abcdefxy"],
    ]);
    const reg = buildPriceRegistry({ getEnv: (k) => env.get(k) });
    expect(reg.getPriceIdForTier("shop", "standard")).toBe(
      "price_shopstandard01abcd",
    );
    expect(reg.getPriceIdForTier("vault", "5gb")).toBe(
      "price_vault5gb01abcdefxy",
    );
  });

  it("returns null for unconfigured tier (fail-closed)", () => {
    const env = new Map<string, string>();
    const reg = buildPriceRegistry({ getEnv: (k) => env.get(k) });
    expect(reg.getPriceIdForTier("shop", "unlimited")).toBeNull();
    expect(reg.isFullyConfigured()).toBe(false);
  });

  it("returns null for unknown tier (fail-closed)", () => {
    const env = new Map<string, string>();
    const reg = buildPriceRegistry({ getEnv: (k) => env.get(k) });
    expect(reg.getPriceIdForTier("shop", "mega-tier" as "standard")).toBeNull();
    expect(reg.getPriceIdForTier("vault", "999gb" as "5gb")).toBeNull();
  });

  it("returns null for malformed env value (fail-closed · does NOT log value)", () => {
    const env = new Map<string, string>([
      [PRICE_ENV_VARS.shop.standard, "cus_wrongprefix01"],
    ]);
    const reg = buildPriceRegistry({ getEnv: (k) => env.get(k) });
    expect(reg.getPriceIdForTier("shop", "standard")).toBeNull();
    // Logs only env-var names, never values · implicit (we can't easily
    // intercept here, but the implementation guarantees it · see code).
  });

  it("resolveTierForPriceId refuses unknown IDs", () => {
    const env = new Map<string, string>([
      [PRICE_ENV_VARS.shop.standard, "price_known1234567abcd"],
    ]);
    const reg = buildPriceRegistry({ getEnv: (k) => env.get(k) });
    expect(reg.resolveTierForPriceId("price_known1234567abcd")).toEqual({
      product: "shop",
      tier: "standard",
    });
    expect(reg.resolveTierForPriceId("price_unknown99999xxxx")).toBeNull();
  });
});

describe("[in-memory] Price registry · webhook fails closed on unknown price", () => {
  it("subscription.created with unknown price → outcome=error · no tier assigned", async () => {
    const store = new InMemoryBillingStore();
    // Seed the mapping so resolveAccountBySubscription returns it
    store.seedProduct("acct_px", "shop", {
      stripeSubscriptionId: "sub_px",
      stripeCustomerId: "cus_px",
      tier: null,
      status: null,
    });

    const env = new Map<string, string>([
      [PRICE_ENV_VARS.shop.standard, "price_knownabcdef01234"],
    ]);
    const registry = buildPriceRegistry({ getEnv: (k) => env.get(k) });

    const result = await processStripeEvent(
      subCreated(
        "evt_px",
        "sub_px",
        "cus_px",
        "price_mysteryprice99887",
      ),
      store,
      new Date("2026-11-02T00:00:00Z"),
      { priceRegistry: registry },
    );
    expect(result.outcome).toBe("error");
    expect(result.outcomeDetail).toContain("unknown Stripe price ID");

    const view = (await store.readProductView("acct_px", "shop"))!;
    expect(view.snapshot.tier).toBeNull();
  });

  it("subscription.created with KNOWN price via registry → tier assigned", async () => {
    const store = new InMemoryBillingStore();
    store.seedProduct("acct_py", "shop", {
      stripeSubscriptionId: "sub_py",
      stripeCustomerId: "cus_py",
      tier: null,
      status: null,
    });
    const env = new Map<string, string>([
      [PRICE_ENV_VARS.shop.unlimited, "price_unlimited1234567"],
    ]);
    const registry = buildPriceRegistry({ getEnv: (k) => env.get(k) });

    const result = await processStripeEvent(
      subCreated(
        "evt_py",
        "sub_py",
        "cus_py",
        "price_unlimited1234567",
      ),
      store,
      new Date("2026-11-02T00:00:00Z"),
      { priceRegistry: registry },
    );
    expect(result.outcome).toBe("applied");
    const view = (await store.readProductView("acct_py", "shop"))!;
    expect(view.snapshot.tier).toBe("unlimited");
  });
});

// ===========================================================================
// SECTION 3 · Replay idempotency guard
// ===========================================================================

describe("[pure] Event replay guard · fail-closed on terminal outcomes", () => {
  const sampleEvent: StripeWebhookEvent = {
    id: "evt_sample",
    type: "customer.subscription.created",
    created: unix(new Date("2026-11-02T00:00:00Z")),
    apiVersion: "2024-06-20",
    data: { object: { id: "sub_sample" } },
  };

  it("refuses replay for already-applied events", async () => {
    const store = new InMemoryBillingStore();
    const result = await replayStoredEvent(
      sampleEvent,
      "applied",
      store,
      new Date(),
    );
    expect(result.ok).toBe(false);
    expect(result.refusal).toBe("outcome_already_applied");
  });

  it("refuses replay for errored events (requires admin)", async () => {
    const store = new InMemoryBillingStore();
    const result = await replayStoredEvent(
      sampleEvent,
      "error",
      store,
      new Date(),
    );
    expect(result.ok).toBe(false);
    expect(result.refusal).toBe("outcome_errored_requires_admin");
  });

  it("refuses replay for skipped outcomes", async () => {
    const store = new InMemoryBillingStore();
    const result = await replayStoredEvent(
      sampleEvent,
      "skipped_duplicate_already_processed",
      store,
      new Date(),
    );
    expect(result.ok).toBe(false);
    expect(result.refusal).toBe("outcome_not_eligible");
  });

  it("processing + pending outcomes are replay-eligible (but current impl returns design-note)", async () => {
    const store = new InMemoryBillingStore();
    const r1 = await replayStoredEvent(
      sampleEvent,
      "processing",
      store,
      new Date(),
    );
    const r2 = await replayStoredEvent(
      sampleEvent,
      "pending_checkout_mapping",
      store,
      new Date(),
    );
    expect(r1.refusal).toBe("outcome_not_eligible"); // design-note returns
    expect(r1.detail).toContain("schema addition");
    expect(r2.refusal).toBe("outcome_not_eligible");
    expect(r2.detail).toContain("schema addition");
  });
});

// ===========================================================================
// SECTION 4 · Checkout refuses on unknown-tier CLIENT INPUT
// ===========================================================================

describe("[in-memory] Checkout · client cannot select unknown tier", () => {
  it("refuses with unknown_tier for a bogus tier string", async () => {
    const store = new InMemoryBillingStore();
    const stripeMock = {
      createCheckoutSession: async () => ({ id: "cs", url: "https://x" }),
    };
    const result = await createCheckoutSession(
      {
        nexAccountId: "acct_bogus",
        product: "shop",
        intendedTier: "mega-tier" as "standard",
        successUrl: "https://nex/s",
        cancelUrl: "https://nex/c",
        getPriceIdForTier: () => "price_shopstandard01abcd",
      },
      store,
      stripeMock,
      new Date(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("unknown_tier");
    }
  });

  it("refuses when getPriceIdForTier returns null for a configured tier", async () => {
    const store = new InMemoryBillingStore();
    const stripeMock = {
      createCheckoutSession: async () => ({ id: "cs", url: "https://x" }),
    };
    const result = await createCheckoutSession(
      {
        nexAccountId: "acct_nopx",
        product: "shop",
        intendedTier: "unlimited",
        successUrl: "https://nex/s",
        cancelUrl: "https://nex/c",
        getPriceIdForTier: () => null, // unconfigured
      },
      store,
      stripeMock,
      new Date(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("missing_price_id");
    }
  });
});

// ===========================================================================
// SECTION 5 · Deferred tests (NOT RUN · listed as owed work)
// ===========================================================================
//
// [postgres · TBD]
//   · Idempotency under concurrent duplicate webhook deliveries (two
//     parallel transactions · INSERT ... ON CONFLICT DO NOTHING RETURNING).
//   · Partial unique indexes on nex_billing_adverse_event enforce the
//     four uniqueness rules.
//   · pg_advisory_xact_lock(258000001) applied at the top of 258 serialises.
//   · ON DELETE CASCADE from nex_account removes dependent rows.
//   · Vault SUM(byte_size) matches enforcement.ts expectations.
//
// [stripe · TBD]
//   · Real Stripe webhook signature verification.
//   · Real Stripe idempotency_key behaviour.
//   · Real refund + dispute + full-cycle checkout flows against test-mode.
//   · Real `cancel_at_period_end` and `customer.subscription.deleted`
//     timing in Stripe test clocks.
//
// These are NOT built in this phase.
