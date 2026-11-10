// src/lib/nex-native/payments/paypal-checkout-service.ts
//
// Owner-sealed 2026-11-10 (REVISED) · MERCHANT-DIRECT PayPal Orders v2.
// Doctrine (sealed 2026-11-10 gateway ownership matrix §J4–J6):
//   · PayPal handles SHOP-OWNER COMMERCE + CUSTOMER-TO-SHOP purchases.
//   · Stripe is RESERVED for NEX member subscriptions/renewals/wallet.
//   · Charges hit the SELLER'S PayPal merchant account directly via
//     the `payee.merchant_id` field on the Orders v2 create request.
//     NEX takes zero fee, holds no money, never routes via Marketplace
//     destination charges.
//
// Live-wire status (2026-11-10 later revision): the real Orders v2
// calls are IMPLEMENTED in `createMerchantDirectPaypalOrder` +
// `capturePaypalOrder`. They fail honestly with reason
// `credentials_missing` when any of these env vars is absent:
//
//   PAYPAL_CLIENT_ID          · platform-level REST client id
//   PAYPAL_CLIENT_SECRET      · platform-level REST client secret
//   NEX_APP_PUBLIC_URL        · base URL for return_url/cancel_url
//   PAYPAL_ENV                · "sandbox" (default) or "live"
//
// We NEVER make a call to PayPal's production host without those env
// vars present; the service rejects the request before any `fetch`.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexOrderRow, NexUuid } from "../types";

export type PaypalCheckoutFailure =
  | "credentials_missing"
  | "seller_not_connected"
  | "order_not_payable"
  | "oauth_failed"
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
  /** HTTP status Stripe returned (when reason === paypal_api_error). */
  readonly httpStatus?: number;
}

export type PaypalCheckoutOrderResponse =
  | PaypalCheckoutOrderResult
  | PaypalCheckoutOrderFailure;

/** PayPal environment config. Sandbox is default and safe. */
interface PaypalConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly baseUrl: string;
  readonly returnBaseUrl: string;
}

/** Load config or null when any required env var is empty. Never logs secrets. */
function loadPaypalConfig(): PaypalConfig | null {
  const clientId = process.env.PAYPAL_CLIENT_ID ?? "";
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET ?? "";
  const returnBaseUrl = process.env.NEX_APP_PUBLIC_URL ?? "";
  const env = (process.env.PAYPAL_ENV ?? "sandbox").toLowerCase();
  if (!clientId || !clientSecret || !returnBaseUrl) return null;
  const baseUrl =
    env === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  return { clientId, clientSecret, baseUrl, returnBaseUrl };
}

/** Env presence check · intentionally boolean · never log the value. */
export function isPaypalConfigured(): boolean {
  return loadPaypalConfig() !== null;
}

/** Minimal in-process OAuth2 token cache to avoid minting a new token on
 *  every request. PayPal tokens have `expires_in` (seconds) · we store
 *  `expiresAtMs` and refresh with 60s buffer. */
let TOKEN_CACHE: { token: string; expiresAtMs: number } | null = null;

/** Allow tests to clear the cache between runs. */
export function _resetPaypalOauthCacheForTests(): void {
  TOKEN_CACHE = null;
}

/**
 * Mint (or reuse) a PayPal OAuth2 access token. Returns null if config
 * is absent. Throws `Error` with gateway detail on live API failure so
 * the caller can surface `oauth_failed`.
 */
async function getPaypalAccessToken(
  config: PaypalConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const now = Date.now();
  if (TOKEN_CACHE && TOKEN_CACHE.expiresAtMs - 60_000 > now) {
    return TOKEN_CACHE.token;
  }
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const res = await fetchImpl(`${config.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`oauth_failed ${res.status} ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token || typeof json.access_token !== "string") {
    throw new Error("oauth_failed · missing access_token in response");
  }
  const expiresInSec = typeof json.expires_in === "number" ? json.expires_in : 300;
  TOKEN_CACHE = {
    token: json.access_token,
    expiresAtMs: now + expiresInSec * 1000,
  };
  return json.access_token;
}

/**
 * Create a merchant-direct PayPal Orders v2 order for the given NEX order.
 *
 * Live wire-up:
 *   1. Mint OAuth2 token (cached in process).
 *   2. POST /v2/checkout/orders with intent=CAPTURE + payee.merchant_id.
 *   3. Return approval URL from `links[].rel === "approve"`.
 *
 * Fail-fast rules:
 *   · seller not connected → `seller_not_connected` (never calls PayPal)
 *   · order not payable    → `order_not_payable` (never calls PayPal)
 *   · env missing          → `credentials_missing` (never calls PayPal)
 *   · oauth failure        → `oauth_failed` with detail (no PII/secrets)
 *   · create failure       → `paypal_api_error` with httpStatus
 */
