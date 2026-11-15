// src/app/api/nex-native/billing/checkout/shop/route.ts
//
// NEX Shop subscription · minimum-viable Stripe Checkout endpoint ·
// owner-authorised 2026-11-08 round 29h.
// -----------------------------------------------------------------------------
// Creates a Stripe Checkout Session for the single NEX Shop
// subscription (€4.99 / £4.99 / $4.99 / Rp 89,000 per month) with a
// 7-day free trial (Option B sealed 2026-11-08 · requires card on
// file · auto-charges on day 8 unless cancelled).
//
// This is INTENTIONALLY separate from the sealed DRAFT endpoint at
// /api/nex-native/billing/checkout/route.ts which encodes the earlier
// 3-tier model (standard / unlimited / vault tiers). Reconciling
// those two paths is a separate owner-authorised task · for now both
// coexist · this route is the one wired to /pricing and /settings
// surfaces.
//
// Request: POST, no body required. Session resolved via the
//   dev-override resolver so NEX_DEV_IMPERSONATE_HANDLE flows through.
//
// Response:
//   200 { ok:true, url:"https://checkout.stripe.com/..." } · client redirects
//   401 { ok:false, code:"unauthenticated" }
//   422 { ok:false, code:"missing_price_id" } · env var not set for region
//   500 { ok:false, code:"stripe_error" | "config_error" }
//
// Honesty guardrails embedded in the Checkout Session:
//   · trial_period_days: 7 · Option B sealed
//   · subscription_data.trial_settings.end_behavior = "cancel" on
//     missing_payment_method so trial users can test without entering
//     a card (fallback) · still prompts for payment_method_collection
//     by default. Owner directive is CARD REQUIRED at signup so we
//     keep payment_method_collection default (always).
//   · metadata.nex_account_id links the subscription back to the
//     NEX account so the webhook can set the shop tier correctly.
//   · metadata.nex_trial_sealed_at records which seal the trial was
//     launched under (audit trail).

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Region = "IE" | "GB" | "US" | "ID";
type Currency = "eur" | "gbp" | "usd" | "idr";

// Per-market price ID lookup · reads NEX_STRIPE_PRICE_SHOP_<CCY>_MONTHLY
// from env · empty string if not configured (returns 422 to caller).
function priceIdForRegion(region: Region): string | null {
  const envVar = (() => {
    switch (region) {
      case "IE":
        return process.env.NEX_STRIPE_PRICE_SHOP_EUR_MONTHLY;
      case "GB":
        return process.env.NEX_STRIPE_PRICE_SHOP_GBP_MONTHLY;
      case "US":
        return process.env.NEX_STRIPE_PRICE_SHOP_USD_MONTHLY;
      case "ID":
        return process.env.NEX_STRIPE_PRICE_SHOP_IDR_MONTHLY;
    }
  })();
  if (!envVar || envVar.trim().length === 0) return null;
  return envVar.trim();
}

function currencyForRegion(region: Region): Currency {
  switch (region) {
    case "IE":
      return "eur";
    case "GB":
      return "gbp";
    case "US":
      return "usd";
    case "ID":
      return "idr";
  }
}

// Viewer-region resolver · DEFERRED per regional-pricing.ts header.
// For now defaults to IE (Ireland) · owner directive to wire the real
// resolver (Accept-Language + CF/Vercel geo header + account pref)
// lands as a separate task.
function defaultRegion(): Region {
  return "IE";
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1 · authenticate the viewer
  const session = await resolveSessionWithDevOverride().catch(() => null);
  if (!session) {
    return NextResponse.json(
      { ok: false, code: "unauthenticated" },
      { status: 401 },
    );
  }

  // 2 · resolve region + price ID (empty → 422)
  const region = defaultRegion();
  const priceId = priceIdForRegion(region);
  if (!priceId) {
    return NextResponse.json(
      { ok: false, code: "missing_price_id", region },
      { status: 422 },
    );
  }

  // 3 · build success/cancel URLs tied to the request origin
  //
  // Owner directive 2026-11-15 (agreed-journey #13 · subscription
  // return page) · Stripe redirects to sealed /subscription/return
  // + /subscription/cancel pages which honestly represent the three
  // states (pending / active / cancelled) and never fake entitlement.
  // The `{CHECKOUT_SESSION_ID}` placeholder is substituted by Stripe
  // at redirect time · consumed as a transparency breadcrumb only
  // (never trusted as proof of payment).
  const origin = originFromRequest(req);
  const successUrl = `${origin}/nex-native/subscription/return?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/nex-native/subscription/cancel`;

  // 4 · create the Stripe Checkout Session
  let stripeClient: Stripe;
  try {
    stripeClient = makeStripeClient();
  } catch (e) {
    console.error(
      "[checkout/shop] stripe init failed:",
      e instanceof Error ? e.message : String(e),
    );
    return NextResponse.json(
      { ok: false, code: "config_error" },
      { status: 500 },
    );
  }

  try {
    const checkoutSession = await stripeClient.checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        currency: currencyForRegion(region),
        success_url: successUrl,
        cancel_url: cancelUrl,
        // Option B sealed 2026-11-08 · 7-day free trial · card on file
        subscription_data: {
          trial_period_days: 7,
          metadata: {
            nex_account_id: session.account.id,
            nex_trial_sealed_at: "2026-11-08",
            nex_package: "shop",
          },
        },
        metadata: {
          nex_account_id: session.account.id,
          nex_package: "shop",
          nex_region: region,
        },
        // Honesty · show the customer the trial-ends-and-charges
        // explicitly inside Stripe's Checkout UI.
        payment_method_collection: "always",
        // Link the Stripe customer object to the NEX account via
        // client_reference_id (Stripe keeps this on the Session).
        client_reference_id: session.account.id,
      },
      {
        // Idempotency key tied to the account so a double-submit
        // doesn't create two Checkout Sessions. Scoped to the day
        // so legitimate re-attempts after 24h still work.
        idempotencyKey: `nex-shop-checkout-${session.account.id}-${new Date().toISOString().slice(0, 10)}`,
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
    const err = e as { message?: string; statusCode?: number; code?: string };
    console.error(
      "[checkout/shop] stripe create failed:",
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
