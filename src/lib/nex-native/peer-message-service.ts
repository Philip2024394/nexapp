// src/lib/nex-native/peer-message-service.ts
//
// Bridge 3 · peer-to-peer message service.
// -----------------------------------------
// Immutable append-only log of messages between two friends. Companion
// to peer-conversation-service.ts.
//
// Doctrine:
//   · Messages are IMMUTABLE · no updateMessage export. The only
//     mutable column is read_at, which flips from null to a timestamp
//     when the recipient views the message.
//   · Send guards: sender must be a participant of the conversation.
//     Enforced here at the service boundary in addition to RLS.
//   · Body length: 1-4000 chars, matches DB CHECK. Longer messages
//     should be split (client responsibility).

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import {
  getPeerConversationById,
  touchPeerConversation,
} from "./peer-conversation-service";
import type { NexUuid } from "./types";
import {
  NEX_PEER_MESSAGE_QUICK_REACTIONS,
  isValidReactionEmoji,
  type NexPeerMessageReactions,
} from "./peer-message-reactions";
// SafeChat Phase 1 · simulated detection · instrumentation only.
// The hook is non-blocking · errors are swallowed · zero observable
// effect on message delivery. ONLY wired into the plaintext send
// path (sendPeerMessage); the encrypted fan-out path
// (sendEncryptedPeerMessages) is NOT hooked by design.
import { isSafeChatPhase1LoggingEnabled } from "./safechat/feature-flag";
import { safechatClassifyAndLog } from "./safechat/_hook";
// Owner directive 2026-10-16 (Vault-exclusion corrective pass) · the
// home-screen badge must count unread messages from NORMAL
// conversations only. We reuse the sealed canonical function that the
// notification-dispatch service already uses to enforce the Vault
// boundary on push notifications · no new Vault detector invented.
import { listVaultedConversationIds } from "./vault-entry-service";

export interface NexPeerMessageRow {
  id: NexUuid;
  conversation_id: NexUuid;
  sender_account_id: NexUuid;
  body: string;
  sent_at: string;
  read_at: string | null;
  /** When non-null, this message is a reply that quotes the target
   *  peer message. Introduced Bridge 5 · migration 052. */
  reply_to_id: NexUuid | null;
  /** Set to true when the sender retracts the message. UI renders a
   *  "🚫 deleted" placeholder in its slot. Body is preserved for
   *  audit. Sealed Bridge 6 · migration 053. */
  deleted_for_everyone: boolean;
  /** When the retraction happened. */
  deleted_at: string | null;
  /** Bridge 8+9 · public URL of an attached photo, video, or voice
   *  note in the nex-peer-chat-attachments bucket. NULL for text-only
   *  messages. Sealed 2026-09-27 · migration 054. */
  attachment_url: string | null;
  /** 'image' | 'video' | 'audio' · which inline renderer to use. */
  attachment_type: NexPeerAttachmentKind | null;
  /** Optional client metadata about the attachment · duration_ms,
   *  width, height, size_bytes, mime · used for waveform, poster,
   *  progress indicators. */
  attachment_meta: NexPeerAttachmentMeta | null;
  /** Bridge 66 · migration 091 · emoji → [account_id, ...] map.
   *  Default {} · toggled via toggleMessageReaction. Never NULL. */
  reactions: NexPeerMessageReactions;
  /** Bridge Reactions-Order · migration 117 · sealed 2026-10-01 ·
   *  emoji keys in the order they were first added to this message.
   *  The UI treats the last entry as "newest" · that emoji renders
   *  as a large stamp overlapping the bubble corner while the rest
   *  demote to a small chip row. Empty when the message has no
   *  reactions · never NULL. */
  reactions_order: string[];
  /** Bridge 76 · when true, body is the sentinel '(encrypted)' and
   *  the real content lives in ciphertext / nonce. */
  encrypted?: boolean;
  /** Bridge 76 · raw bytes from nacl.box.after · null on legacy plaintext rows. */
  ciphertext?: string | null;
  /** Bridge 76 · 24-byte nonce · null on legacy plaintext rows. */
  nonce?: string | null;
  /** Bridge 76 · sender's Curve25519 public key at send time,
   *  base64-encoded · null on legacy plaintext rows. */
  sender_public_key?: string | null;
  /** Bridge 76 · sender's device id at send time · null on legacy. */
  sender_device_id?: string | null;
  /** Bridge 76 · which recipient device this ciphertext is addressed
   *  to · null on legacy plaintext rows. */
  recipient_device_id?: string | null;
  /** Bridge 76 · groups every fan-out copy of the same logical send. */
  message_group_id?: string | null;
  /** Bridge 76/78 · timestamp recipient client set on successful
   *  decrypt · purge candidate once this is set for encrypted rows. */
  delivered_at?: string | null;
}

/** Payload for one row of a fan-out send · sender client generates
 *  one of these per recipient device (+ one per own device so the
 *  sender can decrypt their outbox on other devices). */
export interface EncryptedPeerMessageInsert {
  conversation_id: NexUuid;
  sender_account_id: NexUuid;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  sender_public_key: string;
  sender_device_id: string;
  recipient_device_id: string;
  message_group_id: string;
  reply_to_id?: NexUuid | null;
  attachment_url?: string | null;
  attachment_type?: NexPeerAttachmentKind | null;
  attachment_meta?: NexPeerAttachmentMeta | null;
}

// Bridge 66 · re-export client-safe reactions constants + types so
// existing importers of this service (e.g. the shell + peer chat
// page) continue to compile without knowing about the split.
export { NEX_PEER_MESSAGE_QUICK_REACTIONS, type NexPeerMessageReactions };

