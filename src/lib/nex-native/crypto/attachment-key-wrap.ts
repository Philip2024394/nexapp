// src/lib/nex-native/crypto/attachment-key-wrap.ts
//
// NEX device-key chat · per-recipient attachment-key wrap utility.
// Owner-authorised 2026-11-10 (independent component · does NOT
// depend on any of the six open decisions in
// device-key-chat-decisions-2026-11-10.md).
// -----------------------------------------------------------------
// Scope · low-level NaCl.box primitive for wrapping a fresh
// attachment symmetric key so a specific recipient device (and only
// that device) can unwrap it with its own secret key + the sender's
// public key.
//
// This is a thinner primitive than attachment-envelope.ts. Use this
// when you want to wrap ONE key for ONE recipient without pulling
// the per-conversation shared-secret cache or NexDeviceKey
// IndexedDB stack. Pure functions, no I/O, no cache.
//
// Algorithm:
//   wrap(key, senderSec, recipientPub) =>
//     nonce = randomBytes(24)
//     ct = nacl.box(key, nonce, recipientPub, senderSec)
//   unwrap(blob, recipientSec, senderPub) =>
//     nacl.box.open(blob.ct, blob.nonce, senderPub, recipientSec)
//
// Returns null on tamper / wrong key (consistent with the rest of
// the crypto surface). Never throws on crypto failure · callers get
// a honest boolean signal.

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

/** Length constants mirror NaCl. */
export const WRAP_NONCE_BYTES = nacl.box.nonceLength; // 24
export const ATTACHMENT_KEY_BYTES = nacl.secretbox.keyLength; // 32
export const WRAP_PUBLIC_KEY_BYTES = nacl.box.publicKeyLength; // 32
export const WRAP_SECRET_KEY_BYTES = nacl.box.secretKeyLength; // 32

/** Storage-friendly wrapped-key blob. Both fields are base64 so
 *  callers can store them directly in a DB column or JSON field. */
export interface WrappedAttachmentKeyBlob {
  nonce_b64: string;
  ciphertext_b64: string;
}

export interface WrapArgs {
  /** The 32-byte attachment symmetric key (from
   *  nacl.secretbox.keyLength / attachment-envelope.encryptFileBytes). */
  attachmentKey: Uint8Array;
  /** Recipient device's Curve25519 public key (32 bytes). */
  recipientPublicKey: Uint8Array;
  /** Sender device's Curve25519 secret key (32 bytes). Never leaves
   *  the sender device · caller is responsible for keeping it
   *  memory-only. */
  senderSecretKey: Uint8Array;
  /** Optional deterministic-nonce override. Normally the function
   *  generates a fresh nonce; pass this ONLY for deterministic
   *  round-trip tests. Reusing a nonce across wraps with the same
   *  (sender, recipient) pair IS a confidentiality break · callers
   *  outside tests MUST omit this. */
  nonceOverride?: Uint8Array;
}

export interface UnwrapArgs {
  blob: WrappedAttachmentKeyBlob;
  /** Sender device's Curve25519 public key (32 bytes). */
  senderPublicKey: Uint8Array;
  /** Recipient device's Curve25519 secret key (32 bytes). */
  recipientSecretKey: Uint8Array;
}

function assertLength(label: string, buf: Uint8Array, expected: number): void {
  if (buf.length !== expected) {
    throw new Error(
      `attachment-key-wrap.${label}: expected ${expected} bytes · got ${buf.length}`,
    );
  }
}

/** Wrap one attachment key for one recipient device. Returns a
 *  base64 blob ready for fan-out storage. */
export function wrapAttachmentKey(args: WrapArgs): WrappedAttachmentKeyBlob {
  assertLength("attachmentKey", args.attachmentKey, ATTACHMENT_KEY_BYTES);
  assertLength(
    "recipientPublicKey",
    args.recipientPublicKey,
    WRAP_PUBLIC_KEY_BYTES,
  );
  assertLength(
    "senderSecretKey",
    args.senderSecretKey,
    WRAP_SECRET_KEY_BYTES,
  );
  const nonce =
    args.nonceOverride ?? nacl.randomBytes(WRAP_NONCE_BYTES);
  assertLength("wrapNonce", nonce, WRAP_NONCE_BYTES);
  const ct = nacl.box(
    args.attachmentKey,
    nonce,
    args.recipientPublicKey,
    args.senderSecretKey,
  );
  return {
    nonce_b64: naclUtil.encodeBase64(nonce),
    ciphertext_b64: naclUtil.encodeBase64(ct),
  };
}

/** Unwrap a key blob with the recipient's secret + sender's public.
 *  Returns the original 32-byte attachment key or null on tamper /
 *  wrong-recipient-key / wrong-sender-key. Never throws on crypto
 *  failure (shape errors still throw). */
export function unwrapAttachmentKey(args: UnwrapArgs): Uint8Array | null {
  assertLength(
    "senderPublicKey",
    args.senderPublicKey,
    WRAP_PUBLIC_KEY_BYTES,
  );
  assertLength(
    "recipientSecretKey",
    args.recipientSecretKey,
    WRAP_SECRET_KEY_BYTES,
  );
  let nonce: Uint8Array;
  let ct: Uint8Array;
  try {
    nonce = naclUtil.decodeBase64(args.blob.nonce_b64);
    ct = naclUtil.decodeBase64(args.blob.ciphertext_b64);
  } catch {
    return null;
  }
  if (nonce.length !== WRAP_NONCE_BYTES) return null;
  const plain = nacl.box.open(
    ct,
    nonce,
    args.senderPublicKey,
    args.recipientSecretKey,
  );
  if (!plain) return null;
  if (plain.length !== ATTACHMENT_KEY_BYTES) return null;
  return plain;
}
