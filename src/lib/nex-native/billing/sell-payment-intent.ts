// src/lib/nex-native/billing/sell-payment-intent.ts
//
// NEX Billing · Sell additional-listing PaymentIntent service.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// Separate from Shop/Vault SUBSCRIPTIONS · each extra Sell listing beyond
// the 3-free-per-month allowance is a one-off €1.30 PaymentIntent charge.
//
// SCOPE SEPARATION (sealed):
//   · NEX Shop + Vault = Stripe Checkout Sessions (subscription mode).
//   · Sell extra listings = Stripe PaymentIntents (one-off, per charge).
//   · Shop goods bought from a seller = NEVER handled by NEX. Sealed
//     doctrine: "NEX never handles payments."
//
// Flow:
//   1 · Count free listings used this calendar month for the account.
//   2 · If adding N listings fits the free allowance, no payment needed.
//   3 · Otherwise, compute cents due (extra × €1.30).
//   4 · Create a PaymentIntent via Stripe · confirm it client-side with
//       Stripe Elements · idempotency key derived from (account, month,
//       request-nonce).
//   5 · On webhook `payment_intent.succeeded`, release the listings
//       (handled by a FUTURE webhook event handler · not drafted yet).
//
// The listing INSERT itself happens AFTER the PaymentIntent succeeds.
// Attempting to create listings BEFORE payment is refused.

import "server-only";
import type Stripe from "stripe";
import {
  enforceFreeListingAllowance,
  enforceAdditionalListingPayment,
  NEX_SELL_EXTRA_LISTING_CENTS_EUR,
} from "./enforcement";

export interface SellListingPaymentApi {
  /** Minimal Stripe PaymentIntent surface. Tests inject a mock. */
  createPaymentIntent(input: {
    amountCents: number;
    currency: "eur";
    customerId: string | null;
    idempotencyKey: string;
    metadata: Record<string, string>;
    description: string;
  }): Promise<{ id: string; clientSecret: string }>;
}

export interface PrepareSellPaymentInput {
  readonly nexAccountId: string;
  readonly listingsUsedThisMonth: number;
  readonly addingCount: number;
  /** Opaque client nonce · lets the client safely retry the request
   *  without creating multiple PaymentIntents. */
  readonly requestNonce: string;
  readonly stripeCustomerId?: string | null;
  /** ISO calendar month · YYYY-MM. Server-supplied to prevent client
   *  tampering (e.g. claiming a different month). */
  readonly isoMonth: string;
}

export type PrepareSellPaymentResult =
  | {
      readonly ok: true;
      readonly needsPayment: false;
      readonly freeCovered: number;
    }
  | {
      readonly ok: true;
      readonly needsPayment: true;
      readonly freeCovered: number;
      readonly extraCovered: number;
      readonly amountCents: number;
      readonly currency: "eur";
      readonly paymentIntentId: string;
      readonly clientSecret: string;
    }
  | {
      readonly ok: false;
      readonly code: "stripe_error" | "value_out_of_range";
      readonly reason: string;
    };

/** Compute allowance usage + create a PaymentIntent if payment is needed.
 *  Pure of DB · caller supplies `listingsUsedThisMonth` from the DB.
 *  Caller is responsible for enforcing per-month listing accounting. */
export async function prepareSellListingPayment(
  input: PrepareSellPaymentInput,
  stripe: SellListingPaymentApi,
): Promise<PrepareSellPaymentResult> {
  if (!Number.isFinite(input.addingCount) || input.addingCount <= 0) {
    return {
      ok: false,
      code: "value_out_of_range",
      reason: `addingCount must be a positive integer · got ${input.addingCount}`,
    };
  }
  if (!/^\d{4}-\d{2}$/.test(input.isoMonth)) {
    return {
      ok: false,
      code: "value_out_of_range",
      reason: `isoMonth must be YYYY-MM · got ${input.isoMonth}`,
    };
  }

  const allowance = enforceFreeListingAllowance({
    listingsUsedThisMonth: input.listingsUsedThisMonth,
    addingCount: input.addingCount,
  });

  if (allowance.extraCovered === 0) {
    return {
      ok: true,
      needsPayment: false,
      freeCovered: allowance.freeCovered,
    };
  }

  const paymentDecision = enforceAdditionalListingPayment({
    extraCovered: allowance.extraCovered,
  });

  // Deterministic idempotency key · lets the client retry safely.
  const idempotencyKey = `nex:sell:${input.nexAccountId}:${input.isoMonth}:${input.requestNonce}`;

  try {
    const pi = await stripe.createPaymentIntent({
      amountCents: paymentDecision.payCents,
      currency: "eur",
      customerId: input.stripeCustomerId ?? null,
      idempotencyKey,
      description: `NEX Sell · ${allowance.extraCovered} additional listing${allowance.extraCovered === 1 ? "" : "s"} · ${input.isoMonth}`,
      metadata: {
        nex_account_id: input.nexAccountId,
        iso_month: input.isoMonth,
        free_covered: String(allowance.freeCovered),
        extra_covered: String(allowance.extraCovered),
        cents_per_listing: String(NEX_SELL_EXTRA_LISTING_CENTS_EUR),
        request_nonce: input.requestNonce,
      },
    });

    return {
      ok: true,
      needsPayment: true,
      freeCovered: allowance.freeCovered,
      extraCovered: allowance.extraCovered,
      amountCents: paymentDecision.payCents,
      currency: "eur",
      paymentIntentId: pi.id,
      clientSecret: pi.clientSecret,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "stripe_error", reason: msg };
  }
}

/** Thin adapter from the real Stripe SDK to our SellListingPaymentApi. */
export function makeStripeSellPaymentAdapter(
  stripeClient: Stripe,
): SellListingPaymentApi {
  return {
    async createPaymentIntent(input) {
      const pi = await stripeClient.paymentIntents.create(
        {
          amount: input.amountCents,
          currency: input.currency,
          customer: input.customerId ?? undefined,
          description: input.description,
          metadata: input.metadata,
          // Automatic payment methods · Stripe decides which show in
          // Elements based on currency + buyer location.
          automatic_payment_methods: { enabled: true },
        },
        { idempotencyKey: input.idempotencyKey },
      );
      if (!pi.client_secret) {
        throw new Error("Stripe did not return a client_secret for PaymentIntent");
      }
      return { id: pi.id, clientSecret: pi.client_secret };
    },
  };
}
