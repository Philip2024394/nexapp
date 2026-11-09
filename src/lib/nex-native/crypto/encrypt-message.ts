// src/lib/nex-native/crypto/encrypt-message.ts
//
// Phase 2 Sprint 4 (DRAFT · not applied) · encrypt-to-recipient.
//
// Construction · ECIES-like hybrid encryption:
//   1. Sender generates an EPHEMERAL ECDH P-256 key pair (one-shot).
//   2. Sender does ECDH with (ephemeral private × recipient persistent public).
//      Shared secret = ECDH output · 32 bytes.
//   3. HKDF-SHA-256 derives a 32-byte AES-GCM key from the shared secret
//      with the sender + recipient device IDs as `info` (binding).
//   4. AES-GCM-256 encrypts the plaintext with a fresh 12-byte IV. The
//      AES-GCM tag (16 bytes) is appended by the WebCrypto implementation.
//   5. Output envelope · base64url-encoded JSON:
//        {
//          v: 1,
//          epk: base64url(ephemeral_pub_raw),       // 65 bytes uncompressed
//          iv:  base64url(iv),                       //  12 bytes
//          ct:  base64url(ciphertext||gcmtag),       //  n+16 bytes
//          aad: base64url(aad) // optional additional authenticated data
//        }
//
// Sealed invariants served:
//   · I-1 · This module encrypts on the SENDER's device. NEX servers
//     never observe the ephemeral private key (it is discarded after
//     encryption) and never observe the plaintext. The receiver's
//     device holds the persistent private key and is the only party
//     that can decrypt.
//   · Forward secrecy per message · a compromised sender device cannot
//     decrypt historic messages (ephemeral key destroyed).
//
// Compatible with: WebCrypto in all modern browsers AND Node 18+ (via
// `node:crypto`'s `webcrypto.subtle`), so vitest can unit-test the
// round-trip without a browser.
//
// NOT in this file (deferred):
//   · Signalling-handshake specific framing (uses this primitive)
//   · Persistent recipient-device key fetch (Sprint 1 device-registry)
//   · Decryption (see decrypt-message.ts companion)

export interface EncryptMessageInput {
  /** Recipient device's persistent ECDH P-256 public key · raw 65 bytes. */
  recipientPublicKeyRaw: Uint8Array;
  /** Plaintext bytes to encrypt. Caller handles serialisation. */
  plaintext: Uint8Array;
  /** Additional authenticated data · bound into GCM tag · optional. */
  additionalAuthenticatedData?: Uint8Array;
  /** Senderand recipient device IDs · bound into HKDF info · optional. */
  info?: {
    senderDeviceId?: string;
    recipientDeviceId?: string;
  };
}

export interface EncryptedEnvelope {
  v: 1;
  epk: string;
  iv: string;
  ct: string;
  aad?: string;
}

const subtle = globalThis.crypto?.subtle;
if (!subtle) {
  // Deferred error · thrown on first call rather than at import time.
  // Keeps modules that import this file but don't use it (e.g. type-only
  // imports in Node before polyfill) from breaking.
}

export async function encryptForRecipient(
  input: EncryptMessageInput,
): Promise<EncryptedEnvelope> {
  if (!subtle) throw new Error("WebCrypto subtle unavailable");
  if (!(input.recipientPublicKeyRaw instanceof Uint8Array)) {
    throw new Error("recipientPublicKeyRaw must be Uint8Array");
  }
  if (input.recipientPublicKeyRaw.length !== 65) {
    throw new Error("recipientPublicKeyRaw must be 65 bytes (P-256 uncompressed)");
  }
  if (!(input.plaintext instanceof Uint8Array)) {
    throw new Error("plaintext must be Uint8Array");
  }

  // 1 · Import recipient's static public key.
  const recipientPub = await subtle.importKey(
    "raw",
    input.recipientPublicKeyRaw,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // 2 · Generate ephemeral sender key pair.
  const ephemeral = await subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );

  // 3 · ECDH · shared secret.
  const sharedSecretBits = await subtle.deriveBits(
    { name: "ECDH", public: recipientPub },
    ephemeral.privateKey,
    256,
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // 4 · HKDF-SHA-256 → AES key.
  const salt = new Uint8Array(32); // deterministic · info does the binding
  const info = buildHkdfInfo(input.info);
  const aesKey = await hkdfToAesKey(sharedSecret, salt, info);

  // 5 · AES-GCM encrypt.
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const aad = input.additionalAuthenticatedData ?? new Uint8Array();
  const ciphertextWithTag = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: aad,
      tagLength: 128,
    },
    aesKey,
    input.plaintext,
  );

  // 6 · Export ephemeral public key for the envelope.
  const ephemeralPubRaw = new Uint8Array(
    await subtle.exportKey("raw", ephemeral.publicKey),
  );

  const envelope: EncryptedEnvelope = {
    v: 1,
    epk: toBase64Url(ephemeralPubRaw),
    iv: toBase64Url(iv),
    ct: toBase64Url(new Uint8Array(ciphertextWithTag)),
  };
  if (aad.length > 0) envelope.aad = toBase64Url(aad);
  return envelope;
}

function buildHkdfInfo(info: EncryptMessageInput["info"]): Uint8Array {
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

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // Browser btoa · also present in Node 18+ globally.
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
