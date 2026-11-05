// src/app/api/nex-native/billing/starter-pack-checkout/route.ts
//
// NEX Billing · Starter Pack one-time checkout endpoint.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-05 iter 29 · Ship B3b.
//
// POST /api/nex-native/billing/starter-pack-checkout
// Body (JSON):
//   {
//     "successUrl": "https://nex.../packages?checkout=success&pack=1"
//     "cancelUrl":  "https://nex.../packages?checkout=cancel"
//   }
//
// Returns:
//   200 { ok:true, url: string, stripeCheckoutSessionId: string }
//   401 { ok:false, code:"unauthenticated" }
//   400 { ok:false, code:"bad_request" }
//   500 { ok:false, code:"config_error" | "stripe_error" }
//
// Deliberately NOT routed through src/lib/nex-native/billing/checkout-
// session.ts (that service is subscription-only + tier-bound). Starter
// Pack is a flat one-time €5 purchase with no tier concept. Keeping it
// a parallel code path is 50 lines vs. 500+ lines of entitlement
// plumbing we'd have to extend.
//
// SECURITY:
//   · Session resolved server-side · never trusts client-supplied id
//   · Price ID read from env (STRIPE_PRICE_STARTER_PACK[_IE]) ·
//     client never provides it
//   · Checkout session carries metadata { nex_account_id, product:
//     "starter_pack" } so the sealed webhook can attribute the pack
//     to the right account.
//
// After successful payment:
//   1. Stripe fires `checkout.session.completed` to the sealed webhook
//   2. Webhook identifies product=starter_pack via metadata
//   3. Webhook updates nex_account:
//        starter_pack_quota_remaining = 10
//        starter_pack_expires_at      = now() + 60 days
//        starter_pack_purchased_at    = now()
//   4. tier-gate.ts consults these columns to allow +10 products
//      beyond the sealed Gratis cap.
//   5. Requires migration 281 applied (DRAFT today) · code gracefully
//      fail-closes when the columns aren't present yet.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ParsedBody {
  readonly successUrl: string;
  readonly cancelUrl: string;
}

function parseBody(input: unknown): ParsedBody | null {
  if (!input || typeof input !== "object") return null;
  const b = input as Record<string, unknown>;
  const successUrl = typeof b.successUrl === "string" ? b.successUrl : "";
  const cancelUrl = typeof b.cancelUrl === "string" ? b.cancelUrl : "";
  if (!/^https?:\/\//.test(successUrl)) return null;
  if (!/^https?:\/\//.test(cancelUrl)) return null;
  if (
    process.env.NODE_ENV === "production" &&
    (!successUrl.startsWith("https://") || !cancelUrl.startsWith("https://"))
  ) {
    return null;
  }
  return { successUrl, cancelUrl };
}

/** Starter-Pack price ID resolver · Ireland suffix preferred when
 *  NEX_APP_IDENTITY=ireland (for VAT-inclusive EU pricing) · falls
 *  back to the base env var. Both sources are server-side env vars ·
 *  the client never supplies a price ID. */
function resolveStarterPackPriceId(): string | null {
  const identity = (process.env.NEX_APP_IDENTITY ?? "").trim().toLowerCase();
  if (identity === "ireland") {
    const ie = process.env.STRIPE_PRICE_STARTER_PACK_IE;
    if (ie && ie.trim().length > 0) return ie.trim();
  }
  const base = process.env.STRIPE_PRICE_STARTER_PACK;
  if (base && base.trim().length > 0) return base.trim();
  return null;
}

function makeStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, {
    apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1 · authentication
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json(
      { ok: false, code: "unauthenticated" },
      { status: 401 },
    );
  }

  // 2 · body
  let bodyRaw: unknown;
  try {
    bodyRaw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }
  const body = parseBody(bodyRaw);
  if (!body) {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }

  // 3 · price id · fail-closed if unconfigured
  const priceId = resolveStarterPackPriceId();
  if (!priceId) {
    return NextResponse.json(
      { ok: false, code: "config_error" },
      { status: 500 },
    );
  }

  // 4 · Stripe client · fail-closed if unconfigured
  let stripe: Stripe;
  try {
    stripe = makeStripeClient();
  } catch {
    return NextResponse.json(
      { ok: false, code: "config_error" },
      { status: 500 },
    );
  }

  // 5 · create Checkout Session in PAYMENT mode (one-time) · attach
  //     metadata so the webhook can attribute the grant.
  try {
    // Idempotency · one checkout attempt per { account, minute-bucket }
    // deflects double-clicks without blocking a real second purchase.
    const now = new Date();
    const minuteBucket = Math.floor(now.getTime() / 60_000);
    const idempotencyKey = `starter-pack:${session.account.id}:${minuteBucket}`;

    const sess = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: body.successUrl,
        cancel_url: body.cancelUrl,
        customer_creation: "if_required",
        metadata: {
          nex_account_id: session.account.id,
          nex_product: "starter_pack",
          nex_pack_quota: "10",
          nex_pack_window_days: "60",
        },
        payment_intent_data: {
          metadata: {
            nex_account_id: session.account.id,
            nex_product: "starter_pack",
          },
        },
      },
      { idempotencyKey },
    );
    if (!sess.url) {
      return NextResponse.json(
        { ok: false, code: "stripe_error" },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { ok: true, url: sess.url, stripeCheckoutSessionId: sess.id },
      { status: 200 },
    );
  } catch (err) {
    console.error(
      "[nex-billing/starter-pack-checkout] unexpected error:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { ok: false, code: "stripe_error" },
      { status: 500 },
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, code: "method_not_allowed" },
    { status: 405 },
  );
}
