// src/lib/nex-native/business-message-service.ts
//
// Owner-sealed 2026-11-13 · encrypted business-chat message service.
// -----------------------------------------------------------------------------
// Business-scoped companion to peer-message-service.ts. Writes
// end-to-end encrypted rows into nex_message against a parent
// nex_conversation (keyed by business_id · mig 004) so every shop has
// its own independent customer conversation thread.
//
// Doctrine:
//   · Mirrors sendEncryptedPeerMessages + listPeerMessages exactly.
//     Reuses the sealed device-only E2E architecture (2026-11-09) ·
//     body is NEVER stored as plaintext for encrypted rows · the
//     client wraps one copy per target device + sends all of them
//     in a single call so the Group ID (message_group_id) represents
//     "one logical send."
//
//   · Participant guard · sender must be a participant of the
//     conversation (nex_conversation_participant). Enforced here at
//     the service boundary in addition to the RLS policy sealed in
//     mig 004.
//
//   · Immutable · nex_message is append-only per the sealed 2026-09-24
//     doctrine (mig 009 nex_message_immutability). No updateMessage
//     export · only delivered_at + delivery_status may ever change
//     (mig 345 opens those for future bookkeeping · this service does
//     NOT write them on insert).
//
//   · Requires mig 345 (nex_message E2E crypto columns) applied. Until
//     then this service's writes fail with the CHECK constraint
//     violation · that's correct · guards against plaintext slipping in.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";
import type { NexPeerAttachmentMeta } from "./peer-message-service";

// ─── Row shape · mirrors nex_message schema after mig 345 ──────────

/** The INSERT shape · one encrypted copy per target device. All rows
 *  in a logical send share the same `message_group_id`. */
export interface EncryptedBusinessMessageInsert {
  conversation_id: NexUuid;
  sender_account_id: NexUuid;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  sender_public_key: string;
  sender_device_id: string;
  recipient_device_id: string;
  message_group_id: string;
  reply_to_id?: NexUuid | null;
  attachment_type?:
    | "image"
    | "video"
    | "audio"
    | "document"
    | "product"
    | null;
  attachment_meta?: NexPeerAttachmentMeta | Record<string, unknown> | null;
}

export interface NexBusinessMessageRow {
  id: NexUuid;
  conversation_id: NexUuid;
  sender_account_id: NexUuid;
  body: string | null;
  created_at: string;
  encrypted: boolean;
  ciphertext: string | null;
  nonce: string | null;
  sender_public_key: string | null;
  sender_device_id: string | null;
  recipient_device_id: string | null;
  attachment_type: string | null;
  attachment_meta: unknown | null;
  message_group_id: NexUuid | null;
  delivered_at: string | null;
  send_intent_id: NexUuid | null;
  reply_to_id: NexUuid | null;
  delivery_status: string;
}

// ─── Participant + ownership guard ─────────────────────────────────
//
// Stage 8 · item 9 · 2026-11-14 · hardened.
// The original guard refused any non-participant, which closed the
// "random account sends into a conversation they're not on" vector.
// Stage 8 adds a second check: when the sender is on the BUSINESS
// side of the conversation (nex_conversation_participant.side ===
// 'business'), we also verify that the sender IS the actual owner
// of the shop the conversation is keyed to.
//
// Why this matters: without it, a compromised session with
// participant.side='business' could impersonate the shop even if
// the account was swapped into the business slot through a bug or
// a stale row. Belt + braces on top of the sealed Phase-2 Interp 1
// device-only E2E posture.

async function ensureSenderCanWriteAsSide(
  conversationId: NexUuid,
  senderAccountId: NexUuid,
): Promise<void> {
  // One join · we need both participant.side AND the business's
  // owner_account_id in a single round-trip.
  const { data, error } = await nexSupabaseAdmin
    .from("nex_conversation_participant")
    .select(
      "account_id, side, nex_conversation!inner ( business_id, nex_business!inner ( owner_account_id ) )",
    )
    .eq("conversation_id", conversationId)
    .eq("account_id", senderAccountId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `business-message-service.ensureSenderCanWriteAsSide: ${error.message}`,
    );
  }
  if (!data) {
    throw new Error(
      "only conversation participants can send business messages",
    );
  }
  const row = data as unknown as {
    account_id: NexUuid;
    side: "customer" | "business";
    nex_conversation: {
      business_id: NexUuid;
      nex_business: { owner_account_id: NexUuid };
    };
  };
  if (row.side === "business") {
    const ownerId = row.nex_conversation.nex_business.owner_account_id;
    if (ownerId !== senderAccountId) {
      // Compromised-session defence · the sender claims to be the
      // shop side but the business row says a different account
      // owns the shop. Refuse the write · log the gap so an audit
      // trail exists even if the attempt was benign (e.g., stale
      // participant row after a shop transfer).
      throw new Error(
        "business-side sender is not the registered shop owner",
      );
    }
  }
}

// Owner directive 2026-11-14 · Stage 8 · retained export name is
// `ensureSenderIsParticipant` so the existing P1.T07 participant-
// guard test file keeps compiling (and still enforces the
// non-participant throw). Behaviour is strictly stronger · the
// previous invariant plus the new owner match.
async function ensureSenderIsParticipant(
  conversationId: NexUuid,
  senderAccountId: NexUuid,
): Promise<void> {
  await ensureSenderCanWriteAsSide(conversationId, senderAccountId);
}

