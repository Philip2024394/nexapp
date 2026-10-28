// src/lib/nex-native/emergency/_crypto.ts
//
// NEX Emergency Help · AES-256-GCM envelope encryption.
// Owner-authorised 2026-10-25 (sealed Decision #7).
//
// Envelope encryption pattern:
//   1. KMS generates a fresh 32-byte DATA KEY per encryption call.
//   2. We encrypt the plaintext PII with the data key using AES-256-GCM
//      (authenticated encryption · 96-bit IV · 128-bit auth tag).
//   3. We write the ciphertext + the KMS-wrapped data key together
//      (prepended · fixed-length layout) so a decryption only needs
//      the KMS to unwrap · never a database key lookup.
//   4. The plaintext data key is zeroised + dropped immediately
//      after use.
//
// Serialised ciphertext layout (one Uint8Array):
//
//   [ 1 byte  version=0x01 ]
//   [ 2 bytes BE  master_key_version ]
//   [ 2 bytes BE  wrapped_key_length ]
//   [ wrapped_key_length bytes  wrapped data key ]
//   [ 12 bytes IV ]
//   [ 16 bytes auth tag ]
//   [ ...     ciphertext bytes ... ]
//
// This layout is self-describing (version byte + lengths) so a future
// migration can add a v2 shape without breaking v1 rows.
//
// Honest-copy: nothing in this module decides when encryption is live.
// The `profileEncryptionLive` feature flag + the server-side `encrypt`
// / `decrypt` call sites govern that. This module just provides the
// correct primitives.

import type { KmsAdapter } from "./_kms";

export const EMERGENCY_CRYPTO_VERSION = 0x01;

function u16be(n: number): [number, number] {
  if (n < 0 || n > 0xffff) throw new RangeError("u16be out of range");
  return [(n >>> 8) & 0xff, n & 0xff];
}

function readU16be(buf: Uint8Array, offset: number): number {
  return ((buf[offset] & 0xff) << 8) | (buf[offset + 1] & 0xff);
}

/** Encrypt `plaintext` under a fresh KMS-wrapped data key.
 *  Returns the serialised envelope-encrypted bytes (one blob) ready
 *  to insert into a `bytea` column. */
export async function encryptEmergencyField(
  plaintext: Uint8Array,
  kms: KmsAdapter,
): Promise<Uint8Array> {
  const crypto = await import("node:crypto");
  const { plaintext: dataKey, ciphertext: wrappedKey, masterKeyVersion } =
    await kms.generateDataKey();

  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      Buffer.from(dataKey),
      iv,
    );
    const ct = Buffer.concat([
      cipher.update(Buffer.from(plaintext)),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag(); // 16 bytes

    const [mkvHi, mkvLo] = u16be(masterKeyVersion);
    const [wklHi, wklLo] = u16be(wrappedKey.length);

    const header = Buffer.from([
      EMERGENCY_CRYPTO_VERSION,
      mkvHi,
      mkvLo,
      wklHi,
      wklLo,
    ]);
    return new Uint8Array(
      Buffer.concat([header, Buffer.from(wrappedKey), iv, tag, ct]),
    );
  } finally {
    // Zeroise the plaintext data key. Note that Uint8Array over
    // dataKey means fill mutates the backing buffer the KMS handed us.
    dataKey.fill(0);
  }
}

/** Decrypt an envelope-encrypted blob produced by `encryptEmergencyField`.
 *  Throws on any integrity error · never returns partial / unverified
 *  bytes. */
export async function decryptEmergencyField(
  envelope: Uint8Array,
  kms: KmsAdapter,
): Promise<Uint8Array> {
  const crypto = await import("node:crypto");
  if (envelope.length < 1 + 2 + 2 + 1 + 12 + 16 + 0) {
    throw new Error("emergency crypto: envelope too short");
  }

  const version = envelope[0];
  if (version !== EMERGENCY_CRYPTO_VERSION) {
    throw new Error(
      `emergency crypto: unsupported version 0x${version.toString(16)}`,
    );
  }

  let offset = 1;
  const masterKeyVersion = readU16be(envelope, offset);
  offset += 2;
  const wrappedKeyLength = readU16be(envelope, offset);
  offset += 2;

  const wrappedKey = envelope.subarray(offset, offset + wrappedKeyLength);
  offset += wrappedKeyLength;
  const iv = envelope.subarray(offset, offset + 12);
  offset += 12;
  const tag = envelope.subarray(offset, offset + 16);
  offset += 16;
  const ct = envelope.subarray(offset);

  // Unwrap the data key via KMS · may throw if master-key version is
  // retired · ADR: no fallback. Dead row = dead row.
  const dataKey = await kms.unwrapDataKey(wrappedKey, masterKeyVersion);

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(dataKey),
      Buffer.from(iv),
    );
    decipher.setAuthTag(Buffer.from(tag));
    const pt = Buffer.concat([
      decipher.update(Buffer.from(ct)),
      decipher.final(),
    ]);
    return new Uint8Array(pt);
  } finally {
    dataKey.fill(0);
  }
}

/** Convenience · encrypt a string via UTF-8 → bytes → envelope. */
export async function encryptEmergencyString(
  plaintext: string,
  kms: KmsAdapter,
): Promise<Uint8Array> {
  return encryptEmergencyField(
    new TextEncoder().encode(plaintext),
    kms,
  );
}

/** Convenience · decrypt an envelope → bytes → UTF-8 string. */
export async function decryptEmergencyString(
  envelope: Uint8Array,
  kms: KmsAdapter,
): Promise<string> {
  const bytes = await decryptEmergencyField(envelope, kms);
  return new TextDecoder().decode(bytes);
}

/** Read the master-key version from an envelope without decrypting.
 *  Useful for rotation jobs. */
export function readEnvelopeMasterKeyVersion(envelope: Uint8Array): number {
  if (envelope.length < 3 || envelope[0] !== EMERGENCY_CRYPTO_VERSION) {
    throw new Error("emergency crypto: cannot read master-key version");
  }
  return readU16be(envelope, 1);
}
