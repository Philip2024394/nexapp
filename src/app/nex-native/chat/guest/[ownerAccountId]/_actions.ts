// src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts
//
// Server actions for the guest-chat surface. Only accepts provisional
// sessions. Each action performs an authorization check against the
// resolved conversation participants BEFORE touching the DB.

"use server";

import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { resolveNexAppOrProvisionalSession } from "@/lib/nex-native/first-conversation/provisional-session";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

export interface SendGuestMessageResult {
  ok: boolean;
  reason?: "unauthenticated" | "not_participant" | "empty" | "too_long" | "db_error";
  message_id?: string;
}

const MAX_GUEST_MESSAGE_LENGTH = 2000;

/**
 * Send a plaintext follow-up message from a guest to the business.
 *
 * Why plaintext · guests don't yet have the device-key chain to
 * participate in sealed E2E encryption. The owner's side of the
 * authenticated chat renders plaintext bodies just fine (same column
 * the welcome-delivery module uses). When the guest signs up, their
 * provisional account is linked and future messages gain encryption.
 */
export async function sendGuestMessageAction(
  ownerAccountId: string,
  text: string,
): Promise<SendGuestMessageResult> {
  const resolved = await resolveNexAppOrProvisionalSession();
  if (resolved.kind !== "provisional") {
    return { ok: false, reason: "unauthenticated" };
  }
  const guestAccount = resolved.account;

  const trimmed = (text ?? "").trim();
  if (trimmed.length === 0) return { ok: false, reason: "empty" };
  if (trimmed.length > MAX_GUEST_MESSAGE_LENGTH) {
    return { ok: false, reason: "too_long" };
  }

  // Resolve conversation idempotently.
  const conversation = await peerConversationService
    .getOrCreatePeerConversation(guestAccount.id, ownerAccountId)
    .catch(() => null);
  if (!conversation) return { ok: false, reason: "db_error" };

  // Belt-and-braces · verify guest is really a participant.
  const isParticipant =
    conversation.participant_a_id === guestAccount.id ||
    conversation.participant_b_id === guestAccount.id;
  if (!isParticipant) return { ok: false, reason: "not_participant" };

  // Insert plaintext message · encrypted=false means `body` carries
  // the content (nex_peer_message.body is NOT NULL · we fulfil it).
  const messageId = randomUUID();
  const { error } = await nexSupabaseAdmin.from("nex_peer_message").insert({
    id: messageId,
    conversation_id: conversation.id,
    sender_account_id: guestAccount.id,
    body: trimmed,
    encrypted: false,
    sent_at: new Date().toISOString(),
    reactions: {},
    reactions_order: [],
    deleted_for_everyone: false,
  });
  if (error) return { ok: false, reason: "db_error" };

  // Nudge RSC to re-fetch the message list.
  revalidatePath(`/nex-native/chat/guest/${ownerAccountId}`);

  return { ok: true, message_id: messageId };
}
