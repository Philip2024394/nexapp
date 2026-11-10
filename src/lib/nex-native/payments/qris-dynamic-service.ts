// src/lib/nex-native/payments/qris-dynamic-service.ts
//
// Owner-sealed 2026-11-10 · MERCHANT-DIRECT dynamic QRIS checkout.
// Doctrine (merchant-payments #7): QRIS charges settle into the seller's
// Midtrans or Xendit sub-merchant account directly. NEX takes zero fee,
// holds no money, and never touches the buyer's funds.
//
// Indonesia QRIS context · "dynamic" QRIS means the QR encodes a
// specific amount and order reference and expires · "static" QRIS is
// the manual-QR path handled by merchant-qr/ + /pay (chat_only
// doctrine). This service is for Midtrans-charge-API-created or
// Xendit-payment-request-created QR codes.
//
// STATUS: SCAFFOLD. Live provider API calls are gated on these env vars:
//
//   MIDTRANS_SERVER_KEY       · Midtrans Snap/Core API server key
//   XENDIT_SECRET_KEY         · Xendit secret API key
//   NEX_APP_PUBLIC_URL        · base URL for the QR display landing
//
// Either MIDTRANS_SERVER_KEY or XENDIT_SECRET_KEY must be present (the
// seller's `nex_business` row determines which provider to call). The
// scaffold returns `credentials_missing` when NEITHER is present.
//
// Owner sealed Stripe-first rule 2026-11-05 applies equally here · no
// payment gateway may be built ahead of a clear entitlement + post-
// payment behaviour. Entitlement: one paid NEX order. Post-payment:
// provider webhook → markOrderPaid. Webhook handler lives in
// qris-webhook-service.ts · gated separately.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexOrderRow, NexUuid } from "../types";

export type QrisCheckoutFailure =
  | "credentials_missing"
  | "seller_not_connected"
  | "order_not_payable"
  | "qris_api_error";

export interface QrisCheckoutResult {
  readonly ok: true;
  /** Provider-side transaction / payment request id. */
  readonly transactionId: string;
  /** Data URL or hosted URL of the QR image to display to the buyer. */
  readonly qrUrl: string;
  /** Which provider was used · recorded on the order event. */
  readonly provider: "midtrans" | "xendit";
}

export interface QrisCheckoutFailureResult {
  readonly ok: false;
  readonly reason: QrisCheckoutFailure;
  readonly detail?: string;
}

export type QrisCheckoutResponse = QrisCheckoutResult | QrisCheckoutFailureResult;

/** Env presence check · at least ONE provider's secret must be set. */
function isQrisConfigured(): boolean {
  return Boolean(
    (process.env.MIDTRANS_SERVER_KEY || process.env.XENDIT_SECRET_KEY) &&
      process.env.NEX_APP_PUBLIC_URL,
  );
}

/** Seller's QRIS provider identity · reused by the orchestrator + the service. */
export interface SellerQrisMerchantId {
  readonly midtransMerchantId: string | null;
  readonly xenditBusinessId: string | null;
  readonly anyConnected: boolean;
}

/**
 * Create a merchant-direct dynamic QRIS charge for the given NEX order.
 *
 * SCAFFOLD. Returns `credentials_missing` until a provider secret is
 * set. When those arrive, the implementation replaces the TODO block
 * with the real provider call. The seller's sub-merchant id scopes
 * settlement · NEX never holds the funds.
 */
export async function createMerchantDirectQrisOrder(input: {
  readonly order: NexOrderRow;
  readonly sellerMidtransMerchantId: SellerQrisMerchantId;
}): Promise<QrisCheckoutResponse> {
  if (!input.sellerMidtransMerchantId.anyConnected) {
    return { ok: false, reason: "seller_not_connected" };
  }
  if (!["created", "pending"].includes(input.order.state)) {
    return {
      ok: false,
      reason: "order_not_payable",
      detail: `order state is ${input.order.state}`,
    };
  }
  if (!isQrisConfigured()) {
    return {
      ok: false,
      reason: "credentials_missing",
      detail:
        "MIDTRANS_SERVER_KEY or XENDIT_SECRET_KEY (and NEX_APP_PUBLIC_URL) not set",
    };
  }
  // TODO · when credentials arrive, the live implementation branches by
  // which seller merchant id is present.
  //
  // Midtrans branch (seller has midtrans_merchant_id):
  //   POST https://api.midtrans.com/v2/charge
  //   Authorization: Basic base64(MIDTRANS_SERVER_KEY:)
  //   {
  //     "payment_type": "qris",
  //     "transaction_details": {
  //       "order_id": order.id,
  //       "gross_amount": Math.round(order.price_pence / 100),
  //     },
  //     "qris": { "acquirer": "gopay" },
  //     "custom_field1": order.id,
  //     "sub_merchant_id": input.sellerMidtransMerchantId.midtransMerchantId,
  //   }
  //   Response contains `actions[].url` for the QR image.
  //
  // Xendit branch (seller has xendit_business_id):
  //   POST https://api.xendit.co/qr_codes
  //   Authorization: Basic base64(XENDIT_SECRET_KEY:)
  //   for-user-id: input.sellerMidtransMerchantId.xenditBusinessId (sub-account)
  //   {
  //     "reference_id": order.id,
  //     "type": "DYNAMIC",
  //     "currency": "IDR",
  //     "amount": Math.round(order.price_pence / 100),
  //     "expires_at": <ISO8601 +15min>,
  //   }
  //   Response contains `qr_string` + `qr_url`.
  return {
    ok: false,
    reason: "qris_api_error",
    detail:
      "scaffold path reached without live Midtrans/Xendit client · owner has not authorised QRIS build-out",
  };
}

/**
 * Read the seller's QRIS sub-merchant identity from the business row.
 * Fail-soft when the columns are absent (mig that adds
 * `midtrans_merchant_id` + `xendit_business_id` to `nex_business` has
 * not landed yet · scaffold must tolerate that).
 */
export async function getSellerQrisMerchantId(
  businessId: NexUuid,
): Promise<SellerQrisMerchantId> {
  const emptyResult: SellerQrisMerchantId = {
    midtransMerchantId: null,
    xenditBusinessId: null,
    anyConnected: false,
  };
  try {
    const { data } = await nexSupabaseAdmin
      .from("nex_business")
      .select("midtrans_merchant_id, xendit_business_id")
      .eq("id", businessId)
      .maybeSingle();
    const row = data as
      | {
          midtrans_merchant_id: string | null;
          xendit_business_id: string | null;
        }
      | null;
    const midtrans = row?.midtrans_merchant_id ?? null;
    const xendit = row?.xendit_business_id ?? null;
    return {
      midtransMerchantId: midtrans,
      xenditBusinessId: xendit,
      anyConnected: Boolean(midtrans) || Boolean(xendit),
    };
  } catch {
    return emptyResult;
  }
}
