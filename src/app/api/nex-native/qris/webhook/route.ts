// src/app/api/nex-native/qris/webhook/route.ts
//
// Owner-sealed 2026-11-10 · NEX merchant-direct dynamic QRIS webhook
// endpoint · dispatches to Midtrans or Xendit verifier based on the
// required `X-Nex-Qris-Provider` request header.
//
// Doctrine (merchant-payments #7): QRIS charges settle to the seller's
// Midtrans sub-merchant or Xendit sub-account directly. NEX never holds
// funds. This endpoint is a single entrypoint for both providers so
// the webhook URL registered with Midtrans/Xendit can be the same.
//
// Trust boundary:
//   · X-Nex-Qris-Provider is REQUIRED (midtrans | xendit). This is how
//     we know which verifier to use. Without it we 400 · never guess.
//   · Midtrans: signature from body `signature_key` field verified via
//     SHA512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY).
//   · Xendit: signature from `x-callback-signature` header verified via
//     HMAC-SHA256(XENDIT_WEBHOOK_TOKEN, raw body).
//
// SCAFFOLD. In live-creds mode this route calls markOrderPaid on the
// settlement event. Today the scaffold returns a 503 with reason
// `provider_scaffold_not_live` so the integration point is clear but
// no DB state is mutated.

import { NextResponse, type NextRequest } from "next/server";
import {
  verifyMidtransSignature,
  verifyXenditSignature,
  parseMidtransWebhookEvent,
  parseXenditWebhookEvent,
  NEX_QRIS_SYSTEM_ACTOR_ID,
} from "@/lib/nex-native/payments/qris-webhook-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Referenced in the live wire-up (passed to markOrderPaid + recordOrderEvent).
void NEX_QRIS_SYSTEM_ACTOR_ID;

/** Reject non-POST verbs explicitly. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed" },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const providerHeader = req.headers.get("x-nex-qris-provider");
  if (providerHeader !== "midtrans" && providerHeader !== "xendit") {
    return NextResponse.json(
      { ok: false, error: "missing_or_invalid_provider_header" },
      { status: 400 },
    );
  }

  const rawBody = await req.text();

  if (providerHeader === "midtrans") {
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      return NextResponse.json(
        { ok: false, error: "credentials_missing" },
        { status: 503 },
      );
    }
    // Midtrans notification body contains the signature itself (field
    // `signature_key`). Parse the body BEFORE signature verify is OK
    // because signature verify consumes the parsed fields directly ·
    // we never trust the body for authorisation until verify passes.
    let bodyObj: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (parsed && typeof parsed === "object") {
        bodyObj = parsed as Record<string, unknown>;
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: "malformed_body" },
        { status: 400 },
      );
    }
    if (!bodyObj) {
      return NextResponse.json(
        { ok: false, error: "malformed_body" },
        { status: 400 },
      );
    }

    const signaturePayload = {
      order_id: typeof bodyObj.order_id === "string" ? (bodyObj.order_id as string) : "",
      status_code: typeof bodyObj.status_code === "string" ? (bodyObj.status_code as string) : "",
      gross_amount: typeof bodyObj.gross_amount === "string" ? (bodyObj.gross_amount as string) : "",
    };
    const signatureFromBody = typeof bodyObj.signature_key === "string"
      ? (bodyObj.signature_key as string)
      : null;
    if (!verifyMidtransSignature(signaturePayload, signatureFromBody, serverKey)) {
      return NextResponse.json(
        { ok: false, error: "invalid signature" },
        { status: 400 },
      );
    }

    const event = parseMidtransWebhookEvent(rawBody);
    if (!event) {
      return NextResponse.json(
        { ok: false, error: "malformed_event" },
        { status: 400 },
      );
    }

    // SCAFFOLD · do not mutate DB. In live mode: on settlement →
    // markOrderPaid(event.orderId, NEX_QRIS_SYSTEM_ACTOR_ID).
    console.info("[nex-qris/webhook] midtrans event received (scaffold)", {
      midtrans_transaction_id: event.id,
      type: event.type,
      order_id: event.orderId,
    });
    return NextResponse.json(
      { ok: false, error: "provider_scaffold_not_live" },
      { status: 503 },
    );
  }

  // providerHeader === "xendit"
  const xenditToken = process.env.XENDIT_WEBHOOK_TOKEN ?? process.env.XENDIT_SECRET_KEY;
  if (!xenditToken) {
    return NextResponse.json(
      { ok: false, error: "credentials_missing" },
      { status: 503 },
    );
  }
  const signatureHeader = req.headers.get("x-callback-signature");
  if (!verifyXenditSignature(rawBody, signatureHeader, xenditToken)) {
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 400 },
    );
  }

  const event = parseXenditWebhookEvent(rawBody);
  if (!event) {
    return NextResponse.json(
      { ok: false, error: "malformed_event" },
      { status: 400 },
    );
  }

  // SCAFFOLD · do not mutate DB. In live mode: on settlement →
  // markOrderPaid(event.orderId, NEX_QRIS_SYSTEM_ACTOR_ID).
  console.info("[nex-qris/webhook] xendit event received (scaffold)", {
    xendit_event_id: event.id,
    type: event.type,
    order_id: event.orderId,
  });
  return NextResponse.json(
    { ok: false, error: "provider_scaffold_not_live" },
    { status: 503 },
  );
}
