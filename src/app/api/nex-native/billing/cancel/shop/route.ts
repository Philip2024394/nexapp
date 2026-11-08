// src/app/api/nex-native/billing/cancel/shop/route.ts
//
// NEX Shop subscription · customer-facing cancel endpoint ·
// owner-authorised 2026-11-08 round 29i.
// -----------------------------------------------------------------------------
// Honors sealed Option B honesty guardrail #3 (1-click in-app cancel)
// and guardrail #4 (cancel-during-trial keeps access until day 7).
//
// Mechanism:
//   1. Resolve viewer via dev-override resolver (same path as the
//      checkout endpoint).
//   2. Look up the viewer's active (or trialing) Shop subscription in
//      Stripe by searching on metadata.nex_account_id.
//   3. If found, call stripe.subscriptions.update with
//      cancel_at_period_end:true — Stripe stops future billing but
//      keeps the subscription active through the end of the current
//      period. For trial users, this preserves access for the full
//      7 days they were promised.
//   4. Returns a structured JSON response including the cancels_at
//      timestamp so the UI can show "access until <date>".
//
// Honesty:
//   · Never silently cancels. The client confirms + POSTs this
//     endpoint only on explicit user action.
//   · Returns cancels_at + current_period_end so the UI can show
//     exactly when the user will lose access. No surprise cutoffs.
//   · Idempotent · a second cancel call on an already-cancel-pending
//     subscription just reports back the existing cancels_at.
//   · Fail-closed · if subscription lookup fails (no_active_subscription),
//     reports that honestly rather than silently 200.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, {
    apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  });
}

/** Resolve the viewer's live Shop subscription from Stripe. Prefers
 *  a `metadata.nex_account_id` match on an active OR trialing
 *  subscription. Returns null if nothing matches. */
async function findActiveShopSubscription(
  stripe: Stripe,
  nexAccountId: string,
): Promise<Stripe.Subscription | null> {
  // Stripe's /v1/subscriptions endpoint doesn't filter on metadata,
  // but the Search API does. Falls back to a bounded list scan if
  // search isn't available on the key.
  try {
    const search = await stripe.subscriptions.search({
      query:
        `metadata['nex_account_id']:'${nexAccountId}' ` +
        `AND metadata['nex_package']:'shop' ` +
        `AND -status:'canceled'`,
      limit: 5,
    });
    if (search.data.length > 0) {
      // Prefer the newest live (active OR trialing) subscription.
      const live = search.data
        .filter((s) => s.status === "active" || s.status === "trialing")
        .sort((a, b) => b.created - a.created)[0];
      return live ?? null;
    }
  } catch {
    // Search unavailable (restricted key without search scope) ·
    // fall through to list scan.
  }

  // Fallback · bounded list of recent subscriptions · filter client-side.
  const list = await stripe.subscriptions.list({
    limit: 100,
    status: "all",
  });
  const match = list.data
    .filter(
      (s) =>
        s.metadata?.nex_account_id === nexAccountId &&
        s.metadata?.nex_package === "shop" &&
        (s.status === "active" || s.status === "trialing"),
    )
    .sort((a, b) => b.created - a.created)[0];
  return match ?? null;
}

export async function POST(): Promise<NextResponse> {
  // 1 · authenticate
  const session = await resolveSessionWithDevOverride().catch(() => null);
  if (!session) {
    return NextResponse.json(
      { ok: false, code: "unauthenticated" },
      { status: 401 },
    );
  }

  // 2 · Stripe client
  let stripe: Stripe;
  try {
    stripe = makeStripeClient();
  } catch (e) {
    console.error(
      "[cancel/shop] stripe init failed:",
      e instanceof Error ? e.message : String(e),
    );
    return NextResponse.json(
      { ok: false, code: "config_error" },
      { status: 500 },
    );
  }

  // 3 · find the viewer's Shop subscription
  let subscription: Stripe.Subscription | null;
  try {
    subscription = await findActiveShopSubscription(stripe, session.account.id);
  } catch (e) {
    const err = e as { message?: string; code?: string };
    console.error(
      "[cancel/shop] lookup failed:",
      err.message ?? String(e),
    );
    return NextResponse.json(
      {
        ok: false,
        code: "stripe_error",
        reason: err.code ?? err.message ?? "lookup_failed",
      },
      { status: 500 },
    );
  }

  if (!subscription) {
    return NextResponse.json(
      { ok: false, code: "no_active_subscription" },
      { status: 404 },
    );
  }

  // 4 · idempotent cancel · if already scheduled, just report back
  if (subscription.cancel_at_period_end) {
    return NextResponse.json(
      {
        ok: true,
        subscriptionId: subscription.id,
        status: subscription.status,
        cancels_at: subscription.current_period_end,
        already_pending: true,
      },
      { status: 200 },
    );
  }

  // 5 · schedule the cancel for period end (Option B guardrail #4 ·
  //     trial users keep access until day 7, paid users keep access
  //     through the end of the paid period).
  try {
    const updated = await stripe.subscriptions.update(
      subscription.id,
      {
        cancel_at_period_end: true,
        metadata: {
          ...subscription.metadata,
          nex_cancel_requested_at: new Date().toISOString(),
        },
      },
      {
        idempotencyKey: `nex-shop-cancel-${session.account.id}-${subscription.id}`,
      },
    );
    return NextResponse.json(
      {
        ok: true,
        subscriptionId: updated.id,
        status: updated.status,
        cancels_at: updated.current_period_end,
        already_pending: false,
      },
      { status: 200 },
    );
  } catch (e) {
    const err = e as { message?: string; code?: string };
    console.error(
      "[cancel/shop] update failed:",
      err.message ?? String(e),
    );
    return NextResponse.json(
      {
        ok: false,
        code: "stripe_error",
        reason: err.code ?? err.message ?? "update_failed",
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