export type NexPeerAttachmentKind =
  | "image"
  | "video"
  | "audio"
  | "product"
  | "menu_item"
  | "cart_order"
  | "product_share"
  // Bridge ThemeSticker · sealed 2026-10-01 · dedicated peer-message
  // content type for theme stickers (Migration 118 · nex_theme_sticker).
  // Rendered ~140px tall in the bubble lane · NEVER as an inline emoji
  // chip. attachment_url points at the sticker's public URL in the
  // nex-theme-sticker bucket; attachment_meta.sticker carries the
  // snapshot so the bubble stays renderable if the sticker is later
  // deleted from the theme.
  | "sticker"
  // Stage A · owner-authorised 2026-11-03 · Migration 259 extends the
  // attachment_type CHECK to allow 'document'. Carries PDFs / Office
  // docs / zip archives / any non-media file the sender picks via the
  // Aurora Rail composer's Document attach button or the paperclip
  // fallback. attachment_url points at the sealed nex-peer-chat-
  // attachments bucket (bucket already accepts application/octet-
  // stream per Migration 144); attachment_meta carries filename +
  // mime + size_bytes which the recipient's bubble chip renders.
  // Bridge 88 posture unchanged · document bytes route through the
  // plaintext path in v1 · Stage A2 encrypts all attachment types
  // together as a single security model change.
  | "document"
  // Call Center · owner-authorised 2026-11-08 (round 22) · Migration
  // 306 extends the attachment_type CHECK to allow 'call_invite'.
  // Sent by the Call Center invite-dispatch service · attachment_url
  // is the deep-link to accept the call (/nex-native/call/preview?
  // session=<uuid>&accept=1) and attachment_meta carries { session_id,
  // media_type, host_account_id }. Receiver's bubble renderer shows
  // an Accept button.
  | "call_invite";

export interface NexPeerAttachmentMeta {
  duration_ms?: number;
  width?: number;
  height?: number;
  size_bytes?: number;
  mime?: string;
  /** Stage A · owner-authorised 2026-11-03 · original filename as
   *  chosen by the sender when attachment_type='document'. Rendered
   *  on the recipient's document chip (truncated with ellipsis if
   *  long). Optional for image/video/audio · they don't surface a
   *  filename in the bubble. Max 256 chars enforced server-side at
   *  insert. */
  filename?: string;
  /** Bridge 11 · when attachment_type='product', a snapshot of the
   *  product captured at send time. Frozen so the card stays
   *  renderable even if the product is later edited or deleted. */
  product?: NexPeerProductSnapshot;
  /** Bridge 15c · when attachment_type='menu_item', a snapshot of the
   *  dish captured at send time. Frozen so the card stays renderable
   *  even if the dish is later edited or deleted. */
  menu_item?: NexPeerMenuItemSnapshot;
  /** Bridge 22 · when attachment_type='cart_order', a snapshot of
   *  the entire cart at send time. Frozen prices + variant labels ·
   *  the seller sees exactly what was ordered even if products are
   *  later edited or archived. */
  cart?: NexPeerCartOrderSnapshot;
  /** Bridge 49b · when attachment_type='product_share', a snapshot of
   *  the shared product + shop + the grant that lets the recipient
   *  claim their discount. Rendered as B4 Swiss NEX Banner. Frozen
   *  so the banner keeps working even if the product/ladder edits. */
  product_share?: NexPeerProductShareSnapshot;
  /** Bridge ThemeSticker · when attachment_type='sticker', a snapshot
   *  of the sticker captured at send time. Frozen so the bubble stays
   *  renderable even if the sticker is later deleted from the theme
   *  set. aspect_ratio drives the ~140px-tall sticker footprint
   *  render so there's no layout shift while the image loads. */
  sticker?: NexPeerStickerSnapshot;
}

/** Bridge ThemeSticker · snapshot embedded in attachment_meta when a
 *  theme sticker is sent in peer chat. See Migration 118. */
export interface NexPeerStickerSnapshot {
  theme_id: string;
  slug: string;
  label: string;
  /** 'static' (Phase 1) or 'animated' (future · APNG/animated-WebP/
   *  Lottie reaction stickers). Renderer must branch on this. */
  sticker_type: "static" | "animated";
  /** width / height · drives the reserved footprint in the bubble so
   *  the layout doesn't shift while the sticker image loads. */
  aspect_ratio: number;
}

/** Bridge 49b · Snapshot embedded in an attachment_meta when a peer
 *  shares a Direct Price product to a friend or group chat. */
export interface NexPeerProductShareSnapshot {
  /** The nex_product_share_grant row id · used at checkout to look
   *  up whether the grant is still valid + apply the discount. */
  grant_id: string;
  business_id: string;
  business_name: string;
  business_slug: string;
  business_location: string | null;
  product_id: string;
  product_name: string;
  product_image_url: string | null;
  price_pence: number;
  currency: string;
  /** +N% off for the RECIPIENT · same for sharer, stored on the grant
   *  row · shown on the banner as their reward. */
  receiver_bonus_pct: number;
  /** ISO timestamp · matches grant.expires_at · banner shows the
   *  countdown. */
  expires_at: string;
  /** Optional personal note from the sharer · 200 chars max. */
  personal_note: string | null;
  /** Deep link to the buyer-facing D6 view with grant hydrated. */
  open_href: string;
}

export interface NexPeerCartOrderItem {
  kind: "product" | "menu_item";
  id: string;
  name: string;
  price_pence: number;
  currency: string;
  quantity: number;
  variants: string[]; // human labels e.g. ["Black paint", "Body + Summicron"]
  /** Bridge 23c-3 · frozen perk tokens on this line · seller bubble
   *  renders the same 🚚 Free Delivery / 🎁 BOGO chips the buyer
   *  saw at add-time. */
  perks?: string[];
  perks_note?: string | null;
  note: string | null;
  image_url: string | null;
}

export interface NexPeerCartOrderDeliveryAddress {
  recipient_name: string;
  phone: string;
  street: string;
  street_2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  notes: string;
}

export interface NexPeerCartOrderSnapshot {
  shop_id: string;
  shop_slug: string | null;
  shop_display_name: string;
  items: NexPeerCartOrderItem[];
  buyer_notes: string | null;
  subtotal_pence: number;
  currency: string;
  item_count: number;
  /** Bridge 22c-2 · structured delivery address block. NULL means the
   *  buyer sent from a device where it wasn't filled in (legacy carts). */
  delivery_address?: NexPeerCartOrderDeliveryAddress | null;
  /** Bridge 25c · bike-delivery quote the buyer saw at Send time.
   *  Frozen · seller uses it to book GoSend / GrabExpress / Maxim
   *  and reconcile if the driver quote differs. NULL for legacy or
   *  when the buyer opted out of geolocation. */
  delivery_quote?: {
    kind: "free" | "estimate" | "unknown";
    distance_km?: number;
    fare_pence?: number;
    currency?: "IDR";
    eta_minutes?: number;
    free_reason?: string | null;
  } | null;
  /** Bridge 49b-final · NEX Direct Price applied to this cart at
   *  send time · buyer's tier + share bonuses combined and capped
   *  by ladder.max_cap_pct. NULL for legacy carts or shops without
   *  a Direct Price ladder. Seller sees the same discount the buyer
   *  saw when they hit Send. */
  direct_price?: {
    tier_pct: number;
    share_pct: number;
    applied_pct: number;
    capped_at_max: boolean;
    saving_pence: number;
    total_after_discount_pence: number;
  } | null;
}

