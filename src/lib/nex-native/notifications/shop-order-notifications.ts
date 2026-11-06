// src/lib/nex-native/notifications/shop-order-notifications.ts
//
// Build NotificationItem[] for the drawer's "orders" section from the
// shop owner's real customer conversations.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// The sealed Phase 1 NotificationsDrawer accepts
// `initialNotifications: NotificationItem[]`. Until Phase 2 wires a
// real event stream, the drawer's "orders" section renders mock data.
// This helper lets the chat chrome mount real shop-side conversations
// into the drawer so owners see customer orders slide down instead
// of mocks.
//
// Reads are fail-soft · empty array returned on any error so the
// drawer still renders with the remaining (mock) sections.

import * as conversationService from "./../conversation-service";
import type {
  NotificationItem,
  NotificationSectionKey,
} from "./mock-notifications-data";

const ORDERS_SECTION: NotificationSectionKey = "orders";

/** Return up to `limit` NotificationItem rows for the Orders section
 *  pulled from conversations where the given account participates as
 *  side='business' (i.e. customer messages hitting their shop). */
export async function buildShopOrderNotifications(
  ownerAccountId: string,
  limit = 12,
): Promise<NotificationItem[]> {
  let conversations: Awaited<
    ReturnType<typeof conversationService.listConversationsForAccount>
  > = [];
  try {
    conversations = await conversationService.listConversationsForAccount(
      ownerAccountId,
      { limit: Math.max(limit * 3, 50) },
    );
  } catch {
    return [];
  }
  const businessRows = conversations
    .filter((c) => c.my_side === "business")
    .sort((a, b) => {
      const aT = a.last_message?.created_at ?? a.conversation.created_at;
      const bT = b.last_message?.created_at ?? b.conversation.created_at;
      return new Date(bT).getTime() - new Date(aT).getTime();
    })
    .slice(0, limit);

  return businessRows.map((c): NotificationItem => {
    const subtitle = buildSubtitle(c);
    return {
      id: `shop-order:${c.conversation.id}`,
      section: ORDERS_SECTION,
      title: c.other_display_name ?? "Customer",
      subtitle,
      href: `/nex-native/conversations/${c.conversation.id}`,
      createdAt:
        c.last_message?.created_at ?? c.conversation.created_at,
      unread: (c.unread_count ?? 0) > 0,
      thumbnailUrl: null,
    };
  });
}

/** Privacy-safe subtitle · metadata-only per the drawer's sealed
 *  privacy invariant (never leak plaintext of encrypted messages). */
function buildSubtitle(
  c: Awaited<
    ReturnType<typeof conversationService.listConversationsForAccount>
  >[number],
): string {
  const unread = c.unread_count ?? 0;
  const parts: string[] = [];
  parts.push(`via ${c.business.display_name}`);
  if (c.product) {
    parts.push(`about ${c.product.name}`);
  }
  if (unread > 0) {
    parts.push(
      unread === 1 ? "1 new message" : `${unread} new messages`,
    );
  } else if (c.last_message) {
    parts.push("replied");
  }
  return parts.join(" · ");
}
