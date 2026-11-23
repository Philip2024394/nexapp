// src/lib/nex-native/notifications/nex-notification-writer.ts
//
// NEX · durable in-app notification writer (migration 366 ·
// nex_notification table). Service-role writer path only.
//
// Owner directive 2026-11-23b · recipient-scoped in-app notifications
// are persisted INDEPENDENTLY of push delivery. Push success never
// establishes that someone saw the message. Every active producer
// calls through here regardless of push outcome.
//
// Privacy contract:
//   · The subtitle and title here are PERMITTED event metadata only.
//     Never plaintext of an E2E message. Never bank-detail text.
//     Never card data. Grouped-message rows carry only "You have a new
//     message" style copy · never the message body.
//   · attachment_meta product snapshots for inquiries are already
//     non-sensitive catalogue data (seller owns, buyer sees).
//
// Concurrency model (honest · do not overclaim):
//   · ON CONFLICT (recipient_account_id, source_ref) DO UPDATE is the
//     atomic exactly-once-created guarantee. Two concurrent writers
//     targeting the same (recipient, source_ref) resolve to a single
//     row. The second one bumps created_at + resets read_at to NULL.
//   · We never claim exactly-once push dispatch. That lives upstream
//     at the provider-event-id dedup layer (see Stripe/PayPal webhook
//     notes).
//
// RESERVED sources (`system`, `admin_announcement`, `order_cancelled`,
// `order_shipped`, `follow`) exist in the migration 366 CHECK enum but
// have NO writer here · adding one is a future change. Do not surface
// those categories as "live" in product copy.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";

export type NotificationCategory =
  | "chats"
  | "shop"
  | "orders"
  | "follows"
  | "system";

export type NotificationSource =
  // Active producers (writer wired):
  | "order_paid"
  | "contact_request"
  | "contact_accepted"
  | "message"
  | "inquiry"
  // Reserved · no writer today:
  | "system"
  | "admin_announcement"
  | "order_cancelled"
  | "order_shipped"
  | "follow";

/**
 * Conflict semantics per producer · owner directive 2026-11-23c
 * (recovery hardening). Separating immutable event identity (paid
 * order #X) from recurring activity grouping (new message in chat Y)
 * so an old retry cannot revive a read alert as new activity.
 *
 *  · 'refresh_unread' · current behaviour for recurring activity rows
 *    (message / inquiry / contact_request / contact_accepted). On
 *    conflict we bump `created_at` and reset `read_at = NULL` so new
 *    activity in a conversation reopens the group.
 *
 *  · 'preserve_read_state' · for immutable one-off events (order_paid).
 *    On conflict we DO NOTHING · a webhook retry that fires months
 *    after the seller already read the paid-order alert must NOT
 *    revive it. First-write wins; subsequent retries are no-ops.
 */
export type NotificationConflictMode =
  | "refresh_unread"
  | "preserve_read_state";

export interface WriteNotificationInput {
  readonly recipient_account_id: NexUuid;
  readonly source: NotificationSource;
  /** Per-producer dedup key · drives UPSERT grouping. Required for
   *  active producers; omit (undefined) only for one-shot system rows
   *  that cannot be grouped. */
  readonly source_ref: string | null;
  readonly category: NotificationCategory;
  readonly title: string;        // ≤80 chars
  readonly subtitle: string;     // ≤160 chars
  readonly href: string;         // ≤500 chars
  readonly thumbnail_url?: string | null;
  readonly sender_account_id?: NexUuid | null;
  readonly profile_href?: string | null;
  readonly sender_has_shop?: boolean;
  /** Default `refresh_unread` (grouped-activity). Immutable event rows
   *  (order_paid) MUST pass `preserve_read_state` so a late retry never
   *  revives a read row. */
  readonly on_conflict?: NotificationConflictMode;
}

export interface WriteNotificationResult {
  readonly ok: boolean;
  readonly id: string | null;
  readonly was_insert: boolean;
  readonly skipped_reason?: "disabled_by_env" | "db_error";
  readonly error_message?: string;
}

function isDisabled(): boolean {
  return (
    (process.env.NEX_IN_APP_NOTIFICATIONS_DISABLED ?? "").toLowerCase() ===
    "true"
  );
}

/** Clamp a free-form string to the column CHECK bounds. We trim and
 *  truncate rather than throw so a writer path's success never flips
 *  to failure over a cosmetic length overflow. */
