// src/lib/nex-native/manage-orders/order-notification-service.ts
//
// NEX Merchant-Owned Payments · P4 · order event notifications.
// Owner-authorised 2026-11-10 (local-only · no DB changes).
//
// Privacy contract (owner-tightened 2026-11-10 after review):
//   · Visible push subject + body carry ONLY a generic event sentence.
//     NOTHING identifying the order, the amount, or the party rides
//     the lock-screen surface. Verbatim owner wording:
//       - "You have received a new order."
//       - "Your order payment has been confirmed."
//       - "Your order has been cancelled."
//   · Visible push does NOT carry:
//       - order id (not even the opaque 8-char prefix)
//       - currency or amount
//       - buyer / seller full names
//       - item names, variants, or quantities
//       - delivery addresses or phone numbers
//       - payment method details
//       - merchant / buyer free-form notes
//       - cancellation reason
//   · The data payload (hidden until the service worker acts on it)
//     carries orderId + deep-link URL + eventKind. The URL is used
//     only after the user taps the notification and the app
//     authenticates before rendering order details.
//
// Order push payloads are `kind: "system"` by construction — the sealed
// notification-dispatch-service type system prevents them from carrying
// conversationId. Even though orders may ORIGINATE in a chat (Path A
// JSONB cart snapshot), the notification is a server-origin business
// event · not conversation content · so Vault policy §P0.3 doesn't
// apply.
//
// Category gating (post-migration-318 state, sealed 2026-11-10):
//   · Migration 318 applied to sandbox adds `order_enabled` column
//     to nex_account_notification_prefs (default TRUE). The sealed
//     NotificationCategory union now includes "order". This service
//     routes every order event through the standard
//     `dispatchPushNotification(..., "order", { kind: "system", ... })`
//     so the same fail-closed category gate applies to orders as to
//     message / call / reaction / mention.
//   · `NEX_ORDER_NOTIFICATIONS_DISABLED=true` remains as a cold-stop
//     kill-switch independent of the per-user preference.

import "server-only";
import { dispatchPushNotification } from "../notification-dispatch-service";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexOrderRow, NexUuid } from "../types";

export type OrderNotificationKind =
  | "new_order"
  | "payment_confirmed"
  | "order_cancelled"
  // Dispatch-tracking preparation (2026-11-17). Fires only when the
  // dispatch feature flag is enabled AND a seller dispatch action
  // succeeded; the privacy copy below is intentionally identical for
  // every sub-event so a lock-screen observer learns nothing about
  // which specific shipment state advanced.
  | "shipment_update";

/** Sub-event detail routed through the single "shipment_update" push
 *  kind. Used to populate the data payload + in-app timeline only;
 *  the visible push body stays uniform. */
export type ShipmentUpdateSubKind =
  | "preparing"
  | "dispatched"
  | "tracking_added"
  | "tracking_updated"
  | "delivered_by_seller";

export interface OrderNotificationResult {
  readonly kind: OrderNotificationKind;
  readonly recipientAccountId: NexUuid | null;
  readonly attempted: number;
  readonly delivered: number;
  readonly failed: number;
  readonly skipped_reason?:
    | "disabled_by_env"
    | "no_recipient_resolved"
    | "disabled"
    | "no_subscriptions"
    | "prefs_unavailable"
    | "vault_check_failed"
    | "vault_rejected";
}

function isDisabled(): boolean {
  return (process.env.NEX_ORDER_NOTIFICATIONS_DISABLED ?? "").toLowerCase() === "true";
}

/**
 * Generic, privacy-safe lock-screen copy per event type. NO per-order
 * fields allowed in these strings · they must be identical for every
 * order of the same kind so a lock-screen observer learns nothing
 * about amount, parties, or contents.
 */
const VISIBLE_COPY: Record<OrderNotificationKind, { title: string; body: string }> = {
  new_order: {
    title: "NEX",
    body: "You have received a new order.",
  },
  payment_confirmed: {
    title: "NEX",
    body: "Your order payment has been confirmed.",
  },
  order_cancelled: {
    title: "NEX",
    body: "Your order has been cancelled.",
  },
  shipment_update: {
    title: "NEX",
    body: "Your order has an update.",
  },
};

/** Resolve the seller account_id from a business_id. */
async function resolveSellerAccountId(
  businessId: NexUuid,
): Promise<NexUuid | null> {
  const { data } = await nexSupabaseAdmin
    .from("nex_business")
    .select("owner_account_id")
    .eq("id", businessId)
    .maybeSingle();
  const row = data as { owner_account_id: string } | null;
  return row?.owner_account_id ?? null;
}

/**
 * Low-level fanout. Does the actual webpush send. No category
 * gating today (see header doctrine · pending migration 318).
 * Honest reporting per sealed dispatch pattern.
 */
