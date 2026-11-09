// src/lib/nex-native/device/key-generation-client.ts
//
// Phase 2 Sprint 1 · CLIENT-SIDE key generation. Browser-only helper.
//
// Produces a device key pair using WebCrypto. The PRIVATE key never leaves
// the device · callers persist it in IndexedDB (preferably via a non-
// extractable CryptoKey where supported) and publish only the PUBLIC key
// to NEX via `/api/nex-native/device/register`.
//
// Sealed architecture context:
//   · I-1 · No private material on NEX servers. This helper only ever
//     EXPORTS the public key for transmission.
//
// Future sprints extend this file with ECDH-P256 for peer-to-peer envelope
// encryption (Sprint 4). ECDSA-P256 is Sprint 1 · produces a signing key
// that doubles as a stable identity key published in `nex_device.public_key`.

"use client";

export type DeviceKeyAlgorithm = "ECDSA-P256" | "Ed25519" | "ECDH-P256";

export interface GeneratedDeviceKeyPair {
  /** Base64-encoded raw public key · suitable for `nex_device.public_key`. */
  publicKeyBase64: string;
  /** CryptoKey handle for the private half · retain client-side only. */
  privateKey: CryptoKey;
  /** The algorithm the pair was generated for. */
  algorithm: DeviceKeyAlgorithm;
}

/**
 * Generate an ECDSA P-256 signing key pair. The private half is returned as
 * a CryptoKey the caller can persist in IndexedDB (via structured-clone) or
 * discard · the public half is returned as a base64 string ready for
 * publication to the NEX device registry.
 *
 * Uses `extractable=true` because current browsers require extractability
 * to persist a CryptoKey into IndexedDB via structured clone. Future
 * sprints will tighten this to non-extractable where platform support
 * allows.
 */
export async function generateDeviceKeyPair(): Promise<GeneratedDeviceKeyPair> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("WebCrypto subtle not available · cannot generate device key pair");
  }
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const raw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const publicKeyBase64 = encodeBase64(new Uint8Array(raw));
  return {
    publicKeyBase64,
    privateKey: keyPair.privateKey,
    algorithm: "ECDSA-P256",
  };
}

/**
 * Validate a candidate public key string before posting it to the register
 * endpoint. Mirrors the server-side format check so client-side UI can show
 * an error before a round-trip.
 */
export function isPublicKeyBase64Valid(pk: unknown): pk is string {
  if (typeof pk !== "string") return false;
  if (pk.length < 32 || pk.length > 2048) return false;
  return /^[A-Za-z0-9+/=_\-]+$/.test(pk);
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // btoa is defined in all modern browsers · module is "use client" so
  // the Node bundle never sees this code path.
  return btoa(binary);
}