export async function createMerchantDirectPaypalOrder(input: {
  readonly order: NexOrderRow;
  readonly sellerPaypalMerchantId: string | null;
  /** Injected for tests · defaults to global fetch. */
  readonly fetchImpl?: typeof fetch;
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
  const config = loadPaypalConfig();
  if (!config) {
    return {
      ok: false,
      reason: "credentials_missing",
      detail:
        "PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and/or NEX_APP_PUBLIC_URL not set",
    };
  }

  const fetchImpl = input.fetchImpl ?? fetch;

  let token: string;
  try {
    token = await getPaypalAccessToken(config, fetchImpl);
  } catch (e) {
    return {
      ok: false,
      reason: "oauth_failed",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    };
  }

  const order = input.order;
  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: order.id,
        amount: {
          currency_code: order.currency,
          value: (order.price_pence / 100).toFixed(2),
        },
        payee: { merchant_id: input.sellerPaypalMerchantId },
        custom_id: order.id,
        invoice_id: order.id,
      },
    ],
    application_context: {
      return_url: `${config.returnBaseUrl}/nex-native/orders/${order.id}/pay/paypal/return`,
      cancel_url: `${config.returnBaseUrl}/nex-native/orders/${order.id}/pay/paypal?cancelled=1`,
      user_action: "PAY_NOW",
    },
  };

  let res: Response;
  try {
    res = await fetchImpl(`${config.baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        // Idempotency: PayPal accepts PayPal-Request-Id up to 36 chars.
        // Our NEX order id is a UUID (36 chars) so a retry for the same
        // order hits the same PayPal order rather than creating a dup.
        "PayPal-Request-Id": order.id,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      ok: false,
      reason: "paypal_api_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "network error",
    };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      reason: "paypal_api_error",
      detail: text.slice(0, 200),
      httpStatus: res.status,
    };
  }
  const json = (await res.json().catch(() => null)) as
    | {
        id?: string;
        links?: Array<{ rel?: string; href?: string }>;
      }
    | null;
  const paypalOrderId = json?.id;
  const approveLink = json?.links?.find((l) => l?.rel === "approve")?.href;
  if (!paypalOrderId || typeof paypalOrderId !== "string" || !approveLink) {
    return {
      ok: false,
      reason: "paypal_api_error",
      detail: "missing id or approval link in PayPal response",
    };
  }
  return { ok: true, orderId: paypalOrderId, url: approveLink };
}

export type PaypalCaptureFailure =
  | "credentials_missing"
  | "oauth_failed"
  | "paypal_api_error"
  | "not_approved_yet";

export interface PaypalCaptureResult {
  readonly ok: true;
  readonly paypalOrderId: string;
  readonly captureId: string;
  readonly status: string;
  readonly payeeMerchantId: string | null;
  readonly amount: { readonly currencyCode: string | null; readonly value: string | null };
  readonly nexOrderId: string | null;
}

export interface PaypalCaptureFailureResult {
  readonly ok: false;
  readonly reason: PaypalCaptureFailure;
  readonly detail?: string;
  readonly httpStatus?: number;
}

export type PaypalCaptureResponse = PaypalCaptureResult | PaypalCaptureFailureResult;

/**
 * Capture a PayPal order after the buyer approves. The return-handler
 * page calls this on arrival with ?token=<paypalOrderId> in the URL.
 */
export async function capturePaypalOrder(input: {
  readonly paypalOrderId: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<PaypalCaptureResponse> {
  const config = loadPaypalConfig();
  if (!config) {
    return {
      ok: false,
      reason: "credentials_missing",
      detail:
        "PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and/or NEX_APP_PUBLIC_URL not set",
    };
  }
  const fetchImpl = input.fetchImpl ?? fetch;

  let token: string;
  try {
    token = await getPaypalAccessToken(config, fetchImpl);
  } catch (e) {
    return {
      ok: false,
      reason: "oauth_failed",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    };
  }

  let res: Response;
  try {
    res = await fetchImpl(
      `${config.baseUrl}/v2/checkout/orders/${encodeURIComponent(input.paypalOrderId)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "PayPal-Request-Id": `capture-${input.paypalOrderId}`,
        },
        // PayPal accepts empty JSON body for capture.
        body: "{}",
      },
    );
  } catch (e) {
    return {
      ok: false,
      reason: "paypal_api_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "network error",
    };
  }
  if (res.status === 422) {
    // Buyer never approved · PayPal returns UNPROCESSABLE_ENTITY.
    return {
      ok: false,
      reason: "not_approved_yet",
      httpStatus: 422,
    };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      reason: "paypal_api_error",
      detail: text.slice(0, 200),
      httpStatus: res.status,
    };
  }
  const json = (await res.json().catch(() => null)) as
    | {
        id?: string;
        status?: string;
        purchase_units?: Array<{
          payee?: { merchant_id?: string };
          custom_id?: string;
          payments?: {
            captures?: Array<{
              id?: string;
              status?: string;
              amount?: { currency_code?: string; value?: string };
              custom_id?: string;
            }>;
          };
        }>;
      }
    | null;
  const paypalOrderId = json?.id ?? input.paypalOrderId;
  const status = json?.status ?? "UNKNOWN";
  const unit = json?.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (!capture?.id) {
    return {
      ok: false,
      reason: "paypal_api_error",
      detail: "capture response missing captures[0].id",
    };
  }
  const payeeMerchantId = unit?.payee?.merchant_id ?? null;
  const nexOrderId = capture.custom_id ?? unit?.custom_id ?? null;
  return {
    ok: true,
    paypalOrderId,
    captureId: capture.id,
    status: capture.status ?? status,
    payeeMerchantId,
    amount: {
      currencyCode: capture.amount?.currency_code ?? null,
      value: capture.amount?.value ?? null,
    },
    nexOrderId,
  };
}

/**
 * Read the seller's PayPal merchant id from the business row. Fail-soft
 * when the column is absent (mig 336 may not be applied yet).
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
