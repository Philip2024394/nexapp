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
  type EncryptFileResult,
} from "./attachment-envelope";

export interface UploadedEncryptedAttachment {
  /** Public URL of the ciphertext object in the storage bucket. */
  storageUrl: string;
  /** Bucket-relative path · used by Bridge 78 purge to delete the
   *  object when its message row is purged. */
  storagePath: string;
  /** File MIME · used by the render layer to pick img/video/audio. */
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
   *  NexPeerAttachmentKind enum. */
  kind: "image" | "video" | "audio";
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
  // has not yet migrated to pass the opt (preserves historic bandwidth-
  // conscious behaviour · same shape as the sealed default on migration
  // 201).
  const quality = opts.uploadQuality ?? "standard";
  const effectiveFile = await compressImageIfStandard(opts.file, quality);
  opts.onProgress?.(0.05);

  // Read the file bytes into memory. For >50 MB files this can spike
  // memory · current cap is 25 MB per NEX_PEER_ATTACHMENT_MAX_BYTES.
  const rawBytes = new Uint8Array(await effectiveFile.arrayBuffer());
  opts.onProgress?.(0.15);

  // Encrypt · nacl.secretbox is streaming-ish but pure JS, so a 25MB
  // file runs O(seconds) on modern devices. Acceptable for MVP.
  const enc: EncryptFileResult = encryptFileBytes(rawBytes);
  opts.onProgress?.(0.4);

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
    // Cast via BodyInit · TS 5.7+ narrows Uint8Array to
    // `Uint8Array<ArrayBufferLike>` which the lib.dom RequestInit
    // overload does not accept directly.
    body: enc.ciphertext as BodyInit,
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
  if (!json.ok || !json.storage_url || !json.storage_path) {
    throw new Error(json.error ?? "unknown_upload_error");
  }

  opts.onProgress?.(1);
  return {
    storageUrl: json.storage_url,
    storagePath: json.storage_path,
    contentType: effectiveFile.type,
    sizeBytes: effectiveFile.size,
    contentKey: enc.contentKey,
    contentNonce: enc.contentNonce,
    kind,
  };
}

function classifyMime(mime: string): "image" | "video" | "audio" | null {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return null;
}

function extForMime(mime: string): string {
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
  return map[mime.toLowerCase()] ?? "bin";
}