async function fanOutToAccount(
  recipientAccountId: NexUuid,
  orderId: NexUuid,
  kind: OrderNotificationKind,
  subKind?: ShipmentUpdateSubKind,
): Promise<Omit<OrderNotificationResult, "kind" | "recipientAccountId">> {
  const { title, body } = VISIBLE_COPY[kind];
  // Buyer-side deep-link: route them to their chat with the seller
  // (where the cart handoff + tracking sheet live). Seller-side
  // deep-link: route to the order detail page. The caller never
  // sends shipment_update to the seller — so safe to default to
  // order detail here and buyer-overriding at the call site.
  const deepLink = `/nex-native/manage/orders/${orderId}`;
  const result = await dispatchPushNotification(
    recipientAccountId,
    "order",
    {
      kind: "system",
      title,
      body,
      data: {
        orderId,
        url: deepLink,
        eventKind: kind,
        ...(subKind ? { shipmentSubKind: subKind } : {}),
      },
    },
  );
  return {
    attempted: result.attempted,
    delivered: result.delivered,
    failed: result.failed,
    ...(result.skipped_reason ? { skipped_reason: result.skipped_reason } : {}),
  };
}

/**
 * Notify the seller that a new order has arrived. Call this from the
 * buyer-side checkout action AFTER the order row is inserted.
 * The buyer never sees seller push subscriptions · service-role read.
 */
export async function notifySellerNewOrder(
  order: NexOrderRow,
): Promise<OrderNotificationResult> {
  if (isDisabled()) {
    return {
      kind: "new_order",
      recipientAccountId: null,
      attempted: 0,
      delivered: 0,
      failed: 0,
      skipped_reason: "disabled_by_env",
    };
  }
  const seller = await resolveSellerAccountId(order.business_id);
  if (!seller) {
    return {
      kind: "new_order",
      recipientAccountId: null,
      attempted: 0,
      delivered: 0,
      failed: 0,
      skipped_reason: "no_recipient_resolved",
    };
  }
  const result = await fanOutToAccount(seller, order.id, "new_order");
  return { kind: "new_order", recipientAccountId: seller, ...result };
}

/**
 * Notify the buyer that the seller has confirmed payment. Called from
 * sellerMarkOrderPaidAction.
 */
export async function notifyBuyerPaymentConfirmed(
  order: NexOrderRow,
): Promise<OrderNotificationResult> {
  if (isDisabled()) {
    return {
      kind: "payment_confirmed",
      recipientAccountId: null,
      attempted: 0,
      delivered: 0,
      failed: 0,
      skipped_reason: "disabled_by_env",
    };
  }
  const result = await fanOutToAccount(
    order.customer_account_id,
    order.id,
    "payment_confirmed",
  );
  return {
    kind: "payment_confirmed",
    recipientAccountId: order.customer_account_id,
    ...result,
  };
}

/**
 * Notify the buyer that the seller has cancelled their order. Called
 * from sellerCancelOrderAction. Reason is NOT included in the push
 * body for privacy · the buyer sees it in-app on the order detail.
 */
/**
 * Notify the buyer that the seller has advanced the shipment state.
 * Uses the single "shipment_update" push kind — the lock-screen copy
 * is identical for every sub-event so an observer learns nothing
 * about which shipment stage this is. The sub-kind rides in the
 * hidden `shipmentSubKind` data payload for in-app routing only.
 *
 * Gated by:
 *   · NEX_ORDER_NOTIFICATIONS_DISABLED (cold stop · identical to siblings)
 *   · NEX_DISPATCH_TRACKING_ENABLED (feature flag · dispatch work entirely)
 *
 * This function is safe to call when NEX_DISPATCH_TRACKING_ENABLED is
 * absent — it short-circuits before touching any dispatch-related
 * column or state. Schema-safe under disabled flag.
 *
 * Idempotency / deduplication: the caller (dispatch-service) ensures
 * one sub-event maps to one shipment_update push per transition by
 * only calling after the DB UPDATE succeeded and only on an actual
 * state change. Duplicate suppression at the push-subscription layer
 * (nex_account_push_subscription) remains the authority.
 */
export async function notifyBuyerShipmentUpdate(
  order: NexOrderRow,
  subKind: ShipmentUpdateSubKind,
): Promise<OrderNotificationResult> {
  if (isDisabled()) {
    return {
      kind: "shipment_update",
      recipientAccountId: null,
      attempted: 0,
      delivered: 0,
      failed: 0,
      skipped_reason: "disabled_by_env",
    };
  }
  // Second-layer gate so this helper is safe to leave in-tree even
  // when migration 349 has not been applied anywhere. If the flag is
  // off the function performs zero column reads · the NexOrderRow
  // passed in is only used for its id and customer_account_id, which
  // are pre-349 columns.
  if (process.env.NEX_DISPATCH_TRACKING_ENABLED !== "true") {
    return {
      kind: "shipment_update",
      recipientAccountId: null,
      attempted: 0,
      delivered: 0,
      failed: 0,
      skipped_reason: "disabled",
    };
  }
  const result = await fanOutToAccount(
    order.customer_account_id,
    order.id,
    "shipment_update",
    subKind,
  );
  return {
    kind: "shipment_update",
    recipientAccountId: order.customer_account_id,
    ...result,
  };
}

export async function notifyBuyerOrderCancelled(
  order: NexOrderRow,
): Promise<OrderNotificationResult> {
  if (isDisabled()) {
    return {
      kind: "order_cancelled",
      recipientAccountId: null,
      attempted: 0,
      delivered: 0,
      failed: 0,
      skipped_reason: "disabled_by_env",
    };
  }
  const result = await fanOutToAccount(
    order.customer_account_id,
    order.id,
    "order_cancelled",
  );
  return {
    kind: "order_cancelled",
    recipientAccountId: order.customer_account_id,
    ...result,
  };
}
