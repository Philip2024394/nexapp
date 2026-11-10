// src/lib/nex-native/payments/paypal-webhook-service.ts
//
// Owner-sealed 2026-11-10 · NEX merchant-direct PayPal webhook primitives.
// Doctrine (merchant-payments #7): charges hit the SELLER'S PayPal
// merchant account directly via `payee.merchant_id` on the Orders v2
// create. Webhooks arrive at the NEX platform-level endpoint and carry
// a `resource.payee.merchant_id` field we can cross-check against the
// seller row before trusting the event.
//
// Trust boundary · PayPal signature verification is NOT a local HMAC
// (Stripe's model). PayPal's documented verification path is a live
// server-to-server POST to:
//
//   POST /v1/notifications/verify-webhook-signature
//
// with the five signature-related headers and the raw body. The response
// is `{ verification_status: "SUCCESS" | "FAILURE" }`. That means NEX
// cannot verify a PayPal webhook offline · we MUST call PayPal from the
// webhook route. This scaffold prepares the shape but intentionally does
// NOT call out · `verifyPaypalWebhookSignature` returns:
//
//   · { ok: false, reason: "credentials_missing" } when PAYPAL_WEBHOOK_ID
//     is absent (verification cannot proceed even in theory).
//   · { ok: false, reason: "verification_requires_api_call" } when creds
//     are present · signalling to the route to perform the live call
//     once owner authorises it.
//
// This module is intentionally runtime-agnostic (no `server-only`) so
// it can be unit tested without the Next.js server-only boundary.

/**
 * NEX system actor UUID used as the actor_account_id when the PayPal
 * webhook triggers a state transition on behalf of PayPal (no human in
 * the loop). Same shape as Stripe system actor · distinct constant so
 * audit rows cleanly identify the originating gateway.
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
  /** PAYPAL_WEBHOOK_ID absent · cannot verify. */
  | "credentials_missing"
  /** Creds present · requires a live PayPal API call this scaffold refuses to make. */
  | "verification_requires_api_call";

export interface PaypalSignatureVerifyResult {
  readonly ok: false;
  readonly reason: PaypalSignatureVerifyFailure;
  readonly detail?: string;
}

/**
 * Verify a PayPal webhook signature. SCAFFOLD · does NOT call PayPal.
 *
 * PayPal signature verification requires POSTing the headers + raw body
 * to `/v1/notifications/verify-webhook-signature` · there is no local
 * HMAC equivalent. This function reports whether verification is even
 * *possible* given the current env state:
 *
 *   · missing PAYPAL_WEBHOOK_ID → `credentials_missing` (no WebhookID
 *     means the live verify call would itself fail).
 *   · creds present → `verification_requires_api_call` so the route
 *     surfaces the real blocker honestly instead of silently trusting.
 *
 * When owner authorises the live wire-up, this function becomes an
 * async POST to PayPal and returns `{ ok: true }` on SUCCESS.
 */
export function verifyPaypalWebhookSignature(
  rawBody: string,
  headers: Readonly<Record<string, string | null | undefined>>,
  webhookId: string | null | undefined,
): PaypalSignatureVerifyResult {
  // Reference args so type-checker doesn't complain about unused in scaffold.
  void rawBody;
  void headers;
  if (!webhookId || typeof webhookId !== "string" || webhookId.length === 0) {
    return {
      ok: false,
      reason: "credentials_missing",
      detail: "PAYPAL_WEBHOOK_ID not set",
    };
  }
  return {
    ok: false,
    reason: "verification_requires_api_call",
    detail:
      "PayPal signature verification requires a live POST to /v1/notifications/verify-webhook-signature · scaffold refuses to call out",
  };
}

/**
 * Parse a PayPal webhook payload JSON into a narrow PaypalWebhookEvent.
 * The raw body MUST have been signature-verified before calling this ·
 * we never trust the JSON for authorisation. In scaffold mode the route
 * does NOT reach this function because signature verification returns
 * `verification_requires_api_call`, but it is implemented here so the
 * downstream wiring is unit-testable.
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
  const resource = obj.resource && typeof obj.resource === "object"
    ? (obj.resource as Record<string, unknown>)
    : null;
  if (!id || !eventType || !resource) return null;

  const resourceId = typeof resource.id === "string" ? resource.id : null;
  const customId = typeof resource.custom_id === "string" ? resource.custom_id : null;
  const invoiceId = typeof resource.invoice_id === "string" ? resource.invoice_id : null;
  const payee = resource.payee && typeof resource.payee === "object"
    ? (resource.payee as Record<string, unknown>)
    : null;
  const payeeMerchantId = payee && typeof payee.merchant_id === "string"
    ? (payee.merchant_id as string)
    : null;
  const amountObj = resource.amount && typeof resource.amount === "object"
    ? (resource.amount as Record<string, unknown>)
    : null;
  const amount = {
    currencyCode: amountObj && typeof amountObj.currency_code === "string"
      ? (amountObj.currency_code as string)
      : null,
    value: amountObj && typeof amountObj.value === "string"
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

/** Narrow accessor: extract the NEX order id from a verified capture event.
 *  PayPal `custom_id` is the preferred carrier (survives refunds) ·
 *  `invoice_id` is the fallback. */
export function extractNexOrderIdFromPaypal(
  event: Extract<
    PaypalWebhookEvent,
    { type: "CHECKOUT.ORDER.APPROVED" | "PAYMENT.CAPTURE.COMPLETED" | "PAYMENT.CAPTURE.REFUNDED" }
  >,
): string | null {
  if (event.customId && event.customId.length > 0) return event.customId;
  if (event.invoiceId && event.invoiceId.length > 0) return event.invoiceId;
  return null;
}