/** Product snapshot embedded in an attachment_meta when a peer
 *  message carries a product inquiry. Sealed 2026-09-27 · migration
 *  059.
 *
 *  Phase 1 · Slice 1B · owner-authorised 2026-10-24 · additive
 *  live_session_id field. Captured when the share was initiated from
 *  a NEX Live Commerce broadcaster's featured product. This is a
 *  HISTORICAL REFERENCE to the originating live session, NOT a
 *  liveness claim. Downstream renderers that need to display "LIVE
 *  NOW" MUST look up the session's actual state (requires the
 *  nex_live_session table from Phase 2 · G2 blocker tracked in
 *  nex-commerce-live-relationship-plan-2026-10-24 §10 R3). Rendering
 *  a persisted live_session_id as currently-live without that lookup
 *  is a doctrine violation.
 *
 *  Optional and nullable · legacy snapshots without the field
 *  deserialise correctly. The field is TypeScript-only at the type
 *  layer; the on-disk JSONB column accepts the addition without a
 *  migration. */
export interface NexPeerProductSnapshot {
  product_id: string;
  business_id: string;
  business_slug: string | null;
  name: string;
  price_pence: number;
  currency: string;
  image_url: string | null;
  short_description: string | null;
  /** UUID of the originating NEX Live session, if the share was
   *  initiated from a Live broadcaster's featured product. Historical
   *  reference only. See snapshot-level comment above re G2 renderer
   *  requirement. */
  live_session_id?: string | null;
}

/** Menu-item (dish) snapshot embedded in an attachment_meta when a
 *  peer message carries a dish inquiry. Sealed 2026-09-28 · migration
 *  067. Restaurants + cafes get their own card renderer that shows
 *  spice + dietary chips alongside price + image. */
export interface NexPeerMenuItemSnapshot {
  menu_item_id: string;
  business_id: string;
  business_slug: string | null;
  section_name: string | null;
  name: string;
  price_pence: number;
  currency: string;
  image_url: string | null;
  short_description: string | null;
  spice_level: number;
  dietary_tags: string[];
  portion_note: string | null;
  /** Bridge 23a · free-perk tokens attached to the dish · buyer
   *  bubble renders them as chips (Free Delivery is highlighted). */
  perks?: string[];
  /** Bridge 23a · custom note used when perks contains 'other'. */
  perks_note?: string | null;
}

/** Window in which a sender can still retract a message. WhatsApp
 *  uses roughly 1 hour · we match that. Beyond the window the
 *  service refuses to delete. */
export const NEX_PEER_MESSAGE_DELETE_WINDOW_MS = 60 * 60 * 1000;

export interface SendPeerMessageInput {
  conversation_id: NexUuid;
  sender_account_id: NexUuid;
  body: string;
  /** Optional · when set, the message quotes this target and the UI
   *  renders a reply-quote header inside the bubble. */
  reply_to_id?: NexUuid | null;
  /** Optional attachment on the message · Bridge 8+9. Body may be
   *  empty (attachment-only messages are allowed at the DB level
   *  via the body_or_attachment CHECK constraint). */
  attachment_url?: string | null;
  attachment_type?: NexPeerAttachmentKind | null;
  attachment_meta?: NexPeerAttachmentMeta | null;
  /** Optional · Bridge 99 idempotency key (Migration 102 Part C).
   *  When supplied, the insert is subject to UNIQUE
   *  (sender_account_id, send_intent_id) · a repeated send with the
   *  same intent raises a Postgres duplicate-key error the caller can
   *  interpret as "already delivered". Callers without an idempotency
   *  requirement should leave this undefined. */
  send_intent_id?: NexUuid | null;
}

/** Persist a peer chat message. Sender must be a participant of the
 *  conversation · throws otherwise. Bumps last_message_at on the
 *  conversation as a side-effect (so listing conversations sorted by
 *  recency works without an aggregate query). */
