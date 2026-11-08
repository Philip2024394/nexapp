// src/app/api/nex-native/billing/checkout/buyer/route.ts
//
// NEX buyer→seller checkout via Stripe Connect · Deliverable 5 of the
// Complete Payment System Build Plan · owner-authorised 2026-11-09.
// -----------------------------------------------------------------------------
// Creates a Stripe Checkout Session in `payment` mode (one-time charge)
// where the buyer's card is charged DIRECTLY to the seller's connected
// Stripe Express account. NEX takes 0% application fee (sealed
// commission rule). NEX does not hold or distribute seller sale
// proceeds.
//
// Request body (JSON):
//   {
//     businessId: string,              // the seller's nex_business.id
//     items: [{ name, amountMinor, currency, quantity }],  // cart line items
//     successUrl?: string,             // defaults to shop URL ?checkout=success
//     cancelUrl?: string               // defaults to shop URL ?checkout=cancelled
//   }
//
// Response:
//   200 {ok:true, url, checkoutSessionId}
//   400 {ok:false, code:'bad_request'}
//   401 {ok:false, code:'unauthenticated'}
//   404 {ok:false, code:'business_not_found'}
//   422 {ok:false, code:'seller_not_ready', reason}
//   500 {ok:false, code:'stripe_error'|'config_error'}
//
// Honesty invariants (owner-sealed):
//   · 0% application fee · NEX never takes a cut of seller sales
//   · Destination charge · funds go DIRECTLY to seller's connected account
//   · NEX does not hold funds · no Stripe transfer back to NEX
//   · Order creation deferred until payment_intent.succeeded webhook
//     (Del 6 · NOT WIRED THIS ROUND). The buyer's checkout ingests
//     cart data via inline price_data · metadata carries business_id
//     + buyer account_id so the webhook can reconstruct the order.
//   · Multi-item carts · cleanly represented via multiple Checkout
//     line_items · no dependency on multi-item nex_order schema
//     (which is sealed as Path A but not yet implemented · Del 5
//     deliberately avoids creating orders at checkout-create time).
//   · The seller MUST have charges_enabled=true or we refuse cleanly
//     (fail-closed).
//   · Idempotency key per (business, buyer, cart-fingerprint) prevents
//     duplicate Checkout Sessions on client double-submit.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createHash } from "node:crypto";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getBusinessById } from "@/lib/nex-native/business-service";
import { readLocalConnectStatus } from "@/lib/nex-native/billing/stripe-connect-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_CURRENCIES: ReadonlySet<string> = new Set([
  "eur", "gbp", "usd", "idr",
]);
const ZERO_DECIMAL: ReadonlySet<string> = new Set(["jpy", "idr"]);

interface ParsedItem {
  readonly name: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly quantity: number;
}

interface ParsedBody {
  readonly businessId: string;
  readonly items: ReadonlyArray<ParsedItem>;
  readonly successUrl?: string;
  readonly cancelUrl?: string;
}

function parseBody(input: unknown): ParsedBody | null {
  if (!input || typeof input !== "object") return null;
  const b = input as Record<string, unknown>;
  if (typeof b.businessId !== "string" || !UUID_SHAPE.test(b.businessId)) return null;
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 50) return null;
  const parsedItems: ParsedItem[] = [];
  const currencies: Set<string> = new Set();
  for (const raw of b.items) {
    if (!raw || typeof raw !== "object") return null;
    const it = raw as Record<string, unknown>;
    const name = typeof it.name === "string" ? it.name.trim() : "";
    const amountMinor = typeof it.amountMinor === "number" ? Math.floor(it.amountMinor) : -1;
    const currency = typeof it.currency === "string" ? it.currency.toLowerCase() : "";
    const quantity = typeof it.quantity === "number" ? Math.floor(it.quantity) : 0;
    if (name.length === 0 || name.length > 250) return null;
    if (amountMinor < 0 || amountMinor > 100_000_000) return null; // cap at 1M units
    if (!ALLOWED_CURRENCIES.has(currency)) return null;
    if (quantity < 1 || quantity > 999) return null;
    parsedItems.push({ name, amountMinor, currency, quantity });
    currencies.add(currency);
  }
  if (currencies.size !== 1) return null; // single-currency carts only
  const successUrl = typeof b.successUrl === "string" ? b.successUrl : undefined;
  const cancelUrl = typeof b.cancelUrl === "string" ? b.cancelUrl : undefined;
  if (successUrl && !/^https?:\/\//.test(successUrl)) return null;
  if (cancelUrl && !/^https?:\/\//.test(cancelUrl)) return null;
  return { businessId: b.businessId, items: parsedItems, successUrl, cancelUrl };
}

function originFromRequest(req: NextRequest): string {
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (req.nextUrl.protocol || "http:").replace(":", "");
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    req.nextUrl.host;
  return `${proto}://${host}`;
}

function makeStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, {
    apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  });
}

