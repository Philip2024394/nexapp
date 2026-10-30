// src/app/api/nex-native/music/upload/route.ts
//
// Owner-authorised 2026-10-29 · DRAFT §14 S2.3.
// Multipart POST for an uploaded_audio track + optional cover image.
// Server actions have a small body limit · binary uploads use this
// dedicated route. All identity + ownership resolution flows via
// `resolveSessionWithDevOverride` so dev impersonation (Hendra)
// works end-to-end.

import { NextResponse } from "next/server";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getMusicStorageAdapter } from "@/lib/nex-native/music/storage-adapter";
import { insertMusicTrackWithQuota, getOwnerStorageUsageBytes, getOwnerTrackCount, QuotaExceededError } from "@/lib/nex-native/music/music-repository";
import { probeAudioDuration } from "@/lib/nex-native/music/music-duration-probe";
import {
  ALLOWED_AUDIO_MIME,
  ALLOWED_COVER_MIME,
  MUSIC_UPLOAD_LIMITS,
  detectAudioSignature,
  detectCoverSignature,
  sanitiseName,
  sanitiseTitle,
  sanitiseDescription,
} from "@/lib/nex-native/music/music-upload-validation";
import type { NexMusicRightsDeclaration } from "@/lib/nex-native/music/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PER_ACCOUNT_BYTES = 500 * 1024 * 1024; // DRAFT §2.1 proposal
const MAX_PER_ACCOUNT_TRACKS = 100;

