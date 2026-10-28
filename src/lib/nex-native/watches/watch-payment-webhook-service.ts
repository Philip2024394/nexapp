// src/lib/nex-native/watches/watch-payment-webhook-service.ts
//
// §3 · Payment-provider webhook orchestrator · server-only.
// -----------------------------------------------------------------------------
// Thin shell around the pure helpers in `./watch-payment-webhook.ts`.
// All verification happens there · this file reads the env for the
// provider secret, delegates to the pure verifier, and calls the
// trusted service function `grantWatchListingEntitlement`.
//
// Keep this file small · it is the ONLY path to a real entitlement
// grant in production. The R2 dev-mock action remains production-
// disabled.
//
// Idempotency
//   · Uses the provider's event_id as `internalEventId` so the sealed
//     UNIQUE(internal_event_id) index in migration 228 handles replay.
//   · Also stores the provider + payment_reference pair so the sealed
//     UNIQUE(provider, payment_reference) partial index catches a
//     second real-world payment with the same reference.

import "server-only";
import {
  getWatchListingById,
  grantWatchListingEntitlement,
  WatchListingServiceError,
  type WatchListingRow,
  type WatchListingEntitlementProvider,
} from "./watch-listing-service";
import {
  verifyWebhook,
  WEBHOOK_ADAPTERS,
  isKnownWebhookProvider,
  rejectionToStatus,
  type WebhookProvider,
  type WebhookOutcome,
  type WebhookRejection,
  type WebhookVerifiedEvent,
} from "./watch-payment-webhook";

/** Map a webhook provider token to the entitlement ledger's provider
 *  enum. The ledger does not record `nex-test` separately · test
 *  grants land as `manual` with a note indicating the webhook origin. */
function toEntitlementProvider(p: WebhookProvider): WatchListingEntitlementProvider {
  switch (p) {
    case "xendit":
      return "xendit";
    case "midtrans":
      return "midtrans";
    case "nex-test":
      return "manual";
  }
}

export type ApplyWebhookResult =
  | {
      readonly ok: true;
      readonly httpStatus: 200;
      readonly listing: WatchListingRow;
      readonly entitlementId: string;
      readonly windowEnd: string;
    }
  | {
      readonly ok: false;
      readonly httpStatus: number;
      readonly rejection: WebhookRejection;
    };

export async function verifyAndApplyWebhook(args: {
  readonly providerParam: string;
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly nowMs?: number;
}): Promise<ApplyWebhookResult> {
  if (!isKnownWebhookProvider(args.providerParam)) {
    return {
      ok: false,
      httpStatus: 404,
      rejection: {
        code: "unknown_provider",
        message: `unknown payment provider: ${args.providerParam}`,
      },
    };
  }
  const adapter = WEBHOOK_ADAPTERS[args.providerParam];
  const secret = process.env[adapter.secretEnvName];

  const outcome: WebhookOutcome = verifyWebhook({
    adapter,
    rawBody: args.rawBody,
    headers: args.headers,
    secret,
    nowMs: args.nowMs,
  });

  if (!outcome.ok) {
    return {
      ok: false,
      httpStatus: rejectionToStatus(outcome.rejection.code),
      rejection: outcome.rejection,
    };
  }

  return await applyVerifiedEvent(outcome.event);
}

async function applyVerifiedEvent(
  event: WebhookVerifiedEvent,
): Promise<ApplyWebhookResult> {
  // Second-stage listing checks that the pure verifier cannot do
  // without DB access · listing exists AND is in a grantable state.
  const listing = await getWatchListingById(event.listingId);
  if (!listing) {
    return {
      ok: false,
      httpStatus: 422,
      rejection: {
        code: "wrong_entitlement_product",
        message: `listing ${event.listingId} not found`,
      },
    };
  }
  if (listing.status === "removed") {
    return {
      ok: false,
      httpStatus: 422,
      rejection: {
        code: "wrong_entitlement_product",
        message: "listing has been removed · cannot grant entitlement",
      },
    };
  }

  try {
    const granted = await grantWatchListingEntitlement({
      listingId: event.listingId,
      internalEventId: event.eventId,
      provider: toEntitlementProvider(event.provider),
      paymentReference: event.paymentReference,
      amountPence: event.amountPence,
      currency: event.currency,
      // durationDays uses the sealed default (30) from the service
      // function so this file never fabricates its own policy.
      notes: `webhook ${event.provider} · paid_at=${event.paidAtIso}`,
    });
    return {
      ok: true,
      httpStatus: 200,
      listing: granted.listing,
      entitlementId: granted.entitlementId,
      windowEnd: granted.windowEnd,
    };
  } catch (err) {
    if (err instanceof WatchListingServiceError) {
      // DB-level conflict (e.g. duplicate provider+payment_reference)
      // becomes 409 so the provider can retry with a different ref.
      const map: Record<string, number> = {
        entitlement_insert_failed: 409,
        listing_not_found: 422,
        listing_removed: 422,
      };
      const status = map[err.code] ?? 500;
      return {
        ok: false,
        httpStatus: status,
        rejection: {
          code: "wrong_entitlement_product",
          message: err.message,
        },
      };
    }
    return {
      ok: false,
      httpStatus: 500,
      rejection: {
        code: "wrong_entitlement_product",
        message: err instanceof Error ? err.message : "unknown service error",
      },
    };
  }
}
