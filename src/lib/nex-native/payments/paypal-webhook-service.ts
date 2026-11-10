// src/lib/nex-native/payments/paypal-webhook-service.ts
//
// Owner-sealed 2026-11-10 (REVISED) · NEX merchant-direct PayPal webhook.
// Doctrine (sealed 2026-11-10 gateway ownership matrix §J4–J6):
//   · PayPal handles shop-owner commerce. The webhook is the only
//     authoritative trigger that flips nex_order.state to `paid` or
//     `refunded` · the browser return URL is NOT trusted for state.
//
// Trust boundary · PayPal signature verification is NOT a local HMAC
// (unlike Stripe). PayPal's documented verification path is a live
// server-to-server POST to:
//   POST /v1/notifications/verify-webhook-signature
//
// with the 5 signature-related headers and the raw body. The response
// is `{ verification_status: "SUCCESS" | "FAILURE" }`. This means the
// webhook route MUST call PayPal on every event · there is no offline
// shortcut.
//
// Live-wire status (2026-11-10 revised): `verifyPaypalWebhookSignature`
// is now an ASYNC function that performs the real verify call when
// credentials are present. It still returns `credentials_missing` when
// PAYPAL_WEBHOOK_ID, PAYPAL_CLIENT_ID, or PAYPAL_CLIENT_SECRET is empty.
//
// This module is runtime-agnostic (no `server-only`) so it can be unit
// tested with a mocked `fetch`.

/**
 * NEX system actor UUID used as the actor_account_id when the PayPal
 * webhook triggers a state transition on behalf of PayPal (no human in
 * the loop). Distinct from the Stripe system actor so audit rows
 * cleanly identify the originating gateway.
 */
export const NEX_PAYPAL_SYSTEM_ACTOR_ID =
  "00000000-0000-4000-8000-000000000001" as const;

/** Narrow discriminated union · only events the NEX webhook route handles. */
export type PaypalWebhookEvent =
  | {
      readonly id: string;
      readonly type: "CHECKOUT.ORDER.APPROVED";
      readonly resourceId: string | null;
      readonly payeeMerchantId: string | null;
      readonly customId: string | null;
      readonly invoiceId: string | null;
      readonly data: { readonly resource: Record<string, unknown> };
    }
  | {
      readonly id: string;
      readonly type: "PAYMENT.CAPTURE.COMPLETED";
      readonly resourceId: string | null;
      readonly payeeMerchantId: string | null;
      readonly customId: string | null;
      readonly invoiceId: string | null;
      readonly amount: { readonly currencyCode: string | null; readonly value: string | null };
      readonly data: { readonly resource: Record<string, unknown> };
    }
  | {
      readonly id: string;
      readonly type: "PAYMENT.CAPTURE.DENIED";
      readonly resourceId: string | null;
      readonly payeeMerchantId: string | null;
      readonly customId: string | null;
      readonly invoiceId: string | null;
      readonly amount: { readonly currencyCode: string | null; readonly value: string | null };
      readonly data: { readonly resource: Record<string, unknown> };
    }
  | {
      readonly id: string;
      readonly type: "PAYMENT.CAPTURE.REFUNDED";
      readonly resourceId: string | null;
      readonly payeeMerchantId: string | null;
      readonly customId: string | null;
      readonly invoiceId: string | null;
      readonly amount: { readonly currencyCode: string | null; readonly value: string | null };
      readonly data: { readonly resource: Record<string, unknown> };
    }
  | {
      readonly id: string;
      readonly type: "unhandled";
      readonly originalType: string;
      readonly resourceId: string | null;
      readonly payeeMerchantId: string | null;
      readonly customId: string | null;
      readonly invoiceId: string | null;
      readonly data: { readonly resource: Record<string, unknown> };
    };

export type PaypalSignatureVerifyFailure =
  /** One or more of PAYPAL_WEBHOOK_ID + PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET is absent. */
  | "credentials_missing"
  /** PayPal returned `verification_status: FAILURE`. */
  | "signature_invalid"
  /** PayPal returned non-2xx (network / outage) · retry-safe. */
  | "paypal_unavailable"
  /** OAuth token mint failed. */
  | "oauth_failed";

