// src/lib/nex-native/merchant-qr/qr-validation-service.ts
//
// P5 · server-side validation for seller-uploaded payment QR images.
// Owner-sealed 2026-11-10.
//
// Checks performed, in order:
//   1 · MIME is one of image/png · image/jpeg · image/webp
//   2 · Byte size ≤ 2_097_152 (2 MB)
//   3 · sharp can decode the bytes (rejects spoofed MIME headers)
//   4 · Decoded dimensions ≥ 200 × 200 and ≤ 2000 × 2000
//   5 · jsqr can decode a QR code from the raw pixel buffer
//   6 · sha256 of the raw bytes (used by the asset service for dedup
//       and for the deterministic storage path)
//
// Pure of session + DB. Callers (server actions) handle session,
// ownership, rate limit, dedup lookup, and storage put.

import "server-only";
import { createHash } from "node:crypto";
import sharp, { type Metadata, type OutputInfo } from "sharp";
// jsqr exports as a default function in CommonJS. The project has
// esModuleInterop enabled in tsconfig so this import style resolves
// correctly.
import jsQR from "jsqr";

export const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;
export type QrMime = (typeof ALLOWED_MIMES)[number];

export const MAX_BYTES = 2_097_152; // 2 MB · matches bucket config
export const MIN_DIMENSION = 200;
export const MAX_DIMENSION = 2000;

export type QrValidationReason =
  | "mime_rejected"
  | "too_large"
  | "decode_failed"
  | "dimensions_rejected"
  | "not_a_qr";

export interface QrValidationSuccess {
  readonly ok: true;
  readonly mime: QrMime;
  readonly byteSize: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly sha256Hex: string;
  /** First 64 characters of the decoded QR payload · stored as a hint
   *  for the seller UI (never a security-sensitive value · the QR is
   *  seller-owned payment metadata). */
  readonly qrPayloadHint: string;
}

export interface QrValidationFailure {
  readonly ok: false;
  readonly reason: QrValidationReason;
  readonly detail?: string;
}

export type QrValidationResult = QrValidationSuccess | QrValidationFailure;

function fail(reason: QrValidationReason, detail?: string): QrValidationFailure {
  return { ok: false, reason, ...(detail ? { detail } : {}) };
}

/**
 * Validate the raw image bytes a seller uploaded.
 *
 * @param bytes  Raw image buffer (NOT base64 · the caller decodes).
 * @param mime   The MIME the seller claimed · must be in ALLOWED_MIMES.
 *               We ALSO re-check by actually decoding with sharp · a
 *               mismatch between claimed MIME and decoded format
 *               produces mime_rejected.
 */
export async function validateQrBytes(
  bytes: Buffer,
  mime: string,
): Promise<QrValidationResult> {
  // 1 · MIME whitelist
  if (!ALLOWED_MIMES.includes(mime as QrMime)) {
    return fail("mime_rejected", `claimed MIME ${mime} not in allow-list`);
  }

  // 2 · size cap
  if (bytes.length > MAX_BYTES) {
    return fail("too_large", `byte size ${bytes.length} > ${MAX_BYTES}`);
  }
  if (bytes.length === 0) {
    return fail("decode_failed", "empty buffer");
  }

  // 3 · sharp decode · rejects spoofed MIME headers because the
  //     decoder reads magic bytes, not the MIME string.
  let meta: Metadata;
  let rawPixels: { data: Buffer; info: OutputInfo };
  try {
    const pipeline = sharp(bytes);
    meta = await pipeline.metadata();
    // ensureAlpha gives us a stable 4-channel RGBA layout that jsqr
    // reads as Uint8ClampedArray.
    rawPixels = await pipeline
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail("decode_failed", detail);
  }

  // Re-check the decoded format vs the claimed MIME to catch spoofing.
  // sharp reports 'jpeg' / 'png' / 'webp'. Our MIME strings include
  // the "image/" prefix.
  const decodedFormat = meta.format;
  const mimeMatches =
    (decodedFormat === "jpeg" && mime === "image/jpeg") ||
    (decodedFormat === "png" && mime === "image/png") ||
    (decodedFormat === "webp" && mime === "image/webp");
  if (!mimeMatches) {
    return fail(
      "mime_rejected",
      `claimed MIME ${mime} but decoded format ${decodedFormat ?? "unknown"}`,
    );
  }

  // 4 · dimensions
  const width = rawPixels.info.width;
  const height = rawPixels.info.height;
  if (
    width < MIN_DIMENSION ||
    height < MIN_DIMENSION ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION
  ) {
    return fail(
      "dimensions_rejected",
      `${width} × ${height} outside [${MIN_DIMENSION}, ${MAX_DIMENSION}]`,
    );
  }

  // 5 · QR decode · jsqr requires a Uint8ClampedArray in RGBA order
  //     with matching width * height * 4 length.
  const rgba = new Uint8ClampedArray(
    rawPixels.data.buffer,
    rawPixels.data.byteOffset,
    rawPixels.data.byteLength,
  );
  if (rgba.length !== width * height * 4) {
    return fail(
      "decode_failed",
      `pixel buffer ${rgba.length} does not match ${width} × ${height} × 4`,
    );
  }
  const qr = jsQR(rgba, width, height, { inversionAttempts: "attemptBoth" });
  if (!qr || !qr.data) {
    return fail("not_a_qr", "jsqr returned no QR code in the image");
  }

  // 6 · sha256 of the original bytes (not the raw pixel buffer · we
  //     dedupe by file content, not by decoded pixels, so a cropped
  //     re-save registers as a new upload).
  const sha256Hex = createHash("sha256").update(bytes).digest("hex");

  return {
    ok: true,
    mime: mime as QrMime,
    byteSize: bytes.length,
    widthPx: width,
    heightPx: height,
    sha256Hex,
    qrPayloadHint: qr.data.slice(0, 64),
  };
}