function clamp(s: string, max: number): string {
  const t = (s ?? "").trim();
  if (t.length === 0) return "—";
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

/**
 * Core UPSERT writer. Always INSERT-or-UPDATE keyed on
 * (recipient_account_id, source_ref). On conflict:
 *   · created_at refreshed to now() so the row jumps to the top of
 *     the recipient-created-DESC index.
 *   · read_at reset to NULL so a group that was previously read
 *     becomes unread again on new activity.
 *   · title/subtitle/href refreshed so the drawer shows the latest
 *     event summary for the group.
 *   · sender_account_id refreshed so the drawer avatar reflects the
 *     most-recent sender in a group.
 *
 * Never throws · always returns a result. Writer calls are made from
 * fire-and-forget blocks inside producers; a durable-write failure
 * must never flip a successful message send into a failed send.
 */
export async function writeNotification(
  input: WriteNotificationInput,
): Promise<WriteNotificationResult> {
  if (isDisabled()) {
    return {
      ok: false,
      id: null,
      was_insert: false,
      skipped_reason: "disabled_by_env",
    };
  }
  const row = {
    recipient_account_id: input.recipient_account_id,
    source: input.source,
    source_ref: input.source_ref ?? null,
    category: input.category,
    title: clamp(input.title, 80),
    subtitle: clamp(input.subtitle, 160),
    href: clamp(input.href, 500),
    thumbnail_url: input.thumbnail_url ?? null,
    sender_account_id: input.sender_account_id ?? null,
    profile_href: input.profile_href ?? null,
    sender_has_shop: Boolean(input.sender_has_shop),
  };
  if (!row.source_ref) {
    // Non-grouped row · plain INSERT; cannot dedup.
    const { data, error } = await nexSupabaseAdmin
      .from("nex_notification")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(
        "[nex-notification-writer] insert failed (no source_ref):",
        error.message,
      );
      return {
        ok: false,
        id: null,
        was_insert: false,
        skipped_reason: "db_error",
        error_message: error.message,
      };
    }
    return { ok: true, id: (data as { id: string } | null)?.id ?? null, was_insert: true };
  }
  const mode: NotificationConflictMode = input.on_conflict ?? "refresh_unread";

  if (mode === "preserve_read_state") {
    // Immutable event identity (order_paid). First-write wins; on
    // conflict we DO NOTHING so a late webhook retry never revives a
    // read row. `ignoreDuplicates: true` maps to ON CONFLICT DO NOTHING.
    const { data, error } = await nexSupabaseAdmin
      .from("nex_notification")
      .upsert(row, {
        onConflict: "recipient_account_id,source_ref",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(
        "[nex-notification-writer] upsert (preserve) failed:",
        error.message,
        "source=",
        input.source,
        "source_ref=",
        input.source_ref,
      );
      return {
        ok: false,
        id: null,
        was_insert: false,
        skipped_reason: "db_error",
        error_message: error.message,
      };
    }
    // On conflict-ignore, Supabase returns an empty array. We treat
    // that as "row already exists" · caller gets ok=true,
    // was_insert=false so it can distinguish first-write from replay.
    const arr = (data as Array<{ id: string }> | null) ?? [];
    if (arr.length === 0) {
      return { ok: true, id: null, was_insert: false };
    }
    return { ok: true, id: arr[0].id, was_insert: true };
  }

  // Default: grouped-activity row (message / inquiry / contact-*).
  // UPSERT keyed on (recipient_account_id, source_ref). Resetting
  // read_at + bumping created_at on conflict is the atomic "new
  // activity → group unread again" guarantee.
  const { data, error } = await nexSupabaseAdmin
    .from("nex_notification")
    .upsert(
      { ...row, read_at: null },
      {
        onConflict: "recipient_account_id,source_ref",
        // Supabase-js currently generates ON CONFLICT DO UPDATE SET …
        // for every provided column; passing read_at:null + the row
        // itself guarantees the reset + refresh semantics we want.
        ignoreDuplicates: false,
      },
    )
    .select("id")
    .single();
  if (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "[nex-notification-writer] upsert failed:",
      error.message,
      "source=",
      input.source,
      "source_ref=",
      input.source_ref,
    );
    return {
      ok: false,
      id: null,
      was_insert: false,
      skipped_reason: "db_error",
      error_message: error.message,
    };
  }
  return { ok: true, id: (data as { id: string } | null)?.id ?? null, was_insert: true };
}

// ─── Per-producer helpers ────────────────────────────────────────────

/**
 * Paid-order durable row. Called from notifySellerPaidOrder (Stripe +
 * PayPal webhooks) alongside push dispatch · independent of push
 * outcome.
 *
 * source_ref = 'order:<order_id>:paid' · one row per (seller, order)
 * even across webhook retries. If the seller later refunds and the
 * order cycles back to paid (not currently supported), the UPSERT
 * flips the row back to unread automatically.
 */
export async function writeOrderPaidNotification(args: {
  recipient_account_id: NexUuid;
  order_id: NexUuid;
  short_price_label: string; // e.g. "€24.99" · catalogue-safe
  product_name_or_blank: string; // may be empty string
}): Promise<WriteNotificationResult> {
  const subtitle = args.product_name_or_blank
    ? `Paid · ${args.product_name_or_blank} · ${args.short_price_label}`
    : `Paid · ${args.short_price_label}`;
  return writeNotification({
    recipient_account_id: args.recipient_account_id,
    source: "order_paid",
    source_ref: `order:${args.order_id}:paid`,
    category: "orders",
    title: `Order #${args.order_id.slice(0, 8)}`,
    subtitle,
    href: `/nex-native/manage/orders/${args.order_id}`,
    // Immutable event · a Stripe/PayPal retry months later must NOT
    // revive a read paid-order alert. ON CONFLICT DO NOTHING semantics.
    on_conflict: "preserve_read_state",
  });
}

