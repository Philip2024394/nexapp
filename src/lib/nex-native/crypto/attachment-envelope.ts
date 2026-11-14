// src/lib/nex-native/crypto/attachment-envelope.ts
//
// Bridge 81 · Envelope encryption for personal peer-chat attachments.
// -------------------------------------------------------------------
// Scope (per doctrine split sealed 2026-09-29 · amended same day):
//   · Personal media (attachment_type IN 'image', 'video', 'audio') →
//     use this module · encrypt end-to-end.
//   · Commerce media (attachment_type IN 'product', 'menu_item',
//     'cart_order', 'product_share') → skip this module · stays
//     server-plaintext so /shop and /menu render for cold visitors.
//
// Model: envelope encryption.
//   1. Generate a random 32-byte content key K + 24-byte nonce N.
//   2. Encrypt the file bytes ONCE with nacl.secretbox(bytes, N, K).
//   3. For every recipient device (peer + own devices), WRAP K with
//      the per-pair shared secret: wrapped_i = nacl.box.after(K, wnonce_i, sharedSecret_i).
//   4. Upload the ciphertext to a bucket · store enc metadata +
//      wrapped[] on the message row.
//   5. Recipient device decrypts one wrapped_i → recovers K → fetches
//      ciphertext → decrypts bytes → creates a blob URL for render.
//
// The one-encryption-per-file property means a 25MB video is
// encrypted once, not once-per-device — critical for CPU on mobile.

"use client";

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import type { NexDeviceKey } from "./device-key";
import { getSharedSecret } from "./shared-secret";
import { decodePublicKey } from "./device-key";

/** One wrapped copy of the content key, addressed to one device. */
export interface WrappedAttachmentKey {
  device_id: string;
  wrapped_b64: string;
  wrap_nonce_b64: string;
}

/** Full envelope shape stored in attachment_meta.envelope for
 *  encrypted attachments. */
export interface AttachmentEnvelope {
  version: 1;
  /** Legacy · public URL of the ciphertext in the public attachment
   *  bucket. P1.T05 2026-11-13 · OPTIONAL · present only on envelopes
   *  written before the sealed private-bucket migration. New envelopes
   *  carry `storage_path` instead · the recipient mints a short-lived
   *  signed URL via /api/nex-native/attachment/encrypted/signed when
   *  they need to download. One of `storage_url` or `storage_path`
   *  MUST be present. */
  storage_url?: string;
  /** Private bucket-relative path. P1.T05 2026-11-13 · NEW primary
   *  identifier · recipients call the signed-URL mint endpoint with
   *  this path to obtain a short-lived fetchable URL. */
  storage_path?: string;
  /** Nonce used with the content key to encrypt the file bytes. */
  content_nonce_b64: string;
  /** Sender's public key (base64) + device id at send time · needed
   *  by the recipient to re-derive the same shared secret when
   *  unwrapping their per-device wrapped key. */
  sender_public_key: string;
  sender_device_id: string;
  /** One wrapped copy of the content key per (peer + sender) device.
   *  The recipient finds the row matching its own device_id and
   *  unwraps to recover the content key. */
  wrapped_keys: WrappedAttachmentKey[];
  /** Original file's MIME type so the render layer knows which
   *  element to use (img / video / audio / document). Not sensitive
   *  by itself · the MIME alone does not reveal document contents or
   *  the original filename. */
  content_type: string;
  /** Original file size · lets the receiver validate the fetch. */
  size_bytes: number;
  /** Phase 3 · document attachments only. Ciphertext of the UTF-8
   *  filename bytes, encrypted with the SAME content key using a
   *  distinct random nonce. Absent for image/video/audio where the
   *  OS-generated filename isn't user-identifying. The server never
   *  sees the plaintext filename · it lands only after the recipient
   *  unwraps the content key AND decrypts this blob locally. */
  encrypted_filename_b64?: string;
  filename_nonce_b64?: string;
}

export interface EncryptFileResult {
  ciphertext: Uint8Array;
  contentNonce: Uint8Array;
  contentKey: Uint8Array;
}

/** Encrypt a file's bytes once with a random content key. Callers
 *  then upload the ciphertext + call wrapContentKey per recipient
 *  device to build the envelope. */
