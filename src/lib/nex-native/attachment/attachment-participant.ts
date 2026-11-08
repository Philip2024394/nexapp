// src/lib/nex-native/attachment/attachment-participant.ts
//
// NEX Chat Attachment · participant-of-conversation gate for signed-
// URL generation. Owner-authorised 2026-11-08.
// -----------------------------------------------------------------------------
// Only a participant of the peer conversation that owns a ciphertext
// object may obtain a signed URL for that object. The participant
// check is server-side and uses the authenticated account id from
// resolveNexAppSession · NEVER a client-supplied identity.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";

/** Object-path shape · must match what the upload route writes.
 *  `enc/<sender_account_id>/<timestamp>-<rand6>.<ext>` */
const CIPHERTEXT_PATH_SHAPE =
  /^enc\/[0-9a-f-]{32,36}\/\d{10,16}-[a-z0-9]{6,12}\.[a-z0-9]{1,8}$/;

export function isValidCiphertextPath(path: string): boolean {
  return CIPHERTEXT_PATH_SHAPE.test(path);
}

/** Find the peer-message that references this storage_path in its
 *  attachment_meta envelope, and check whether the authenticated
 *  account is a participant of that message's conversation.
 *
 *  Returns:
 *    "participant"   · authorised · issue a signed URL
 *    "not-found"     · path doesn't match any known message
 *    "not-participant" · path is real but caller is not a participant
 *  Three distinct outcomes · the caller returns 404 for not-found and
 *  403 for not-participant · never leaks whether the path exists to a
 *  non-participant (both return 404 to the client). */
export type ParticipantCheck =
  | "participant"
  | "not-found"
  | "not-participant";

export async function verifyParticipantForCiphertext(
  accountId: string,
  storagePath: string,
): Promise<ParticipantCheck> {
  if (!isValidCiphertextPath(storagePath)) return "not-found";
  // Resolve the owning message. Two possible shapes:
  //   A · new uploads · envelope.storage_path is set on the message row
  //       (/api/nex-native/attachment/encrypted writes it there).
  //   B · legacy migrated uploads · envelope is sealed-immutable by the
  //       migration-054 trigger · we record (message_id, storage_path)
  //       in the append-only nex_peer_chat_envelope_overlay instead
  //       (migration 298).
  // We try A first (direct JSONB match) and fall back to B. Both paths
  // feed the same participant check.
  let conversationId: string | null = null;
  const direct = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("conversation_id")
    .filter("attachment_meta->envelope->>storage_path", "eq", storagePath)
    .limit(1)
    .maybeSingle();
  if (!direct.error && direct.data) {
    conversationId = (direct.data as { conversation_id: string }).conversation_id;
  } else {
    // Fallback · overlay lookup (migration 298)
    const overlay = await nexSupabaseAdmin
      .from("nex_peer_chat_envelope_overlay")
      .select("message_id")
      .eq("storage_path", storagePath)
      .limit(1)
      .maybeSingle();
    if (overlay.error || !overlay.data) return "not-found";
    const msgId = (overlay.data as { message_id: string }).message_id;
    const msg = await nexSupabaseAdmin
      .from("nex_peer_message")
      .select("conversation_id")
      .eq("id", msgId)
      .maybeSingle();
    if (msg.error || !msg.data) return "not-found";
    conversationId = (msg.data as { conversation_id: string }).conversation_id;
  }
  if (!conversationId) return "not-found";
  const conv = await nexSupabaseAdmin
    .from("nex_peer_conversation")
    .select("participant_a_id, participant_b_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (conv.error || !conv.data) return "not-found";
  const row = conv.data as { participant_a_id: string; participant_b_id: string };
  if (row.participant_a_id === accountId || row.participant_b_id === accountId) {
    return "participant";
  }
  return "not-participant";
}