function errorJson(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return errorJson("not-signed-in", "Sign in required", 401);
  }
  const ownerAccountId = session.account.id;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorJson("invalid-input", "Could not parse multipart body", 400);
  }

  // --- Required fields ---
  const title = sanitiseTitle(formData.get("title"));
  if (!title) return errorJson("invalid-input", "Title is required", 400);

  const artist = sanitiseName(formData.get("artist"), MUSIC_UPLOAD_LIMITS.MAX_ARTIST_LEN);
  // Owner-authorised 2026-10-30 · optional long-form description.
  // Dev-FS only · no DB column yet.
  const description = sanitiseDescription(formData.get("description"));

  const rightsRaw = formData.get("rights_declaration");
  const rightsDeclaration = (
    rightsRaw === "owner_content" ||
    rightsRaw === "licensed" ||
    rightsRaw === "public_domain"
      ? rightsRaw
      : null
  ) as NexMusicRightsDeclaration | null;
  if (!rightsDeclaration) {
    return errorJson(
      "rights-required",
      "Rights declaration is required",
      400,
    );
  }

  // Owner-authorised 2026-10-31 (music-upload-audit · finding #10):
  // the client-reported `duration_ms` is NO LONGER TRUSTED. We probe
  // the audio bytes server-side after signature validation. The
  // formData value is read + ignored here only to keep the client
  // contract backwards-compatible (older clients still send it).
  // The authoritative value is set at line ~180 (`probedDurationMs`).
  void formData.get("duration_ms");

  // --- Audio file ---
  const audioFile = formData.get("audio");
  if (!(audioFile instanceof File)) {
    return errorJson("invalid-input", "Audio file is required", 400);
  }
  if (!ALLOWED_AUDIO_MIME.includes(audioFile.type as (typeof ALLOWED_AUDIO_MIME)[number])) {
    return errorJson(
      "unsupported-media-type",
      `Only ${ALLOWED_AUDIO_MIME.join(", ")} accepted`,
      415,
    );
  }
  if (audioFile.size > MUSIC_UPLOAD_LIMITS.MAX_AUDIO_BYTES) {
    return errorJson(
      "too-large",
      `Audio file exceeds ${MUSIC_UPLOAD_LIMITS.MAX_AUDIO_BYTES} bytes`,
      413,
    );
  }
  const audioBytes = Buffer.from(await audioFile.arrayBuffer());
  const audioSig = detectAudioSignature(audioBytes);
  if (!audioSig.ok) {
    return errorJson(
      "signature-mismatch",
      `Audio file does not look like MP3 or M4A: ${audioSig.reason}`,
      422,
    );
  }

  // --- Optional cover ---
  const coverFile = formData.get("cover");
  let coverBytes: Buffer | null = null;
  let coverMime: "image/jpeg" | "image/png" | "image/webp" | null = null;
  if (coverFile instanceof File && coverFile.size > 0) {
    if (!ALLOWED_COVER_MIME.includes(coverFile.type as (typeof ALLOWED_COVER_MIME)[number])) {
      return errorJson(
        "unsupported-media-type",
        `Cover must be JPEG, PNG, or WebP`,
        415,
      );
    }
    if (coverFile.size > MUSIC_UPLOAD_LIMITS.MAX_COVER_BYTES) {
      return errorJson(
        "too-large",
        `Cover exceeds ${MUSIC_UPLOAD_LIMITS.MAX_COVER_BYTES} bytes`,
        413,
      );
    }
    coverBytes = Buffer.from(await coverFile.arrayBuffer());
    const coverSig = detectCoverSignature(coverBytes);
    if (!coverSig.ok) {
      return errorJson(
        "signature-mismatch",
        `Cover image signature invalid: ${coverSig.reason}`,
        422,
      );
    }
    coverMime = coverSig.detectedMime;
  }

  // --- Optional background (landscape backdrop for Live) ---
  const backgroundFile = formData.get("background");
  let backgroundBytes: Buffer | null = null;
  let backgroundMime: "image/jpeg" | "image/png" | "image/webp" | null = null;
  if (backgroundFile instanceof File && backgroundFile.size > 0) {
    if (!ALLOWED_COVER_MIME.includes(backgroundFile.type as (typeof ALLOWED_COVER_MIME)[number])) {
      return errorJson(
        "unsupported-media-type",
        `Background must be JPEG, PNG, or WebP`,
        415,
      );
    }
    if (backgroundFile.size > MUSIC_UPLOAD_LIMITS.MAX_BACKGROUND_BYTES) {
      return errorJson(
        "too-large",
        `Background exceeds ${MUSIC_UPLOAD_LIMITS.MAX_BACKGROUND_BYTES} bytes`,
        413,
      );
    }
    backgroundBytes = Buffer.from(await backgroundFile.arrayBuffer());
    const bgSig = detectCoverSignature(backgroundBytes);
    if (!bgSig.ok) {
      return errorJson(
        "signature-mismatch",
        `Background image signature invalid: ${bgSig.reason}`,
        422,
      );
    }
    backgroundMime = bgSig.detectedMime;
  }

  // --- Server-side duration probe (owner-authorised 2026-10-31 ·
  //     music-upload-audit · finding #10). Replaces client-reported
  //     duration_ms. Fails closed. ---
  const probe = await probeAudioDuration(audioBytes, audioSig.detectedMime);
  if (!probe.ok) {
    return errorJson(
      "invalid-input",
      `Could not read audio duration · ${probe.reason}${probe.detail ? ` (${probe.detail})` : ""}`,
      422,
    );
  }
  if (probe.durationMs > MUSIC_UPLOAD_LIMITS.MAX_DURATION_MS) {
    return errorJson(
      "too-large",
      `Track exceeds ${Math.floor(MUSIC_UPLOAD_LIMITS.MAX_DURATION_MS / 60000)}-minute limit (probed ${Math.round(probe.durationMs / 1000)}s)`,
      413,
    );
  }
  const probedDurationMs = probe.durationMs;
  const probedBitrateKbps = probe.bitrateKbps;

  // --- Per-account quota checks ---
  const [usedBytes, usedCount] = await Promise.all([
    getOwnerStorageUsageBytes(ownerAccountId),
    getOwnerTrackCount(ownerAccountId),
  ]);
  if (usedBytes + audioBytes.length > MAX_PER_ACCOUNT_BYTES) {
    return errorJson(
      "storage-quota-exceeded",
      `Storage quota exceeded (${usedBytes} / ${MAX_PER_ACCOUNT_BYTES} bytes used)`,
      429,
    );
  }
  if (usedCount >= MAX_PER_ACCOUNT_TRACKS) {
    return errorJson(
      "track-count-exceeded",
      `Track-count quota exceeded (${usedCount} / ${MAX_PER_ACCOUNT_TRACKS})`,
      429,
    );
  }

  // --- Store bytes ---
  const storage = getMusicStorageAdapter();
  const audioKey = `audio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${audioSig.detectedMime === "audio/mpeg" ? "mp3" : "m4a"}`;
  let audioRef: string;
  try {
    const put = await storage.putObject({
      objectKey: audioKey,
      contentType: audioSig.detectedMime,
      bytes: audioBytes,
      byteLength: audioBytes.length,
      ownerAccountId,
    });
    audioRef = put.reference;
  } catch (err) {
    return errorJson(
      "storage-write-failed",
      err instanceof Error ? err.message : "Storage write failed",
      500,
    );
  }

  let coverRef: string | null = null;
  if (coverBytes && coverMime) {
    try {
      const ext =
        coverMime === "image/jpeg"
          ? "jpg"
          : coverMime === "image/png"
          ? "png"
          : "webp";
      const coverKey = `cover-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const put = await storage.putObject({
        objectKey: coverKey,
        contentType: coverMime,
        bytes: coverBytes,
        byteLength: coverBytes.length,
        ownerAccountId,
      });
      coverRef = put.reference;
    } catch {
      // Non-fatal · we persisted the audio · default cover will render.
      coverRef = null;
    }
  }

  let backgroundRef: string | null = null;
  if (backgroundBytes && backgroundMime) {
    try {
      const ext =
        backgroundMime === "image/jpeg"
          ? "jpg"
          : backgroundMime === "image/png"
          ? "png"
          : "webp";
      const bgKey = `background-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const put = await storage.putObject({
        objectKey: bgKey,
        contentType: backgroundMime,
        bytes: backgroundBytes,
        byteLength: backgroundBytes.length,
        ownerAccountId,
      });
      backgroundRef = put.reference;
    } catch {
      backgroundRef = null;
    }
  }

  // --- Persist row ---
  // Owner-authorised 2026-10-31 (music-upload-audit · finding #9):
  // use insertMusicTrackWithQuota so quota is re-checked INSIDE the
  // write lock. Prevents the race where two concurrent uploads both
  // pass the soft route-level check (lines 178-196) and both land.
  try {
    const row = await insertMusicTrackWithQuota(
      {
        owner_account_id: ownerAccountId,
        business_id: null,
        source_type: "uploaded_audio",
        title,
        artist,
        album: null,
        duration_ms: probedDurationMs,
        media_url: audioRef,
        source_url: null,
        cover_image_url: coverRef,
        background_image_url: backgroundRef,
        byte_size: audioBytes.length,
        mime_type: audioSig.detectedMime,
        bitrate_kbps: probedBitrateKbps,
        rights_declaration: rightsDeclaration,
        rights_notes: null,
      },
      { maxBytes: MAX_PER_ACCOUNT_BYTES, maxTracks: MAX_PER_ACCOUNT_TRACKS },
    );
    // Owner-authorised 2026-10-30 · if a description was provided
    // during upload, persist it via the metadata update path · the
    // insert signature stays unchanged to minimise the schema diff.
    if (description) {
      try {
        await (
          await import("@/lib/nex-native/music/music-repository")
        ).updateTrackMetadata({
          trackId: row.id,
          ownerAccountId,
          description,
        });
      } catch {
        /* non-fatal · track is uploaded, description can be edited
           later via the preview page. */
      }
    }
    return NextResponse.json({ ok: true, data: { trackId: row.id } });
  } catch (err) {
    // Rollback the storage writes if the row insert failed. This covers
    // both the lock-race QuotaExceededError (finding #9) and any other
    // repository failure. The soft route-level check above cannot
    // catch the race because it reads snapshot state outside the lock.
    try {
      await storage.deleteObject({ reference: audioRef });
      if (coverRef) await storage.deleteObject({ reference: coverRef });
      if (backgroundRef) await storage.deleteObject({ reference: backgroundRef });
    } catch {
      // Fire-and-forget cleanup. The dead-letter design (audit #2)
      // will cover this gap separately.
    }
    if (err instanceof QuotaExceededError) {
      return errorJson(
        err.kind === "bytes" ? "storage-quota-exceeded" : "track-count-exceeded",
        err.message,
        429,
      );
    }
    return errorJson(
      "unknown",
      err instanceof Error ? err.message : "Could not record track",
      500,
    );
  }
}
