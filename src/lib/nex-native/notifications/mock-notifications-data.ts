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

// Owner directive 2026-11-23 · hardcoded notification fixtures retired.
// The Phase 1 prototype seeded eight fake rows (Aoife, Rónán, Cillian,
// Treaty Bar, Cork Roastery, NEX-1234, NEX-1198, Eoin) to demo the UX.
// The app is now past prototype and must distinguish seeded demo
// contacts (Hammerex / Rosa — real Supabase accounts) from manufactured
// activity. Keeping an empty default means new accounts see an honest
// empty state ("You're all caught up") and real recipient-scoped
// notifications from server sources (seller order feed, future
// nex_notification inbox) are the only rows that render.
export const MOCK_NOTIFICATIONS: ReadonlyArray<NotificationItem> = [];

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
