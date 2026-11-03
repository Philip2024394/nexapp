// src/lib/nex-native/billing/webhook-handler.ts
//
// NEX Billing Foundation · Stripe webhook signature verification + handler.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED to Stripe).
//
// Service-layer function that the thin route (/api/nex-native/billing/
// webhook/stripe/route.ts) delegates to. Keeps the route a 10-line shell:
// the heavy lifting lives here and is unit-testable.
//
// Flow:
//   1 · Verify Stripe signature using `stripe.webhooks.constructEvent`
//       with the raw body (byte-exact · route MUST not re-serialise).
//   2 · Map the verified Stripe.Event into our narrow StripeWebhookEvent
//       type (processor consumes a reduced surface).
//   3 · Delegate to processStripeEvent with the price registry.
//   4 · Translate the processor outcome into HTTP status:
//         'applied', 'skipped_*', 'pending_checkout_mapping',
//         'orphaned_pending_mapping'   → 200 (Stripe acks + won't retry)
//         'error'                       → 500 (Stripe retries)
//
// FAIL-CLOSED:
//   · Missing env var STRIPE_WEBHOOK_SECRET → 500 config_error, no detail
//   · Missing stripe-signature header       → 400 bad_signature, no detail
//   · constructEvent throws                 → 400 bad_signature, no detail
//   · Processor throws unexpectedly         → 500 processing_error, no detail
//
// SECURITY:
//   · The computed signature is NEVER logged.
//   · The raw body is only used for signature verification + parsing.
//   · The webhook secret is never printed, never returned in any response.

import "server-only";
import Stripe from "stripe";
import type { BillingStore } from "./store";
import type { PriceRegistry } from "./price-registry";
import type { StripeWebhookEvent, EventOutcome } from "./types";
import { processStripeEvent } from "./webhook-processor";

export interface StripeWebhookHandlerOptions {
  readonly store: BillingStore;
  readonly priceRegistry: PriceRegistry;
  /** The Stripe webhook secret · pulled from env at caller construction
   *  so this module stays import-time pure. */
  readonly webhookSecret: string;
  /** Optional Stripe client · if omitted a default is created from the
   *  secret-key env var. Tests inject. */
  readonly stripeClient?: Stripe;
}

export interface StripeWebhookHandlerResult {
  readonly httpStatus: number;
  readonly body: {
    readonly ok: boolean;
    readonly code?: string;
    readonly outcome?: EventOutcome;
    readonly detail?: string;
  };
}

/** Lazily-constructed Stripe client · ONLY used if the caller does not
 *  inject one. In production, callers should inject a shared instance so
 *  the API version is pinned in one place. */
function makeDefaultStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "makeDefaultStripeClient · STRIPE_SECRET_KEY not configured",
    );
  }
  return new Stripe(key, {
    // Pin to a specific API version · must match the version Stripe emits
    // in webhook events (`event.api_version`). The processor also records
    // the API version in nex_billing_event_log for audit.
    apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  });
}

/** Translate a processor outcome into an HTTP status Stripe will treat
 *  correctly. Must return 200 for anything we have DEFINITIVELY handled
 *  (including skips) · 500 for cases Stripe should retry. */
function outcomeToHttpStatus(outcome: EventOutcome): number {
  switch (outcome) {
    case "applied":
    case "skipped_duplicate_already_processed":
    case "skipped_stale_subscription":
    case "skipped_partial_refund_historical":
    case "skipped_unverified_checkout":
    case "skipped_unknown_sub":
    case "pending_checkout_mapping":
    case "orphaned_pending_mapping":
      return 200;
    case "processing":
      // Should never leak back here · processor always finalizes before
      // returning. If we see 'processing' something went wrong · 500 so
      // Stripe retries + we investigate.
      return 500;
    case "error":
      return 500;
    default: {
      // Exhaustiveness guard · unknown future outcome → 500 so Stripe
      // retries while we add handling.
      const _never: never = outcome;
      void _never;
      return 500;
    }
  }
}

/** Narrow a verified Stripe.Event into the processor's StripeWebhookEvent. */
function toProcessorEvent(ev: Stripe.Event): StripeWebhookEvent {
  // `ev.data.object` is `Stripe.Event.Data.Object` · we cast to the
  // narrow record shape the processor consumes. All reads inside the
  // processor are property-defensive (`typeof ... === "string"`).
  return {
    id: ev.id,
    type: ev.type,
    created: ev.created,
    apiVersion: ev.api_version ?? "unknown",
    data: {
      object: ev.data.object as unknown as Record<string, unknown>,
    },
  };
}

/** Verify + dispatch · the single public entry point used by the route. */
export async function handleStripeWebhook(input: {
  readonly rawBody: string | Buffer;
  readonly signatureHeader: string | null | undefined;
  readonly now: Date;
  readonly options: StripeWebhookHandlerOptions;
}): Promise<StripeWebhookHandlerResult> {
  const { rawBody, signatureHeader, now, options } = input;

  // 1 · Signature header must be present
  if (!signatureHeader) {
    return {
      httpStatus: 400,
      body: { ok: false, code: "bad_signature" },
    };
  }

  // 2 · Secret must be configured
  if (!options.webhookSecret) {
    return {
      httpStatus: 500,
      body: { ok: false, code: "config_error" },
    };
  }

  // 3 · Construct event (verifies signature + parses payload)
  const stripe = options.stripeClient ?? makeDefaultStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signatureHeader,
      options.webhookSecret,
    );
  } catch {
    // Deliberately opaque · never leak which part of verification failed
    return {
      httpStatus: 400,
      body: { ok: false, code: "bad_signature" },
    };
  }

  // 4 · Dispatch to processor
  try {
    const result = await processStripeEvent(
      toProcessorEvent(event),
      options.store,
      now,
      { priceRegistry: options.priceRegistry },
    );
    return {
      httpStatus: outcomeToHttpStatus(result.outcome),
      body: {
        ok: result.outcome !== "error",
        outcome: result.outcome,
        detail: result.outcomeDetail ?? undefined,
      },
    };
  } catch (err) {
    // Processor should never throw · it catches and records 'error'.
    // If it does, respond 500 so Stripe retries · log server-side only.
    const msg = err instanceof Error ? err.message : String(err);
    // Server-side console only · the response does NOT echo the message
    // (it could leak internal state via Stripe retry inspection).
    console.error("[nex-billing/webhook] processor threw:", msg);
    return {
      httpStatus: 500,
      body: { ok: false, code: "processing_error" },
    };
  }
}
