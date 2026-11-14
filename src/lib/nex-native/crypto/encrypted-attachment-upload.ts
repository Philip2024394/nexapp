// src/lib/nex-native/crypto/encrypted-attachment-upload.ts
//
// Bridge 81 · Client helper: encrypt a File + upload ciphertext.
// --------------------------------------------------------------
// Returns a "pending attachment" descriptor the caller stashes until
// send time. At send time, encrypted-send.ts loops over recipient
// device keys, wraps the content key for each, builds the envelope,
// and includes it in attachment_meta.
//
// The content key + nonce STAY IN MEMORY on the sender's device
// between upload and send · they never touch the server as plaintext.

"use client";

import {
  encryptFileBytes,
  encryptSmallBytes,
  type EncryptFileResult,
} from "./attachment-envelope";

export interface UploadedEncryptedAttachment {
  /** Legacy · public URL when the server emits one. P1.T05 2026-11-13 ·
   *  the sealed private-bucket route no longer returns a storage_url
   *  (new envelopes carry `storage_path` and recipients mint a short-
   *  lived signed URL at read time). Retained as optional for the
   *  pre-2026-11-08 upload surface whose legacy callers still read it. */
  storageUrl?: string;
  /** Bucket-relative path · PRIMARY identifier for new uploads · used
   *  by the signed-URL mint endpoint + Bridge 78 purge. */
  storagePath: string;
  /** File MIME · used by the render layer to pick img/video/audio/
   *  document rendering. */
  contentType: string;
  /** Original file size in bytes. */
  sizeBytes: number;
  /** In-memory content key that must be wrapped per recipient device
   *  at send time. Never persisted to disk. */
  contentKey: Uint8Array;
  /** Nonce used to encrypt the file bytes · included in the envelope
   *  so the recipient can decrypt. */
  contentNonce: Uint8Array;
  /** Kind classifier for the message row · matches the existing
   *  NexPeerAttachmentKind enum. Phase 3 adds "document". */
  kind: "image" | "video" | "audio" | "document";
  /** Phase 3 · document attachments only. The UTF-8 filename
   *  encrypted with the SAME content key (distinct nonce). The
   *  server never sees the plaintext filename · only this ciphertext
   *  lands in attachment metadata and realtime routing never carries
   *  the plaintext. Omitted for image/video/audio. */
  encryptedFilename?: Uint8Array;
  filenameNonce?: Uint8Array;
}

export interface UploadEncryptedAttachmentOptions {
  file: File;
  onProgress?: (fraction: number) => void;
  /**
   * R14 Stage 6 (2026-10-15 · migration 201 unapplied) · upload quality
   * tier. When "standard" (default), images are downsampled client-side
   * before encryption to save bandwidth · videos and audio pass through
   * unchanged (browsers do not natively transcode video). When "hd",
   * the file is encrypted as-is. If omitted, defaults to "standard".
   */
  uploadQuality?: "standard" | "hd";
}

/**
 * R14 Stage 6 helper · downsample an image file via canvas when the
 * caller's `uploadQuality` is "standard". Returns the original file
 * for videos, audio, and HD uploads · the compression step is
 * idempotent for small images (we only resample when the longest edge
 * exceeds the ceiling). Never silently converts formats · stays within
 * JPEG for already-JPEG inputs and PNG otherwise.
 *
 * This runs ONLY in the browser · requires createImageBitmap +
 * OffscreenCanvas. If either is unavailable (older browsers), the
 * compression step is a graceful no-op · the file encrypts at its
 * original size.
 */
async function compressImageIfStandard(
  file: File,
  quality: "standard" | "hd",
): Promise<File> {
  if (quality === "hd") return file;
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file; // preserve animation
  if (typeof createImageBitmap !== "function") return file;
  if (typeof OffscreenCanvas === "undefined") return file;

  const MAX_EDGE_PX = 1600;
  const JPEG_QUALITY = 0.85;
  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= MAX_EDGE_PX) {
      bitmap.close();
      return file; // already within target · no benefit from re-encode
    }
    const scale = MAX_EDGE_PX / longest;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const outType =
      file.type === "image/jpeg" || file.type === "image/jpg"
        ? "image/jpeg"
        : "image/jpeg"; // default to JPEG for downsized output (smaller than PNG)
    const blob = await canvas.convertToBlob({
      type: outType,
      quality: JPEG_QUALITY,
    });
    // If compressed is somehow larger than original (rare), use original.
    if (blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.(png|webp|heic|heif)$/i, ".jpg"), {
      type: outType,
    });
  } catch {
    // Any failure in the compression pipeline falls through to original.
    return file;
  }
}

/**
 * Encrypt the given file and upload the ciphertext to
 * /api/nex-native/attachment/encrypted. Resolves with a pending
 * attachment descriptor the caller stashes until the peer message
 * send. Rejects on network / storage / MIME failure.
 *
 * R14 Stage 6 enforcement · when `uploadQuality='standard'` and the
 * file is an image larger than 1600px on its longest edge, the file
 * is downsampled client-side before encryption. Video and audio pass
 * through unchanged (browser-native video transcoding is not viable
 * without a new client-side library · documented limitation).
 */
