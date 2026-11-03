// src/lib/nex-native/billing/__tests__/webhook-handler.test.ts
//
// NEX Billing · [in-memory] Stripe webhook handler service tests.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT).
//
// Verifies the signature-verify → dispatch → HTTP-status pipeline of
// handleStripeWebhook using a mock Stripe client. These tests DO NOT
// exercise real HMAC verification (that is Gate-2 responsibility).
//
// Scenarios:
//   · Missing stripe-signature header   → 400 bad_signature
//   · Missing webhook secret            → 500 config_error
//   · constructEvent throws             → 400 bad_signature (opaque)
//   · Verified event · applied outcome  → 200 ok
//   · Verified event · skipped_*        → 200 ok (so Stripe stops retrying)
//   · Verified event · error outcome    → 500 (so Stripe retries)
//   · Processor throws                   → 500 processing_error (opaque)

import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { handleStripeWebhook } from "../webhook-handler";
import { InMemoryBillingStore } from "./in-memory-store";
import { buildPriceRegistry, PRICE_ENV_VARS } from "../price-registry";

function mockStripeClient(opts: {
  throwOnConstruct?: boolean;
  eventType?: string;
  subscriptionId?: string;
}): Stripe {
  return {
    webhooks: {
      constructEvent: () => {
        if (opts.throwOnConstruct) {
          throw new Error("invalid signature");
        }
        return {
          id: "evt_mock_1",
          type: opts.eventType ?? "invoice.payment_succeeded",
          api_version: "2024-06-20",
          created: Math.floor(Date.now() / 1000),
          data: {
            object: {
              id: "inv_1",
              subscription: opts.subscriptionId ?? "sub_unknown",
              period_end: Math.floor(Date.now() / 1000) + 86_400,
            },
          },
        };
      },
    } as unknown as Stripe["webhooks"],
  } as unknown as Stripe;
}

const defaultRegistry = buildPriceRegistry({ getEnv: () => undefined });

describe("[in-memory] handleStripeWebhook · signature + headers", () => {
  it("missing stripe-signature → 400 bad_signature", async () => {
    const store = new InMemoryBillingStore();
    const r = await handleStripeWebhook({
      rawBody: "{}",
      signatureHeader: null,
      now: new Date(),
      options: {
        store,
        priceRegistry: defaultRegistry,
        webhookSecret: "whsec_test",
        stripeClient: mockStripeClient({}),
      },
    });
    expect(r.httpStatus).toBe(400);
    expect(r.body.code).toBe("bad_signature");
  });

  it("missing webhook secret → 500 config_error", async () => {
    const store = new InMemoryBillingStore();
    const r = await handleStripeWebhook({
      rawBody: "{}",
      signatureHeader: "t=1,v1=abc",
      now: new Date(),
      options: {
        store,
        priceRegistry: defaultRegistry,
        webhookSecret: "",
        stripeClient: mockStripeClient({}),
      },
    });
    expect(r.httpStatus).toBe(500);
    expect(r.body.code).toBe("config_error");
  });

  it("constructEvent throws → 400 bad_signature (opaque body)", async () => {
    const store = new InMemoryBillingStore();
    const r = await handleStripeWebhook({
      rawBody: "{}",
      signatureHeader: "t=1,v1=abc",
      now: new Date(),
      options: {
        store,
        priceRegistry: defaultRegistry,
        webhookSecret: "whsec_test",
        stripeClient: mockStripeClient({ throwOnConstruct: true }),
      },
    });
    expect(r.httpStatus).toBe(400);
    expect(r.body.code).toBe("bad_signature");
    // Opaque · never leaks which part of verification failed
    expect(r.body.detail).toBeUndefined();
  });
});

