// src/lib/nex-native/message/send-message-service.ts
//
// Phase 2 Sprint 7+8 (DRAFT · not applied) · unified message-send service.
//
// Single API the UI layer calls to send a message. Handles:
//   · Peer-to-peer private chat (user-to-user)
//   · Business chat (buyer-to-seller · sealed I-3 · same E2E path)
//   · NEX Official system messages (platform-to-user)
//   · HQ Direct Channel (admin-to-user)
//
// All four flows follow the SAME contract (sealed I-3):
//   1. Resolve recipient's active device public keys (Sprint 1 registry)
//   2. For each recipient device, encrypt the plaintext to its key
//      (Sprint 4 crypto)
//   3. Deliver via WebRTC data channel (Sprint 3 webrtc)
//   4. If recipient has zero active devices · delivery DEFERS until
//      device registration (I-2 compliant · no server queue · just a
//      "pending-recipient-registration" status returned to the UI)
//
// NEX servers never see plaintext or ciphertext. This is the engineering
// expression of the sealed launch claim.
//
// This is a CLIENT-side service. The sender's device holds the per-message
// ephemeral private key briefly (destroyed after encrypt). The recipient's
// device holds its own persistent private key in IndexedDB.

"use client";

import { encryptForRecipient } from "../crypto/encrypt-message";
import { fromBase64Url } from "../crypto/encrypt-message";

export type MessageKind =
  | "peer_chat"
  | "business_chat"
  | "nex_official"
  | "hq_direct_channel";

export interface RecipientDevicePublicKey {
  device_id: string;
  public_key_base64: string;
  key_algorithm: "ECDSA-P256" | "Ed25519" | "ECDH-P256";
}

export interface SendMessageInput {
  kind: MessageKind;
  conversation_id: string;
  sender_device_id: string;
  /** All active public keys for every recipient device. Empty = defer. */
  recipient_devices: RecipientDevicePublicKey[];
  plaintext_utf8: string;
  attachment_ids?: string[];
  /** Epoch ms · caller stamps · receiver trusts via AAD binding. */
  sent_at: number;
}

export type SendMessageResult =
  | {
      ok: true;
      message_id: string;
      delivered_to_device_ids: string[];
      envelopes: PerDeviceEnvelope[];
    }
  | {
      ok: false;
      error:
        | "no_active_recipient_device"
        | "unsupported_key_algorithm"
        | "encrypt_failed"
        | "invalid_input";
      detail?: string;
    };

export interface PerDeviceEnvelope {
  recipient_device_id: string;
  envelope: Awaited<ReturnType<typeof encryptForRecipient>>;
}

/** Generate a message id · per-send uuid v4-ish via crypto.randomUUID. */
function newMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback · timestamp + random (non-colliding for single-user context)
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  if (!input.plaintext_utf8 || typeof input.plaintext_utf8 !== "string") {
    return { ok: false, error: "invalid_input", detail: "plaintext_utf8 required" };
  }
  if (!input.recipient_devices || input.recipient_devices.length === 0) {
    return {
      ok: false,
      error: "no_active_recipient_device",
      detail: "I-2 compliant deferral · recipient has no registered device",
    };
  }
  // Only ECDH-P256 keys support our encrypt-to-recipient path. ECDSA keys
  // are for signing identity · not key agreement.
  const supported = input.recipient_devices.filter(
    (d) => d.key_algorithm === "ECDH-P256",
  );
  if (supported.length === 0) {
    return {
      ok: false,
      error: "unsupported_key_algorithm",
      detail: "no ECDH-P256 keys among recipient devices · cannot derive AES key",
    };
  }

  const message_id = newMessageId();
  const plaintext = new TextEncoder().encode(input.plaintext_utf8);
  const aad = new TextEncoder().encode(
    JSON.stringify({
      message_id,
      kind: input.kind,
      conversation_id: input.conversation_id,
      sent_at: input.sent_at,
      attachment_ids: input.attachment_ids ?? [],
    }),
  );

  const envelopes: PerDeviceEnvelope[] = [];
  for (const device of supported) {
    let publicKeyRaw: Uint8Array;
    try {
      publicKeyRaw = fromBase64Url(device.public_key_base64);
    } catch (e) {
      return {
        ok: false,
        error: "encrypt_failed",
        detail: `invalid public_key_base64 for device ${device.device_id}`,
      };
    }
    if (publicKeyRaw.length !== 65) {
      return {
        ok: false,
        error: "encrypt_failed",
        detail: `public key for device ${device.device_id} is ${publicKeyRaw.length} bytes · expected 65`,
      };
    }
    try {
      const envelope = await encryptForRecipient({
        recipientPublicKeyRaw: publicKeyRaw,
        plaintext,
        additionalAuthenticatedData: aad,
        info: {
          senderDeviceId: input.sender_device_id,
          recipientDeviceId: device.device_id,
        },
      });
      envelopes.push({ recipient_device_id: device.device_id, envelope });
    } catch (e) {
      return {
        ok: false,
        error: "encrypt_failed",
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  }

  return {
    ok: true,
    message_id,
    delivered_to_device_ids: envelopes.map((e) => e.recipient_device_id),
    envelopes,
  };
}
