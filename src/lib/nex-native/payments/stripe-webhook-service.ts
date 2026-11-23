// src/lib/nex-native/payments/stripe-webhook-service.ts
//
// Owner-sealed 2026-11-10 · NEX merchant-direct Stripe webhook primitives.
// Doctrine (merchant-payments #7): charges hit the SELLER'S connected
// Stripe account directly. NEX never holds funds. Webhooks may arrive
// with a `Stripe-Account` header identifying the connected account that
// generated the event — we accept both platform-level and connected-
// account events and preserve the connected-account id as audit metadata.
//
// This module is intentionally runtime-agnostic (no `server-only`) so it
// can be unit tested without the Next.js server-only boundary. Signature
// verification uses Node's built-in `crypto` HMAC-SHA256 following
// Stripe's documented algorithm:
//
//   signed_payload = `${t}.${rawBody}`
//   expected_sig    = HMAC_SHA256(secret, signed_payload) · hex
//   header format   = `t=<unix>,v1=<expected_sig>[,v1=<extra_sig>]...`
//
// We compare with `crypto.timingSafeEqual` on equal-length byte buffers to
// avoid timing side channels.
//
// We deliberately do NOT import the `stripe` npm package here · this
// service MUST work with just Node crypto so the webhook route is
// portable, deterministic in tests, and does not pull Stripe SDK state
// into the hot verification path.

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * NEX system actor UUID used as the actor_account_id when the webhook
 * triggers a state transition on behalf of Stripe (no human in the
 * loop). Hard-coded per owner directive · not a real account row.
 */
export const NEX_STRIPE_SYSTEM_ACTOR_ID =
  "00000000-0000-4000-8000-000000000000" as const;

/**
 * Shape of the `checkout.session.*` data.object we care about. Shared by
 * `checkout.session.completed` and the two delayed-settlement variants
 * (`async_payment_succeeded` + `async_payment_failed`). Owner directive
 * 2026-11-23 · Stripe fires `async_payment_succeeded` when a bank-debit /
 * BNPL settles AFTER the initial `completed` event · the webhook must
 * handle it to flip the order to paid at that later moment.
 */
type StripeCheckoutSessionObject = {
  readonly id: string;
  readonly metadata?: Record<string, string | undefined> | null;
  readonly client_reference_id?: string | null;
  readonly payment_status?: string | null;
};

/** Narrow discriminated union · only events the NEX webhook route handles. */
export type StripeWebhookEvent =
  | {
      readonly id: string;
      readonly type: "checkout.session.completed";
      readonly connectedAccountId: string | null;
      readonly data: { readonly object: StripeCheckoutSessionObject };
    }
  | {
      readonly id: string;
      readonly type: "checkout.session.async_payment_succeeded";
      readonly connectedAccountId: string | null;
      readonly data: { readonly object: StripeCheckoutSessionObject };
    }
  | {
      readonly id: string;
      readonly type: "checkout.session.async_payment_failed";
      readonly connectedAccountId: string | null;
      readonly data: { readonly object: StripeCheckoutSessionObject };
    }
  | {
      readonly id: string;
      readonly type: "charge.refunded";
      readonly connectedAccountId: string | null;
      readonly data: {
        readonly object: {
          readonly id: string;
          readonly amount_refunded?: number | null;
          readonly metadata?: Record<string, string | undefined> | null;
        };
      };
    }
  | {
      readonly id: string;
      readonly type: "unhandled";
      readonly originalType: string;
      readonly connectedAccountId: string | null;
      readonly data: { readonly object: Record<string, unknown> };
    };

/**
 * Parse the raw `stripe-signature` header value into its elements. The
 * header shape is `t=<ts>,v1=<sig>[,v1=<sig>]...` possibly with `v0=` too.
 * Returns null if the header is malformed.
 */
function parseSignatureHeader(
  header: string,
): { timestamp: string; signatures: string[] } | null {
  if (!header) return null;
  const parts = header.split(",").map((p) => p.trim()).filter(Boolean);
  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (!value) continue;
    if (key === "t") {
      timestamp = value;
    } else if (key === "v1") {
      signatures.push(value);
    }
  }
  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

/**
 * Compute the expected Stripe v1 signature for a given payload.
 * `signed_payload = ${timestamp}.${rawBody}` then HMAC-SHA256 with the
 * webhook secret, lowercase hex.
 */
export function computeStripeSignature(
  rawBody: string,
  timestamp: string,
  secret: string,
): string {
  const signedPayload = `${timestamp}.${rawBody}`;
  return createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
}

/**
 * Constant-time compare between two hex strings. Returns false if lengths
 * differ (timingSafeEqual requires equal-length buffers).
 */
export function timingSafeHexEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  // Convert to byte buffers of equal length and compare.
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Default Stripe-recommended timestamp tolerance (seconds). */
export const STRIPE_DEFAULT_TOLERANCE_SECONDS = 300;

