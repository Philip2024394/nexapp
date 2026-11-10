// src/app/api/nex-native/paypal/webhook/route.ts
//
// Owner-sealed 2026-11-10 · NEX merchant-direct PayPal webhook endpoint.
// Doctrine (merchant-payments #7): charges hit the SELLER'S PayPal
// merchant account directly via `payee.merchant_id` on Orders v2. This
// route is the platform-level webhook endpoint that receives events
// from PayPal for all merchants · we cross-check `resource.payee.
// merchant_id` against the seller row to preserve the audit trail.
//
// Trust boundary · PayPal verification is NOT a local HMAC (unlike
// Stripe). It requires POSTing the headers + raw body to PayPal's
// `/v1/notifications/verify-webhook-signature` endpoint. Because this
// scaffold must not make live PayPal API calls, the route returns:
//
//   · 503 `credentials_missing`             · when PAYPAL_WEBHOOK_ID absent
//   · 503 `verification_requires_live_paypal` · when creds present but
//       the scaffold refuses to make the live verify call
//
// The route logs intent in the credentials-present branch so the
// production wiring is obvious when owner authorises the live call.
// `markOrderPaid` is NEVER invoked in scaffold mode.

import { NextResponse, type NextRequest } from "next/server";
import {
  verifyPaypalWebhookSignature,
  NEX_PAYPAL_SYSTEM_ACTOR_ID,
} from "@/lib/nex-native/payments/paypal-webhook-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reference the system-actor constant so lint/tree-shaker can see the
// import is intentional · the live wire-up will pass it to markOrderPaid
// + recordOrderEvent (matching the Stripe route's pattern).
void NEX_PAYPAL_SYSTEM_ACTOR_ID;

/** Reject non-POST verbs explicitly. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed" },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1 · Read raw body FIRST · byte-exact for the eventual live verify call.
  const rawBody = await req.text();

  // 2 · Pull all 5 PayPal signature headers · passed through to the
  //     verify-webhook-signature call in the live wiring.
  const headers = {
    "paypal-auth-algo": req.headers.get("paypal-auth-algo"),
    "paypal-cert-url": req.headers.get("paypal-cert-url"),
    "paypal-transmission-id": req.headers.get("paypal-transmission-id"),
    "paypal-transmission-sig": req.headers.get("paypal-transmission-sig"),
    "paypal-transmission-time": req.headers.get("paypal-transmission-time"),
  };

  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    // 503 so PayPal retries while we fix the config. Never echo
    // "webhook id missing" into the PayPal dashboard log.
    return NextResponse.json(
      { ok: false, error: "credentials_missing" },
      { status: 503 },
    );
  }

  // 3 · Attempt verification. Scaffold always returns a failure union
  //     because the live PayPal verify call is not authorised yet.
  const verify = verifyPaypalWebhookSignature(rawBody, headers, webhookId);

  if (!verify.ok && verify.reason === "credentials_missing") {
    return NextResponse.json(
      { ok: false, error: "credentials_missing" },
      { status: 503 },
    );
  }

  // 4 · Credentials present · live verify call would go here. Log the
  //     intent server-side so the production path is traceable, and
  //     return a 503 with an honest reason. Do NOT call markOrderPaid.
  console.info(
    "[nex-paypal/webhook] would call /v1/notifications/verify-webhook-signature here",
    {
      webhook_id_present: Boolean(webhookId),
      headers_present: {
        auth_algo: Boolean(headers["paypal-auth-algo"]),
        cert_url: Boolean(headers["paypal-cert-url"]),
        transmission_id: Boolean(headers["paypal-transmission-id"]),
        transmission_sig: Boolean(headers["paypal-transmission-sig"]),
        transmission_time: Boolean(headers["paypal-transmission-time"]),
      },
      body_bytes: rawBody.length,
    },
  );

  return NextResponse.json(
    { ok: false, error: "verification_requires_live_paypal" },
    { status: 503 },
  );
}
