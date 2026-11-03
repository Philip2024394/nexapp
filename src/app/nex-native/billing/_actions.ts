// src/app/nex-native/billing/_actions.ts
//
// NEX Billing · customer-side server actions.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED to
// a real Stripe account yet · will become functional once Gate 1 + Gate 2
// pass and the production environment variables are configured).
//
// Server actions invoked from the customer billing page. Each action:
//   · authenticates via session (no client-supplied accountId trust)
//   · constructs the production BillingStore (fail-closed on config)
//   · delegates to the pure logic in cancellation.ts or the Stripe SDK
//   · returns {ok, code, detail} shaped results · the client renders them
//
// Actions:
//   · cancelProductSubscriptionAction  · schedules cancel-at-period-end
//   · changeProductTierAction          · upgrade / downgrade (Stripe sub update)

"use server";

import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { cancelAtPeriodEnd } from "@/lib/nex-native/billing/cancellation";
import { createProductionBillingStore } from "@/lib/nex-native/billing/supabase-store";
import { getPriceRegistry } from "@/lib/nex-native/billing/price-registry";
import { shouldRefuseNewCheckout } from "@/lib/nex-native/billing/entitlement";
import type {
  NexProduct,
  ShopTier,
  VaultTier,
} from "@/lib/nex-native/billing/types";

export type ActionResult<T = Record<string, never>> =
  | ({ readonly ok: true } & T)
  | {
      readonly ok: false;
      readonly code:
        | "unauthenticated"
        | "bad_request"
        | "config_error"
        | "no_subscription"
        | "blocked_by_adverse_event"
        | "unknown_tier"
        | "missing_price_id"
        | "same_tier"
        | "stripe_error"
        | "account_not_found"
        | "wrong_product";
      readonly reason?: string;
    };

/** Validate a product + tier string pair without trusting the client. */
function isValidTier(product: NexProduct, tier: string): boolean {
  if (product === "shop") return tier === "standard" || tier === "unlimited";
  if (product === "vault") {
    return tier === "5gb" || tier === "25gb" || tier === "50gb" || tier === "100gb";
  }
  return false;
}

function makeStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, {
    apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  });
}

// ---------------------------------------------------------------------------
// cancelProductSubscriptionAction
// ---------------------------------------------------------------------------

export async function cancelProductSubscriptionAction(input: {
  product: NexProduct;
}): Promise<ActionResult<{ accessUntil: string | null; graceUntil: string | null }>> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, code: "unauthenticated" };

  if (input.product !== "shop" && input.product !== "vault") {
    return { ok: false, code: "bad_request" };
  }

  const stripe = makeStripe();
  if (!stripe) return { ok: false, code: "config_error" };

  let store;
  try {
    store = createProductionBillingStore();
  } catch {
    return { ok: false, code: "config_error" };
  }

  try {
    const result = await cancelAtPeriodEnd(
      { nexAccountId: session.account.id, product: input.product },
      store,
      {
        async cancelAtPeriodEnd(subId) {
          const updated = await stripe.subscriptions.update(subId, {
            cancel_at_period_end: true,
          });
          return {
            id: updated.id,
            cancelAt: updated.cancel_at,
            status: updated.status,
          };
        },
      },
    );
    if (!result.ok) {
      return { ok: false, code: result.code, reason: result.reason };
    }
    revalidatePath("/nex-native/billing");
    return {
      ok: true,
      accessUntil: result.accessUntil ? result.accessUntil.toISOString() : null,
      graceUntil: result.graceUntil ? result.graceUntil.toISOString() : null,
    };
  } finally {
    try {
      await store.end();
    } catch {
      /* non-fatal */
    }
  }
}

// ---------------------------------------------------------------------------
// changeProductTierAction · upgrade / downgrade
// ---------------------------------------------------------------------------

export async function changeProductTierAction(input: {
  product: NexProduct;
  intendedTier: string;
}): Promise<ActionResult<{ stripeSubscriptionId: string; newTier: string }>> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, code: "unauthenticated" };

  if (input.product !== "shop" && input.product !== "vault") {
    return { ok: false, code: "bad_request" };
  }
  if (!isValidTier(input.product, input.intendedTier)) {
    return { ok: false, code: "unknown_tier" };
  }

  const stripe = makeStripe();
  if (!stripe) return { ok: false, code: "config_error" };

  let store;
  try {
    store = createProductionBillingStore();
  } catch {
    return { ok: false, code: "config_error" };
  }

  const priceRegistry = getPriceRegistry();
  const newPriceId = priceRegistry.getPriceIdForTier(
    input.product,
    input.intendedTier,
  );
  if (!newPriceId) {
    await store.end();
    return { ok: false, code: "missing_price_id" };
  }

  try {
    const view = await store.readProductView(session.account.id, input.product);
    if (!view || !view.snapshot.stripeSubscriptionId) {
      return { ok: false, code: "no_subscription" };
    }
    const currentTier = view.snapshot.tier;
    if (currentTier === input.intendedTier) {
      return { ok: false, code: "same_tier" };
    }

    // E3 · refuse tier change if an open adverse-event blocker exists
    const refusal = shouldRefuseNewCheckout(view);
    if (refusal.refuse) {
      return {
        ok: false,
        code: "blocked_by_adverse_event",
        reason: refusal.reason ?? "Open adverse event · resolve before changing plan",
      };
    }

    // Load the current subscription to find the item ID to update
    const sub = await stripe.subscriptions.retrieve(
      view.snapshot.stripeSubscriptionId,
    );
    const items = sub.items.data;
    if (items.length === 0) {
      return { ok: false, code: "stripe_error", reason: "Subscription has no items" };
    }
    // We assume ONE price per NEX subscription · multi-item subs are not
    // part of the current product shape.
    const itemId = items[0].id;

    await stripe.subscriptions.update(view.snapshot.stripeSubscriptionId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: "create_prorations",
    });

    // DO NOT write the new tier to our DB here · the Stripe webhook
    // `customer.subscription.updated` (or `invoice.payment_succeeded`
    // on the next cycle) will flow through processStripeEvent and apply
    // the tier change authoritatively. We just revalidate the UI so the
    // customer sees the Stripe update in-progress.
    revalidatePath("/nex-native/billing");

    return {
      ok: true,
      stripeSubscriptionId: view.snapshot.stripeSubscriptionId,
      newTier: input.intendedTier,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "stripe_error", reason: msg };
  } finally {
    try {
      await store.end();
    } catch {
      /* non-fatal */
    }
  }
}

// ---------------------------------------------------------------------------
// Unused suppression (silences unused-import lint on types)
// ---------------------------------------------------------------------------
void (null as unknown as ShopTier);
void (null as unknown as VaultTier);
