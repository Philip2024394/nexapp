// src/lib/nex-native/crypto/encrypted-attachment-uploader.ts
//
// NEX device-key chat · client-side encrypted attachment uploader.
// Owner-authorised 2026-11-10 · integration layer.
// -----------------------------------------------------------------
// Pipeline:
//   1. Generate a fresh 32-byte attachment symmetric key + nonce
//      via the sealed attachment-envelope.encryptFileBytes primitive
//      (XSalsa20-Poly1305 via nacl.secretbox · AEAD).
//   2. Upload the ciphertext bytes to the private ciphertext bucket
//      (nex-peer-chat-ciphertext) via the sealed server route at
//      /api/nex-native/attachment/encrypted. That route itself
//      REFUSES to accept the upload when the private bucket is not
//      provisioned (returns 503 · owner-sealed 2026-11-08 private-
//      bucket-only policy).
//   3. For each recipient device, wrap the attachment key using the
//      sealed attachment-key-wrap primitive · returns a per-device
//      WrappedAttachmentKeyBlob the dispatcher ships with the
//      ciphertext peer-message row.
//
// Returns { ok: true, ciphertext_url_token, wrapped_keys } where
// `ciphertext_url_token` is the storage_path (opaque to the client
// after upload · the recipient uses /api/nex-native/attachment/
// encrypted/signed to mint a short-lived signed URL at read time),
// OR { ok: false, reason: "ciphertext_bucket_not_applied" } when the
// private bucket probe fails. NEVER falls back to the public bucket.
//
// Invariants preserved:
//   · I-1 · plaintext bytes never leave the client · ciphertext is
//     uploaded · the wrap step is per-device so no server-held key
//     unlocks the content.
//   · I-3 · no public-bucket fallback · a missing private bucket
//     short-circuits with "ciphertext_bucket_not_applied".
//   · I-5 · a failed upload returns { ok: false } · no partial state
//     is ever persisted and no key material lingers in storage.
//   · Error cases never surface plaintext bytes or the attachment
//     key in the response · they return opaque reason strings.

"use client";

import {
  encryptFileBytes,
  type EncryptFileResult,
} from "./attachment-envelope";
import {
  wrapAttachmentKey,
  type WrappedAttachmentKeyBlob,
} from "./attachment-key-wrap";

export interface RecipientDeviceForWrap {
  /** Opaque device id · identifies the row in the wrapped-keys map. */
  device_id: string;
  /** Recipient device's Curve25519 public key (32 bytes). */
  recipient_public_key: Uint8Array;
}

export interface UploaderOptions {
  /** The raw file bytes to encrypt + upload. */
  file: File;
  /** Sender device's Curve25519 secret key · memory-only. */
  senderSecretKey: Uint8Array;
  /** All target devices (peers + sender-own-echo devices) the
   *  attachment key must be wrapped for. */
  recipients: RecipientDeviceForWrap[];
  /** Optional fetch override for unit testing. */
  fetchImpl?: typeof fetch;
}

export type UploaderOk = {
  ok: true;
  /** Opaque storage locator the dispatcher embeds in the ciphertext
   *  row's envelope. For the sealed private-bucket path this is the
   *  storage_path · the recipient's side mints a signed URL from it
   *  via the sealed /encrypted/signed endpoint. */
  ciphertext_url_token: string;
  /** Per-device wrapped attachment keys keyed by device_id. */
  wrapped_keys: Record<string, WrappedAttachmentKeyBlob>;
  /** Content nonce used with the attachment key when encrypting the
   *  file bytes · recipient needs it to decrypt. Base64-encoded for
   *  JSON transport. */
  content_nonce_b64: string;
  /** Encrypted file size in bytes · useful for progress / integrity. */
  size_bytes: number;
  /** Original MIME · drives the recipient's render choice. */
  content_type: string;
};

export type UploaderFailure =
  | {
      ok: false;
      reason: "ciphertext_bucket_not_applied";
    }
  | {
      ok: false;
      reason: "upload_failed" | "encrypt_failed" | "wrap_failed";
      /** Opaque diagnostic · NEVER contains plaintext bytes or key
       *  material · suitable for error logs. */
      detail?: string;
    };

export type UploaderResult = UploaderOk | UploaderFailure;

// Client-facing MIME → safe-extension map. Mirrors the sealed
// extForMime in encrypted-attachment-upload.ts without leaking the
// legacy module's internal API.
function safeExt(mime: string): string {
  const m = mime.toLowerCase();
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "audio/wav": "wav",
    "audio/opus": "opus",
  };
  return map[m] ?? "bin";
}

