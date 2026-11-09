// src/app/api/nex-native/billing/checkout/theme/route.ts
//
// NEX Chat Theme one-time purchase · Deliverable 9 of the Complete
// Payment System Build Plan · owner-authorised 2026-11-09 Round 33.
// -----------------------------------------------------------------------------
// Creates a Stripe Checkout Session (mode=payment) for a single
// Chat Theme at the viewer's region price (CHAT_THEME_PRICING in
// regional-pricing.ts). On webhook completion the theme entitlement
// is written to nex_theme_ownership (future round · webhook handler
// not yet wired for this specific event).
//
// Request body:
//   {
//     themeId: string,        // nex_chat_theme.id (uuid)
//     themeName?: string      // display label · optional
//   }
//
// Response:
//   200 {ok:true, url, checkoutSessionId}
//   400 {ok:false, code:'bad_request'}
//   401 {ok:false, code:'unauthenticated'}
//   422 {ok:false, code:'no_price_for_region'}
//   500 {ok:false, code:'stripe_error'|'config_error'}
//
// NEX side · theme payments go to NEX's own Stripe account (unlike
// buyer→seller payments which route to the seller's Connect account).
// Chat Themes are a NEX product · same account as Shop subscriptions.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  CHAT_THEME_PRICING,
  formatPrice,
  type SupportedRegion,
} from "@/lib/nex-native/commercial/regional-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ParsedBody {
  readonly themeId: string;
  readonly themeName: string;
}

function parseBody(input: unknown): ParsedBody | null {
  if (!input || typeof input !== "object") return null;
  const b = input as Record<string, unknown>;
  const themeId = typeof b.themeId === "string" ? b.themeId : "";
  if (!UUID_SHAPE.test(themeId)) return null;
  const themeName =
    typeof b.themeName === "string" && b.themeName.trim().length > 0
      ? b.themeName.trim().slice(0, 100)
      : "NEX Chat Theme";
  return { themeId, themeName };
}

function makeStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, {
    apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  });
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

// Viewer-region resolver is deferred (same comment as Shop checkout) ·
// defaults to Ireland for now.
const DEFAULT_REGION: SupportedRegion = "IE";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveSessionWithDevOverride().catch(() => null);
  if (!session) {
    return NextResponse.json(
      { ok: false, code: "unauthenticated" },
      { status: 401 },
    );
  }

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
      { ok: false, code: "bad_request", reason: "invalid_payload" },
      { status: 400 },
    );
  }

  // Resolve region price
  const priceRow = CHAT_THEME_PRICING.find(
    (p) => p.region === DEFAULT_REGION && p.active,
  );
  if (!priceRow || priceRow.amountMinor <= 0) {
    return NextResponse.json(
      { ok: false, code: "no_price_for_region", region: DEFAULT_REGION },
      { status: 422 },
    );
  }

  let stripeClient: Stripe;
  try {
    stripeClient = makeStripeClient();
  } catch (e) {
    console.error(
      "[checkout/theme] stripe init failed:",
      e instanceof Error ? e.message : String(e),
    );
    return NextResponse.json(
      { ok: false, code: "config_error" },
      { status: 500 },
    );
  }

  const origin = originFromRequest(req);
  const successUrl = `${origin}/nex-native/chat-themes-library?theme_purchase=success&theme=${encodeURIComponent(body.themeId)}`;
  const cancelUrl = `${origin}/nex-native/chat-themes-library?theme_purchase=cancelled`;

  try {
    const checkoutSession = await stripeClient.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: priceRow.currency.toLowerCase(),
              product_data: {
                name: `${body.themeName} · NEX Chat Theme`,
                description: `Permanent ownership of this theme on your NEX account (${formatPrice(priceRow)})`,
              },
              unit_amount: priceRow.amountMinor,
            },
            quantity: 1,
          },
        ],
        currency: priceRow.currency.toLowerCase(),
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_intent_data: {
          metadata: {
            nex_account_id: session.account.id,
            nex_role: "theme_purchase",
            nex_theme_id: body.themeId,
            nex_region: DEFAULT_REGION,
          },
        },
        metadata: {
          nex_account_id: session.account.id,
          nex_role: "theme_purchase",
          nex_theme_id: body.themeId,
          nex_region: DEFAULT_REGION,
        },
        client_reference_id: session.account.id,
      },
      {
        idempotencyKey: `nex-theme-checkout-${session.account.id}-${body.themeId}-${new Date().toISOString().slice(0, 10)}`,
      },
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
    const err = e as { message?: string; code?: string };
    console.error(
      "[checkout/theme] stripe create failed:",
      err.message ?? String(e),
    );
    return NextResponse.json(
      {
        ok: false,
        code: "stripe_error",
        reason: err.code ?? err.message ?? "unknown",
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