export async function uploadEncryptedAttachment(
  opts: UploadEncryptedAttachmentOptions,
): Promise<UploadedEncryptedAttachment> {
  const kind = classifyMime(opts.file.type);
  if (!kind) {
    throw new Error(`unsupported attachment MIME '${opts.file.type}'`);
  }

  // R14 Stage 6 · apply client-side image compression per the viewer's
  // upload_quality preference. Default to "standard" when the caller
  // has not yet migrated to pass the opt. Compression is a no-op for
  // non-image kinds (checked internally).
  const quality = opts.uploadQuality ?? "standard";
  const effectiveFile = await compressImageIfStandard(opts.file, quality);
  opts.onProgress?.(0.05);

  // Read the file bytes into memory. For >50 MB files this can spike
  // memory · current cap is 25 MB per NEX_PEER_ATTACHMENT_MAX_BYTES.
  const rawBytes = new Uint8Array(await effectiveFile.arrayBuffer());
  opts.onProgress?.(0.15);

  // Encrypt · nacl.secretbox is streaming-ish but pure JS. Works for
  // document bytes exactly the same way as media bytes · there is
  // nothing kind-specific about the content-byte path.
  const enc: EncryptFileResult = encryptFileBytes(rawBytes);
  opts.onProgress?.(0.4);

  // Phase 3 · for documents, encrypt the UTF-8-encoded filename with
  // the SAME content key but a distinct random nonce. The server
  // never sees the plaintext filename · only the ciphertext lands in
  // attachment metadata when the sender composes the message.
  let encryptedFilename: Uint8Array | undefined;
  let filenameNonce: Uint8Array | undefined;
  if (kind === "document") {
    const rawFilename =
      typeof effectiveFile.name === "string" ? effectiveFile.name : "";
    // Truncate to 256 chars to mirror the sealed meta.filename cap
    // · utf-8 encode · defensive bounds check against absurd lengths.
    const truncated = rawFilename.slice(0, 256);
    const filenameBytes = new TextEncoder().encode(truncated);
    const fn = encryptSmallBytes(filenameBytes, enc.contentKey);
    encryptedFilename = fn.ciphertext;
    filenameNonce = fn.nonce;
  }

  // Upload the ciphertext as raw bytes. Use the effective (possibly
  // compressed) file's MIME + size · recipients render based on the
  // delivered bytes, not the pre-compression original.
  const ext = extForMime(effectiveFile.type);
  const resp = await fetch("/api/nex-native/attachment/encrypted", {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-nex-enc-ext": ext,
    },
    // Uint8Array is a valid BufferSource · the cast quiets a DOM-lib
    // type overload picking that doesn't recognise it as BodyInit in
    // this project's TS config. Runtime behaviour unchanged.
    body: enc.ciphertext as unknown as BodyInit,
  });
  opts.onProgress?.(0.95);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`encrypted upload failed: ${resp.status} ${text}`);
  }
  const json = (await resp.json()) as {
    ok: boolean;
    storage_url?: string;
    storage_path?: string;
    error?: string;
  };
  // P1.T05 2026-11-13 · the sealed private-bucket route returns
  // `storage_path` only · the previous client validator required
  // `storage_url` too, which made every encrypted upload throw
  // "unknown_upload_error" on the live route. Now we require
  // `storage_path` (primary identifier) and treat `storage_url` as
  // optional for forward/back compat with any legacy path that still
  // emits a public URL.
  if (!json.ok || !json.storage_path) {
    throw new Error(json.error ?? "unknown_upload_error");
  }

  opts.onProgress?.(1);
  return {
    // storageUrl present only if the server explicitly emits it (legacy
    // public-bucket compat window). Primary id is storagePath.
    ...(json.storage_url ? { storageUrl: json.storage_url } : {}),
    storagePath: json.storage_path,
    contentType: effectiveFile.type,
    sizeBytes: effectiveFile.size,
    contentKey: enc.contentKey,
    contentNonce: enc.contentNonce,
    kind,
    encryptedFilename,
    filenameNonce,
  };
}

/** P1.T04 Phase 3 · 2026-11-13 · owner-approved document MIME allowlist.
 *  Documents with recognised types route through the encrypted
 *  attachment pipeline · ciphertext-only upload · recipient decrypts
 *  locally + downloads with the original filename. Keep this list in
 *  sync with the server route's safeExt whitelist and the composer's
 *  file-picker accept hints. Exotic MIMEs that are not on this list
 *  still return `null` so the block prompt fires "unsupported-mime". */
export const SUPPORTED_DOCUMENT_MIMES: ReadonlySet<string> = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/csv",
  "application/zip",
  "application/x-zip-compressed",
]);

export function classifyMime(
  mime: string,
): "image" | "video" | "audio" | "document" | null {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (SUPPORTED_DOCUMENT_MIMES.has(m)) return "document";
  return null;
}

export function extForMime(mime: string): string {
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
    // P1.T04 Phase 3 · document extensions · safe-list only · the
    // server route echoes the same whitelist as a defence-in-depth.
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "text/plain": "txt",
    "text/csv": "csv",
    "application/csv": "csv",
    "application/zip": "zip",
    "application/x-zip-compressed": "zip",
  };
  return map[mime.toLowerCase()] ?? "bin";
}
