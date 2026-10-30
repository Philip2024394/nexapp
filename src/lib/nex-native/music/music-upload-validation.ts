// src/lib/nex-native/music/music-upload-validation.ts
//
// Owner-authorised 2026-10-29 · DRAFT §6.1 + §13.1.
//
// Server-side input validation for an uploaded audio file. Zero
// external dependencies: MP3 is detected via ID3v2 header or raw
// sync-frame; M4A via the `ftyp` box. Rejects files that look like
// anything else even when the client swears they are audio.

import "server-only";
import type { NexMusicMimeType } from "./types";

/** Owner-authorised 2026-10-29 · DRAFT §2.1 proposal. All values
 *  remain DRAFT until the resource-economics gate is cleared. */
export const MUSIC_UPLOAD_LIMITS = {
  MAX_AUDIO_BYTES: 20 * 1024 * 1024, // 20 MB
  MAX_COVER_BYTES: 2 * 1024 * 1024, // 2 MB
  MAX_BACKGROUND_BYTES: 5 * 1024 * 1024, // 5 MB · landscape backdrop can be larger
  MAX_TITLE_LEN: 200,
  MAX_ARTIST_LEN: 200,
  MAX_ALBUM_LEN: 200,
  MAX_DURATION_MS: 10 * 60 * 1000, // 10 min
  /** Owner-authorised 2026-10-30 · description cap (≈ 250 words of
   *  typical English prose). Character cap keeps the counter honest
   *  across languages. */
  MAX_DESCRIPTION_LEN: 1500,
} as const;

export const ALLOWED_AUDIO_MIME: readonly NexMusicMimeType[] = [
  "audio/mpeg",
  "audio/mp4",
];

export const ALLOWED_COVER_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export type AudioSignatureResult =
  | { readonly ok: true; readonly detectedMime: NexMusicMimeType }
  | { readonly ok: false; readonly reason: string };

/** Probe the first bytes of an audio Buffer and confirm it is a
 *  real MP3 or M4A, not just a file renamed .mp3/.m4a. */
export function detectAudioSignature(bytes: Buffer): AudioSignatureResult {
  if (bytes.length < 16) {
    return { ok: false, reason: "file too small to inspect" };
  }

  // MP3 · ID3v2 header: "ID3" + 2-byte version + 1-byte flags.
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return { ok: true, detectedMime: "audio/mpeg" };
  }

  // MP3 · raw sync frame: 0xFF 0xFB / 0xFF 0xF3 / 0xFF 0xF2 (MPEG-1/2 Layer 3).
  if (
    bytes[0] === 0xff &&
    (bytes[1] === 0xfb || bytes[1] === 0xf3 || bytes[1] === 0xf2)
  ) {
    return { ok: true, detectedMime: "audio/mpeg" };
  }

  // M4A · ISO base-media file-type box: bytes 4-7 = "ftyp".
  // The brand (bytes 8-11) is typically "M4A ", "mp42", "isom".
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = bytes.slice(8, 12).toString("ascii");
    if (
      brand === "M4A " ||
      brand === "mp42" ||
      brand === "mp41" ||
      brand === "isom" ||
      brand === "iso2"
    ) {
      return { ok: true, detectedMime: "audio/mp4" };
    }
    return { ok: false, reason: `unsupported MP4 brand "${brand}"` };
  }

  return { ok: false, reason: "no MP3/M4A signature found" };
}

export type CoverSignatureResult =
  | { readonly ok: true; readonly detectedMime: "image/jpeg" | "image/png" | "image/webp" }
  | { readonly ok: false; readonly reason: string };

export function detectCoverSignature(bytes: Buffer): CoverSignatureResult {
  if (bytes.length < 12) return { ok: false, reason: "file too small" };
  // JPEG · FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ok: true, detectedMime: "image/jpeg" };
  }
  // PNG · 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { ok: true, detectedMime: "image/png" };
  }
  // WebP · "RIFF" ... "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { ok: true, detectedMime: "image/webp" };
  }
  return { ok: false, reason: "unsupported image format" };
}

export function sanitiseTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MUSIC_UPLOAD_LIMITS.MAX_TITLE_LEN);
}

export function sanitiseName(
  raw: unknown,
  maxLen: number,
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLen);
}

/** Owner-authorised 2026-10-30 · long-form description sanitiser.
 *  Preserves intentional line breaks (unlike `sanitiseName` which
 *  collapses whitespace) · trims leading/trailing whitespace · hard
 *  cap at MAX_DESCRIPTION_LEN. Returns null for empty input so the
 *  caller can clear the field. */
export function sanitiseDescription(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MUSIC_UPLOAD_LIMITS.MAX_DESCRIPTION_LEN);
}