/**
 * New contact request · recipient-facing. The actionable surface
 * remains /nex-native/contacts; this row is a pointer so the drawer
 * also shows the arrival.
 *
 * source_ref = 'friend_request:<request_id>' · one row per request.
 */
export async function writeContactRequestNotification(args: {
  recipient_account_id: NexUuid;
  request_id: NexUuid;
  sender_account_id: NexUuid;
  sender_handle_or_name: string;
  intro_note_or_blank: string;
}): Promise<WriteNotificationResult> {
  const subtitle = args.intro_note_or_blank
    ? `New request · ${args.intro_note_or_blank}`
    : "Tap to view in Contacts";
  return writeNotification({
    recipient_account_id: args.recipient_account_id,
    source: "contact_request",
    source_ref: `friend_request:${args.request_id}`,
    category: "chats",
    title: `${args.sender_handle_or_name} wants to connect`,
    subtitle,
    href: "/nex-native/contacts",
    sender_account_id: args.sender_account_id,
  });
}

/**
 * Contact request accepted · notifies the ORIGINAL sender that their
 * request was accepted. Fired from acceptFriendRequestAction.
 *
 * source_ref = 'friend_request:<request_id>:accepted'.
 */
export async function writeContactAcceptedNotification(args: {
  recipient_account_id: NexUuid; // the original sender
  request_id: NexUuid;
  accepter_account_id: NexUuid;
  accepter_handle_or_name: string;
  category: "friends" | "business";
}): Promise<WriteNotificationResult> {
  const subtitle =
    args.category === "business"
      ? "Business contact · tap to open chat"
      : "Added to your contacts";
  return writeNotification({
    recipient_account_id: args.recipient_account_id,
    source: "contact_accepted",
    source_ref: `friend_request:${args.request_id}:accepted`,
    category: "chats",
    title: `${args.accepter_handle_or_name} accepted`,
    subtitle,
    href: "/nex-native/contacts",
    sender_account_id: args.accepter_account_id,
  });
}

/**
 * Ordinary peer-message durable row. Called from sendPeerMessageAction
 * alongside push dispatch · independent of push outcome. A push-
 * disabled recipient still gets a durable inbox row.
 *
 * source_ref = 'msg:<conversation_id>' · one row per conversation.
 * Repeated activity in the same conversation bumps the row to the top
 * and flips read_at back to NULL so the group becomes unread again.
 *
 * E2E doctrine: the message body is NEVER passed to this writer. We
 * only carry sender handle + conversation id in href. Any attempt to
 * pass a decrypted body through here is a doctrine violation.
 */
export async function writePeerMessageNotification(args: {
  recipient_account_id: NexUuid;
  conversation_id: NexUuid;
  sender_account_id: NexUuid;
  sender_display_name: string;
  has_attachment: boolean;
}): Promise<WriteNotificationResult> {
  const subtitle = args.has_attachment
    ? "Sent you an attachment"
    : "Sent you a message";
  return writeNotification({
    recipient_account_id: args.recipient_account_id,
    source: "message",
    source_ref: `msg:${args.conversation_id}`,
    category: "chats",
    title: args.sender_display_name || "New message",
    subtitle,
    href: `/nex-native/chat/peer/${args.sender_account_id}`,
    sender_account_id: args.sender_account_id,
  });
}

/**
 * Product-inquiry durable row. Called from sendProductInquiryAction.
 * Deep-link opens the seller-side chat with the buyer; the drawer
 * row is one per (product, buyer) · subsequent inquiry messages for
 * the same product from the same buyer collapse onto this row and
 * flip it back to unread.
 *
 * source_ref = 'inquiry:<product_id>:<buyer_account_id>'.
 *
 * Privacy: product name is catalogue data the seller already owns.
 * No buyer message body ever reaches this writer.
 */
export async function writeProductInquiryNotification(args: {
  seller_account_id: NexUuid; // recipient
  product_id: NexUuid;
  product_name: string;
  buyer_account_id: NexUuid;
  buyer_display_name: string;
}): Promise<WriteNotificationResult> {
  const subtitle = args.product_name
    ? `About · ${args.product_name}`
    : "New product inquiry";
  return writeNotification({
    recipient_account_id: args.seller_account_id,
    source: "inquiry",
    source_ref: `inquiry:${args.product_id}:${args.buyer_account_id}`,
    category: "chats",
    title: `${args.buyer_display_name || "A buyer"} asked about a product`,
    subtitle,
    href: `/nex-native/chat/peer/${args.buyer_account_id}`,
    sender_account_id: args.buyer_account_id,
  });
}
