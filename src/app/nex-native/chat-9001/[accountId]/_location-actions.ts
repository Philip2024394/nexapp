"use server";

// src/app/nex-native/chat-9001/[accountId]/_location-actions.ts
//
// NEX Location Sharing · Phase 1A · page-scoped server actions.
// Owner-authorised 2026-11-05.
// -----------------------------------------------------------------------------
// Server-side authorisation gate for location encryption. The existing
// listAccountDeviceKeysAction is intentionally open (public keys are
// public by design), so we add a SEPARATE gated endpoint for location
// that requires conversation-participation BEFORE returning any key.
// This ensures that knowing someone's account id does NOT grant a
// path to receive their encrypted location.

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { findPeerConversation } from "@/lib/nex-native/peer-conversation-service";
import * as deviceKeyService from "@/lib/nex-native/device-key-service";

export interface AuthorisedRecipientDevice {
  readonly device_id: string;
  readonly public_key_b64: string;
}

export type AuthoriseLocationResult =
  | {
      readonly ok: true;
      readonly conversation_id: string;
      readonly peer_devices: ReadonlyArray<AuthorisedRecipientDevice>;
      readonly self_devices: ReadonlyArray<AuthorisedRecipientDevice>;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "not_signed_in"
        | "no_conversation"
        | "not_participant"
        | "no_recipient_devices"
        | "unknown";
      readonly message?: string;
    };

/** Verify that the caller is in a nex_peer_conversation with the peer
 *  and return BOTH parties' public device keys. The caller uses the
 *  peer keys to encrypt the location payload per-device and the self
 *  keys to encrypt a copy for the caller's other devices (outbox
 *  display across sender's own devices is deferred to v1B). */
export async function authoriseLocationRecipientAction(
  peerAccountId: string,
): Promise<AuthoriseLocationResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return { ok: false, reason: "not_signed_in" };
  }
  if (typeof peerAccountId !== "string" || peerAccountId.length < 8) {
    return { ok: false, reason: "unknown", message: "invalid_peer_id" };
  }

  const selfId = session.account.id;
  if (peerAccountId === selfId) {
    return { ok: false, reason: "not_participant", message: "self_target" };
  }

  // Gate 1 · conversation must exist
  const conv = await findPeerConversation(selfId, peerAccountId);
  if (!conv) {
    return { ok: false, reason: "no_conversation" };
  }

  // Gate 2 · caller must be a participant (sanity · findPeerConversation
  // returns only where the pair matches so this is defence-in-depth)
  if (
    conv.participant_a_id !== selfId &&
    conv.participant_b_id !== selfId
  ) {
    return { ok: false, reason: "not_participant" };
  }

  // Gate 3 · fetch recipient's public device keys. Only AFTER
  // participation passes do we expose any key.
  const peerDeviceRows = await deviceKeyService.listDeviceKeys(peerAccountId);
  if (!peerDeviceRows || peerDeviceRows.length === 0) {
    return { ok: false, reason: "no_recipient_devices" };
  }

  const selfDeviceRows = await deviceKeyService.listDeviceKeys(selfId);

  return {
    ok: true,
    conversation_id: conv.id,
    peer_devices: peerDeviceRows.map((r) => ({
      device_id: r.device_id,
      public_key_b64: r.public_key,
    })),
    self_devices: selfDeviceRows.map((r) => ({
      device_id: r.device_id,
      public_key_b64: r.public_key,
    })),
  };
}