export interface PaypalSignatureVerifyResultOk {
  readonly ok: true;
}
export interface PaypalSignatureVerifyResultFail {
  readonly ok: false;
  readonly reason: PaypalSignatureVerifyFailure;
  readonly detail?: string;
  readonly httpStatus?: number;
}
export type PaypalSignatureVerifyResult =
  | PaypalSignatureVerifyResultOk
  | PaypalSignatureVerifyResultFail;

interface PaypalConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly baseUrl: string;
}
function loadConfig(): PaypalConfig | null {
  const clientId = process.env.PAYPAL_CLIENT_ID ?? "";
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET ?? "";
  const env = (process.env.PAYPAL_ENV ?? "sandbox").toLowerCase();
  if (!clientId || !clientSecret) return null;
  const baseUrl =
    env === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  return { clientId, clientSecret, baseUrl };
}

// Per-process OAuth2 token cache for webhook verify (same lifetime as
// the checkout service · PayPal docs recommend reuse).
let TOKEN_CACHE: { token: string; expiresAtMs: number } | null = null;

/** Allow tests to clear the cache between runs. */
export function _resetPaypalWebhookOauthCacheForTests(): void {
  TOKEN_CACHE = null;
}

async function mintToken(config: PaypalConfig, fetchImpl: typeof fetch): Promise<string> {
  const now = Date.now();
  if (TOKEN_CACHE && TOKEN_CACHE.expiresAtMs - 60_000 > now) return TOKEN_CACHE.token;
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
    throw new Error("oauth_failed · missing access_token");
  }
  const expiresInSec = typeof json.expires_in === "number" ? json.expires_in : 300;
  TOKEN_CACHE = { token: json.access_token, expiresAtMs: now + expiresInSec * 1000 };
  return json.access_token;
}

/**
 * Verify a PayPal webhook signature by calling PayPal's own verify
 * endpoint. The raw body MUST be the exact bytes PayPal POSTed to us ·
 * any re-serialisation breaks the verification.
 *
 * Returns:
 *   · ok=true                          · PayPal said SUCCESS
 *   · credentials_missing              · env not populated (never calls PayPal)
 *   · signature_invalid                · PayPal said FAILURE
 *   · paypal_unavailable + httpStatus  · retry-safe (non-2xx from PayPal)
 *   · oauth_failed                     · token mint failed
 */
