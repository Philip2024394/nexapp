// src/app/api/nex-native/billing/webhook/stripe/route.ts
//
// NEX Billing · Stripe webhook endpoint.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED to
// real Stripe account yet · requires STRIPE_WEBHOOK_SECRET env var +
// Supabase BillingStore + production authorisation before enabling in
// Vercel).
//
// Thin shell · all verification + processing lives in webhook-handler.ts.
// This route:
//   · forces nodejs runtime (Stripe SDK uses Node crypto)
//   · forces dynamic (never cached)
//   · reads the raw body (byte-exact · required for HMAC signature)
//   · pulls the `stripe-signature` header
//   · constructs the production BillingStore + price registry
//   · delegates to handleStripeWebhook
//   · returns the service-layer result verbatim
//
// Never:
//   · parses JSON before signature verification
//   · logs the signature, secret, or raw body in any error path
//   · exposes which part of verification failed

import { NextRequest, NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/nex-native/billing/webhook-handler";
import { createProductionBillingStore } from "@/lib/nex-native/billing/supabase-store";
import { getPriceRegistry } from "@/lib/nex-native/billing/price-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Raw body FIRST · byte-exact for HMAC
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("stripe-signature");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // 500 · webhook retries · gives us time to configure before Stripe
    // treats it as hard-failed. Never echo "secret missing" · just
    // "config_error" (same shape returned by handleStripeWebhook).
    return NextResponse.json(
      { ok: false, code: "config_error" },
      { status: 500 },
    );
  }

  // Construct real adapters · fail-closed inside each if env missing.
  // These throw if DATABASE_URL does not resolve to the canonical NEX
  // Supabase project · a safety fence per CLAUDE.md §8.
  let store;
  try {
    store = createProductionBillingStore();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[nex-billing/webhook] store init failed:", msg);
    return NextResponse.json(
      { ok: false, code: "config_error" },
      { status: 500 },
    );
  }

  const priceRegistry = getPriceRegistry();

  try {
    const result = await handleStripeWebhook({
      rawBody,
      signatureHeader,
      now: new Date(),
      options: { store, priceRegistry, webhookSecret },
    });
    return NextResponse.json(result.body, { status: result.httpStatus });
  } finally {
    // Release the pg pool connection acquired at construction. In a
    // long-lived serverless warm instance we'd keep the pool alive · for
    // safety during the draft phase we close after each request. When
    // the production integration lands, this will be revisited.
    try {
      await store.end();
    } catch {
      /* non-fatal */
    }
  }
}

// Reject anything other than POST
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, code: "method_not_allowed" },
    { status: 405 },
  );
}
