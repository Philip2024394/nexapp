// src/lib/nex-native/crypto/encrypted-business-send.ts
//
// Owner-sealed 2026-11-13 · client-side encrypt + POST helper for the
// business-scoped shop chat.
// -----------------------------------------------------------------------------
// Companion to encrypted-send.ts (peer chat). Takes the same primitives
// (tweetnacl.box · X25519 ECDH + XSalsa20-Poly1305) and posts the
// per-recipient-device fan-out to /api/nex-native/chat/encrypted.
//
// Scope:
//   · One conversationId (nex_conversation, keyed by business_id)
//   · One plaintext (the body OR a product-card JSON · attachmentMeta
//     carries product_id / price / image_url when the message IS a
//     product share)
//   · Two participants (customer, business-owner account) · the
//     recipient list is the OTHER participant's device keys · we also
//     encrypt one copy for every ONE OF OUR OWN devices so later
//     sessions can read our sent history

"use client";

import naclUtil from "tweetnacl-util";
import {
  ensureDeviceKey,
  publicKeyBase64,
} from "./device-key";
import {
  generateNonce,
  getSharedSecret,
  sealWithSharedSecret,
} from "./shared-secret";
import { cachedListDeviceKeys } from "./device-key-cache";

export interface EncryptedBusinessSendOptions {
  conversationId: string;
  /** Business-side participant account id · the OWNER of the shop
   *  (resolved server-side on the shop chat page). */
  peerAccountId: string;
  selfAccountId: string;
  plaintext: string;
  replyToId?: string | null;
  attachmentType?:
    | "image"
    | "video"
    | "audio"
    | "document"
    | "product"
    | null;
  attachmentMeta?: unknown;
}

export interface EncryptedBusinessSendResult {
  ok: true;
  messageGroupId: string;
  insertedIds: string[];
}

export interface EncryptedBusinessSendFailure {
  ok: false;
  error:
    | "no_peer_devices"
    | "no_self_devices"
    | "encrypt_failed"
    | "http_failed"
    | "unknown";
  message?: string;
}

export type EncryptedBusinessSendOutcome =
  | EncryptedBusinessSendResult
  | EncryptedBusinessSendFailure;

/** Send ONE encrypted business message · fan-out across the peer's
 *  and self's devices. */
export async function sendEncryptedBusinessMessage(
  opts: EncryptedBusinessSendOptions,
): Promise<EncryptedBusinessSendOutcome> {
  // 1. Peer + self device lists.
  const [peerRes, selfRes] = await Promise.all([
    cachedListDeviceKeys(opts.peerAccountId),
    cachedListDeviceKeys(opts.selfAccountId),
  ]);
  if (!peerRes.ok) {
    return { ok: false, error: "unknown", message: peerRes.error };
  }
  if (!selfRes.ok) {
    return { ok: false, error: "unknown", message: selfRes.error };
  }
  if (peerRes.devices.length === 0) {
    return { ok: false, error: "no_peer_devices" };
  }
  if (selfRes.devices.length === 0) {
    return { ok: false, error: "no_self_devices" };
  }

  // 2. Our device keypair.
  const self = await ensureDeviceKey();
  const selfPubB64 = publicKeyBase64(self.publicKey);

  // 3. Group id + plaintext.
  const messageGroupId = crypto.randomUUID();
  const plaintextBytes = naclUtil.decodeUTF8(opts.plaintext);

  // 4. Encrypt for every target device (peer + self).
  type ApiRow = {
    conversation_id: string;
    ciphertext_b64: string;
    nonce_b64: string;
    sender_public_key: string;
    sender_device_id: string;
    recipient_device_id: string;
    reply_to_id: string | null;
    attachment_type:
      | "image"
      | "video"
      | "audio"
      | "document"
      | "product"
      | null;
    attachment_meta: unknown;
  };
  const rows: ApiRow[] = [];
  const targets = [
    ...peerRes.devices.map((d) => ({ ...d, accountId: opts.peerAccountId })),
    ...selfRes.devices.map((d) => ({ ...d, accountId: opts.selfAccountId })),
  ];
  try {
    for (const t of targets) {
      const secret = getSharedSecret(
        self.secretKey,
        t.accountId,
        t.device_id,
        t.public_key,
      );
      const nonce = generateNonce();
      const ct = sealWithSharedSecret(plaintextBytes, nonce, secret);
      rows.push({
        conversation_id: opts.conversationId,
        ciphertext_b64: naclUtil.encodeBase64(ct),
        nonce_b64: naclUtil.encodeBase64(nonce),
        sender_public_key: selfPubB64,
        sender_device_id: self.deviceId,
        recipient_device_id: t.device_id,
        reply_to_id: opts.replyToId ?? null,
        attachment_type: opts.attachmentType ?? null,
        attachment_meta: opts.attachmentMeta ?? null,
      });
    }
  } catch (e) {
    return {
      ok: false,
      error: "encrypt_failed",
      message: (e as Error).message,
    };
  }

  // 5. POST.
  try {
    const resp = await fetch("/api/nex-native/chat/encrypted", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message_group_id: messageGroupId, rows }),
    });
    if (!resp.ok) {
      return {
        ok: false,
        error: "http_failed",
        message: `${resp.status} ${resp.statusText}`,
      };
    }
    const json = (await resp.json()) as {
      ok: boolean;
      ids?: string[];
      error?: string;
    };
    if (!json.ok) {
      return { ok: false, error: "http_failed", message: json.error };
    }
    return {
      ok: true,
      messageGroupId,
      insertedIds: json.ids ?? [],
    };
  } catch (e) {
    return {
      ok: false,
      error: "http_failed",
      message: (e as Error).message,
    };
  }
}