export async function verifyPaypalWebhookSignature(
  rawBody: string,
  headers: Readonly<Record<string, string | null | undefined>>,
  webhookId: string | null | undefined,
  options: { readonly fetchImpl?: typeof fetch } = {},
): Promise<PaypalSignatureVerifyResult> {
  const config = loadConfig();
  if (
    !webhookId ||
    typeof webhookId !== "string" ||
    webhookId.length === 0 ||
    !config
  ) {
    return {
      ok: false,
      reason: "credentials_missing",
      detail:
        "PAYPAL_WEBHOOK_ID + PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET must all be set",
    };
  }

  // Header + body shape checks FIRST so we never burn an OAuth token
  // on an obviously malformed webhook.
  const authAlgo = headers["paypal-auth-algo"];
  const certUrl = headers["paypal-cert-url"];
  const transmissionId = headers["paypal-transmission-id"];
  const transmissionSig = headers["paypal-transmission-sig"];
  const transmissionTime = headers["paypal-transmission-time"];
  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    return {
      ok: false,
      reason: "signature_invalid",
      detail: "missing required PayPal signature header(s)",
    };
  }

  // The verify endpoint expects webhook_event = PARSED JSON of raw body.
  let parsedEvent: unknown;
  try {
    parsedEvent = JSON.parse(rawBody);
  } catch {
    return { ok: false, reason: "signature_invalid", detail: "body is not JSON" };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  let token: string;
  try {
    token = await mintToken(config, fetchImpl);
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
      `${config.baseUrl}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: webhookId,
          webhook_event: parsedEvent,
        }),
      },
    );
  } catch (e) {
    return {
      ok: false,
      reason: "paypal_unavailable",
      detail: e instanceof Error ? e.message.slice(0, 200) : "network error",
    };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      reason: "paypal_unavailable",
      detail: text.slice(0, 200),
      httpStatus: res.status,
    };
  }
  const json = (await res.json().catch(() => null)) as
    | { verification_status?: string }
    | null;
  if (json?.verification_status === "SUCCESS") return { ok: true };
  return {
    ok: false,
    reason: "signature_invalid",
    detail: `verification_status=${json?.verification_status ?? "UNKNOWN"}`,
  };
}

/**
 * Parse a PayPal webhook payload JSON into a narrow PaypalWebhookEvent.
 * The raw body MUST have been signature-verified before calling this ·
 * we never trust the JSON for authorisation.
 */
export function parsePaypalWebhookEvent(
  rawBody: string,
): PaypalWebhookEvent | null {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const id = typeof obj.id === "string" ? obj.id : null;
  const eventType = typeof obj.event_type === "string" ? obj.event_type : null;
  const resource =
    obj.resource && typeof obj.resource === "object"
      ? (obj.resource as Record<string, unknown>)
      : null;
  if (!id || !eventType || !resource) return null;

  const resourceId = typeof resource.id === "string" ? resource.id : null;
  const customId = typeof resource.custom_id === "string" ? resource.custom_id : null;
  const invoiceId = typeof resource.invoice_id === "string" ? resource.invoice_id : null;
  const payee =
    resource.payee && typeof resource.payee === "object"
      ? (resource.payee as Record<string, unknown>)
      : null;
  const payeeMerchantId =
    payee && typeof payee.merchant_id === "string" ? (payee.merchant_id as string) : null;
  const amountObj =
    resource.amount && typeof resource.amount === "object"
      ? (resource.amount as Record<string, unknown>)
      : null;
  const amount = {
    currencyCode:
      amountObj && typeof amountObj.currency_code === "string"
        ? (amountObj.currency_code as string)
        : null,
    value:
      amountObj && typeof amountObj.value === "string"
        ? (amountObj.value as string)
        : null,
  };

  if (eventType === "CHECKOUT.ORDER.APPROVED") {
    return {
      id,
      type: "CHECKOUT.ORDER.APPROVED",
      resourceId,
      payeeMerchantId,
      customId,
      invoiceId,
      data: { resource },
    };
  }
  if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
    return {
      id,
      type: "PAYMENT.CAPTURE.COMPLETED",
      resourceId,
      payeeMerchantId,
      customId,
      invoiceId,
      amount,
      data: { resource },
    };
  }
  if (eventType === "PAYMENT.CAPTURE.DENIED") {
    return {
      id,
      type: "PAYMENT.CAPTURE.DENIED",
      resourceId,
      payeeMerchantId,
      customId,
      invoiceId,
      amount,
      data: { resource },
    };
  }
  if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
    return {
      id,
      type: "PAYMENT.CAPTURE.REFUNDED",
      resourceId,
      payeeMerchantId,
      customId,
      invoiceId,
      amount,
      data: { resource },
    };
  }
  return {
    id,
    type: "unhandled",
    originalType: eventType,
    resourceId,
    payeeMerchantId,
    customId,
    invoiceId,
    data: { resource },
  };
}

/** Narrow accessor: extract the NEX order id from a verified event.
 *  PayPal `custom_id` is the preferred carrier (survives refunds) ·
 *  `invoice_id` is the fallback. */
export function extractNexOrderIdFromPaypal(
  event: Extract<
    PaypalWebhookEvent,
    {
      type:
        | "CHECKOUT.ORDER.APPROVED"
        | "PAYMENT.CAPTURE.COMPLETED"
        | "PAYMENT.CAPTURE.DENIED"
        | "PAYMENT.CAPTURE.REFUNDED";
    }
  >,
): string | null {
  if (event.customId && event.customId.length > 0) return event.customId;
  if (event.invoiceId && event.invoiceId.length > 0) return event.invoiceId;
  return null;
}
