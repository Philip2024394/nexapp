// src/lib/nex-native/payments/qris-webhook-service.ts
//
// Owner-sealed 2026-11-10 · NEX merchant-direct dynamic QRIS webhook
// primitives · supports BOTH Midtrans (SHA512 hex signature) and Xendit
// (HMAC-SHA256 hex signature).
//
// Doctrine (merchant-payments #7): QRIS charges settle to the seller's
// Midtrans sub-merchant or Xendit sub-account directly. NEX never holds
// funds. Webhooks arrive at the NEX platform-level endpoint; the route
// dispatches to the correct verifier based on the required
// `X-Nex-Qris-Provider` header.
//
// Midtrans signature algorithm (documented):
//
//   signature = SHA512_hex(order_id + status_code + gross_amount + server_key)
//
// where `order_id`, `status_code`, `gross_amount` come from the JSON
// body. The signature is carried in the `signature_key` field of the
// notification body itself (Midtrans does NOT use an HTTP header for
// the signature).
//
// Xendit signature algorithm (documented):
//
//   signature = HMAC_SHA256_hex(secret_token, raw_body)
//
// carried in the `x-callback-token` header (OR as of newer webhook
// versions, `webhook-token` + `x-callback-signature` HMAC pair · we
// implement the HMAC pair form since it is the pattern Xendit
// recommends for new integrations).
//
// Both compare with Node's `timingSafeEqual` on equal-length byte
// buffers to avoid timing side channels.
//
// This module is intentionally runtime-agnostic (no `server-only`) so
// it can be unit tested without the Next.js server-only boundary.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * NEX system actor UUID used as the actor_account_id when the QRIS
 * webhook triggers a state transition on behalf of the provider (no
 * human in the loop). Distinct constant per gateway so audit rows
 * cleanly identify origin.
 */
export const NEX_QRIS_SYSTEM_ACTOR_ID =
  "00000000-0000-4000-8000-000000000002" as const;

/** Narrow discriminated union · only events the NEX webhook route handles. */
export type QrisWebhookEvent =
  | {
      readonly id: string;
      readonly type: "settlement";
      readonly provider: "midtrans" | "xendit";
      readonly orderId: string | null;
      readonly grossAmount: string | null;
      readonly currency: string | null;
      readonly rawStatus: string;
    }
  | {
      readonly id: string;
      readonly type: "pending";
      readonly provider: "midtrans" | "xendit";
      readonly orderId: string | null;
      readonly rawStatus: string;
    }
  | {
      readonly id: string;
      readonly type: "expire";
      readonly provider: "midtrans" | "xendit";
      readonly orderId: string | null;
      readonly rawStatus: string;
    }
  | {
      readonly id: string;
      readonly type: "cancel";
      readonly provider: "midtrans" | "xendit";
      readonly orderId: string | null;
      readonly rawStatus: string;
    }
  | {
      readonly id: string;
      readonly type: "deny";
      readonly provider: "midtrans" | "xendit";
      readonly orderId: string | null;
      readonly rawStatus: string;
    }
  | {
      readonly id: string;
      readonly type: "unhandled";
      readonly provider: "midtrans" | "xendit";
      readonly originalStatus: string;
      readonly orderId: string | null;
    };

/**
 * Constant-time compare between two hex strings. Returns false if
 * lengths differ (timingSafeEqual requires equal-length buffers).
 */
export function timingSafeHexEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Compute the Midtrans signature_key for a parsed notification payload.
 * Midtrans documents the algorithm as:
 *
 *   SHA512_hex(order_id + status_code + gross_amount + server_key)
 *
 * where order_id/status_code/gross_amount come from the notification body.
 */
export function computeMidtransSignature(
  payload: {
    readonly order_id: string;
    readonly status_code: string;
    readonly gross_amount: string;
  },
  serverKey: string,
): string {
  const input = `${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`;
  return createHash("sha512").update(input, "utf8").digest("hex");
}

/**
 * Verify a Midtrans webhook. Returns `true` only if the computed
 * SHA512(order_id + status_code + gross_amount + server_key) matches
 * the body's `signature_key` field under a timing-safe compare.
 *
 * NOTE: Midtrans carries the signature in the JSON body itself (the
 * `signature_key` field), NOT in an HTTP header. The caller passes
 * that string in as `signatureFromBody`.
 */
export function verifyMidtransSignature(
  payload: {
    readonly order_id: string;
    readonly status_code: string;
    readonly gross_amount: string;
  } | null | undefined,
  signatureFromBody: string | null | undefined,
  serverKey: string | null | undefined,
): boolean {
  if (!serverKey || typeof serverKey !== "string") return false;
  if (!signatureFromBody || typeof signatureFromBody !== "string") return false;
  if (!payload) return false;
  if (
    typeof payload.order_id !== "string" ||
    typeof payload.status_code !== "string" ||
    typeof payload.gross_amount !== "string"
  ) {
    return false;
  }
  const expected = computeMidtransSignature(payload, serverKey);
  return timingSafeHexEqual(signatureFromBody, expected);
}

