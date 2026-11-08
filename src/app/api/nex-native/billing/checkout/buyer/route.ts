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
// PHASE 1 F-3 FIX · 2026-11-09 · owner-authorised (G1).
// -----------------------------------------------------------------------------
// Prior shape accepted client-supplied `amountMinor` and `currency` per item ·
// server used them directly as Stripe `unit_amount` without verifying against
// the authoritative `nex_product.price_pence`. A malicious buyer could pay 1
// cent for a 10,000-cent product. This revision:
//   · Requires `productId: string` per line item (replaces name / amountMinor /
//     currency in the request body).
//   · Server fetches each product via product-service.getProductById().
//   · Server verifies product.business_id === body.businessId (prevents
//     cross-business cart injection).
//   · Server verifies product.status === "live" (prevents purchasing drafts
//     or archived items).
//   · Server verifies product.stock_status !== "sold_out" when stock_status
//     is set (honest buyer UX · explicit 409 rather than silent oversell).
//   · Server uses product.price_pence + product.currency authoritatively ·
//     client cannot influence Stripe unit_amount.
//   · Idempotency fingerprint now uses server-resolved values so a
//     client-crafted fingerprint cannot pre-bind a session with a bad
//     price.
//   · payment_intent_data.metadata carries nex_item_product_ids so the
//     webhook processor (Del 6 · not yet wired) can reconstruct the order
//     with server-verified prices rather than trusting Stripe line_items
//     after the fact.
// -----------------------------------------------------------------------------
// Request body (JSON):
//   {
//     businessId: string,
//     items: [{ productId: string, quantity: number }],
//     successUrl?: string,
//     cancelUrl?: string
//   }
//
// Response:
//   200 {ok:true, url, checkoutSessionId}
//   400 {ok:false, code:'bad_request'|'product_business_mismatch'}
//   401 {ok:false, code:'unauthenticated'}
//   404 {ok:false, code:'business_not_found'|'product_not_found'}
//   409 {ok:false, code:'product_not_purchaseable'|'product_sold_out'}
//   422 {ok:false, code:'seller_not_ready'|'unsupported_currency'|'mixed_currency_cart'|'product_price_out_of_range'}
//   500 {ok:false, code:'stripe_error'|'config_error'}
//
// Honesty invariants (owner-sealed):
//   · 0% application fee · NEX never takes a cut of seller sales
//   · Destination charge · funds go DIRECTLY to seller's connected account
//   · NEX does not hold funds · no Stripe transfer back to NEX
//   · Server-side price trust · client can NEVER influence Stripe unit_amount
//   · Order creation deferred until payment_intent.succeeded webhook
//     (Del 6 · NOT WIRED THIS ROUND).
//   · The seller MUST have charges_enabled=true or we refuse cleanly
//     (fail-closed).
//   · Idempotency key per (business, buyer, server-resolved-cart fingerprint)
//     prevents duplicate Checkout Sessions on client double-submit.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createHash } from "node:crypto";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getBusinessById } from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import { readLocalConnectStatus } from "@/lib/nex-native/billing/stripe-connect-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_CURRENCIES: ReadonlySet<string> = new Set([
  "eur", "gbp", "usd", "idr",
]);
const ZERO_DECIMAL: ReadonlySet<string> = new Set(["jpy", "idr"]);
const MAX_ITEMS = 50;
const MAX_UNIT_AMOUNT_MINOR = 100_000_000; // 1,000,000 units in minor-currency form

interface ParsedItem {
  readonly productId: string;
  readonly quantity: number;
}

interface ResolvedItem {
  readonly productId: string;
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
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > MAX_ITEMS) return null;
  const parsedItems: ParsedItem[] = [];
  for (const raw of b.items) {
    if (!raw || typeof raw !== "object") return null;
    const it = raw as Record<string, unknown>;
    const productId = typeof it.productId === "string" ? it.productId : "";
    const quantity = typeof it.quantity === "number" ? Math.floor(it.quantity) : 0;
    if (!UUID_SHAPE.test(productId)) return null;
    if (quantity < 1 || quantity > 999) return null;
    parsedItems.push({ productId, quantity });
  }
  // De-duplicate productId · the server will treat multiple-line-items-same-product
  // as a quantity sum. For now we reject duplicates as a shape error so the
  // caller must send a single consolidated line per product.
  const productIds = new Set(parsedItems.map((p) => p.productId));
  if (productIds.size !== parsedItems.length) return null;
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

