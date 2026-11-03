// src/lib/nex-native/billing/__tests__/supabase-store-sql.test.ts
//
// NEX Billing · [in-memory] SQL-shape tests for SupabaseBillingStore.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT).
//
// Purpose · verify the adapter sends the RIGHT SQL + parameters for each
// method, with the RIGHT error-handling branch for unique violations.
// Uses a hand-rolled fake `pg.Pool` client that records every query.
//
// IMPORTANT · THESE TESTS DO NOT COUNT AS GATE-1 VERIFICATION.
// They prove the adapter's SQL shape is correct against the designed
// schema, but they do NOT prove:
//   · the schema in migration 258 actually produces the behaviour we rely on
//   · partial unique indexes fire correctly
//   · ON CONFLICT DO NOTHING RETURNING actually returns zero rows on dup
//   · ON DELETE CASCADE propagates
//   · pg_advisory_xact_lock serialises
//
// Those remain Gate-1 (scratch rehearsal) R-1..R-11.

import { describe, it, expect, beforeEach } from "vitest";
import { SupabaseBillingStore } from "../supabase-store";
import type { Pool, QueryResult } from "pg";

// ---------------------------------------------------------------------------
// Fake pg.Pool · records every query, returns scripted responses
// ---------------------------------------------------------------------------

interface Call {
  readonly text: string;
  readonly values: readonly unknown[];
}

class FakePool {
  readonly calls: Call[] = [];
  private responses: Array<QueryResult<Record<string, unknown>> | Error> = [];

  queueOk<T extends Record<string, unknown>>(rows: T[]): void {
    this.responses.push({
      command: "",
      rowCount: rows.length,
      oid: 0,
      fields: [],
      rows,
    } as unknown as QueryResult<Record<string, unknown>>);
  }

  queueError(err: Error): void {
    this.responses.push(err);
  }

  async query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    this.calls.push({ text, values: values ?? [] });
    if (this.responses.length === 0) {
      throw new Error(`FakePool · no response queued for: ${text.slice(0, 50)}`);
    }
    const next = this.responses.shift()!;
    if (next instanceof Error) throw next;
    return next as QueryResult<T>;
  }

  async connect() {
    // withTransaction uses pool.connect() · we return `this` to let the
    // transaction code share the same call list.
    return {
      query: this.query.bind(this),
      release: () => {},
    };
  }

  async end(): Promise<void> {}
}

function makeStore(fake: FakePool): SupabaseBillingStore {
  return new SupabaseBillingStore({ source: fake as unknown as Pool });
}

// ---------------------------------------------------------------------------
// claimEvent
// ---------------------------------------------------------------------------

describe("[in-memory] SupabaseBillingStore.claimEvent", () => {
  it("emits INSERT ... ON CONFLICT DO NOTHING RETURNING + returns isClaimed=true on RETURNING hit", async () => {
    const fake = new FakePool();
    fake.queueOk([{ stripe_event_id: "evt_1" }]);
    const store = makeStore(fake);

    const r = await store.claimEvent({
      stripeEventId: "evt_1",
      stripeEventType: "customer.subscription.created",
      stripeEventCreated: new Date("2026-11-02T00:00:00Z"),
      stripeApiVersion: "2024-06-20",
    });

    expect(r.isClaimed).toBe(true);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].text).toMatch(/INSERT INTO nex_billing_event_log/);
    expect(fake.calls[0].text).toMatch(/ON CONFLICT \(stripe_event_id\) DO NOTHING/);
    expect(fake.calls[0].text).toMatch(/RETURNING stripe_event_id/);
    expect(fake.calls[0].values[0]).toBe("evt_1");
    expect(fake.calls[0].values[1]).toBe("customer.subscription.created");
  });

  it("returns isClaimed=false when RETURNING yields zero rows (duplicate delivery)", async () => {
    const fake = new FakePool();
    fake.queueOk([]); // conflict · no row returned
    const store = makeStore(fake);

    const r = await store.claimEvent({
      stripeEventId: "evt_dup",
      stripeEventType: "customer.subscription.created",
      stripeEventCreated: new Date(),
      stripeApiVersion: "2024-06-20",
    });

    expect(r.isClaimed).toBe(false);
    expect(r.stripeEventId).toBe("evt_dup");
  });
});