export function encryptFileBytes(bytes: Uint8Array): EncryptFileResult {
  const contentKey = nacl.randomBytes(nacl.secretbox.keyLength);
  const contentNonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ciphertext = nacl.secretbox(bytes, contentNonce, contentKey);
  return { ciphertext, contentNonce, contentKey };
}

/** Wrap a content key for one target device. Returns the wrapped
 *  bytes + the wrap nonce, both base64-encoded for JSON transport. */
export function wrapContentKey(
  contentKey: Uint8Array,
  self: NexDeviceKey,
  targetAccountId: string,
  targetDeviceId: string,
  targetPublicKeyBase64: string,
): WrappedAttachmentKey {
  const secret = getSharedSecret(
    self.secretKey,
    targetAccountId,
    targetDeviceId,
    targetPublicKeyBase64,
  );
  const wrapNonce = nacl.randomBytes(nacl.box.nonceLength);
  const wrapped = nacl.box.after(contentKey, wrapNonce, secret);
  return {
    device_id: targetDeviceId,
    wrapped_b64: naclUtil.encodeBase64(wrapped),
    wrap_nonce_b64: naclUtil.encodeBase64(wrapNonce),
  };
}

/** Try to unwrap the content key from an envelope using this device's
 *  keypair. Returns null when no wrapped row is addressed to this
 *  device OR when the wrapped bytes fail the Poly1305 tag (tamper
 *  detection). */
export function unwrapContentKey(
  envelope: AttachmentEnvelope,
  self: NexDeviceKey,
  senderAccountId: string,
): Uint8Array | null {
  const target = envelope.wrapped_keys.find(
    (r) => r.device_id === self.deviceId,
  );
  if (!target) return null;
  const secret = getSharedSecret(
    self.secretKey,
    senderAccountId,
    envelope.sender_device_id,
    envelope.sender_public_key,
  );
  const wrapped = naclUtil.decodeBase64(target.wrapped_b64);
  const wrapNonce = naclUtil.decodeBase64(target.wrap_nonce_b64);
  return nacl.box.open.after(wrapped, wrapNonce, secret);
}

/** Decrypt the file bytes with the recovered content key. */
export function decryptFileBytes(
  ciphertext: Uint8Array,
  contentNonceB64: string,
  contentKey: Uint8Array,
): Uint8Array | null {
  const contentNonce = naclUtil.decodeBase64(contentNonceB64);
  return nacl.secretbox.open(ciphertext, contentNonce, contentKey);
}

/** Phase 3 · encrypt a short byte string (the UTF-8-encoded filename)
 *  using the SAME content key as the file bytes but a DISTINCT random
 *  nonce. Stored in the envelope so the recipient can recover the
 *  original filename after unwrapping the content key. The server
 *  never sees the plaintext filename. */
export function encryptSmallBytes(
  bytes: Uint8Array,
  contentKey: Uint8Array,
): { ciphertext: Uint8Array; nonce: Uint8Array } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ciphertext = nacl.secretbox(bytes, nonce, contentKey);
  return { ciphertext, nonce };
}

/** Phase 3 · inverse of encryptSmallBytes · returns null on tamper. */
export function decryptSmallBytes(
  ciphertextB64: string,
  nonceB64: string,
  contentKey: Uint8Array,
): Uint8Array | null {
  const ciphertext = naclUtil.decodeBase64(ciphertextB64);
  const nonce = naclUtil.decodeBase64(nonceB64);
  return nacl.secretbox.open(ciphertext, nonce, contentKey);
}

/** Convenience: fetch ciphertext, unwrap the key, decrypt the file,
 *  and return the decrypted bytes + the content_type so the render
 *  layer can build a blob URL.
 *
 *  P1.T05 2026-11-13 · resolves the ciphertext URL through the sealed
 *  signed-URL mint when the envelope carries `storage_path` (private
 *  bucket). Legacy envelopes with only `storage_url` continue to
 *  fetch the public URL directly (backwards compat for pre-migration
 *  content). Returns null on any failure · tamper, wrong device,
 *  network, mint denial (non-participant) or expired URL. */
