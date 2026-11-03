// src/app/api/nex-native/billing/sell-listing-charge/route.ts
//
// NEX Billing · Sell additional-listing charge endpoint.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// POST /api/nex-native/billing/sell-listing-charge
// Body:
//   {
//     "addingCount":  <number · 1..10>,
//     "requestNonce": "<string · client-generated UUID>"
//   }
//
// Response:
//   200 { ok:true, needsPayment:false, freeCovered }                            // all free
//   200 { ok:true, needsPayment:true, freeCovered, extraCovered, amountCents, currency, paymentIntentId, clientSecret }
//   400 bad_request
//   401 unauthenticated
//   500 config_error / stripe_error
//
// The listing INSERT itself is NOT handled here. Caller flow:
//   1 · POST this endpoint · get PaymentIntent client_secret
//   2 · Client confirms the PaymentIntent in Stripe Elements
//   3 · webhook payment_intent.succeeded fires (future handler) · marks
//       the per-month allowance as "paid for N extra" so the listing
//       insert can proceed
//
// This endpoint does NOT read or write listing-count DB data in this
// draft · the DB-side allowance query will land when enforcement is
// wired at Gate 3 D4.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import {
  prepareSellListingPayment,
  makeStripeSellPaymentAdapter,
} from "@/lib/nex-native/billing/sell-payment-intent";
import {
  countListingsThisMonth,
  isoMonthUtc,
} from "@/lib/nex-native/billing/sell-listing-count";
import { createProductionBillingStore } from "@/lib/nex-native/billing/supabase-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ParsedBody {
  readonly addingCount: number;
  readonly requestNonce: string;
}

function parseBody(input: unknown): ParsedBody | null {
  if (!input || typeof input !== "object") return null;
  const b = input as Record<string, unknown>;
  const addingCount = typeof b.addingCount === "number" ? b.addingCount : NaN;
  if (!Number.isFinite(addingCount) || addingCount < 1 || addingCount > 10) {
    return null;
  }
  const requestNonce =
    typeof b.requestNonce === "string" ? b.requestNonce.trim() : "";
  if (requestNonce.length < 8 || requestNonce.length > 128) return null;
  return { addingCount: Math.floor(addingCount), requestNonce };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json(
      { ok: false, code: "unauthenticated" },
      { status: 401 },
    );
  }

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

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, code: "config_error" },
      { status: 500 },
    );
  }
  const stripeClient = new Stripe(key, {
    apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  });
  const stripeAdapter = makeStripeSellPaymentAdapter(stripeClient);

  let store;
  try {
    store = createProductionBillingStore();
  } catch {
    return NextResponse.json(
      { ok: false, code: "config_error" },
      { status: 500 },
    );
  }

  const now = new Date();
  try {
    // Atomic quota check + PaymentIntent creation inside withAccountLock
    // (owner-recommended D4). Two concurrent charge attempts for the same
    // account serialise · the second sees the first's listing count after
    // its PaymentIntent is created (and the webhook subsequently releases
    // the listings).
    const outcome = await store.withAccountLock(
      session.account.id,
      async (txStore) => {
        const usedThisMonth = await countListingsThisMonth(
          { nexAccountId: session.account.id, now },
          txStore,
        );
        return prepareSellListingPayment(
          {
            nexAccountId: session.account.id,
            listingsUsedThisMonth: usedThisMonth,
            addingCount: body.addingCount,
            requestNonce: body.requestNonce,
            stripeCustomerId: null,
            isoMonth: isoMonthUtc(now),
          },
          stripeAdapter,
        );
      },
    );

    if (!outcome.ok) {
      const status = outcome.code === "stripe_error" ? 500 : 400;
      return NextResponse.json(
        { ok: false, code: outcome.code, reason: outcome.reason },
        { status },
      );
    }
    return NextResponse.json(outcome, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[nex-billing/sell-listing-charge] error:", msg);
    return NextResponse.json(
      { ok: false, code: "config_error" },
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