function cartFingerprint(businessId: string, buyerId: string, items: ReadonlyArray<ParsedItem>): string {
  const payload = JSON.stringify({ b: businessId, u: buyerId, i: items });
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1 · authenticate buyer
  const session = await resolveSessionWithDevOverride().catch(() => null);
  if (!session) {
    return NextResponse.json(
      { ok: false, code: "unauthenticated" },
      { status: 401 },
    );
  }

  // 2 · parse body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "bad_request", reason: "invalid_json" },
      { status: 400 },
    );
  }
  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json(
      { ok: false, code: "bad_request", reason: "invalid_payload_shape" },
      { status: 400 },
    );
  }

  // 3 · resolve seller business + Connect status
  const business = await getBusinessById(body.businessId).catch(() => null);
  if (!business) {
    return NextResponse.json(
      { ok: false, code: "business_not_found" },
      { status: 404 },
    );
  }
  const connect = await readLocalConnectStatus(body.businessId);
  if (!connect.accountId) {
    return NextResponse.json(
      {
        ok: false,
        code: "seller_not_ready",
        reason: "seller_has_not_connected_stripe",
      },
      { status: 422 },
    );
  }
  if (!connect.chargesEnabled) {
    return NextResponse.json(
      {
        ok: false,
        code: "seller_not_ready",
        reason: "seller_charges_not_enabled",
      },
      { status: 422 },
    );
  }

  // 4 · build Stripe client + URLs
  let stripeClient: Stripe;
  try {
    stripeClient = makeStripeClient();
  } catch (e) {
    console.error(
      "[checkout/buyer] stripe init failed:",
      e instanceof Error ? e.message : String(e),
    );
    return NextResponse.json(
      { ok: false, code: "config_error" },
      { status: 500 },
    );
  }
  const origin = originFromRequest(req);
  const businessSlug =
    (business as unknown as { slug?: string }).slug ?? body.businessId;
  const successUrl =
    body.successUrl ??
    `${origin}/nex-native/${businessSlug}?checkout=success`;
  const cancelUrl =
    body.cancelUrl ??
    `${origin}/nex-native/${businessSlug}?checkout=cancelled`;

  // 5 · build Stripe line_items from inline price_data
  const currency = body.items[0].currency;
  const zeroDecimal = ZERO_DECIMAL.has(currency);
  const line_items = body.items.map((it) => ({
    price_data: {
      currency: it.currency,
      product_data: { name: it.name },
      unit_amount: it.amountMinor,
    },
    quantity: it.quantity,
  }));

  // 6 · create Checkout Session with destination charge
  const idempotencyKey = `nex-buyer-${body.businessId}-${session.account.id}-${cartFingerprint(body.businessId, session.account.id, body.items)}`;

  try {
    const checkoutSession = await stripeClient.checkout.sessions.create(
      {
        mode: "payment",
        line_items,
        currency,
        success_url: successUrl,
        cancel_url: cancelUrl,
        // Destination charge · routes funds DIRECTLY to seller's
        // connected Express account. NEX does not touch the money.
        // application_fee_amount omitted · defaults to 0 · sealed 0%
        // commission rule.
        payment_intent_data: {
          transfer_data: {
            destination: connect.accountId!,
          },
          metadata: {
            nex_business_id: body.businessId,
            nex_buyer_account_id: session.account.id,
            nex_role: "buyer_seller_payment",
            nex_zero_decimal_currency: zeroDecimal ? "1" : "0",
          },
        },
        metadata: {
          nex_business_id: body.businessId,
          nex_buyer_account_id: session.account.id,
          nex_role: "buyer_seller_payment",
        },
        client_reference_id: session.account.id,
      },
      { idempotencyKey },
    );

    if (!checkoutSession.url) {
      return NextResponse.json(
        { ok: false, code: "stripe_error", reason: "no_url_returned" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        url: checkoutSession.url,
        checkoutSessionId: checkoutSession.id,
      },
      { status: 200 },
    );
  } catch (e) {
    const err = e as { message?: string; code?: string; type?: string };
    console.error(
      "[checkout/buyer] stripe create failed:",
      err.message ?? String(e),
    );
    return NextResponse.json(
      {
        ok: false,
        code: "stripe_error",
        reason: err.code ?? err.type ?? err.message ?? "unknown",
      },
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
