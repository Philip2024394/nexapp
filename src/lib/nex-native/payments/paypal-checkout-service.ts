// src/lib/nex-native/payments/paypal-checkout-service.ts
//
// Owner-sealed 2026-11-10 · MERCHANT-DIRECT PayPal Orders v2.
// Doctrine (merchant-payments #7): charges hit the seller's PayPal
// merchant account directly via the `payee.merchant_id` field on the
// Orders v2 create request. NEX takes zero fee, holds no money, and
// never touches the buyer's funds. We are NOT using PayPal Platform
// (Marketplace) destination routing · funds settle merchant-direct.
//
// STATUS: SCAFFOLD. Live PayPal API calls are gated on these env vars,
// which are intentionally NOT present in the sandbox:
//
//   PAYPAL_CLIENT_ID          · platform-level REST client id
//   PAYPAL_CLIENT_SECRET      · platform-level REST client secret
//   NEX_APP_PUBLIC_URL        · base URL for return_url/cancel_url
//
// Until those are set, `createMerchantDirectPaypalOrder` returns a
// `credentials_missing` reason and never touches the network.
//
// Owner sealed Stripe-first rule 2026-11-05: NO payment gateway may be
// built ahead of a clear entitlement + post-payment behaviour. The
// entitlement for this flow mirrors Stripe: one paid NEX order whose
// seller must deliver. Post-payment behaviour: PayPal webhook
// (PAYMENT.CAPTURE.COMPLETED) → NEX updates order state to `paid` via
// commerce-service.markOrderPaid. That webhook handler is a separate
// scaffold (paypal-webhook-service) gated on PAYPAL_WEBHOOK_ID.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexOrderRow, NexUuid } from "../types";

export type PaypalCheckoutFailure =
  | "credentials_missing"
  | "seller_not_connected"
  | "order_not_payable"
  | "paypal_api_error";

export interface PaypalCheckoutOrderResult {
  readonly ok: true;
  /** PayPal Orders v2 `id` (e.g. `5O190127TN364715T`). */
  readonly orderId: string;
  /** Approval URL returned in `links[].rel === "approve"`. */
  readonly url: string;
}

export interface PaypalCheckoutOrderFailure {
  readonly ok: false;
  readonly reason: PaypalCheckoutFailure;
  readonly detail?: string;
}

export type PaypalCheckoutOrderResponse =
  | PaypalCheckoutOrderResult
  | PaypalCheckoutOrderFailure;

/** Env presence check · intentionally boolean · never log the value. */
function isPaypalConfigured(): boolean {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID &&
      process.env.PAYPAL_CLIENT_SECRET &&
      process.env.NEX_APP_PUBLIC_URL,
  );
}

/**
 * Create a merchant-direct PayPal Orders v2 order for the given NEX order.
 *
 * SCAFFOLD. Returns `credentials_missing` until PAYPAL_CLIENT_ID +
 * PAYPAL_CLIENT_SECRET + NEX_APP_PUBLIC_URL are set. When those arrive,
 * the implementation replaces the TODO block with the real PayPal
 * Orders v2 create call. The seller's PayPal merchant id is supplied
 * via `purchase_units[].payee.merchant_id`, which routes settlement
 * directly to the seller's account · the NEX platform account never
 * holds funds.
 */
export async function createMerchantDirectPaypalOrder(input: {
  readonly order: NexOrderRow;
  readonly sellerPaypalMerchantId: string | null;
}): Promise<PaypalCheckoutOrderResponse> {
  if (!input.sellerPaypalMerchantId) {
    return { ok: false, reason: "seller_not_connected" };
  }
  if (!["created", "pending"].includes(input.order.state)) {
    return {
      ok: false,
      reason: "order_not_payable",
      detail: `order state is ${input.order.state}`,
    };
  }
  if (!isPaypalConfigured()) {
    return {
      ok: false,
      reason: "credentials_missing",
      detail:
        "PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and/or NEX_APP_PUBLIC_URL not set",
    };
  }
  // TODO · when credentials arrive, the live implementation:
  //
  //   1. Mint an OAuth2 access token via POST /v1/oauth2/token
  //      (Basic auth with client_id:client_secret).
  //   2. POST /v2/checkout/orders with body:
  //        {
  //          "intent": "CAPTURE",
  //          "purchase_units": [{
  //            "reference_id": order.id,
  //            "amount": {
  //              "currency_code": order.currency,
  //              "value": (order.price_pence / 100).toFixed(2),
  //            },
  //            "payee": { "merchant_id": input.sellerPaypalMerchantId },
  //            "custom_id": order.id,
  //            "invoice_id": order.id,
  //          }],
  //          "application_context": {
  //            "return_url": `${NEX_APP_PUBLIC_URL}/nex-native/orders/${order.id}?paid=1`,
  //            "cancel_url": `${NEX_APP_PUBLIC_URL}/nex-native/orders/${order.id}/pay/paypal?cancelled=1`,
  //            "user_action": "PAY_NOW",
  //          },
  //        }
  //   3. Return { ok: true, orderId: body.id, url: body.links.find(l => l.rel === "approve").href }.
  //
  // The merchant-direct property is the `payee.merchant_id` field · PayPal
  // settles the capture into that merchant's account with no NEX-held
  // balance, no platform fee, and no marketplace destination routing.
  return {
    ok: false,
    reason: "paypal_api_error",
    detail:
      "scaffold path reached without live PayPal client · owner has not authorised PayPal Orders v2 build-out",
  };
}

/**
 * Read the seller's PayPal merchant id from the business row. Fail-soft
 * when the column is absent (mig that adds `paypal_merchant_id` to
 * `nex_business` has not landed yet · scaffold must tolerate that).
 */
export async function getSellerPaypalMerchantId(
  businessId: NexUuid,
): Promise<string | null> {
  try {
    const { data } = await nexSupabaseAdmin
      .from("nex_business")
      .select("paypal_merchant_id")
      .eq("id", businessId)
      .maybeSingle();
    const row = data as { paypal_merchant_id: string | null } | null;
    return row?.paypal_merchant_id ?? null;
  } catch {
    return null;
  }
}