export async function sendPeerMessage(
  input: SendPeerMessageInput,
): Promise<NexPeerMessageRow> {
  const body = input.body.trim();
  const hasAttachment = !!input.attachment_url && !!input.attachment_type;
  if (body.length === 0 && !hasAttachment) {
    throw new Error(
      "peer-message-service.sendPeerMessage: body is empty and no attachment provided",
    );
  }
  if (body.length > 4000) {
    throw new Error(
      "peer-message-service.sendPeerMessage: body exceeds 4000 chars",
    );
  }
  if (
    (input.attachment_url && !input.attachment_type) ||
    (input.attachment_type && !input.attachment_url)
  ) {
    throw new Error(
      "peer-message-service.sendPeerMessage: attachment_url + attachment_type must be set together",
    );
  }
  const conversation = await getPeerConversationById(input.conversation_id);
  if (!conversation) {
    throw new Error(
      "peer-message-service.sendPeerMessage: conversation not found",
    );
  }
  const isParticipant =
    conversation.participant_a_id === input.sender_account_id ||
    conversation.participant_b_id === input.sender_account_id;
  if (!isParticipant) {
    throw new Error(
      "peer-message-service.sendPeerMessage: sender is not a participant of this conversation",
    );
  }
  // Validate the reply target exists AND belongs to the same
  // conversation · defends against replying to a message in another
  // thread (impossible via UI but cheap to enforce here).
  let replyToId: NexUuid | null = null;
  if (input.reply_to_id) {
    const { data: target, error: targetErr } = await nexSupabaseAdmin
      .from("nex_peer_message")
      .select("id, conversation_id")
      .eq("id", input.reply_to_id)
      .maybeSingle();
    if (targetErr) {
      throw new Error(
        `peer-message-service.sendPeerMessage · reply target lookup failed: ${targetErr.message}`,
      );
    }
    if (
      target &&
      (target as { conversation_id: string }).conversation_id ===
        input.conversation_id
    ) {
      replyToId = input.reply_to_id;
    }
    // Silently drop bad reply pointers rather than erroring the send.
  }

  // Owner-sealed 2026-11-07 · disappearing messages Phase 2 wire-in.
  // Compute disappearing_at from the sender's account default before
  // insert. For OFF (0) default · patch is empty · no stamp. For
  // positive-integer defaults · patch = { disappearing_at: ISO }. For
  // sentinel -1 "immediately after view" · patch is empty at send
  // (Phase 3 stamps at read time). If migration 283's disappearing_at
  // column is absent · patch is empty · insert works on the pre-
  // migration schema without error.
  const { resolveDisappearingAtPatchForSend } = await import(
    "./disappearing-messages-service"
  );
  const disappearingPatch = await resolveDisappearingAtPatchForSend(
    input.sender_account_id,
  );

  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .insert({
      conversation_id: input.conversation_id,
      sender_account_id: input.sender_account_id,
      body,
      reply_to_id: replyToId,
      attachment_url: input.attachment_url ?? null,
      attachment_type: input.attachment_type ?? null,
      attachment_meta: input.attachment_meta ?? null,
      // Bridge 99 idempotency key · UNIQUE (sender_account_id,
      // send_intent_id) enforced by Migration 102 Part C.
      ...(input.send_intent_id ? { send_intent_id: input.send_intent_id } : {}),
      // Disappearing messages · Phase 2 (owner-sealed 2026-11-07).
      ...disappearingPatch,
    })
    .select("*")
    .single();
  // Track C · owner-authorised 2026-10-20 · server-side idempotency.
  // If this insert loses the partial-unique race against an earlier
  // request carrying the same (sender_account_id, send_intent_id),
  // Postgres returns 23505 (unique_violation). Treat that as an
  // idempotent cache hit · SELECT the existing row + return it.
  // This matches the Bridge 99 doctrine on send_intent_id and makes
  // double-tapped cart sends (and any other caller supplying
  // send_intent_id) safe without a schema change.
  if (error && input.send_intent_id) {
    const code = (error as { code?: string }).code ?? "";
    const msg = (error.message ?? "").toLowerCase();
    const isUniqueViolation =
      code === "23505" ||
      msg.includes("duplicate key") ||
      msg.includes("already exists");
    if (isUniqueViolation) {
      const existing = await nexSupabaseAdmin
        .from("nex_peer_message")
        .select("*")
        .eq("sender_account_id", input.sender_account_id)
        .eq("send_intent_id", input.send_intent_id)
        .maybeSingle();
      if (existing.data) {
        const row = existing.data as NexPeerMessageRow;
        // Still bump last_message_at for the conversation · best-effort.
        await touchPeerConversation(row.conversation_id, row.sent_at).catch(
          () => undefined,
        );
        return row;
      }
      // If the SELECT lost a race too (race-of-races · extremely rare)
      // fall through to the generic error below.
    }
  }
  if (error || !data) {
    throw new Error(
      `peer-message-service.sendPeerMessage: ${error?.message ?? "no row returned"}`,
    );
  }
  const row = data as NexPeerMessageRow;
  await touchPeerConversation(row.conversation_id, row.sent_at).catch(() => {
    // best-effort · leaving last_message_at stale won't break sends
  });
  // SafeChat Phase 1 · simulated detection · non-blocking · errors swallowed.
  // Encrypted messages (sendEncryptedPeerMessages) are a separate code path
  // and are NOT hooked by design · see safechat doctrine.
  if (isSafeChatPhase1LoggingEnabled()) {
    void safechatClassifyAndLog({
      messageText: body,
      senderAccountId: input.sender_account_id,
      recipientAccountId:
        row.sender_account_id === conversation.participant_a_id
          ? conversation.participant_b_id
          : conversation.participant_a_id,
      conversationId: row.conversation_id,
      messageRef: row.id,
    }).catch(() => {
      /* swallow · SafeChat must never affect message delivery */
    });
  }
  return row;
}

/** List messages in a conversation, oldest first. Optional limit. */
export async function listPeerMessages(
  conversationId: NexUuid,
  opts?: { limit?: number },
): Promise<NexPeerMessageRow[]> {
  let query = nexSupabaseAdmin
    .from("nex_peer_message")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true });
  if (opts?.limit && opts.limit > 0) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) {
    throw new Error(`peer-message-service.listPeerMessages: ${error.message}`);
  }
  return (data as NexPeerMessageRow[]) ?? [];
}

/** Return the most recent message in a conversation, or null if the
 *  conversation is empty. Used by the inbox + vault chat list views
 *  for row-level previews. Doctrine #7 scoping: reads strictly by
 *  conversation_id (two-party envelope); caller is responsible for
 *  verifying the viewer participates in the conversation. */
export async function getLastPeerMessageInConversation(
  conversationId: NexUuid,
): Promise<NexPeerMessageRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(
      `peer-message-service.getLastPeerMessageInConversation: ${error.message}`,
    );
  }
  return (data as NexPeerMessageRow) ?? null;
}

/** Mark every inbound (not-from-viewer) message in the conversation as
 *  read. Idempotent side-effect · safe to call on every page load.
 *
 *  R9 Stage 4 gate (2026-10-15 · migration 199 unapplied as of this
 *  commit · service reads defaults from DEFAULT_CHAT_PREFS when the
 *  columns are absent): the viewer here IS the recipient of the
 *  inbound messages. When the recipient has `read_receipts_enabled`
 *  disabled, their saved intent is "nobody sees when I've read a
 *  message." We honour that by SKIPPING the read_at write entirely ·
 *  the sender's view never surfaces a receipt because the column
 *  stays NULL. Fail-closed · a service-layer error reading prefs
 *  resolves to PRIVACY-MAXIMUM (receipts suppressed) via
 *  getChatPreferencesSafe. This is the primary server-side
 *  enforcement for reciprocal read-receipt privacy. */
/** Owner-authorised 2026-11-05 later-same-day iter 10 · edit a sent
 *  peer message. Sender-only · within 15-minute edit window. Appends
 *  the pre-edit body to `edit_history` and sets `edited_at`. Returns a
 *  typed result union so callers can report friendly errors.
 *
 *  Migration 279 (nex-supabase/migrations/279_peer_message_edit.sql)
 *  must be applied before this function returns ok; until then every
 *  call returns { ok: false, reason: "schema-unapplied" } because the
 *  update targets columns that don't exist. The service is defensive:
 *  the Supabase client will surface a column-does-not-exist error and
 *  we map that to the schema-unapplied reason.
 */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

