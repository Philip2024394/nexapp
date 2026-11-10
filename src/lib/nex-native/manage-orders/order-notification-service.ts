// src/lib/nex-native/manage-orders/order-notification-service.ts
//
// NEX Merchant-Owned Payments · P4 · order event notifications.
// Owner-authorised 2026-11-10 (local-only · no DB changes).
//
// Privacy contract (owner directive):
//   · Push notification bodies carry ONLY:
//       - order id prefix (first 8 hex chars · opaque)
//       - state label (New order / Paid / Cancelled)
//       - currency + amount
//   · Push bodies do NOT carry:
//       - buyer / seller full names
//       - item names, variants, or quantities
//       - delivery addresses or phone numbers
//       - payment method details
//       - merchant / buyer free-form notes
//
// Order push payloads are `kind: "system"` by construction — the sealed
// notification-dispatch-service type system prevents them from carrying
// conversationId. Even though orders may ORIGINATE in a chat (Path A
// JSONB cart snapshot), the notification is a server-origin business
// event · not conversation content · so Vault policy §P0.3 doesn't
// apply.
//
// Category gating (current state · pending migration 318):
//   · The sealed NotificationCategory union does NOT contain "order"
//     yet · the proposed migration 318 adds `order_enabled` column +
//     TS union member, defaulted TRUE.
//   · Until migration 318 is approved + applied, this service
//     bypasses `dispatchPushNotification` and talks to the push
//     subscription store + web-push adapter directly. A cold-stop
//     switch (NEX_ORDER_NOTIFICATIONS_DISABLED env) lets ops silence
//     the fanout without a deploy if anything misbehaves.
//
// After migration 318 lands the plan is:
//   · Add "order" to NotificationCategory
//   · Add order_enabled to NotificationPrefs
//   · Switch this service to call dispatchPushNotification(..., "order",
//     { kind: "system", ... }) so category prefs apply consistently.

import "server-only";
import { listPushSubscriptions } from "../push-subscription-service";
import { nexSupabaseAdmin } from "../supabase-admin";
import { getNotifications } from "@/lib/nex/notifications/registry";
import type { NotificationMessage } from "@/lib/nex/notifications/types";
import type { NexOrderRow, NexUuid } from "../types";

export type OrderNotificationKind =
  | "new_order"
  | "payment_confirmed"
  | "order_cancelled";

export interface OrderNotificationResult {
  readonly kind: OrderNotificationKind;
  readonly recipientAccountId: NexUuid | null;
  readonly attempted: number;
  readonly delivered: number;
  readonly failed: number;
  readonly skipped_reason?:
    | "disabled_by_env"
    | "no_recipient_resolved"
    | "no_subscriptions"
    | "subscription_lookup_failed";
}

function isDisabled(): boolean {
  return (process.env.NEX_ORDER_NOTIFICATIONS_DISABLED ?? "").toLowerCase() === "true";
}

function formatMoney(pence: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(pence / 100);
  } catch {
    return `${currency} ${(pence / 100).toFixed(2)}`;
  }
}

function orderIdShort(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

/** Minimum privacy-safe push body for order events. */
function buildBody(order: NexOrderRow): string {
  return formatMoney(order.price_pence, order.currency);
}

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
  title: string,
  body: string,
  orderId: NexUuid,
  kind: OrderNotificationKind,
): Promise<Omit<OrderNotificationResult, "kind" | "recipientAccountId">> {
  let subscriptions;
  try {
    subscriptions = await listPushSubscriptions(recipientAccountId);
  } catch {
    return {
      attempted: 0,
      delivered: 0,
      failed: 0,
      skipped_reason: "subscription_lookup_failed",
    };
  }
  if (subscriptions.length === 0) {
    return { attempted: 0, delivered: 0, failed: 0, skipped_reason: "no_subscriptions" };
  }
  const adapter = getNotifications("push");
  let delivered = 0;
  let failed = 0;
  const deepLink = `/nex-native/manage/orders/${orderId}`;
  for (const sub of subscriptions) {
    const message: NotificationMessage = {
      channel: "push",
      to: [],
      kind: "transactional",
      subject: title,
      body,
      data: {
        orderId,
        url: deepLink,
        eventKind: kind,
        subscription: {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
      },
    };
    try {
      const result = await adapter.send(message);
      if (result.ok) delivered += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return {
    attempted: subscriptions.length,
    delivered,
    failed,
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
  const result = await fanOutToAccount(
    seller,
    `New order #${orderIdShort(order.id)}`,
    buildBody(order),
    order.id,
    "new_order",
  );
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
    `Order #${orderIdShort(order.id)} · payment confirmed`,
    buildBody(order),
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
    `Order #${orderIdShort(order.id)} · cancelled`,
    buildBody(order),
    order.id,
    "order_cancelled",
  );
  return {
    kind: "order_cancelled",
    recipientAccountId: order.customer_account_id,
    ...result,
  };
}