/**
 * Compute the Xendit webhook HMAC signature.
 *
 *   HMAC_SHA256_hex(secret_token, raw_body)
 */
export function computeXenditSignature(
  rawBody: string,
  webhookToken: string,
): string {
  return createHmac("sha256", webhookToken).update(rawBody, "utf8").digest("hex");
}

/**
 * Verify a Xendit webhook HMAC signature.
 * Returns `true` only if the computed HMAC_SHA256(webhook_token, raw_body)
 * matches the value from the `x-callback-signature` header.
 */
export function verifyXenditSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  webhookToken: string | null | undefined,
): boolean {
  if (!webhookToken || typeof webhookToken !== "string") return false;
  if (!signatureHeader || typeof signatureHeader !== "string") return false;
  if (typeof rawBody !== "string") return false;
  const expected = computeXenditSignature(rawBody, webhookToken);
  return timingSafeHexEqual(signatureHeader, expected);
}

/** Narrow Midtrans subset of QrisWebhookEvent (all provider:"midtrans"). */
export type MidtransWebhookEvent = Extract<QrisWebhookEvent, { provider: "midtrans" }>;

/**
 * Parse a verified Midtrans notification into a narrow QrisWebhookEvent.
 * Midtrans `transaction_status` values are documented as:
 *   settlement · capture · pending · deny · cancel · expire · refund
 *
 * For QRIS we care about: settlement (successful · final) · pending
 * (awaiting scan) · expire · cancel · deny. Everything else is
 * `unhandled`.
 */
export function parseMidtransWebhookEvent(
  rawBody: string,
): MidtransWebhookEvent | null {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const orderId = typeof obj.order_id === "string" ? obj.order_id : null;
  const status = typeof obj.transaction_status === "string" ? obj.transaction_status : null;
  const transactionId = typeof obj.transaction_id === "string"
    ? obj.transaction_id
    : null;
  const grossAmount = typeof obj.gross_amount === "string" ? obj.gross_amount : null;
  const currency = typeof obj.currency === "string" ? obj.currency : null;
  if (!status || !transactionId) return null;

  const base = {
    id: transactionId,
    provider: "midtrans" as const,
    orderId,
    rawStatus: status,
  };
  if (status === "settlement" || status === "capture") {
    return {
      ...base,
      type: "settlement",
      grossAmount,
      currency,
    };
  }
  if (status === "pending") return { ...base, type: "pending" };
  if (status === "expire") return { ...base, type: "expire" };
  if (status === "cancel") return { ...base, type: "cancel" };
  if (status === "deny") return { ...base, type: "deny" };
  return {
    id: transactionId,
    provider: "midtrans",
    type: "unhandled",
    orderId,
    originalStatus: status,
  };
}

/** Narrow Xendit subset of QrisWebhookEvent (all provider:"xendit"). */
export type XenditWebhookEvent = Extract<QrisWebhookEvent, { provider: "xendit" }>;

/**
 * Parse a verified Xendit QR code callback into a narrow QrisWebhookEvent.
 * Xendit QR code webhook status values:
 *   SUCCEEDED · FAILED · EXPIRED · ACTIVE
 */
export function parseXenditWebhookEvent(
  rawBody: string,
): XenditWebhookEvent | null {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const eventId = typeof obj.id === "string" ? obj.id : null;
  const referenceId = typeof obj.reference_id === "string" ? obj.reference_id : null;
  const dataObj = obj.data && typeof obj.data === "object"
    ? (obj.data as Record<string, unknown>)
    : null;
  const status = dataObj && typeof dataObj.status === "string"
    ? (dataObj.status as string)
    : typeof obj.status === "string" ? obj.status : null;
  const dataRef = dataObj && typeof dataObj.reference_id === "string"
    ? (dataObj.reference_id as string)
    : referenceId;
  const amountNum = dataObj && typeof dataObj.amount === "number"
    ? (dataObj.amount as number)
    : null;
  const currency = dataObj && typeof dataObj.currency === "string"
    ? (dataObj.currency as string)
    : null;
  if (!eventId || !status) return null;

  const base = {
    id: eventId,
    provider: "xendit" as const,
    orderId: dataRef,
    rawStatus: status,
  };
  if (status === "SUCCEEDED") {
    return {
      ...base,
      type: "settlement",
      grossAmount: amountNum != null ? String(amountNum) : null,
      currency,
    };
  }
  if (status === "ACTIVE") return { ...base, type: "pending" };
  if (status === "EXPIRED") return { ...base, type: "expire" };
  if (status === "FAILED") return { ...base, type: "deny" };
  return {
    id: eventId,
    provider: "xendit",
    type: "unhandled",
    orderId: dataRef,
    originalStatus: status,
  };
}