// ---------------------------------------------------------------------------
// finalizeEvent
// ---------------------------------------------------------------------------

describe("[in-memory] SupabaseBillingStore.finalizeEvent", () => {
  it("UPDATES outcome + outcome_detail + processed_at by stripe_event_id", async () => {
    const fake = new FakePool();
    fake.queueOk([{}]); // rowCount=1
    const store = makeStore(fake);

    await store.finalizeEvent({
      stripeEventId: "evt_1",
      outcome: "applied",
      outcomeDetail: "ok",
    });

    expect(fake.calls[0].text).toMatch(/UPDATE nex_billing_event_log/);
    expect(fake.calls[0].text).toMatch(/SET outcome\s*=\s*\$1/);
    expect(fake.calls[0].text).toMatch(/outcome_detail\s*=\s*\$2/);
    expect(fake.calls[0].text).toMatch(/processed_at\s*=\s*NOW\(\)/);
    expect(fake.calls[0].values).toEqual(["applied", "ok", "evt_1"]);
  });

  it("throws when the event-log row is missing (rowCount=0)", async () => {
    const fake = new FakePool();
    fake.queueOk([]); // rowCount=0
    const store = makeStore(fake);
    await expect(
      store.finalizeEvent({
        stripeEventId: "evt_missing",
        outcome: "applied",
      }),
    ).rejects.toThrow(/no event-log row/);
  });
});

// ---------------------------------------------------------------------------
// resolveAccountBySubscription · searches BOTH shop + vault columns
// ---------------------------------------------------------------------------

