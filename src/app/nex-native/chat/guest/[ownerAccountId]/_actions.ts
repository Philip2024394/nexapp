// src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts
//
// Server actions for the guest-chat surface. Only accepts provisional
// sessions. Each action performs an authorization check against the
// resolved conversation participants BEFORE touching the DB.

"use server";

import { resolveNexAppOrProvisionalSession } from "@/lib/nex-native/first-conversation/provisional-session";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import { recordIfAllowed } from "@/lib/nex-native/community/rate-limit";
import { NexCommunityRateLimitError } from "@/lib/nex-native/community/types";
import {
  PlaintextFrozenError,
  sendPeerMessage,
} from "@/lib/nex-native/peer-message-service";
import { revalidatePath } from "next/cache";

export interface SendGuestMessageResult {
  ok: boolean;
  reason?:
    | "unauthenticated"
    | "not_participant"
    | "empty"
    | "too_long"
    | "rate_limited"
    | "db_error"
    // P3 remediation · 2026-11-23 · guest plaintext insert is now
    // routed through sendPeerMessage, which refuses when the sealed
    // NEX_CHAT_PLAINTEXT_FREEZE guard is active (default ON). The
    // guest-chat surface renders this as a clear "guest chat not
    // available · please sign in" banner · it never silently
    // persists plaintext.
    | "plaintext_frozen";
  message_id?: string;
  /** When the rate-limit kicks in, the service-layer error carries the
   *  configured window/cap · surfaced here so an honest "try again in
   *  N minutes" message can be rendered without the client having to
   *  know the config. */
  rate_limited_window_minutes?: number;
  rate_limited_max_per_window?: number;
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
 *
 * Stage 1.1 (2026-10-14) · wrapped with the sealed community rate-
 * limit primitive keyed on the provisional nex_account.id and action
 * `peer_message_guest`. Closes design-contract gap G1 across every
 * guest-chat caller (not just NEX1). The sealed §7A fingerprint re-
 * check (gap G2) is NOT applied here · it would require extending the
 * action signature to carry the five fingerprint signals and is
 * deferred to a separate design pass.
 *
 * Fail-open behaviour on primitive failure (not rate-limit): until
 * migration 197 is applied, calling the primitive with action
 * 'peer_message_guest' violates the sealed CHECK and throws. The
 * action catches that error, logs a warning, and ALLOWS the message
 * through. This preserves the current behaviour exactly (no rate
 * limit today) during the deploy window where code has shipped but
 * migration has not. Once migration 197 applies, the limit becomes
 * a hard enforcement.
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

  // Stage 1.1 · frequency rate limit (design-contract G1 fix).
  // Uses the sealed community rate-limit primitive on the provisional
  // nex_account.id. Hard enforcement once migration 197 is applied.
  // Known limitation (sealed in community/rate-limit.ts): "not atomic
  // in the strict sense — two concurrent calls at a cold bucket could
  // both pass." Acceptable for the current guest-chat volume; the
  // adversarial burst test for this PR characterises the overshoot
  // and the design contract §4.1.1 flags the atomic-enforcement
  // conditions.
  try {
    await recordIfAllowed(guestAccount.id, "peer_message_guest");
  } catch (err) {
    if (err instanceof NexCommunityRateLimitError) {
      return {
        ok: false,
        reason: "rate_limited",
        rate_limited_window_minutes: err.windowMinutes,
        rate_limited_max_per_window: err.maxPerWindow,
      };
    }
    // Fail-open on any other error · including the pre-migration-197
    // CHECK violation. The limit becomes effective only once the
    // migration is applied. Current no-rate-limit behaviour is
    // preserved during the deploy window.
    console.warn(
      "[guest-chat] rate-limit primitive failed · falling through (soft limit until migration 197 applies)",
      err instanceof Error ? err.message : err,
    );
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

  // P3 remediation · 2026-11-23 · owner-authorised. Previously this
  // action performed a direct `nex_peer_message.insert({ body, ... })`
  // which bypassed the Prompt-7 freeze guard entirely · plaintext
  // guest messages were persisted on the server unconditionally.
  //
  // Route through `sendPeerMessage` so the sealed freeze policy is
  // enforced at a single choke point. Under the fail-closed default
  // (`NEX_CHAT_PLAINTEXT_FREEZE` unset), `sendPeerMessage` throws
  // `PlaintextFrozenError` BEFORE any DB write, and we surface a
  // typed reason so the surface shows a clear error instead of a
  // silent success.
  //
  // `sendPeerMessage` also re-fetches the conversation and re-runs
  // the participant check, which strictly subsumes the belt-and-
  // braces check above. The old `encrypted: false`, `reactions: {}`,
  // and `reactions_order: []` fields have DB defaults so they no
  // longer need to be set at insert time.
  try {
    const row = await sendPeerMessage({
      conversation_id: conversation.id,
      sender_account_id: guestAccount.id,
      body: trimmed,
    });
    // Nudge RSC to re-fetch the message list.
    revalidatePath(`/nex-native/chat/guest/${ownerAccountId}`);
    return { ok: true, message_id: row.id };
  } catch (err) {
    if (err instanceof PlaintextFrozenError) {
      return { ok: false, reason: "plaintext_frozen" };
    }
    return { ok: false, reason: "db_error" };
  }
}
