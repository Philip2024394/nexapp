// src/lib/nex-native/notifications/seller-order-notifications.ts
//
// NEX · Seller-side order notifications feed · owner-authorised
// 2026-11-16, tightened by owner directive 2026-11-23: notification
// rows are reserved for VERIFIED PAID orders only. Reuses the
// EXISTING `nex_business` ownership and `nex_order` model. No new
// tables, no new RPC, no new schema.
//
// Owner directive 2026-11-23 · do not surface `state='created'` rows
// here. A merely-created order has not been settled yet · surfacing
// it as a seller notification would advertise it as a sale before
// Stripe/PayPal/manual confirmation has actually moved funds. Those
// unpaid rows are still reachable in /manage/orders (the orders
// queue is the right place for unpaid-order triage · the drawer is
// for "something happened you should know about").
//
// Scope:
//   · Map the signed-in seller's current `state='paid'` orders
//     into the `NotificationItem` contract the LEFT notifications
//     drawer consumes.
//   · Row id namespace is prefixed with `order-` so there's no
//     collision with mock ids or chat/follow rows.
//   · Subtitle is metadata-only ("new order", price label) · no
//     plaintext buyer content leaks into the drawer surface.
//   · href points at the SELLER's own order detail route, which
//     already enforces seller-scoped access on its page module.
//   · Returns [] on any DB failure (soft-fail · mirrors the chat
//     invite / unread-chat soft-fail path on the mounting pages).
//
// Not in this scope:
//   · Persistent `unread` state (would need a new column / table ·
//     the drawer's session-local `readIds` useState continues to
//     cover intra-session dismissal).
//   · Client-side polling to refresh the drawer without reload ·
//     the drawer's props are server-rendered at page render time.
//     `/manage` already carries the live polling badge for the
//     `chat + orders` unread count.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexOrderRow, NexUuid } from "../types";
import type { NotificationItem } from "./mock-notifications-data";

const MAX_ROWS = 20;

/**
 * Pure · format a price-pence integer + ISO currency code into a
 * short metadata label suitable for the drawer subtitle. Falls back
 * to the raw integer when Intl rejects the currency (matches the
 * `formatProductPriceLabel` behaviour already in peer-chat page).
 */
function formatOrderPriceLabel(pricePence: number, currency: string): string {
  const major = pricePence / 100;
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

/**
 * List the signed-in seller's `state='paid'` orders mapped into
 * `NotificationItem`s for the LEFT notifications drawer's "Orders"
 * section. Returns `[]` when the viewer is not signed in, owns no
 * businesses, has no verified-paid orders, or when any query fails
 * (soft-fail by design). Unpaid / pending orders are deliberately
 * excluded · see the header owner directive 2026-11-23.
 */
export async function listSellerOrderNotifications(
  accountId: NexUuid | null,
): Promise<NotificationItem[]> {
  if (!accountId) return [];

  // 1 · resolve owned businesses · identical shape to
  //     countSellerUnreadOrders so behaviour stays coherent.
  const { data: owned, error: ownedErr } = await nexSupabaseAdmin
    .from("nex_business")
    .select("id")
    .eq("owner_account_id", accountId);
  if (ownedErr) {
    // eslint-disable-next-line no-console
    console.warn(
      "[seller-order-notifications] owned businesses query failed:",
      ownedErr.message,
    );
    return [];
  }
  const businessIds = (owned ?? []).map((b: { id: string }) => b.id);
  if (businessIds.length === 0) return [];

  // 2 · pull the newest `paid` orders scoped to those businesses.
  //     Owner directive 2026-11-23 · `state='paid'` is the ONLY value
  //     the drawer surfaces. A seller sees paid-order notifications
  //     when a Stripe/PayPal webhook has flipped the row (or a
  //     merchant-confirmed QR payment has transitioned it); unpaid
  //     and pending orders live in the /manage/orders queue instead.
  const { data, error } = await nexSupabaseAdmin
    .from("nex_order")
    .select("id,product_id,price_pence,currency,created_at,state,business_id")
    .in("business_id", businessIds)
    .eq("state", "paid")
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "[seller-order-notifications] order query failed:",
      error.message,
    );
    return [];
  }

  const rows = (data as Array<Pick<NexOrderRow,
    | "id"
    | "product_id"
    | "price_pence"
    | "currency"
    | "created_at"
    | "state"
    | "business_id"
  >>) ?? [];
  if (rows.length === 0) return [];

  // 3 · one batched product-name lookup · catalogue-only (nex_product
  //     is already visible to the seller via the orders detail page);
  //     soft-fail on error · falls back to price-only subtitle.
  const productIds = Array.from(new Set(rows.map((r) => r.product_id)));
  let nameById = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: products, error: productsErr } = await nexSupabaseAdmin
      .from("nex_product")
      .select("id,name")
      .in("id", productIds);
    if (productsErr) {
      // eslint-disable-next-line no-console
      console.warn(
        "[seller-order-notifications] product-name lookup failed (soft-fail):",
        productsErr.message,
      );
    } else {
      nameById = new Map(
        (products ?? []).map((p: { id: string; name: string | null }) => [
          p.id,
          p.name ?? "",
        ]),
      );
    }
  }

  return rows.map((r) => {
    const shortId = r.id.slice(0, 8);
    const price =
      typeof r.price_pence === "number" && r.price_pence > 0
        ? formatOrderPriceLabel(r.price_pence, r.currency ?? "EUR")
        : "paid order";
    const name = nameById.get(r.product_id) ?? "";
    // Subtitle is metadata-only · product name is catalogue data the
    // seller already owns; never cart content / buyer notes. "paid"
    // prefix matches the owner directive 2026-11-23: these rows only
    // surface after a verified Stripe/PayPal settlement.
    const subtitle = name ? `Paid · ${name} · ${price}` : `Paid · ${price}`;
    return {
      id: `order-${r.id}`,
      section: "orders" as const,
      title: `Order #${shortId}`,
      subtitle,
      href: `/nex-native/manage/orders/${r.id}`,
      createdAt: r.created_at,
      unread: true,
      thumbnailUrl: null,
      senderAccountId: null,
      profileHref: null,
    };
  });
}
