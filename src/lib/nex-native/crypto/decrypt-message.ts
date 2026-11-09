// src/lib/nex-native/crypto/decrypt-message.ts
//
// Phase 2 Sprint 4 (DRAFT · not applied) · decrypt-with-device-private-key.
//
// Mirror of encrypt-message.ts. Called on the RECEIVER's device with the
// device's persistent ECDH P-256 private key (from IndexedDB · never
// leaves the device · sealed I-1).
//
// Produces the plaintext bytes. Caller handles deserialisation + storage
// into the device-local history (see Sprint 5 chat/local-history-store).

import { fromBase64Url, type EncryptedEnvelope } from "./encrypt-message";

const subtle = globalThis.crypto?.subtle;

export interface DecryptMessageInput {
  /** Recipient device's PERSISTENT private ECDH P-256 CryptoKey. */
  recipientPrivateKey: CryptoKey;
  /** Received envelope from the data channel. */
  envelope: EncryptedEnvelope;
  /** Binding info used when the message was encrypted · must match. */
  info?: {
    senderDeviceId?: string;
    recipientDeviceId?: string;
  };
}

export async function decryptForRecipient(
  input: DecryptMessageInput,
): Promise<Uint8Array> {
  if (!subtle) throw new Error("WebCrypto subtle unavailable");
  if (!input.envelope || input.envelope.v !== 1) {
    throw new Error("Envelope version not supported");
  }

  // 1 · Import sender's ephemeral public key.
  const epkRaw = fromBase64Url(input.envelope.epk);
  if (epkRaw.length !== 65) throw new Error("Invalid ephemeral public key length");
  const senderEphemeralPub = await subtle.importKey(
    "raw",
    epkRaw,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // 2 · ECDH with recipient's static private × sender ephemeral public.
  const sharedBits = await subtle.deriveBits(
    { name: "ECDH", public: senderEphemeralPub },
    input.recipientPrivateKey,
    256,
  );
  const sharedSecret = new Uint8Array(sharedBits);

  // 3 · HKDF-SHA-256 → AES key (same parameters as encrypt).
  const salt = new Uint8Array(32);
  const info = buildHkdfInfo(input.info);
  const aesKey = await hkdfToAesKey(sharedSecret, salt, info);

  // 4 · AES-GCM decrypt.
  const iv = fromBase64Url(input.envelope.iv);
  const ct = fromBase64Url(input.envelope.ct);
  const aad = input.envelope.aad ? fromBase64Url(input.envelope.aad) : new Uint8Array();

  const plaintext = await subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: aad,
      tagLength: 128,
    },
    aesKey,
    ct,
  );

  return new Uint8Array(plaintext);
}

function buildHkdfInfo(info: DecryptMessageInput["info"]): Uint8Array {
  const parts: string[] = ["nex-chat-v1"];
  if (info?.senderDeviceId) parts.push(info.senderDeviceId);
  if (info?.recipientDeviceId) parts.push(info.recipientDeviceId);
  return new TextEncoder().encode(parts.join("|"));
}

async function hkdfToAesKey(
  sharedSecret: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
): Promise<CryptoKey> {
  const hkdfBase = await subtle!.importKey(
    "raw",
    sharedSecret,
    { name: "HKDF" },
    false,
    ["deriveKey"],
  );
  return subtle!.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info,
    },
    hkdfBase,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
