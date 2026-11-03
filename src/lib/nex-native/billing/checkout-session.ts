// src/lib/nex-native/billing/checkout-session.ts
//
// NEX Billing Foundation · verified checkout-session creation.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// Server-side action that creates a Stripe Checkout session with a durable
// internal record. The DB row is the authority for account/product/tier
// linkage · Stripe metadata is only a lookup key.
//
// Flow:
//   1. Authenticate the user (caller's responsibility · passes nexAccountId)
//   2. Validate product + tier
//   3. Refuse if any open access-blocking adverse event exists (E3)
//   4. INSERT pending nex_billing_checkout_session row (durable intent)
//   5. Call Stripe API with idempotency_key (Stripe interface mocked here)
//   6. UPDATE the row with stripe_checkout_session_id
//   7. Return the Stripe-hosted URL
//
// If step 5 fails before step 4 commits · nothing to recover (no local
// state). If step 5 succeeds but step 6 fails · the pending row remains
// without stripe_checkout_session_id · the webhook will log 'pending_
// checkout_mapping' and the reconciliation cron will match + heal.

import type { NexProduct, ShopTier, VaultTier } from "./types";
import type { BillingStore, CheckoutSessionRow } from "./store";
import { shouldRefuseNewCheckout } from "./entitlement";

/** Minimal Stripe API surface the checkout service uses. The real
 *  implementation (stripe SDK) is injected by the caller · tests use an
 *  in-memory mock. */
export interface StripeCheckoutApi {
  createCheckoutSession(input: {
    mode: "subscription";
    priceId: string;
    customerId: string | null;
    successUrl: string;
    cancelUrl: string;
    idempotencyKey: string;
    metadata: Record<string, string>;
  }): Promise<{ id: string; url: string }>;
}

export interface CreateCheckoutInput {
  readonly nexAccountId: string;
  readonly product: NexProduct;
  readonly intendedTier: ShopTier | VaultTier;
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly getPriceIdForTier: (
    product: NexProduct,
    tier: string,
  ) => string | null;
}

export interface CreateCheckoutResult {
  readonly ok: true;
  readonly internalSessionId: string;
  readonly stripeCheckoutSessionId: string;
  readonly url: string;
}

export interface CreateCheckoutRefused {
  readonly ok: false;
  readonly code:
    | "blocked_by_adverse_event"
    | "unknown_tier"
    | "missing_price_id"
    | "stripe_error"
    | "account_lookup_failed";
  readonly reason: string;
}

/** Validate tier for product. Pure. */
function isValidTier(product: NexProduct, tier: string): boolean {
  if (product === "shop") {
    return tier === "standard" || tier === "unlimited";
  }
  if (product === "vault") {
    return (
      tier === "5gb" || tier === "25gb" || tier === "50gb" || tier === "100gb"
    );
  }
  return false;
}

/** Generate a stable idempotency key for Stripe's create-session call.
 *  Uses the input's deterministic parts · a repeated client click within
 *  a short window produces the same key. We bucket by minute to allow
 *  deliberate retries after a minute. */
export function computeIdempotencyKey(
  input: Pick<CreateCheckoutInput, "nexAccountId" | "product" | "intendedTier">,
  now: Date,
): string {
  const bucket = Math.floor(now.getTime() / 60_000);
  // Format: nex:acct:<id>:<product>:<tier>:<minute-bucket>
  return `nex:acct:${input.nexAccountId}:${input.product}:${input.intendedTier}:${bucket}`;
}

export async function createCheckoutSession(
  input: CreateCheckoutInput,
  store: BillingStore,
  stripe: StripeCheckoutApi,
  now: Date,
): Promise<CreateCheckoutResult | CreateCheckoutRefused> {
  // 1 · tier validation
  if (!isValidTier(input.product, input.intendedTier)) {
    return {
      ok: false,
      code: "unknown_tier",
      reason: `Tier '${input.intendedTier}' is not valid for product '${input.product}'`,
    };
  }

  // 2 · adverse-event block (E3)
  const view = await store.readProductView(input.nexAccountId, input.product);
  if (view === null) {
    // Non-fatal · fresh account with no row yet. We create a view-shaped
    // null-safe default and run the blocker check against an empty list.
    // (In the real implementation the Supabase adapter would upsert the
    // account row if missing · for this logic layer we treat null as
    // "no adverse events" which is correct for a brand-new account.)
  } else {
    const refusal = shouldRefuseNewCheckout(view);
    if (refusal.refuse) {
      return {
        ok: false,
        code: "blocked_by_adverse_event",
        reason: refusal.reason ?? "Open adverse event blocks new checkout",
      };
    }
  }

  // 3 · resolve price ID
  const priceId = input.getPriceIdForTier(input.product, input.intendedTier);
  if (priceId === null) {
    return {
      ok: false,
      code: "missing_price_id",
      reason: `No Stripe price ID configured for ${input.product}/${input.intendedTier}`,
    };
  }

  // 4 · INSERT durable pending row FIRST
  const idempotencyKey = computeIdempotencyKey(input, now);
  let row: CheckoutSessionRow;
  try {
    row = await store.insertCheckoutSession({
      nexAccountId: input.nexAccountId,
      product: input.product,
      intendedTier: input.intendedTier,
      stripeIdempotencyKey: idempotencyKey,
    });
  } catch (err) {
    // Idempotency-key unique violation · another concurrent request
    // created the row. The caller may want to look it up by key.
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      code: "stripe_error",
      reason: `Failed to insert pending checkout row: ${msg}`,
    };
  }

  // 5 · call Stripe (idempotency_key guards against duplicates)
  let stripeResp: { id: string; url: string };
  try {
    stripeResp = await stripe.createCheckoutSession({
      mode: "subscription",
      priceId,
      customerId: view?.snapshot.stripeCustomerId ?? null,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      idempotencyKey,
      metadata: {
        internal_session_id: row.internalSessionId,
        nex_account_id: input.nexAccountId,
        product: input.product,
        intended_tier: input.intendedTier,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Pending row remains · reconciliation cron will mark abandoned/
    // orphaned by age
    return {
      ok: false,
      code: "stripe_error",
      reason: `Stripe API error: ${msg}`,
    };
  }

  // 6 · bind the Stripe session ID back to our row
  await store.updateCheckoutSession(row.internalSessionId, {
    stripeCheckoutSessionId: stripeResp.id,
    status: "awaiting_payment",
  });

  return {
    ok: true,
    internalSessionId: row.internalSessionId,
    stripeCheckoutSessionId: stripeResp.id,
    url: stripeResp.url,
  };
}
