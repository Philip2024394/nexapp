// src/lib/nex-native/location/recipient-authorisation.ts
//
// NEX Location Sharing · Phase 1A · recipient authorisation gate.
// Owner-authorised 2026-11-05.
// -----------------------------------------------------------------------------
// Addresses owner condition 3 ("verify the existing conversation-
// participant and device-key authorisation paths · do not assume that a
// public key or a UUID grants access").
//
// Before any encryption happens, we verify that the SENDER is a
// participant in a `nex_peer_conversation` with the intended recipient
// via a NEW server action that gates key fetch on conversation membership.
// The existing `listAccountDeviceKeysAction` is intentionally open
// (device keys are public) · we add a separate gated endpoint for the
// location flow so an attacker who learns a target account id cannot
// use that fact alone to receive their encrypted location.
//
// This module is the CLIENT wrapper · the server action lives in
// src/app/nex-native/chat-9001/[accountId]/_location-actions.ts and is
// imported from here.

"use client";

export interface AuthorisedRecipientDevice {
  readonly device_id: string;
  readonly public_key_b64: string;
}

export type AuthoriseRecipientResult =
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

/** The server-action contract · imported from a page-scoped action file
 *  (see src/app/nex-native/chat-9001/[accountId]/_location-actions.ts).
 *  This re-export exists purely to give the authorisation wrapper a
 *  stable module location that tests can mock. */
export type AuthoriseFn = (
  peerAccountId: string,
) => Promise<AuthoriseRecipientResult>;

/** Thin client wrapper · calls the server action and performs the
 *  well-formed-shape validation. Callers should NOT bypass this helper. */
export async function authoriseLocationRecipient(
  peerAccountId: string,
  action: AuthoriseFn,
): Promise<AuthoriseRecipientResult> {
  if (typeof peerAccountId !== "string" || peerAccountId.length < 8) {
    return { ok: false, reason: "unknown", message: "invalid_peer_id" };
  }
  try {
    const result = await action(peerAccountId);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: "unknown", message: msg };
  }
}
