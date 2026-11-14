// src/lib/nex-native/crypto/encrypted-document-download.ts
//
// P1.T04 Phase 3 · 2026-11-13 · owner-authorised.
// -----------------------------------------------------------------------------
// Recipient-side helper for opening an end-to-end encrypted document
// attachment. Takes an AttachmentEnvelope (including the encrypted
// filename) + this device's keypair, and returns a plaintext
// {bytes, filename, contentType} tuple suitable for triggering a
// browser download via an anchor element. Returns null on any failure
// (wrong device, tamper, network, malformed envelope). Never silently
// downgrades to a plaintext fetch.
//
// Security contract:
//   · Content key unwrapped locally with the device private key · the
//     server never sees the content key.
//   · Filename decrypted locally with the same content key · the
//     server never saw the plaintext filename at upload time either.
//   · If the filename blob is absent (image/video/audio envelope OR
//     an older document that was somehow sent without the blob) we
//     return a safe fallback "attachment" placeholder · we do NOT
//     surface any server-side metadata as if it were the filename.
//   · Returned bytes are the file bytes only · the caller builds a
//     Blob + URL.createObjectURL + <a download> click and revokes the
//     URL after the download starts.

"use client";

import type { NexDeviceKey } from "./device-key";
import {
  decryptFileBytes,
  decryptSmallBytes,
  unwrapContentKey,
  type AttachmentEnvelope,
} from "./attachment-envelope";
import { resolveCiphertextFetchUrl } from "./attachment-url-resolver";

export interface DecryptedDocument {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
}

/** Fetch the ciphertext, unwrap the content key for this device,
 *  decrypt the file bytes, decrypt the filename (if present), and
 *  return a tuple suitable for triggering a download. */
export async function fetchAndDecryptDocument(
  envelope: AttachmentEnvelope,
  self: NexDeviceKey,
  senderAccountId: string,
  opts?: {
    /** Overrideable fetcher · tests pass a mock. Defaults to the
     *  global fetch. */
    fetchFn?: typeof fetch;
    /** Optional abort signal · caller can cancel a slow download
     *  mid-flight. */
    signal?: AbortSignal;
    /** Test override · signed-URL mint endpoint. */
    signedUrlEndpoint?: string;
  },
): Promise<DecryptedDocument | null> {
  const fetchFn = opts?.fetchFn ?? fetch;
  const contentKey = unwrapContentKey(envelope, self, senderAccountId);
  if (!contentKey) return null;

  // P1.T05 2026-11-13 · route through the signed-URL mint when the
  // envelope carries a private-bucket path. Legacy envelopes with
  // only storage_url fall through to a direct fetch.
  const fetchUrl = await resolveCiphertextFetchUrl(
    { storage_path: envelope.storage_path, storage_url: envelope.storage_url },
    { fetchFn: opts?.fetchFn, signedUrlEndpoint: opts?.signedUrlEndpoint },
  );
  if (!fetchUrl) return null;

  let ciphertextBuf: ArrayBuffer;
  try {
    const resp = await fetchFn(fetchUrl, { signal: opts?.signal });
    if (!resp.ok) return null;
    ciphertextBuf = await resp.arrayBuffer();
  } catch {
    return null;
  }
  const ciphertext = new Uint8Array(ciphertextBuf);
  const plain = decryptFileBytes(
    ciphertext,
    envelope.content_nonce_b64,
    contentKey,
  );
  if (!plain) return null;

  // Filename blob is optional on the envelope type but required for
  // documents. If both fields are present, decrypt them · if neither
  // is present, fall back to a neutral placeholder. If only one is
  // present, the envelope is malformed · bail.
  let filename = "attachment";
  const hasFn = typeof envelope.encrypted_filename_b64 === "string";
  const hasNonce = typeof envelope.filename_nonce_b64 === "string";
  if (hasFn !== hasNonce) return null;
  if (hasFn && hasNonce) {
    const filenameBytes = decryptSmallBytes(
      envelope.encrypted_filename_b64!,
      envelope.filename_nonce_b64!,
      contentKey,
    );
    if (!filenameBytes) return null;
    const decoded = new TextDecoder("utf-8").decode(filenameBytes);
    filename = sanitiseFilename(decoded);
  }

  return {
    bytes: plain,
    filename,
    contentType: envelope.content_type,
  };
}

/** Defensive filename cleanup · we don't trust the recovered filename
 *  bytes blindly even though they came from our own encrypted
 *  envelope · defence in depth against a sender who smuggled a path-
 *  traversal or control-char filename. Keeps the extension intact. */
export function sanitiseFilename(raw: string): string {
  if (!raw || typeof raw !== "string") return "attachment";
  // Strip directory separators + control chars + null bytes.
  const stripped = raw
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[\\/]/g, "_")
    .trim();
  if (stripped.length === 0) return "attachment";
  // Bound the length · browser downloads tolerate long names but we
  // match the sealed meta cap (256 chars).
  return stripped.length > 256 ? stripped.slice(0, 256) : stripped;
}

/** Convenience · build a Blob + trigger a browser download for the
 *  given decrypted payload. Caller must already be in a user-gesture
 *  context (click handler) for the download to be allowed. */
export function triggerBrowserDownload(doc: DecryptedDocument): void {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  // Uint8Array<ArrayBufferLike> → cast to the Blob constructor's
  // accepted type. Runtime: Uint8Array is a valid BlobPart in every
  // browser · this is purely a TypeScript lib shape issue.
  const blob = new Blob([doc.bytes as unknown as BlobPart], {
    type: doc.contentType || "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = doc.filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    // Revoke the URL on the next tick so the click has time to fire.
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }, 0);
  }
}