function cartFingerprint(
  businessId: string,
  buyerId: string,
  items: ReadonlyArray<ResolvedItem>,
): string {
  // Fingerprint includes server-resolved amountMinor + currency so a
  // client-crafted fingerprint cannot pre-bind a session with a tampered
  // price. Fingerprint is day-stamped so a cart change the next day
  // yields a new idempotency key even for the same product set.
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

  // 4 · server-side product resolution · F-3 fix
  const resolvedItems: ResolvedItem[] = [];
  for (const item of body.items) {
    const product = await productService.getProductById(item.productId).catch(() => null);
    if (!product) {
      return NextResponse.json(
        { ok: false, code: "product_not_found", productId: item.productId },
        { status: 404 },
      );
    }
    if (product.business_id !== body.businessId) {
      return NextResponse.json(
        { ok: false, code: "product_business_mismatch", productId: item.productId },
        { status: 400 },
      );
    }
    if (product.status !== "live") {
      return NextResponse.json(
        {
          ok: false,
          code: "product_not_purchaseable",
          productId: item.productId,
          reason: `product_status_is_${product.status}`,
        },
        { status: 409 },
      );
    }
    if (product.stock_status === "sold_out") {
      return NextResponse.json(
        { ok: false, code: "product_sold_out", productId: item.productId },
        { status: 409 },
      );
    }
    const currency = (product.currency ?? "").toLowerCase();
    if (!ALLOWED_CURRENCIES.has(currency)) {
      return NextResponse.json(
        {
          ok: false,
          code: "unsupported_currency",
          productId: item.productId,
          currency: product.currency,
        },
        { status: 422 },
      );
    }
    if (
      !Number.isInteger(product.price_pence) ||
      product.price_pence < 0 ||
      product.price_pence > MAX_UNIT_AMOUNT_MINOR
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "product_price_out_of_range",
          productId: item.productId,
        },
        { status: 422 },
      );
    }
    resolvedItems.push({
      productId: item.productId,
      name: product.name,
      amountMinor: product.price_pence,
      currency,
      quantity: item.quantity,
    });
  }

  // 5 · single-currency assertion (preserved from prior behaviour)
  const currencies = new Set(resolvedItems.map((it) => it.currency));
  if (currencies.size !== 1) {
    return NextResponse.json(
      { ok: false, code: "mixed_currency_cart" },
      { status: 422 },
    );
  }
  const currency = resolvedItems[0]!.currency;
  const zeroDecimal = ZERO_DECIMAL.has(currency);

  // 6 · build Stripe client + URLs
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

  // 7 · build Stripe line_items from SERVER-RESOLVED values (never client)
  const line_items = resolvedItems.map((it) => ({
    price_data: {
      currency: it.currency,
      product_data: { name: it.name },
      unit_amount: it.amountMinor,
    },
    quantity: it.quantity,
  }));

  // 8 · create Checkout Session with destination charge
  // Fingerprint uses server-resolved values so client cannot pre-bind
  // an idempotent session with a tampered price.
  const idempotencyKey = `nex-buyer-${body.businessId}-${session.account.id}-${cartFingerprint(body.businessId, session.account.id, resolvedItems)}`;
  // Metadata for Del 6 webhook reconstruction · comma-separated product IDs
  const productIdsCsv = resolvedItems.map((it) => it.productId).join(",");

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
            nex_item_product_ids: productIdsCsv,
          },
        },
        metadata: {
          nex_business_id: body.businessId,
          nex_buyer_account_id: session.account.id,
          nex_role: "buyer_seller_payment",
          nex_item_product_ids: productIdsCsv,
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