export type EditPeerMessageResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "not-found"
        | "not-sender"
        | "deleted"
        | "window-expired"
        | "empty-body"
        | "schema-unapplied"
        | "db-error";
      readonly detail?: string;
    };

export async function editPeerMessage(args: {
  readonly messageId: NexUuid;
  readonly senderAccountId: NexUuid;
  readonly newBody: string;
}): Promise<EditPeerMessageResult> {
  const trimmed = args.newBody.trim();
  if (trimmed.length === 0) return { ok: false, reason: "empty-body" };

  // Fetch current row · enforce ownership + window + deleted gate in
  // app code so we can return a friendly reason for each path.
  const { data: row, error: fetchErr } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("id, sender_account_id, sent_at, body, deleted_for_everyone")
    .eq("id", args.messageId)
    .maybeSingle();
  if (fetchErr) return { ok: false, reason: "db-error", detail: fetchErr.message };
  if (!row) return { ok: false, reason: "not-found" };
  if (row.sender_account_id !== args.senderAccountId) {
    return { ok: false, reason: "not-sender" };
  }
  if (row.deleted_for_everyone) return { ok: false, reason: "deleted" };
  const sentMs = new Date(row.sent_at).getTime();
  if (Number.isNaN(sentMs) || Date.now() - sentMs > EDIT_WINDOW_MS) {
    return { ok: false, reason: "window-expired" };
  }

  const now = new Date().toISOString();
  // First read existing edit_history so we can append (Supabase has no
  // native JSONB append · race window here is 1-sender-only edit so
  // low risk).
  const { data: historyRow, error: historyErr } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("edit_history")
    .eq("id", args.messageId)
    .maybeSingle();
  if (historyErr) {
    const msg = historyErr.message ?? "";
    if (/column .*edit_history.* does not exist/i.test(msg)) {
      return { ok: false, reason: "schema-unapplied" };
    }
    return { ok: false, reason: "db-error", detail: msg };
  }
  const prior = Array.isArray(
    (historyRow as { edit_history?: unknown } | null)?.edit_history,
  )
    ? ((historyRow as { edit_history: unknown[] }).edit_history as Array<{
        body: string;
        edited_at: string;
      }>)
    : [];
  const nextHistory = [...prior, { body: row.body, edited_at: now }];

  const { error: updateErr } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .update({
      body: trimmed,
      edited_at: now,
      edit_history: nextHistory,
    })
    .eq("id", args.messageId);
  if (updateErr) {
    const msg = updateErr.message ?? "";
    if (/column .*edited_at.* does not exist/i.test(msg)) {
      return { ok: false, reason: "schema-unapplied" };
    }
    return { ok: false, reason: "db-error", detail: msg };
  }
  return { ok: true };
}