/**
 * Verify a Stripe webhook signature using Node's built-in crypto HMAC.
 * Returns `true` only if:
 *   · secret is a non-empty string
 *   · signatureHeader parses into `t=...,v1=...`
 *   · at least one `v1=` value equals the expected HMAC of
 *     `${timestamp}.${rawBody}` under a timing-safe compare
 *   · `|Date.now()/1000 - timestamp| <= toleranceSeconds`
 *
 * Owner-sealed 2026-11-10 (cycle 5 Stripe Option B · 5-minute window).
 * Follows Stripe's documented replay-protection recommendation.
 * `toleranceSeconds` is parameterised for testing · production callers
 * should accept the default (300s).
 *
 * `nowSeconds` is injectable for deterministic tests. Default is the
 * real wall clock in seconds since epoch.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string | null | undefined,
  toleranceSeconds: number = STRIPE_DEFAULT_TOLERANCE_SECONDS,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || typeof secret !== "string") return false;
  if (!signatureHeader || typeof signatureHeader !== "string") return false;
  if (typeof rawBody !== "string") return false;

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  // Reject outside the tolerance window · Stripe docs recommend 5 min.
  // A toleranceSeconds <= 0 disables the age check entirely (test-only
  // escape hatch · production always uses the 300s default).
  if (toleranceSeconds > 0) {
    const t = Number(parsed.timestamp);
    if (!Number.isFinite(t)) return false;
    const ageSeconds = Math.abs(nowSeconds - t);
    if (ageSeconds > toleranceSeconds) return false;
  }

  const expected = computeStripeSignature(rawBody, parsed.timestamp, secret);
  for (const candidate of parsed.signatures) {
    if (timingSafeHexEqual(candidate, expected)) {
      return true;
    }
  }
  return false;
}

/**
 * Parse a verified webhook payload JSON into a narrow StripeWebhookEvent.
 * The raw body MUST have been signature-verified before calling this —
 * we never trust the JSON for authorisation. `connectedAccountId` is
 * sourced from the `Stripe-Account` request header by the route caller
 * and passed through here as the second argument; Stripe sets this on
 * events from a connected account (i.e. merchant-direct charges on the
 * seller's Stripe account).
 */
export function parseStripeWebhookEvent(
  rawBody: string,
  connectedAccountId: string | null,
): StripeWebhookEvent | null {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const id = typeof obj.id === "string" ? obj.id : null;
  const type = typeof obj.type === "string" ? obj.type : null;
  const data = obj.data && typeof obj.data === "object"
    ? (obj.data as { object?: unknown })
    : null;
  const dataObject = data && data.object && typeof data.object === "object"
    ? (data.object as Record<string, unknown>)
    : null;
  if (!id || !type || !dataObject) return null;

  if (
    type === "checkout.session.completed" ||
    type === "checkout.session.async_payment_succeeded" ||
    type === "checkout.session.async_payment_failed"
  ) {
    const sessionObject: StripeCheckoutSessionObject = {
      id: typeof dataObject.id === "string" ? dataObject.id : "",
      metadata: (dataObject.metadata as Record<string, string | undefined> | undefined) ?? null,
      client_reference_id:
        typeof dataObject.client_reference_id === "string"
          ? dataObject.client_reference_id
          : null,
      payment_status:
        typeof dataObject.payment_status === "string"
          ? dataObject.payment_status
          : null,
    };
    return {
      id,
      type,
      connectedAccountId,
      data: { object: sessionObject },
    } as StripeWebhookEvent;
  }
  if (type === "charge.refunded") {
    return {
      id,
      type,
      connectedAccountId,
      data: {
        object: {
          id: typeof dataObject.id === "string" ? dataObject.id : "",
          amount_refunded:
            typeof dataObject.amount_refunded === "number"
              ? dataObject.amount_refunded
              : null,
          metadata: (dataObject.metadata as Record<string, string | undefined> | undefined) ?? null,
        },
      },
    };
  }
  return {
    id,
    type: "unhandled",
    originalType: type,
    connectedAccountId,
    data: { object: dataObject },
  };
}

/** Checkout-session-shaped event union (completed + async variants). */
export type StripeCheckoutSessionEvent = Extract<
  StripeWebhookEvent,
  {
    type:
      | "checkout.session.completed"
      | "checkout.session.async_payment_succeeded"
      | "checkout.session.async_payment_failed";
  }
>;

/** Narrow accessor: extract the NEX order id from a verified checkout event. */
export function extractNexOrderId(event: StripeCheckoutSessionEvent): string | null {
  const meta = event.data.object.metadata ?? null;
  const fromMeta = meta && typeof meta.nex_order_id === "string"
    ? meta.nex_order_id
    : null;
  if (fromMeta) return fromMeta;
  const fromClientRef = event.data.object.client_reference_id;
  return fromClientRef && typeof fromClientRef === "string" ? fromClientRef : null;
}
