// src/lib/nex-native/payments/stripe-checkout-service.ts
//
// Owner-sealed 2026-11-10 · MERCHANT-DIRECT Stripe Checkout Sessions.
// Doctrine (merchant-payments #7): charges hit the seller's connected
// Stripe account directly. NEX takes zero fee, holds no money, and
// does NOT use destination charges or Payouts routing.
//
// STATUS: SCAFFOLD. Live Stripe API calls are gated on these env
// vars, which are intentionally NOT present in the sandbox:
//
//   STRIPE_SECRET_KEY               · nex platform secret key
//   STRIPE_WEBHOOK_SECRET           · signing secret (for webhook route)
//   NEX_APP_PUBLIC_URL              · base URL for success/cancel redirects
//
// Until those are set, `createMerchantDirectCheckoutSession` returns
// a `credentials_missing` reason and never touches the network.
//
// Owner sealed Stripe-first rule 2026-11-05: NO payment gateway may
// be built ahead of a clear entitlement + post-payment behaviour.
// The entitlement for this flow is: one paid NEX order whose seller
// must deliver. Post-payment behaviour: Stripe webhook → NEX updates
// order state to `paid` via commerce-service.markOrderPaid. That
// webhook handler is NOT included in this scaffold; it is a
// separate build gated on the same credentials.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexOrderRow, NexUuid } from "../types";

export type StripeCheckoutFailure =
  | "credentials_missing"
  | "seller_not_connected"
  | "order_not_payable"
  | "stripe_api_error";

export interface StripeCheckoutSessionResult {
  readonly ok: true;
  readonly sessionId: string;
  readonly url: string;
}

export interface StripeCheckoutSessionFailure {
  readonly ok: false;
  readonly reason: StripeCheckoutFailure;
  readonly detail?: string;
}

export type StripeCheckoutSessionResponse =
  | StripeCheckoutSessionResult
  | StripeCheckoutSessionFailure;

/** Env presence check · intentionally boolean · never log the value. */
function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEX_APP_PUBLIC_URL);
}

/**
 * Create a merchant-direct Checkout Session for the given order.
 *
 * SCAFFOLD. Returns `credentials_missing` until STRIPE_SECRET_KEY +
 * NEX_APP_PUBLIC_URL are set. When those arrive, the implementation
 * replaces the TODO block with the real `stripe.checkout.sessions.
 * create` call under { stripeAccount: sellerStripeAccountId }.
 */
export async function createMerchantDirectCheckoutSession(input: {
  readonly order: NexOrderRow;
  readonly sellerStripeAccountId: string | null;
}): Promise<StripeCheckoutSessionResponse> {
  if (!input.sellerStripeAccountId) {
    return { ok: false, reason: "seller_not_connected" };
  }
  if (!["created", "pending"].includes(input.order.state)) {
    return {
      ok: false,
      reason: "order_not_payable",
      detail: `order state is ${input.order.state}`,
    };
  }
  if (!isStripeConfigured()) {
    return {
      ok: false,
      reason: "credentials_missing",
      detail: "STRIPE_SECRET_KEY and/or NEX_APP_PUBLIC_URL not set",
    };
  }
  // TODO · when credentials arrive, call:
  //   const session = await stripe.checkout.sessions.create(
  //     {
  //       mode: "payment",
  //       line_items: [{ price_data: { currency: order.currency, product_data: {name: productName}, unit_amount: order.price_pence }, quantity: 1 }],
  //       success_url: `${NEX_APP_PUBLIC_URL}/nex-native/orders/${order.id}?paid=1`,
  //       cancel_url:  `${NEX_APP_PUBLIC_URL}/nex-native/orders/${order.id}/pay/stripe?cancelled=1`,
  //       client_reference_id: order.id,
  //       metadata: { nex_order_id: order.id, nex_business_id: order.business_id },
  //     },
  //     { stripeAccount: input.sellerStripeAccountId }
  //   );
  //   return { ok: true, sessionId: session.id, url: session.url! };
  return {
    ok: false,
    reason: "stripe_api_error",
    detail: "scaffold path reached without live Stripe client · owner has not authorised Stripe API build-out",
  };
}

/** Read the seller's Stripe Connect account id from the business row.
 *  Fail-soft when mig 311 columns are absent. */
export async function getSellerStripeAccountId(
  businessId: NexUuid,
): Promise<string | null> {
  try {
    const { data } = await nexSupabaseAdmin
      .from("nex_business")
      .select("stripe_connect_account_id")
      .eq("id", businessId)
      .maybeSingle();
    const row = data as { stripe_connect_account_id: string | null } | null;
    return row?.stripe_connect_account_id ?? null;
  } catch {
    return null;
  }
}