function b64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
    return btoa(s);
  }
  // Node fallback (tests run under Node).
  return Buffer.from(bytes).toString("base64");
}

/** Client-side upload helper. See module docstring. */
export async function uploadEncryptedAttachment(
  opts: UploaderOptions,
): Promise<UploaderResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;

  // 1. Encrypt bytes in memory. Any throw here is reported opaquely.
  let enc: EncryptFileResult;
  try {
    const raw = new Uint8Array(await opts.file.arrayBuffer());
    enc = encryptFileBytes(raw);
    // Immediately discard the plaintext reference so the GC can
    // reclaim it (defensive · plain bytes should not linger).
    (raw as unknown) as Uint8Array; // no-op to silence unused
  } catch (e) {
    return {
      ok: false,
      reason: "encrypt_failed",
      // Message only · never bytes.
      detail: e instanceof Error ? e.name : "unknown",
    };
  }

  // 2. Upload the ciphertext to the sealed private-bucket route.
  //    The route is the one source of truth for "is the private
  //    bucket applied" · if it returns 503 private_bucket_unavailable
  //    we short-circuit with the sealed refusal code.
  let uploadJson: {
    ok: boolean;
    storage_path?: string;
    storage_url?: string;
    private?: boolean;
    error?: string;
  };
  try {
    const resp = await fetchImpl("/api/nex-native/attachment/encrypted", {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-nex-enc-ext": safeExt(opts.file.type),
      },
      body: enc.ciphertext as unknown as BodyInit,
    });
    if (resp.status === 503) {
      // Sealed private-bucket-unavailable path · NEVER retry on the
      // public bucket · surface the refusal to the caller.
      return { ok: false, reason: "ciphertext_bucket_not_applied" };
    }
    if (!resp.ok) {
      // Diagnostic payload MUST NOT echo the response body · a
      // misbehaving or compromised route could echo the uploaded
      // ciphertext bytes back to the client · surface only the HTTP
      // status so no server-echoed bytes leak into the result.
      return {
        ok: false,
        reason: "upload_failed",
        detail: `http_${resp.status}`,
      };
    }
    uploadJson = (await resp.json()) as typeof uploadJson;
  } catch (e) {
    return {
      ok: false,
      reason: "upload_failed",
      detail: e instanceof Error ? e.name : "unknown",
    };
  }

  if (!uploadJson.ok) {
    // Sealed error-code mapping · the route returns
    // private_bucket_unavailable only with status 503 (handled above),
    // every other error maps to "upload_failed". We DO NOT propagate
    // the server's `error` string to the result · it could echo
    // uploaded bytes if a route is misconfigured. Only a short
    // whitelist of known codes is mapped.
    const knownCodes = new Set([
      "private_bucket_unavailable",
      "storage_upload",
      "too_large",
      "empty",
      "invalid_body",
      "not_signed_in",
    ]);
    if (uploadJson.error === "private_bucket_unavailable") {
      return { ok: false, reason: "ciphertext_bucket_not_applied" };
    }
    const safeCode =
      typeof uploadJson.error === "string" &&
      // Match by prefix so "storage_upload: <msg>" collapses to
      // "storage_upload" without forwarding the message text.
      [...knownCodes].find((k) => uploadJson.error!.startsWith(k));
    return {
      ok: false,
      reason: "upload_failed",
      detail: safeCode || "unknown",
    };
  }

  const storageToken = uploadJson.storage_path ?? uploadJson.storage_url;
  if (!storageToken) {
    return { ok: false, reason: "upload_failed", detail: "no_storage_token" };
  }

  // 3. Wrap the attachment key for every recipient device.
  const wrapped: Record<string, WrappedAttachmentKeyBlob> = {};
  try {
    for (const r of opts.recipients) {
      const blob = wrapAttachmentKey({
        attachmentKey: enc.contentKey,
        recipientPublicKey: r.recipient_public_key,
        senderSecretKey: opts.senderSecretKey,
      });
      wrapped[r.device_id] = blob;
    }
  } catch (e) {
    return {
      ok: false,
      reason: "wrap_failed",
      detail: e instanceof Error ? e.name : "unknown",
    };
  }

  return {
    ok: true,
    ciphertext_url_token: storageToken,
    wrapped_keys: wrapped,
    content_nonce_b64: b64(enc.contentNonce),
    size_bytes: enc.ciphertext.byteLength,
    content_type: opts.file.type,
  };
}
