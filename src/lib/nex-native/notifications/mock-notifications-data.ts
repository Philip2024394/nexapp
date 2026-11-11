// src/lib/nex-native/notifications/mock-notifications-data.ts
//
// NEX · Notifications · Phase 1 mock data source.
// Owner-authorised 2026-11-04 later-same-day.
// -----------------------------------------------------------------------------
// Mocked data for the Phase 1 NotificationsDrawer prototype. Lets the
// owner evaluate the UX before investing in the event-plumbing backend
// (server-sent events, unread counts per section, read state persistence,
// section opt-outs, etc.).
//
// Phase 2 (NOT authorised yet) will replace this file's exports with a
// server-resolved data source that reads from a `nex_notification_event`
// table or an equivalent SSE/websocket stream. The TYPES below are the
// contract the drawer consumes · they stay stable across the mock → real
// migration so the drawer component itself doesn't change.
//
// Privacy invariant honoured by Phase 1 and locked for Phase 2:
//   · Chat notifications NEVER include the plaintext message body. The
//     subtitle shows an envelope metadata string only ("1 new message",
//     "sent you a photo", "2 unread messages") so a locked-device
//     preview + any accidental screenshot cannot leak an E2E message.
//   · Same rule applies to any encrypted media (voice notes, photos,
//     documents): subtitle names the KIND, never the content.

// Owner directive 2026-11-11 · "Live" section retired from the
// notifications drawer. Section key union + section array + mock rows
// + glyph case trimmed in one sweep.
export type NotificationSectionKey =
  | "chats"
  | "shop"
  | "orders"
  | "follows";

export interface NotificationItem {
  readonly id: string;
  readonly section: NotificationSectionKey;
  /** Short primary line · 1-2 words preferred (e.g. "Aoife" · "Order
   *  #NEX-1234" · "Treaty Bar"). Rendered as the row's title ink. */
  readonly title: string;
  /** One-line metadata · NEVER the plaintext of an encrypted message.
   *  Examples: "1 new message" · "sent you a photo" · "shipped" ·
   *  "is live now · 24 viewers". */
  readonly subtitle: string;
  /** Route to open when the row is tapped. Tapping also marks the item
   *  as read. */
  readonly href: string;
  /** ISO timestamp · used to compute a relative label ("2m", "14m",
   *  "3h", "yesterday", or a date for older items). */
  readonly createdAt: string;
  /** False when the viewer has seen this notification. Phase 1 uses
   *  client-side state only · Phase 2 persists this on the server. */
  readonly unread: boolean;
  /** Optional avatar / thumbnail URL (peer avatar for chats · product
   *  image for shop · null for sections without per-row art). */
  readonly thumbnailUrl?: string | null;
  /** Owner directive 2026-11-06 · the sender's chat identity id ·
   *  used to join nex_business and surface a 🏪 shop badge on their
   *  avatar rim when they own a shop. Null when the notification
   *  isn't account-scoped (system events, order shipments, etc.). */
  readonly senderAccountId?: string | null;
  /** Owner directive 2026-11-06 · tap target for the sender's
   *  profile when the viewer wants to "see who they deal with"
   *  without first opening the subject. When present the drawer
   *  renders the avatar as its own link to this URL · tapping the
   *  row body still opens `href` (the subject). Null = avatar is
   *  not tappable as a separate target. */
  readonly profileHref?: string | null;
  /** Owner directive 2026-11-06 · when true the drawer paints a
   *  small gold 🏪 badge on the bottom-right of the avatar rim so
   *  the viewer sees at a glance that the sender owns a shop. */
  readonly senderHasShop?: boolean;
}

export interface NotificationSectionMeta {
  readonly key: NotificationSectionKey;
  readonly label: string;
  readonly glyph: "chat" | "shop" | "order" | "follow";
}

export const NOTIFICATION_SECTIONS: ReadonlyArray<NotificationSectionMeta> = [
  { key: "chats",   label: "Chats",   glyph: "chat"   },
  { key: "shop",    label: "Shop",    glyph: "shop"   },
  { key: "orders",  label: "Orders",  glyph: "order"  },
  { key: "follows", label: "Follows", glyph: "follow" },
];

// Phase 1 sample data · spans every section so the design validates
// end-to-end. Times are anchored to "now" as a relative-time demo.
// Owner-visible copy stays metadata-only for encrypted-chat rows.
export const MOCK_NOTIFICATIONS: ReadonlyArray<NotificationItem> = [
  {
    id: "notif-chat-1",
    section: "chats",
    title: "Aoife",
    subtitle: "1 new message",
    href: "/nex-native/chat/peer/11111111-aaaa-4aaa-8aaa-111111111112",
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    unread: true,
    thumbnailUrl: null,
  },
  {
    id: "notif-chat-2",
    section: "chats",
    title: "Rónán",
    subtitle: "sent you a photo",
    href: "/nex-native/chat/peer/11111111-aaaa-4aaa-8aaa-111111111114",
    createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    unread: true,
    thumbnailUrl: null,
  },
  {
    id: "notif-chat-3",
    section: "chats",
    title: "Cillian",
    subtitle: "2 unread messages",
    href: "/nex-native/chat/peer/11111111-aaaa-4aaa-8aaa-111111111115",
    createdAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    unread: true,
    thumbnailUrl: null,
  },
  // Owner directive 2026-11-11 · Live notification rows retired
  // alongside the Live section (Live surface is removed from NEX).
  {
    id: "notif-shop-1",
    section: "shop",
    title: "Treaty Bar",
    subtitle: "New stock · 6 items added",
    href: "/nex-native/directory",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    unread: true,
    thumbnailUrl: null,
  },
  {
    id: "notif-shop-2",
    section: "shop",
    title: "Cork Roastery",
    subtitle: "Weekend brew · limited release",
    href: "/nex-native/directory",
    createdAt: new Date(
      Date.now() - 1 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    unread: false,
    thumbnailUrl: null,
  },
  {
    id: "notif-order-1",
    section: "orders",
    title: "Order #NEX-1234",
    subtitle: "Shipped · tracking available",
    href: "/nex-native/settings/payments",
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    unread: true,
    thumbnailUrl: null,
  },
  {
    id: "notif-order-2",
    section: "orders",
    title: "Order #NEX-1198",
    subtitle: "Delivered · leave a review",
    href: "/nex-native/settings/payments",
    createdAt: new Date(
      Date.now() - 2 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    unread: false,
    thumbnailUrl: null,
  },
  {
    id: "notif-follow-1",
    section: "follows",
    title: "Cillian",
    subtitle: "followed you back",
    href: "/nex-native/profile/me",
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    unread: true,
    thumbnailUrl: null,
  },
  {
    id: "notif-follow-2",
    section: "follows",
    title: "Eoin",
    subtitle: "started following you",
    href: "/nex-native/profile/me",
    createdAt: new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    unread: false,
    thumbnailUrl: null,
  },
];

/** Relative-time formatter · small, inline, no deps. Returns strings
 *  like "just now", "2m", "14m", "3h", "yday", or an ISO date for items
 *  older than a week. Keep the output short · it renders in the row's
 *  trailing timestamp slot. */
export function formatRelativeTime(iso: string, nowMs: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const deltaMs = Math.max(0, nowMs - then);
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yday";
  if (days < 7) return `${days}d`;
  // Older than a week · render a compact ISO date (YYYY-MM-DD).
  return iso.slice(0, 10);
}