export async function markPeerMessagesRead(
  conversationId: NexUuid,
  viewerAccountId: NexUuid,
): Promise<void> {
  const { getChatPreferencesSafe } = await import("./chat-preferences-service");
  const prefs = await getChatPreferencesSafe(viewerAccountId);
  if (!prefs.read_receipts_enabled) {
    // Honest no-op · the recipient has opted out of the receipt signal.
    return;
  }
  const now = new Date().toISOString();
  const { error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .update({ read_at: now })
    .eq("conversation_id", conversationId)
    .neq("sender_account_id", viewerAccountId)
    .is("read_at", null);
  if (error) {
    // best-effort · never throw from a read-marker
    // eslint-disable-next-line no-console
    console.warn(
      `peer-message-service.markPeerMessagesRead soft-fail: ${error.message}`,
    );
  }

  // Owner-sealed 2026-11-07 · disappearing messages Phase 3 wire-in.
  // For any messages we just stamped read AND whose SENDER has the
  // -1 ("immediately after view") sentinel default AND whose
  // disappearing_at is still NULL · stamp disappearing_at = now + 30s
  // grace so the purge job (migration 284) removes them shortly.
  //
  // Degrades safely when:
  //   · migration 283 (disappearing_at column) unapplied · column
  //     probe returns false · we skip the stamping block entirely.
  //   · migration 282 (sender default column) unapplied · the service
  //     fail-safe returns OFF for every sender · nobody qualifies ·
  //     no update fires.
  //
  // Scope · we only stamp messages that were JUST marked read in the
  // same call (read_at = now). This avoids retroactively stamping
  // older messages whose sender has since changed their default.
  try {
    const {
      hasDisappearingAtColumn,
      getDisappearingDefaultSafe,
      computeExpiresAtAtReadTime,
    } = await import("./disappearing-messages-service");
    const columnReady = await hasDisappearingAtColumn();
    if (!columnReady) return;

    // Find the messages this call stamped read that lack a
    // disappearing_at · group by sender so we batch per-sender.
    const { data: rows, error: selErr } = await nexSupabaseAdmin
      .from("nex_peer_message")
      .select("id, sender_account_id")
      .eq("conversation_id", conversationId)
      .neq("sender_account_id", viewerAccountId)
      .eq("read_at", now)
      .is("disappearing_at", null);
    if (selErr || !rows || rows.length === 0) return;

    // Group IDs by sender · then resolve each sender's default once.
    const bySender = new Map<string, string[]>();
    for (const r of rows as Array<{ id: string; sender_account_id: string }>) {
      const list = bySender.get(r.sender_account_id) ?? [];
      list.push(r.id);
      bySender.set(r.sender_account_id, list);
    }

    const graceAt = computeExpiresAtAtReadTime(new Date()).toISOString();
    for (const [senderId, ids] of bySender.entries()) {
      const def = await getDisappearingDefaultSafe(senderId);
      if (def !== -1) continue; // only -1 sentinel stamps at read time
      const { error: updErr } = await nexSupabaseAdmin
        .from("nex_peer_message")
        .update({ disappearing_at: graceAt })
        .in("id", ids);
      if (updErr) {
        // best-effort · never throw from a read-marker
        // eslint-disable-next-line no-console
        console.warn(
          `peer-message-service.markPeerMessagesRead disappearing-stamp soft-fail: ${updErr.message}`,
        );
      }
    }
  } catch (err) {
    // Any import/probe/query failure degrades to "no-op stamping" ·
    // the read receipt itself already fired above so chat UX is OK.
    // eslint-disable-next-line no-console
    console.warn(
      `peer-message-service.markPeerMessagesRead disappearing-stamp exception: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/** Retract a peer message · "delete for everyone". Sender-only,
 *  within a 1-hour window from send time. Sets deleted_for_everyone
 *  + deleted_at · body is preserved for audit. Throws with clear
 *  reasons the Server Action can surface as user-facing banners. */
export async function deletePeerMessageForEveryone(
  messageId: NexUuid,
  viewerAccountId: NexUuid,
): Promise<void> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("id, sender_account_id, sent_at, deleted_for_everyone")
    .eq("id", messageId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `peer-message-service.deletePeerMessageForEveryone lookup: ${error.message}`,
    );
  }
  if (!data) {
    throw new Error("message not found");
  }
  const row = data as Pick<
    NexPeerMessageRow,
    "sender_account_id" | "sent_at" | "deleted_for_everyone"
  > & { id: NexUuid };
  if (row.deleted_for_everyone) {
    // Idempotent · already deleted · nothing to do.
    return;
  }
  if (row.sender_account_id !== viewerAccountId) {
    throw new Error("only the sender can delete this message");
  }
  const age = Date.now() - new Date(row.sent_at).getTime();
  if (age > NEX_PEER_MESSAGE_DELETE_WINDOW_MS) {
    throw new Error(
      "delete window has passed · you can retract messages within an hour",
    );
  }
  const now = new Date().toISOString();
  const upd = await nexSupabaseAdmin
    .from("nex_peer_message")
    .update({ deleted_for_everyone: true, deleted_at: now })
    .eq("id", messageId);
  if (upd.error) {
    throw new Error(
      `peer-message-service.deletePeerMessageForEveryone update: ${upd.error.message}`,
    );
  }
}

/**
 * Bridge 66 · Toggle a reaction on a peer message.
 * ------------------------------------------------
 * Reads the current `reactions` JSONB, adds or removes the caller's
 * account id from the emoji's array, writes back. Returns the resulting
 * reactions map so the caller can echo it into the UI without a re-read.
 *
 * Idempotent · calling twice with the same emoji is a toggle (add then
 * remove). Emojis outside the quick-reactions whitelist are rejected so
 * an untrusted client can't stuff arbitrary strings into the JSONB.
 */
export async function toggleMessageReaction(
  messageId: NexUuid,
  callerAccountId: NexUuid,
  emoji: string,
): Promise<NexPeerMessageReactions> {
  // Bridge ThemeEmoji · accepts unicode whitelist OR theme-emoji slugs
  // in `:slug:` form so per-theme reactions can flow through the same
  // storage path without a schema change.
  if (!isValidReactionEmoji(emoji)) {
    throw new Error(`reaction '${emoji}' is not on the whitelist`);
  }

  const cur = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("id, conversation_id, reactions, reactions_order")
    .eq("id", messageId)
    .maybeSingle();
  if (cur.error) {
    throw new Error(
      `peer-message-service.toggleMessageReaction lookup: ${cur.error.message}`,
    );
  }
  if (!cur.data) throw new Error("message not found");

  const row = cur.data as {
    id: NexUuid;
    conversation_id: NexUuid;
    reactions: NexPeerMessageReactions | null;
    reactions_order: string[] | null;
  };
  // Membership check · RLS also enforces this but a clear error is
  // kinder than a silent 0-row update.
  const conv = await getPeerConversationById(row.conversation_id);
  if (!conv) throw new Error("conversation not found");
  if (
    callerAccountId !== conv.participant_a_id &&
    callerAccountId !== conv.participant_b_id
  ) {
    throw new Error("only conversation participants can react");
  }

  const next: NexPeerMessageReactions = { ...(row.reactions ?? {}) };
  const prevOrder = row.reactions_order ?? [];
  const prevListLen = next[emoji]?.length ?? 0;
  const list = next[emoji] ? [...next[emoji]!] : [];
  const idx = list.indexOf(callerAccountId);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(callerAccountId);
  }
  if (list.length === 0) {
    delete next[emoji];
  } else {
    next[emoji] = list;
  }

  // Bridge Reactions-Order · migration 117 · maintain reactions_order
  // so the UI can render the newest emoji as a large stamp overlap.
  //  · 0 → 1 transition: append emoji (it just became "newest")
  //  · N → 0 transition: drop the emoji from the array
  //  · otherwise: leave the array untouched (repeat-toggles by the
  //    same user shouldn't churn ordering)
  const nextListLen = list.length;
  let nextOrder: string[] = prevOrder;
  if (prevListLen === 0 && nextListLen > 0) {
    // First reactor picked this emoji · make it the newest by moving
    // it to the end of the order array (or appending if absent).
    nextOrder = prevOrder.filter((e) => e !== emoji).concat(emoji);
  } else if (prevListLen > 0 && nextListLen === 0) {
    nextOrder = prevOrder.filter((e) => e !== emoji);
  }

  const upd = await nexSupabaseAdmin
    .from("nex_peer_message")
    .update({ reactions: next, reactions_order: nextOrder })
    .eq("id", messageId);
  if (upd.error) {
    throw new Error(
      `peer-message-service.toggleMessageReaction update: ${upd.error.message}`,
    );
  }
  return next;
}

/**
 * Bridge 76 · Insert N encrypted rows atomically as one fan-out send.
 * ------------------------------------------------------------------
 * Every payload in `rows` must share the same conversation_id +
 * sender_account_id + message_group_id (the client is responsible for
 * grouping them correctly). The sentinel body '(encrypted)' is set
 * server-side so the existing shell + listing paths continue to work
 * without decrypting.
 *
 * Returns the inserted row ids so the caller can display an optimistic
 * bubble instantly, then flip it to "delivered" once ack broadcasts
 * come back from the recipient devices.
 */
export async function sendEncryptedPeerMessages(
  rows: EncryptedPeerMessageInsert[],
): Promise<NexUuid[]> {
  if (rows.length === 0) return [];

  const groupIds = new Set(rows.map((r) => r.message_group_id));
  if (groupIds.size !== 1) {
    throw new Error("sendEncryptedPeerMessages: all rows must share message_group_id");
  }
  const convIds = new Set(rows.map((r) => r.conversation_id));
  if (convIds.size !== 1) {
    throw new Error("sendEncryptedPeerMessages: all rows must share conversation_id");
  }
  const senderIds = new Set(rows.map((r) => r.sender_account_id));
  if (senderIds.size !== 1) {
    throw new Error("sendEncryptedPeerMessages: all rows must share sender_account_id");
  }

  const conv = await getPeerConversationById(rows[0]!.conversation_id);
  if (!conv) throw new Error("conversation not found");
  const sender = rows[0]!.sender_account_id;
  if (
    sender !== conv.participant_a_id &&
    sender !== conv.participant_b_id
  ) {
    throw new Error("only conversation participants can send messages");
  }

  // Postgres bytea is exchanged over PostgREST as base64-encoded text
  // (the \x prefix hex form doesn't round-trip cleanly on insert). The
  // Supabase client encodes Uint8Array → base64 automatically when the
  // column type is bytea, but we prefer to encode explicitly here so
  // the wire shape is predictable.
  const encode = (b: Uint8Array): string => bufferToBase64(b);

  const payload = rows.map((r) => ({
    conversation_id: r.conversation_id,
    sender_account_id: r.sender_account_id,
    body: "(encrypted)",
    encrypted: true,
    ciphertext: encode(r.ciphertext),
    nonce: encode(r.nonce),
    sender_public_key: r.sender_public_key,
    sender_device_id: r.sender_device_id,
    recipient_device_id: r.recipient_device_id,
    message_group_id: r.message_group_id,
    reply_to_id: r.reply_to_id ?? null,
    attachment_url: r.attachment_url ?? null,
    attachment_type: r.attachment_type ?? null,
    attachment_meta: r.attachment_meta ?? null,
  }));

  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .insert(payload)
    .select("id");
  if (error) {
    throw new Error(`sendEncryptedPeerMessages: ${error.message}`);
  }

  // Bump last_message_at so conversation lists sort correctly.
  // Round 22 2026-11-08 · signature is (conversationId, sentAtIso)
  // · the encrypted insert path did not pass the timestamp, which
  // TypeScript now catches after the attachment_type enum was
  // extended. Use the current time (payload insertions happened
  // moments ago) so last_message_at is accurate.
  await touchPeerConversation(
    rows[0]!.conversation_id,
    new Date().toISOString(),
  );

  return (data as Array<{ id: NexUuid }>).map((r) => r.id);
}

/** Mark an encrypted row as delivered after the recipient's client
 *  decrypts successfully · triggers Bridge 78 purge eligibility.
 *
 *  R9 Stage 4 extension (2026-10-15 · migration 199 unapplied):
 *  optional `viewerAccountId` enables encrypted-path read-receipt
 *  reciprocity. When supplied, the recipient's `read_receipts_enabled`
 *  preference is checked via `getChatPreferencesSafe` · if disabled,
 *  this helper is an honest no-op (the sender never sees "delivered"
 *  because `delivered_at` stays NULL). Callers that already know the
 *  recipient's account (the sealed `/api/.../peer-message/delivered`
 *  route authenticates the session, so the viewer === recipient) should
 *  pass it. Legacy callers that omit the parameter continue to work
 *  (gate bypassed · ciphertext purge semantics preserved) · they are
 *  tracked as follow-up migration targets for Stage 4b encrypted
 *  caller sweep.
 */
export async function markPeerMessageDelivered(
  messageId: NexUuid,
  viewerAccountId?: NexUuid,
): Promise<void> {
  if (viewerAccountId) {
    const { getChatPreferencesSafe } = await import("./chat-preferences-service");
    const prefs = await getChatPreferencesSafe(viewerAccountId);
    if (!prefs.read_receipts_enabled) {
      // Honest no-op · the recipient has opted out of the delivered
      // signal in the reciprocal receipt contract.
      return;
    }
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .update({ delivered_at: new Date().toISOString() })
    .eq("id", messageId)
    .is("delivered_at", null);
  if (error) {
    // best-effort · never throw from an ack path
    // eslint-disable-next-line no-console
    console.warn(`markPeerMessageDelivered soft-fail: ${error.message}`);
  }
}

/** Node-safe base64 encoder for Uint8Array · we can't rely on the
 *  browser's btoa here (service is `server-only`). */
function bufferToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/** Storage bucket that holds peer-chat attachments · created by
 *  migration 055 · public read, 25 MB cap, image/video/audio MIMEs. */
const NEX_PEER_ATTACHMENT_BUCKET = "nex-peer-chat-attachments";

/** Max upload size (bytes) · matches the bucket's file_size_limit. */
export const NEX_PEER_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

/** MIME → kind classifier.
 *  - image/*, video/*, audio/* → sealed attachment kinds (Migration 054)
 *  - any other non-empty MIME → "document" (Migration 259 · Stage A)
 *  - empty / missing MIME → null (rejected · the composer requires a
 *    file.type for upload path routing · an empty type would land in
 *    the bucket as octet-stream with no way to pick a recipient icon) */
export function classifyPeerAttachmentMime(
  mime: string,
): NexPeerAttachmentKind | null {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m.length === 0) return null;
  // Stage A · owner-authorised 2026-11-03 · Migration 259 extended
  // the attachment_type CHECK to allow 'document'. Everything that
  // isn't image/video/audio but DOES carry a MIME lands here · PDF,
  // Office docs, zip archives, text files, etc. Upload path coerces
  // Content-Type to application/octet-stream (bucket migration 144
  // already allows that MIME) so the bucket doesn't need widening ·
  // the original MIME is preserved in attachment_meta.mime for the
  // recipient's document-chip icon selection.
  return "document";
}

/** Upload a file to the peer-chat attachments bucket. Returns the
 *  public URL + resolved kind + metadata so the caller can either
 *  attach it to a message right away or stash it in URL state and
 *  attach on next send. Throws on MIME rejection, size cap, or
 *  storage error. */
export async function uploadPeerAttachment(
  senderAccountId: NexUuid,
  file: File,
): Promise<{
  url: string;
  kind: NexPeerAttachmentKind;
  meta: NexPeerAttachmentMeta;
}> {
  if (file.size > NEX_PEER_ATTACHMENT_MAX_BYTES) {
    throw new Error(
      `attachment exceeds ${NEX_PEER_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB cap`,
    );
  }
  const kind = classifyPeerAttachmentMime(file.type || "");
  if (!kind) {
    throw new Error(`attachment MIME '${file.type}' is not allowed`);
  }
  const extMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
  };
  // For documents, prefer the filename's own extension when available ·
  // falls back to a MIME-derived extension or 'bin'. Stage A, 2026-11-03.
  const extFromFilename = (() => {
    if (kind !== "document") return null;
    const raw = file.name ?? "";
    const dot = raw.lastIndexOf(".");
    if (dot <= 0 || dot === raw.length - 1) return null;
    const candidate = raw.slice(dot + 1).toLowerCase();
    // Reject anything that doesn't look like a plain extension (no
    // slashes, no spaces, bounded length) · keeps the storage path
    // injection-safe.
    if (!/^[a-z0-9]{1,8}$/.test(candidate)) return null;
    return candidate;
  })();
  const ext = extFromFilename ?? extMap[file.type.toLowerCase()] ?? "bin";
  // Path layout · senderId/timestamp-randomshort.ext · keeps every
  // sender's uploads in their own prefix (useful for future
  // per-sender cleanup) and avoids collision without a UUID lookup.
  const objectPath = `${senderAccountId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const bucket = nexSupabaseAdmin.storage.from(NEX_PEER_ATTACHMENT_BUCKET);
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Stage A · owner-authorised 2026-11-03 · documents upload with
  // Content-Type `application/octet-stream` so the bucket's existing
  // MIME whitelist (Migration 144) accepts them. The original MIME is
  // retained in attachment_meta.mime for the recipient's chip icon.
  // image/video/audio keep their original Content-Type (unchanged).
  const uploadContentType =
    kind === "document" ? "application/octet-stream" : file.type;
  const { error } = await bucket.upload(objectPath, bytes, {
    contentType: uploadContentType,
    upsert: false,
  });
  if (error) {
    throw new Error(
      `peer-message-service.uploadPeerAttachment: ${error.message}`,
    );
  }
  const { data: pub } = bucket.getPublicUrl(objectPath);
  // Stage A · when kind === 'document' we preserve the original filename
  // (truncated to 256 chars to match the Migration 259 server-side cap
  // noted in NexPeerAttachmentMeta.filename) so the recipient's chip
  // can show it. Non-document attachments omit the filename to keep
  // the sealed metadata shape unchanged for them.
  const meta: NexPeerAttachmentMeta = {
    size_bytes: file.size,
    mime: file.type || "application/octet-stream",
  };
  if (kind === "document" && typeof file.name === "string" && file.name.length > 0) {
    meta.filename = file.name.slice(0, 256);
  }
  return { url: pub.publicUrl, kind, meta };
}

/** Count unread messages for a viewer across a specific conversation.
 *  Cheap · used for the chat surface unread pill. */
export async function countUnreadPeerMessages(
  conversationId: NexUuid,
  viewerAccountId: NexUuid,
): Promise<number> {
  const { count, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .neq("sender_account_id", viewerAccountId)
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

/** Count TOTAL unread messages for a viewer across EVERY NON-VAULT
 *  peer conversation they participate in. Used for the home-screen
 *  app badge (owner directive 2026-10-16) and any UI that aggregates
 *  unread state across the inbox.
 *
 *  Three queries by design:
 *    1. list conversation ids where viewer is participant_a OR
 *       participant_b (sealed `nex_peer_conversation` shape ·
 *       migration 047 ordered-pair constraint)
 *    2. subtract the viewer's vaulted conversation ids via the
 *       sealed `listVaultedConversationIds` · same canonical source
 *       the notification-dispatch service uses to enforce the Vault
 *       boundary on push notifications (owner directive 2026-10-16 ·
 *       Vault activity must not inflate the public home-screen badge)
 *    3. count unread messages in the remaining (non-vault)
 *       conversations where the sender is NOT the viewer and
 *       `read_at IS NULL`
 *
 *  Error handling · owner directive 2026-10-16 (corrective pass) ·
 *  THROWS on any DB failure so the API boundary can distinguish a
 *  genuine zero count from an outage. The previous implementation
 *  returned 0 on any error, which would clear a user's badge during
 *  a transient DB blip. The API route is responsible for returning
 *  a non-2xx response so the client's `if (!res.ok) return;` guard
 *  preserves the last known badge state. */
export async function countTotalUnreadPeerMessages(
  viewerAccountId: NexUuid,
): Promise<number> {
  const convs = await nexSupabaseAdmin
    .from("nex_peer_conversation")
    .select("id")
    .or(
      `participant_a_id.eq.${viewerAccountId},participant_b_id.eq.${viewerAccountId}`,
    );
  if (convs.error) {
    throw new Error(
      `peer-message-service.countTotalUnreadPeerMessages conversations: ${convs.error.message}`,
    );
  }
  if (!convs.data || convs.data.length === 0) return 0;

  // Owner directive 2026-10-16 · Vault exclusion. The viewer's
  // vaulted-conversation set is the canonical source of truth used
  // by the sealed notification-dispatch service (vault_rejected
  // branch). We MUST propagate errors here · if we cannot determine
  // Vault membership, we cannot safely compute the badge count and
  // the caller should preserve the last known value.
  const vaulted = await listVaultedConversationIds(viewerAccountId);
  const nonVaultedIds = convs.data
    .map((row: { id: NexUuid }) => row.id)
    .filter((id: NexUuid) => !vaulted.has(id));
  if (nonVaultedIds.length === 0) return 0;

  const { count, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", nonVaultedIds)
    .neq("sender_account_id", viewerAccountId)
    .is("read_at", null);
  if (error) {
    throw new Error(
      `peer-message-service.countTotalUnreadPeerMessages count: ${error.message}`,
    );
  }
  return count ?? 0;
}

/**
 * R8 Stage 3b helper · lightweight read of a message's author and
 * conversation so a server action can route a push notification to
 * the right recipient (the original message author) without duplicating
 * row-fetch logic. Returns null when the message does not exist.
 * Throws on database error so the caller can fail-closed.
 */
export async function getMessageAuthorContext(
  messageId: NexUuid,
): Promise<{ sender_account_id: NexUuid; conversation_id: NexUuid } | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("sender_account_id, conversation_id")
    .eq("id", messageId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `peer-message-service.getMessageAuthorContext: ${error.message}`,
    );
  }
  if (!data) return null;
  const row = data as { sender_account_id: NexUuid; conversation_id: NexUuid };
  return {
    sender_account_id: row.sender_account_id,
    conversation_id: row.conversation_id,
  };
}