describe("[in-memory] SupabaseBillingStore.resolveAccountBySubscription", () => {
  it("CASE-expresses which column matched · 'shop' or 'vault'", async () => {
    const fake = new FakePool();
    fake.queueOk([{ id: "acct_1", which: "shop" }]);
    const store = makeStore(fake);

    const r = await store.resolveAccountBySubscription("sub_abc");

    expect(r).toEqual({ accountId: "acct_1", product: "shop" });
    expect(fake.calls[0].text).toMatch(/shop_stripe_subscription_id = \$1/);
    expect(fake.calls[0].text).toMatch(/vault_stripe_subscription_id = \$1/);
    expect(fake.calls[0].text).toMatch(/WHEN shop_stripe_subscription_id = \$1\s+THEN 'shop'/);
    expect(fake.calls[0].text).toMatch(/WHEN vault_stripe_subscription_id = \$1\s+THEN 'vault'/);
    expect(fake.calls[0].values).toEqual(["sub_abc"]);
  });

  it("returns null when no match", async () => {
    const fake = new FakePool();
    fake.queueOk([]); // rowCount=0 · no match
    const store = makeStore(fake);
    const r = await store.resolveAccountBySubscription("sub_nope");
    expect(r).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readProductView · scopes to EITHER shop OR vault columns · no cross-leak
// ---------------------------------------------------------------------------

describe("[in-memory] SupabaseBillingStore.readProductView", () => {
  it("Shop query selects ONLY shop_* columns · aliases to canonical names", async () => {
    const fake = new FakePool();
    fake.queueOk([
      {
        account_id: "acct_1",
        tier: "standard",
        status: "active",
        period_end: new Date("2026-12-01T00:00:00Z"),
        past_due_at: null,
        stripe_customer_id: "cus_1",
        stripe_subscription_id: "sub_1",
        stripe_price_id: "price_1",
      },
    ]);
    fake.queueOk([]); // adverse events · empty
    const store = makeStore(fake);

    const view = await store.readProductView("acct_1", "shop");

    expect(view).not.toBeNull();
    expect(view!.snapshot.tier).toBe("standard");
    expect(view!.snapshot.status).toBe("active");
    expect(view!.adverseEvents).toHaveLength(0);

    // Confirm the account query ONLY mentions shop_*, never vault_*
    const accountSql = fake.calls[0].text;
    expect(accountSql).toMatch(/shop_tier/);
    expect(accountSql).toMatch(/shop_period_end/);
    expect(accountSql).toMatch(/shop_stripe_subscription_id/);
    expect(accountSql).not.toMatch(/vault_tier/);
    expect(accountSql).not.toMatch(/vault_period_end/);
    // Adverse-event query scopes to product='shop'
    expect(fake.calls[1].text).toMatch(/FROM nex_billing_adverse_event/);
    expect(fake.calls[1].values).toEqual(["acct_1", "shop"]);
  });

  it("Vault query selects ONLY vault_* columns", async () => {
    const fake = new FakePool();
    fake.queueOk([
      {
        account_id: "acct_1",
        tier: "5gb",
        status: "active",
        period_end: new Date(),
        past_due_at: null,
        stripe_customer_id: "cus_1",
        stripe_subscription_id: "sub_v",
        stripe_price_id: "price_v",
      },
    ]);
    fake.queueOk([]);
    const store = makeStore(fake);

    const view = await store.readProductView("acct_1", "vault");

    const accountSql = fake.calls[0].text;
    expect(accountSql).toMatch(/vault_tier/);
    expect(accountSql).not.toMatch(/shop_tier/);
    expect(view!.snapshot.tier).toBe("5gb");
  });

  it("returns null when the account doesn't exist", async () => {
    const fake = new FakePool();
    fake.queueOk([]); // no account row
    const store = makeStore(fake);
    const view = await store.readProductView("acct_missing", "shop");
    expect(view).toBeNull();
    // adverse query not sent (early return)
    expect(fake.calls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// updateProductSubscription · writes ONLY per-product columns (R-5)
// ---------------------------------------------------------------------------

describe("[in-memory] SupabaseBillingStore.updateProductSubscription", () => {
  it("Shop · writes shop_* columns ONLY · one column per set", async () => {
    const fake = new FakePool();
    fake.queueOk([]);
    const store = makeStore(fake);

    await store.updateProductSubscription("acct_1", "shop", {
      tier: "unlimited",
      status: "active",
      periodEnd: new Date("2026-12-01T00:00:00Z"),
    });

    const sql = fake.calls[0].text;
    expect(sql).toMatch(/UPDATE nex_account SET/);
    expect(sql).toMatch(/shop_tier = \$1/);
    expect(sql).toMatch(/shop_status = \$2/);
    expect(sql).toMatch(/shop_period_end = \$3/);
    // Never touches vault_*
    expect(sql).not.toMatch(/vault_tier/);
    expect(sql).not.toMatch(/vault_status/);
    expect(sql).not.toMatch(/vault_period_end/);
  });

  it("Vault · writes vault_* columns ONLY", async () => {
    const fake = new FakePool();
    fake.queueOk([]);
    const store = makeStore(fake);

    await store.updateProductSubscription("acct_1", "vault", {
      tier: "25gb",
      stripePriceId: "price_v25",
    });

    const sql = fake.calls[0].text;
    expect(sql).toMatch(/vault_tier = \$1/);
    expect(sql).toMatch(/vault_stripe_price_id = \$2/);
    expect(sql).not.toMatch(/shop_tier/);
    expect(sql).not.toMatch(/shop_stripe_price_id/);
  });

  it("no-op when patch is empty · does not send a query", async () => {
    const fake = new FakePool();
    const store = makeStore(fake);
    await store.updateProductSubscription("acct_1", "shop", {});
    expect(fake.calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// insertCheckoutSession · R-8 · unique violation handling
// ---------------------------------------------------------------------------

describe("[in-memory] SupabaseBillingStore.insertCheckoutSession", () => {
  const row = {
    internal_session_id: "cs_internal_1",
    nex_account_id: "acct_1",
    product: "shop" as const,
    intended_tier: "standard",
    stripe_idempotency_key: "idem_1",
    stripe_checkout_session_id: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    status: "pending" as const,
    created_at: new Date(),
    completed_at: null,
  };

  it("returns the inserted row with mapped camelCase fields", async () => {
    const fake = new FakePool();
    fake.queueOk([row]);
    const store = makeStore(fake);

    const r = await store.insertCheckoutSession({
      nexAccountId: "acct_1",
      product: "shop",
      intendedTier: "standard",
      stripeIdempotencyKey: "idem_1",
    });

    expect(r.internalSessionId).toBe("cs_internal_1");
    expect(r.intendedTier).toBe("standard");
    expect(r.status).toBe("pending");
    const sql = fake.calls[0].text;
    expect(sql).toMatch(/INSERT INTO nex_billing_checkout_session/);
    expect(sql).toMatch(/RETURNING \*/);
  });

  it("surfaces unique-violation (code 23505) as a distinct Error", async () => {
    const fake = new FakePool();
    const err = Object.assign(new Error("dup"), { code: "23505", constraint: "nex_checkout_idempotency_unique" });
    fake.queueError(err);
    const store = makeStore(fake);

    await expect(
      store.insertCheckoutSession({
        nexAccountId: "acct_1",
        product: "shop",
        intendedTier: "standard",
        stripeIdempotencyKey: "idem_dup",
      }),
    ).rejects.toThrow(/duplicate stripe_idempotency_key.+nex_checkout_idempotency_unique/);
  });
});

// ---------------------------------------------------------------------------
// insertAdverseEvent · R-2 · unique-violation → null (NOT a throw)
// ---------------------------------------------------------------------------

describe("[in-memory] SupabaseBillingStore.insertAdverseEvent", () => {
  const adverseInput = {
    nexAccountId: "acct_1",
    product: "shop" as const,
    adverseType: "dispute_pending" as const,
    stripeSubscriptionId: "sub_1",
    stripeInvoiceId: null,
    stripePaymentIntentId: null,
    stripeChargeId: null,
    stripeDisputeId: "dp_1",
    stripeRefundId: null,
    invoicePeriodStart: null,
    invoicePeriodEnd: null,
    stripeDisputeStatus: "pending" as const,
    stripeDisputeClosedAt: null,
    accessBlocking: true,
    openedByEventId: "evt_1",
    adminActionId: null,
  };

  it("inserts + returns the mapped row", async () => {
    const fake = new FakePool();
    fake.queueOk([
      {
        id: "adv_1",
        nex_account_id: "acct_1",
        product: "shop",
        adverse_type: "dispute_pending",
        stripe_subscription_id: "sub_1",
        stripe_invoice_id: null,
        stripe_payment_intent_id: null,
        stripe_charge_id: null,
        stripe_dispute_id: "dp_1",
        stripe_refund_id: null,
        invoice_period_start: null,
        invoice_period_end: null,
        stripe_dispute_status: "pending",
        stripe_dispute_closed_at: null,
        access_blocking: true,
        access_block_cleared_at: null,
        access_block_cleared_by: null,
        opened_at: new Date(),
        opened_by_event_id: "evt_1",
        admin_action_id: null,
      },
    ]);
    const store = makeStore(fake);
    const r = await store.insertAdverseEvent(adverseInput);
    expect(r).not.toBeNull();
    expect(r!.adverseType).toBe("dispute_pending");
    expect(r!.accessBlocking).toBe(true);
    expect(r!.accessBlockClearedAt).toBeNull();
  });

  it("returns null on unique_violation (23505) · caller treats as 'already recorded'", async () => {
    const fake = new FakePool();
    fake.queueError(Object.assign(new Error("dup"), { code: "23505" }));
    const store = makeStore(fake);
    const r = await store.insertAdverseEvent(adverseInput);
    expect(r).toBeNull();
  });

  it("re-throws non-unique errors", async () => {
    const fake = new FakePool();
    fake.queueError(new Error("server exploded"));
    const store = makeStore(fake);
    await expect(store.insertAdverseEvent(adverseInput)).rejects.toThrow(
      "server exploded",
    );
  });
});

// ---------------------------------------------------------------------------
// clearAdverseEvent · R-3 · only clears open rows (predicate in WHERE)
// ---------------------------------------------------------------------------

describe("[in-memory] SupabaseBillingStore.clearAdverseEvent", () => {
  it("UPDATE includes access_block_cleared_at IS NULL predicate (R-3)", async () => {
    const fake = new FakePool();
    fake.queueOk([{}]); // rowCount=1
    const store = makeStore(fake);

    const r = await store.clearAdverseEvent({
      adverseEventId: "adv_1",
      clearedAt: new Date("2026-11-10T00:00:00Z"),
      clearedBy: "dispute_won",
    });
    expect(r).toBe(true);
    const sql = fake.calls[0].text;
    expect(sql).toMatch(/access_block_cleared_at = \$1/);
    expect(sql).toMatch(/access_block_cleared_by = \$2/);
    expect(sql).toMatch(/WHERE id = \$3/);
    expect(sql).toMatch(/AND access_block_cleared_at IS NULL/);
  });

  it("returns false when no row matched (already cleared OR unknown id)", async () => {
    const fake = new FakePool();
    fake.queueOk([]); // rowCount=0
    const store = makeStore(fake);
    const r = await store.clearAdverseEvent({
      adverseEventId: "adv_cleared",
      clearedAt: new Date(),
      clearedBy: "admin",
    });
    expect(r).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// findPendingCheckoutMappingEvents · R-9 · partial index target
// ---------------------------------------------------------------------------

describe("[in-memory] SupabaseBillingStore.findPendingCheckoutMappingEvents", () => {
  it("filters outcome='pending_checkout_mapping' · ordered by received_at ASC", async () => {
    const fake = new FakePool();
    fake.queueOk([]);
    const store = makeStore(fake);

    await store.findPendingCheckoutMappingEvents(25);

    const sql = fake.calls[0].text;
    expect(sql).toMatch(/WHERE outcome = 'pending_checkout_mapping'/);
    expect(sql).toMatch(/ORDER BY received_at ASC/);
    expect(sql).toMatch(/LIMIT \$1/);
    expect(fake.calls[0].values).toEqual([25]);
  });

  it("clamps limit to [1, 1000]", async () => {
    const fake = new FakePool();
    fake.queueOk([]);
    fake.queueOk([]);
    const store = makeStore(fake);
    await store.findPendingCheckoutMappingEvents(0);
    await store.findPendingCheckoutMappingEvents(999999);
    expect(fake.calls[0].values).toEqual([1]);
    expect(fake.calls[1].values).toEqual([1000]);
  });
});

// ---------------------------------------------------------------------------
// withAccountLock · R-12 · SELECT ... FOR UPDATE inside txn
// ---------------------------------------------------------------------------

describe("[in-memory] SupabaseBillingStore.withAccountLock", () => {
  it("acquires FOR UPDATE lock on the account row before callback runs", async () => {
    const fake = new FakePool();
    fake.queueOk([]); // BEGIN
    fake.queueOk([{ id: "acct_1" }]); // SELECT ... FOR UPDATE
    fake.queueOk([]); // callback user query (not used · still queue to be safe)
    fake.queueOk([]); // COMMIT
    const store = makeStore(fake);

    const r = await store.withAccountLock("acct_1", async () => "done");

    expect(r).toBe("done");
    expect(fake.calls[0].text).toBe("BEGIN");
    expect(fake.calls[1].text).toMatch(
      /SELECT id FROM nex_account WHERE id = \$1 FOR UPDATE/,
    );
    expect(fake.calls[1].values).toEqual(["acct_1"]);
    expect(fake.calls[fake.calls.length - 1].text).toBe("COMMIT");
  });

  it("throws when the account row doesn't exist · ROLLBACK follows", async () => {
    const fake = new FakePool();
    fake.queueOk([]); // BEGIN
    fake.queueOk([]); // SELECT ... FOR UPDATE · zero rows
    fake.queueOk([]); // ROLLBACK
    const store = makeStore(fake);

    await expect(
      store.withAccountLock("acct_missing", async () => "x"),
    ).rejects.toThrow(/account acct_missing does not exist/);
    expect(fake.calls[fake.calls.length - 1].text).toBe("ROLLBACK");
  });
});

// ---------------------------------------------------------------------------
// withTransaction · R-7 · BEGIN/COMMIT success · BEGIN/ROLLBACK on throw
// ---------------------------------------------------------------------------

describe("[in-memory] SupabaseBillingStore.withTransaction", () => {
  it("wraps callback in BEGIN/COMMIT · result bubbles up", async () => {
    const fake = new FakePool();
    fake.queueOk([]); // BEGIN
    fake.queueOk([{ ok: true }]); // user query
    fake.queueOk([]); // COMMIT
    const store = makeStore(fake);

    const r = await store.withTransaction(async (tx) => {
      const sub = await tx.resolveAccountBySubscription("sub_x");
      return sub;
    });

    expect(r).toBeNull();
    expect(fake.calls[0].text).toBe("BEGIN");
    expect(fake.calls[fake.calls.length - 1].text).toBe("COMMIT");
  });

  it("ROLLBACKs on throw · re-raises original error", async () => {
    const fake = new FakePool();
    fake.queueOk([]); // BEGIN
    fake.queueError(new Error("boom"));
    fake.queueOk([]); // ROLLBACK
    const store = makeStore(fake);

    await expect(
      store.withTransaction(async (tx) => {
        await tx.finalizeEvent({ stripeEventId: "x", outcome: "applied" });
      }),
    ).rejects.toThrow("boom");

    expect(fake.calls[0].text).toBe("BEGIN");
    expect(fake.calls[fake.calls.length - 1].text).toBe("ROLLBACK");
  });
});

// ---------------------------------------------------------------------------
// readCheckoutSession · internal + by Stripe session id
// ---------------------------------------------------------------------------

describe("[in-memory] SupabaseBillingStore.readCheckoutSession*", () => {
  const row = {
    internal_session_id: "cs_internal_1",
    nex_account_id: "acct_1",
    product: "shop" as const,
    intended_tier: "standard",
    stripe_idempotency_key: "idem_1",
    stripe_checkout_session_id: "cs_stripe_abc",
    stripe_customer_id: "cus_x",
    stripe_subscription_id: "sub_y",
    status: "awaiting_payment" as const,
    created_at: new Date(),
    completed_at: null,
  };

  it("readCheckoutSession queries internal_session_id and returns mapped row", async () => {
    const fake = new FakePool();
    fake.queueOk([row]);
    const store = makeStore(fake);
    const r = await store.readCheckoutSession("cs_internal_1");
    expect(r).not.toBeNull();
    expect(r!.internalSessionId).toBe("cs_internal_1");
    expect(r!.stripeCheckoutSessionId).toBe("cs_stripe_abc");
    expect(fake.calls[0].text).toMatch(/WHERE internal_session_id = \$1/);
  });

  it("readCheckoutSession returns null when not found", async () => {
    const fake = new FakePool();
    fake.queueOk([]);
    const store = makeStore(fake);
    const r = await store.readCheckoutSession("cs_missing");
    expect(r).toBeNull();
  });

  it("readCheckoutSessionByStripeSessionId queries by stripe_checkout_session_id", async () => {
    const fake = new FakePool();
    fake.queueOk([row]);
    const store = makeStore(fake);
    const r = await store.readCheckoutSessionByStripeSessionId("cs_stripe_abc");
    expect(r).not.toBeNull();
    expect(r!.nexAccountId).toBe("acct_1");
    expect(fake.calls[0].text).toMatch(/WHERE stripe_checkout_session_id = \$1/);
  });
});

// ---------------------------------------------------------------------------
// updateCheckoutSession · dynamic SET
// ---------------------------------------------------------------------------

describe("[in-memory] SupabaseBillingStore.updateCheckoutSession", () => {
  it("writes only the keys supplied in the patch", async () => {
    const fake = new FakePool();
    fake.queueOk([]);
    const store = makeStore(fake);
    await store.updateCheckoutSession("cs_1", {
      stripeCheckoutSessionId: "cs_stripe_abc",
      status: "awaiting_payment",
    });
    const sql = fake.calls[0].text;
    expect(sql).toMatch(/UPDATE nex_billing_checkout_session/);
    expect(sql).toMatch(/stripe_checkout_session_id = \$1/);
    expect(sql).toMatch(/status = \$2/);
    expect(sql).not.toMatch(/stripe_customer_id/);
    expect(sql).not.toMatch(/stripe_subscription_id/);
    expect(sql).not.toMatch(/completed_at/);
  });

  it("no-op patch does not send a query", async () => {
    const fake = new FakePool();
    const store = makeStore(fake);
    await store.updateCheckoutSession("cs_1", {});
    expect(fake.calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// findOpenAdverseByDisputeId
// ---------------------------------------------------------------------------

describe("[in-memory] SupabaseBillingStore.findOpenAdverseByDisputeId", () => {
  it("filters by dispute_id AND cleared IS NULL · returns mapped row", async () => {
    const fake = new FakePool();
    fake.queueOk([
      {
        id: "adv_dp_1",
        nex_account_id: "acct_1",
        product: "shop",
        adverse_type: "dispute_pending",
        stripe_subscription_id: null,
        stripe_invoice_id: null,
        stripe_payment_intent_id: null,
        stripe_charge_id: null,
        stripe_dispute_id: "dp_abc",
        stripe_refund_id: null,
        invoice_period_start: null,
        invoice_period_end: null,
        stripe_dispute_status: "pending",
        stripe_dispute_closed_at: null,
        access_blocking: true,
        access_block_cleared_at: null,
        access_block_cleared_by: null,
        opened_at: new Date(),
        opened_by_event_id: null,
        admin_action_id: null,
      },
    ]);
    const store = makeStore(fake);
    const r = await store.findOpenAdverseByDisputeId("dp_abc");
    expect(r).not.toBeNull();
    expect(r!.stripeDisputeId).toBe("dp_abc");
    const sql = fake.calls[0].text;
    expect(sql).toMatch(/WHERE stripe_dispute_id = \$1/);
    expect(sql).toMatch(/AND access_block_cleared_at IS NULL/);
  });

  it("returns null when no open row", async () => {
    const fake = new FakePool();
    fake.queueOk([]);
    const store = makeStore(fake);
    const r = await store.findOpenAdverseByDisputeId("dp_none");
    expect(r).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateDisputeStripeResolution · with + without adverseType
// ---------------------------------------------------------------------------

describe("[in-memory] SupabaseBillingStore.updateDisputeStripeResolution", () => {
  it("with adverseType · writes dispute_status + dispute_closed_at + adverse_type", async () => {
    const fake = new FakePool();
    fake.queueOk([]);
    const store = makeStore(fake);
    const closedAt = new Date("2026-11-10T00:00:00Z");
    await store.updateDisputeStripeResolution({
      adverseEventId: "adv_dp_1",
      stripeDisputeStatus: "lost",
      stripeDisputeClosedAt: closedAt,
      adverseType: "dispute_lost",
    });
    const sql = fake.calls[0].text;
    expect(sql).toMatch(/stripe_dispute_status = \$1/);
    expect(sql).toMatch(/stripe_dispute_closed_at = \$2/);
    expect(sql).toMatch(/adverse_type = \$3/);
    expect(sql).toMatch(/WHERE id = \$4/);
    expect(fake.calls[0].values).toEqual([
      "lost",
      closedAt,
      "dispute_lost",
      "adv_dp_1",
    ]);
  });

  it("without adverseType · writes only dispute_status + dispute_closed_at", async () => {
    const fake = new FakePool();
    fake.queueOk([]);
    const store = makeStore(fake);
    const closedAt = new Date("2026-11-10T00:00:00Z");
    await store.updateDisputeStripeResolution({
      adverseEventId: "adv_dp_2",
      stripeDisputeStatus: "won",
      stripeDisputeClosedAt: closedAt,
    });
    const sql = fake.calls[0].text;
    expect(sql).toMatch(/stripe_dispute_status = \$1/);
    expect(sql).toMatch(/stripe_dispute_closed_at = \$2/);
    expect(sql).toMatch(/WHERE id = \$3/);
    expect(sql).not.toMatch(/adverse_type/);
  });
});

// ---------------------------------------------------------------------------
// Explicit non-verification note
// ---------------------------------------------------------------------------
//
// These tests prove the adapter sends the SQL it was DESIGNED to send
// against the schema it was DESIGNED to query. They do NOT prove that
// migration 258 produces a schema that answers those queries correctly.
// The Gate-1 scratch rehearsal (R-1..R-11) is still owed.