describe("[in-memory] handleStripeWebhook · outcome → HTTP mapping", () => {
  it("verified · subscription unmapped → pending_checkout_mapping → 200 (do not retry)", async () => {
    const store = new InMemoryBillingStore();
    const r = await handleStripeWebhook({
      rawBody: "{}",
      signatureHeader: "t=1,v1=abc",
      now: new Date(),
      options: {
        store,
        priceRegistry: defaultRegistry,
        webhookSecret: "whsec_test",
        stripeClient: mockStripeClient({
          eventType: "invoice.payment_succeeded",
          subscriptionId: "sub_notmapped",
        }),
      },
    });
    expect(r.httpStatus).toBe(200);
    expect(r.body.outcome).toBe("pending_checkout_mapping");
    // Event is recorded in the log
    expect(store._dumpEvents()).toHaveLength(1);
  });

  it("verified + known subscription · payment_succeeded → applied → 200", async () => {
    const store = new InMemoryBillingStore();
    store.seedProduct("acct_1", "shop", {
      stripeSubscriptionId: "sub_known",
      stripeCustomerId: "cus_1",
      tier: "standard",
      status: "incomplete",
    });
    const r = await handleStripeWebhook({
      rawBody: "{}",
      signatureHeader: "t=1,v1=abc",
      now: new Date(),
      options: {
        store,
        priceRegistry: defaultRegistry,
        webhookSecret: "whsec_test",
        stripeClient: mockStripeClient({
          eventType: "invoice.payment_succeeded",
          subscriptionId: "sub_known",
        }),
      },
    });
    expect(r.httpStatus).toBe(200);
    expect(r.body.outcome).toBe("applied");
    const view = await store.readProductView("acct_1", "shop");
    expect(view!.snapshot.status).toBe("active");
  });

  it("duplicate webhook delivery → skipped_duplicate_already_processed → 200", async () => {
    const store = new InMemoryBillingStore();
    store.seedProduct("acct_1", "shop", {
      stripeSubscriptionId: "sub_dup",
      tier: "standard",
      status: "incomplete",
    });
    const options = {
      store,
      priceRegistry: defaultRegistry,
      webhookSecret: "whsec_test",
      stripeClient: mockStripeClient({
        eventType: "invoice.payment_succeeded",
        subscriptionId: "sub_dup",
      }),
    };
    const first = await handleStripeWebhook({
      rawBody: "{}",
      signatureHeader: "t=1,v1=abc",
      now: new Date(),
      options,
    });
    const second = await handleStripeWebhook({
      rawBody: "{}",
      signatureHeader: "t=1,v1=abc",
      now: new Date(),
      options,
    });
    expect(first.body.outcome).toBe("applied");
    expect(first.httpStatus).toBe(200);
    expect(second.body.outcome).toBe("skipped_duplicate_already_processed");
    expect(second.httpStatus).toBe(200);
  });

  it("processor error outcome → 500 (Stripe retries)", async () => {
    const store = new InMemoryBillingStore();
    store.seedProduct("acct_1", "shop", {
      stripeSubscriptionId: "sub_err",
      stripeCustomerId: "cus_1",
      tier: null,
      status: null,
    });
    const env = new Map<string, string>([
      [PRICE_ENV_VARS.shop.standard, "price_knownabcdefxyz1"],
    ]);
    const registry = buildPriceRegistry({ getEnv: (k) => env.get(k) });

    const stripeClient = {
      webhooks: {
        constructEvent: () => ({
          id: "evt_sub_create",
          type: "customer.subscription.created",
          api_version: "2024-06-20",
          created: Math.floor(Date.now() / 1000),
          data: {
            object: {
              id: "sub_err",
              customer: "cus_1",
              status: "incomplete",
              items: {
                data: [{ price: { id: "price_mysteryxxxxxxxxx" } }],
              },
            },
          },
        }),
      } as unknown as Stripe["webhooks"],
    } as unknown as Stripe;

    const r = await handleStripeWebhook({
      rawBody: "{}",
      signatureHeader: "t=1,v1=abc",
      now: new Date(),
      options: {
        store,
        priceRegistry: registry,
        webhookSecret: "whsec_test",
        stripeClient,
      },
    });
    expect(r.httpStatus).toBe(500);
    expect(r.body.outcome).toBe("error");
    expect(r.body.ok).toBe(false);
  });
});