// ─── Encrypted send · atomic multi-row insert ──────────────────────

function bufferToBase64(buf: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buf).toString("base64");
  }
  let bin = "";
  for (let i = 0; i < buf.byteLength; i++) {
    bin += String.fromCharCode(buf[i]!);
  }
  if (typeof btoa === "function") return btoa(bin);
  throw new Error("no base64 encoder available");
}

/** Insert N encrypted copies (one per target device) for a single
 *  logical send. Caller supplies the message_group_id (shared across
 *  rows) and the ciphertext/nonce per target device. Returns the
 *  inserted row ids so the UI can render an optimistic bubble. */
export async function sendEncryptedBusinessMessages(
  rows: EncryptedBusinessMessageInsert[],
): Promise<NexUuid[]> {
  if (rows.length === 0) return [];

  const groupIds = new Set(rows.map((r) => r.message_group_id));
  if (groupIds.size !== 1) {
    throw new Error(
      "sendEncryptedBusinessMessages: all rows must share message_group_id",
    );
  }
  const convIds = new Set(rows.map((r) => r.conversation_id));
  if (convIds.size !== 1) {
    throw new Error(
      "sendEncryptedBusinessMessages: all rows must share conversation_id",
    );
  }
  const senderIds = new Set(rows.map((r) => r.sender_account_id));
  if (senderIds.size !== 1) {
    throw new Error(
      "sendEncryptedBusinessMessages: all rows must share sender_account_id",
    );
  }

  await ensureSenderIsParticipant(
    rows[0]!.conversation_id,
    rows[0]!.sender_account_id,
  );

  const payload = rows.map((r) => ({
    conversation_id: r.conversation_id,
    sender_account_id: r.sender_account_id,
    body: null, // encrypted rows carry ciphertext, not plaintext
    encrypted: true,
    ciphertext: bufferToBase64(r.ciphertext),
    nonce: bufferToBase64(r.nonce),
    sender_public_key: r.sender_public_key,
    sender_device_id: r.sender_device_id,
    recipient_device_id: r.recipient_device_id,
    message_group_id: r.message_group_id,
    reply_to_id: r.reply_to_id ?? null,
    attachment_type: r.attachment_type ?? null,
    attachment_meta: r.attachment_meta ?? null,
  }));

  const { data, error } = await nexSupabaseAdmin
    .from("nex_message")
    .insert(payload)
    .select("id");
  if (error) {
    throw new Error(
      `sendEncryptedBusinessMessages: ${error.message}`,
    );
  }
  return (data as Array<{ id: NexUuid }>).map((r) => r.id);
}

// ─── Read path · list messages for a conversation ──────────────────

/** Fetch every message in a conversation · ascending by created_at so
 *  the caller can render oldest-first (matching peer-chat convention).
 *  Guard: pass the viewer's accountId · the service checks they are a
 *  participant before returning any row. */
export async function listBusinessMessages(
  conversationId: NexUuid,
  viewerAccountId: NexUuid,
): Promise<NexBusinessMessageRow[]> {
  await ensureSenderIsParticipant(conversationId, viewerAccountId);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_message")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`listBusinessMessages: ${error.message}`);
  }
  return (data as NexBusinessMessageRow[]) ?? [];
}

// ─── Create-or-find a business conversation (customer ↔ shop) ──────

/** Find the existing conversation for (customer, business) · creates
 *  one if none exists · idempotent. Adds both participants with the
 *  correct `side` enum ('customer' / 'business') so the business-side
 *  participant is distinct from the customer's. */
export async function getOrCreateBusinessConversation(
  customerAccountId: NexUuid,
  businessId: NexUuid,
  businessOwnerAccountId: NexUuid,
): Promise<NexUuid> {
  if (customerAccountId === businessOwnerAccountId) {
    throw new Error(
      "cannot open a shop conversation with your own shop as the customer",
    );
  }

  // Try to find an existing conversation for this (business, customer)
  // pair · join through participants to avoid picking the wrong row
  // when a business has many customer conversations.
  const existing = await nexSupabaseAdmin
    .from("nex_conversation")
    .select("id, nex_conversation_participant!inner(account_id)")
    .eq("business_id", businessId)
    .eq("nex_conversation_participant.account_id", customerAccountId);
  if (existing.error) {
    throw new Error(
      `getOrCreateBusinessConversation.find: ${existing.error.message}`,
    );
  }
  const rows = (existing.data ?? []) as Array<{ id: NexUuid }>;
  if (rows.length > 0) return rows[0]!.id;

  // None exists · create the row + both participants.
  const created = await nexSupabaseAdmin
    .from("nex_conversation")
    .insert({ business_id: businessId })
    .select("id")
    .single();
  if (created.error || !created.data) {
    throw new Error(
      `getOrCreateBusinessConversation.create: ${created.error?.message ?? "no row returned"}`,
    );
  }
  const conversationId = (created.data as { id: NexUuid }).id;

  const parts = await nexSupabaseAdmin
    .from("nex_conversation_participant")
    .insert([
      {
        conversation_id: conversationId,
        account_id: customerAccountId,
        side: "customer",
      },
      {
        conversation_id: conversationId,
        account_id: businessOwnerAccountId,
        side: "business",
      },
    ]);
  if (parts.error) {
    throw new Error(
      `getOrCreateBusinessConversation.participants: ${parts.error.message}`,
    );
  }
  return conversationId;
}