export async function fetchAndDecryptAttachment(
  envelope: AttachmentEnvelope,
  self: NexDeviceKey,
  senderAccountId: string,
  opts?: {
    /** Test override · defaults to global fetch. */
    fetchFn?: typeof fetch;
    /** Test override · same hook as the resolver + the fetch call. */
    signedUrlEndpoint?: string;
  },
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const contentKey = unwrapContentKey(envelope, self, senderAccountId);
  if (!contentKey) return null;
  const { resolveCiphertextFetchUrl } = await import(
    "./attachment-url-resolver"
  );
  const fetchUrl = await resolveCiphertextFetchUrl(
    { storage_path: envelope.storage_path, storage_url: envelope.storage_url },
    { fetchFn: opts?.fetchFn, signedUrlEndpoint: opts?.signedUrlEndpoint },
  );
  if (!fetchUrl) return null;
  try {
    const fetchFn = opts?.fetchFn ?? fetch;
    const resp = await fetchFn(fetchUrl);
    if (!resp.ok) return null;
    const buf = new Uint8Array(await resp.arrayBuffer());
    const plain = decryptFileBytes(buf, envelope.content_nonce_b64, contentKey);
    if (!plain) return null;
    return { bytes: plain, contentType: envelope.content_type };
  } catch {
    return null;
  }
}

/** Build the envelope object ready to store in attachment_meta.
 *  Callers assemble the wrapped_keys array by looping over every
 *  target device and calling wrapContentKey. */
export function buildEnvelope(opts: {
  /** P1.T05 2026-11-13 · at least ONE of storageUrl or storagePath
   *  MUST be provided. Prefer `storagePath` for all new uploads ·
   *  `storageUrl` stays for legacy-envelope compatibility. */
  storageUrl?: string;
  storagePath?: string;
  contentNonce: Uint8Array;
  senderPublicKey: string;
  senderDeviceId: string;
  wrappedKeys: WrappedAttachmentKey[];
  contentType: string;
  sizeBytes: number;
  /** Phase 3 · optional for documents · ciphertext bytes of the UTF-8
   *  filename encrypted under the SAME content key with a fresh nonce. */
  encryptedFilename?: Uint8Array;
  filenameNonce?: Uint8Array;
}): AttachmentEnvelope {
  if (!opts.storageUrl && !opts.storagePath) {
    throw new Error(
      "buildEnvelope: at least one of storageUrl or storagePath is required",
    );
  }
  const env: AttachmentEnvelope = {
    version: 1,
    content_nonce_b64: naclUtil.encodeBase64(opts.contentNonce),
    sender_public_key: opts.senderPublicKey,
    sender_device_id: opts.senderDeviceId,
    wrapped_keys: opts.wrappedKeys,
    content_type: opts.contentType,
    size_bytes: opts.sizeBytes,
  };
  if (opts.storageUrl) env.storage_url = opts.storageUrl;
  if (opts.storagePath) env.storage_path = opts.storagePath;
  if (opts.encryptedFilename && opts.filenameNonce) {
    env.encrypted_filename_b64 = naclUtil.encodeBase64(opts.encryptedFilename);
    env.filename_nonce_b64 = naclUtil.encodeBase64(opts.filenameNonce);
  }
  return env;
}

/** Type guard for arbitrary attachment_meta JSON.
 *  P1.T05 2026-11-13 · accepts envelopes with EITHER storage_url
 *  (legacy) OR storage_path (new private-bucket) · requires at least
 *  one. All other fields remain mandatory. */
export function isAttachmentEnvelope(x: unknown): x is AttachmentEnvelope {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const hasUrl = typeof o.storage_url === "string" && o.storage_url.length > 0;
  const hasPath =
    typeof o.storage_path === "string" && o.storage_path.length > 0;
  return (
    o.version === 1 &&
    (hasUrl || hasPath) &&
    typeof o.content_nonce_b64 === "string" &&
    typeof o.sender_public_key === "string" &&
    typeof o.sender_device_id === "string" &&
    Array.isArray(o.wrapped_keys) &&
    typeof o.content_type === "string" &&
    typeof o.size_bytes === "number"
  );
}
