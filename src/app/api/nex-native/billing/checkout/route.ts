// src/app/api/nex-native/billing/checkout/route.ts
//
// NEX Billing · authenticated Checkout Session endpoint.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED to
// real Stripe account yet).
//
// POST /api/nex-native/billing/checkout
// Body (JSON):
//   {
//     "product":     "shop" | "vault",
//     "intendedTier": "standard" | "unlimited" | "5gb" | "25gb" | "50gb" | "100gb",
//     "successUrl":   "https://nex.../success?..."   (absolute, same origin recommended)
//     "cancelUrl":    "https://nex.../cancel?..."
//   }
//
// Returns:
//   200 { ok:true, internalSessionId, stripeCheckoutSessionId, url }
//   401 { ok:false, code:"unauthenticated" }
//   400 { ok:false, code:"bad_request" }
//   422 { ok:false, code:"blocked_by_adverse_event" | "unknown_tier" | "missing_price_id" }
//   500 { ok:false, code:"stripe_error" | "config_error" }
//
// SCOPE SEPARATION per owner directive:
//   · This endpoint handles NEX SUBSCRIPTIONS only (Shop or Vault). It
//     is NOT the Sell listing payment path and NOT the shop-goods
//     payment path.
//   · Sell additional-listing €1.30 charges → separate endpoint (future ·
//     uses Stripe PaymentIntents, not Checkout Sessions).
//   · Shop goods payments between buyer and seller → NEVER handled by
//     NEX. "NEX never handles payments" is sealed doctrine.
//
// SECURITY:
//   · Server-side session authentication · the client-provided accountId
//     is IGNORED. The server derives the account from the session.
//   · Server-side price-ID resolution via the sealed registry. Client
//     provides product + tier; server never trusts a client-supplied
//     Stripe price ID.
//   · Checkout refuses when any open access-blocking adverse event
//     exists for this (account, product) · defense in depth.
//   · successUrl/cancelUrl are passed to Stripe · Stripe will reject
//     invalid URLs itself. We additionally require the URLs to use
//     https in production.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { createCheckoutSession } from "@/lib/nex-native/billing/checkout-session";
import { createProductionBillingStore } from "@/lib/nex-native/billing/supabase-store";
import { getPriceRegistry } from "@/lib/nex-native/billing/price-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Local body-shape validator · minimal, server-side, strict.
interface ParsedBody {
  readonly product: "shop" | "vault";
  readonly intendedTier: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
}

function parseBody(input: unknown): ParsedBody | null {
  if (!input || typeof input !== "object") return null;
  const b = input as Record<string, unknown>;
  const product = b.product;
  if (product !== "shop" && product !== "vault") return null;
  const intendedTier = typeof b.intendedTier === "string" ? b.intendedTier : "";
  if (!intendedTier) return null;
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
  return { product, intendedTier, successUrl, cancelUrl };
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
    return NextResponse.json(
      { ok: false, code: "bad_request" },
      { status: 400 },
    );
  }
  const body = parseBody(bodyRaw);
  if (!body) {
    return NextResponse.json(
      { ok: false, code: "bad_request" },
      { status: 400 },
    );
  }

  // 3 · dependencies
  let store;
  try {
    store = createProductionBillingStore();
  } catch (err) {
    console.error(
      "[nex-billing/checkout] store init failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { ok: false, code: "config_error" },
      { status: 500 },
    );
  }
  const priceRegistry = getPriceRegistry();

  let stripeClient: Stripe;
  try {
    stripeClient = makeStripeClient();
  } catch {
    await store.end();
    return NextResponse.json(
      { ok: false, code: "config_error" },
      { status: 500 },
    );
  }

  // 4 · adapt the Stripe SDK to the checkout-session service's
  //     StripeCheckoutApi interface. Keeps createCheckoutSession
  //     untestable-free (service already has mocks). The real call
  //     uses `stripe.checkout.sessions.create` with idempotency_key.
  const stripeApi = {
    createCheckoutSession: async (input: {
      mode: "subscription";
      priceId: string;
      customerId: string | null;
      successUrl: string;
      cancelUrl: string;
      idempotencyKey: string;
      metadata: Record<string, string>;
    }): Promise<{ id: string; url: string }> => {
      const sess = await stripeClient.checkout.sessions.create(
        {
          mode: input.mode,
          line_items: [{ price: input.priceId, quantity: 1 }],
          customer: input.customerId ?? undefined,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata: input.metadata,
          // Setting payment_method_collection=always is default for
          // subscription mode; Stripe handles payment collection UI.
        },
        { idempotencyKey: input.idempotencyKey },
      );
      if (!sess.url) {
        throw new Error("Stripe did not return a Checkout URL");
      }
      return { id: sess.id, url: sess.url };
    },
  };

  // 5 · delegate
  try {
    const result = await createCheckoutSession(
      {
        nexAccountId: session.account.id,
        product: body.product,
        intendedTier: body.intendedTier as
          | "standard"
          | "unlimited"
          | "5gb"
          | "25gb"
          | "50gb"
          | "100gb",
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
        getPriceIdForTier: (p, t) => priceRegistry.getPriceIdForTier(p, t),
      },
      store,
      stripeApi,
      new Date(),
    );

    if (!result.ok) {
      const refusalStatus =
        result.code === "stripe_error" ? 500 :
        result.code === "account_lookup_failed" ? 500 :
        422;
      return NextResponse.json(
        { ok: false, code: result.code, reason: result.reason },
        { status: refusalStatus },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        internalSessionId: result.internalSessionId,
        stripeCheckoutSessionId: result.stripeCheckoutSessionId,
        url: result.url,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error(
      "[nex-billing/checkout] unexpected error:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { ok: false, code: "stripe_error" },
      { status: 500 },
    );
  } finally {
    try {
      await store.end();
    } catch {
      /* non-fatal */
    }
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, code: "method_not_allowed" },
    { status: 405 },
  );
}
