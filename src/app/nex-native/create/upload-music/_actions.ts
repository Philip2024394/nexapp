// src/app/nex-native/create/upload-music/_actions.ts
//
// Owner-authorised 2026-10-29 · DRAFT §14 S2.3.
// Server actions for the non-upload parts of the music journey:
// adding a Spotify/YouTube URL track and deleting an existing track.
// MP3/M4A uploads flow through the dedicated multipart API route
// (`/api/nex-native/music/upload`) due to Next's server-action body
// limits.

"use server";

import { revalidatePath } from "next/cache";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  hardDeleteTrack,
  insertMusicTrack,
  setTrackVisibility,
  getTrackById,
  listTracksByOwner,
  updateTrackMetadata,
  bumpTrackViewCount,
  bumpTrackPlayCountAnyViewer,
  bumpTrackShareCount,
  toggleTrackLike,
  hasLikedTrack,
} from "@/lib/nex-native/music/music-repository";
import {
  publishActiveMusicSlot,
  unpublishActiveMusicSlot,
  generatePublishRequestId,
} from "@/lib/nex-native/music/active-slot-repository";
import {
  recordRateLimitedAttempt,
  type NexMusicRateLimitAction,
} from "@/lib/nex-native/music/music-rate-limit";

/* Owner-approved 2026-10-29 (Stage 5C · H3) · wrap any mutating
   action in the dev-only in-memory limiter. Returns the standard
   `NexMusicResult` shape with code "rate-limited" when blocked.
   See music-rate-limit.ts for the explicit production-enforcement
   limitations · this is NOT production-grade. */
function rateLimitedReject(
  action: NexMusicRateLimitAction,
  accountId: string,
): NexMusicResult<never> | null {
  const check = recordRateLimitedAttempt(action, accountId);
  if (check.ok) return null;
  return {
    ok: false,
    code: "rate-limited",
    message: `Too many ${action} attempts · limit ${check.limit}/hour · try again in ${check.resetInSeconds}s`,
  };
}
import { getMusicStorageAdapter } from "@/lib/nex-native/music/storage-adapter";
import {
  validateSpotifyUrl,
  validateYouTubeUrl,
} from "@/lib/nex-native/music/music-url-validators";
import { sanitiseName, sanitiseTitle, sanitiseDescription, MUSIC_UPLOAD_LIMITS } from "@/lib/nex-native/music/music-upload-validation";
import type {
  NexMusicResult,
  NexMusicRightsDeclaration,
  NexMusicVisibility,
} from "@/lib/nex-native/music/types";

type RawRights = unknown;
function coerceRights(raw: RawRights): NexMusicRightsDeclaration | null {
  if (raw === "owner_content" || raw === "licensed" || raw === "public_domain") {
    return raw;
  }
  return null;
}

export async function createExternalMusicTrackAction(input: {
  readonly sourceType: "spotify_url" | "youtube_url";
  readonly url: string;
  readonly title: string;
  readonly artist: string | null;
  readonly rightsDeclaration: NexMusicRightsDeclaration;
}): Promise<NexMusicResult<{ readonly trackId: string }>> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return { ok: false, code: "not-signed-in", message: "Sign in required" };
  }
  const title = sanitiseTitle(input.title);
  if (!title) {
    return { ok: false, code: "invalid-input", message: "Title is required" };
  }
  const artist = sanitiseName(input.artist, MUSIC_UPLOAD_LIMITS.MAX_ARTIST_LEN);
  const rights = coerceRights(input.rightsDeclaration);
  if (!rights) {
    return {
      ok: false,
      code: "rights-required",
      message: "Rights declaration is required",
    };
  }

  let sourceUrl: string;
  if (input.sourceType === "spotify_url") {
    const v = validateSpotifyUrl(input.url);
    if (!v.ok) {
      return {
        ok: false,
        code: "invalid-input",
        message: `Spotify URL rejected: ${v.reason}`,
      };
    }
    sourceUrl = v.canonical;
  } else {
    const v = validateYouTubeUrl(input.url);
    if (!v.ok) {
      return {
        ok: false,
        code: "invalid-input",
        message: `YouTube URL rejected: ${v.reason}`,
      };
    }
    sourceUrl = v.canonical;
  }

  try {
    const row = await insertMusicTrack({
      owner_account_id: session.account.id,
      business_id: null,
      source_type: input.sourceType,
      title,
      artist,
      album: null,
      duration_ms: null,
      media_url: null,
      source_url: sourceUrl,
      cover_image_url: null,
      byte_size: null,
      mime_type: null,
      rights_declaration: rights,
      rights_notes: null,
    });
    revalidatePath("/nex-native/music");
    revalidatePath("/nex-native/create/upload-music");
    return { ok: true, data: { trackId: row.id } };
  } catch (err) {
    return {
      ok: false,
      code: "unknown",
      message: err instanceof Error ? err.message : "Could not save track",
    };
  }
}

export async function setMusicTrackVisibilityAction(input: {
  readonly trackId: string;
  readonly visibility: NexMusicVisibility;
}): Promise<NexMusicResult<{ readonly trackId: string }>> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return { ok: false, code: "not-signed-in", message: "Sign in required" };
  }
  if (
    input.visibility !== "private" &&
    input.visibility !== "shared_live" &&
    input.visibility !== "removed"
  ) {
    return { ok: false, code: "invalid-input", message: "Invalid visibility" };
  }
  // Owner-approved 2026-10-29 (Stage 5C · H3) · rate-limit only the
  // SOFT-DELETE transition (visibility → "removed"). Share/unshare
  // toggles between "private" and "shared_live" are low-cost and
  // intentionally unrated.
  if (input.visibility === "removed") {
    const limited = rateLimitedReject("soft_delete", session.account.id);
    if (limited) return limited;
  }
  const row = await setTrackVisibility({
    trackId: input.trackId,
    ownerAccountId: session.account.id,
    visibility: input.visibility,
  });
  if (!row) {
    return { ok: false, code: "not-found", message: "Track not found" };
  }
  revalidatePath("/nex-native/music");
  return { ok: true, data: { trackId: row.id } };
}

/** Owner-authorised 2026-10-30 (M-2 of NEX Music Publishing → Live Feed) ·
 *  publish a recorded music track as the creator's active Music post in
 *  the shared NEX Live Feed.
 *
 *  Dev-FS backing · the production Supabase path writes via Migration 236's
 *  `nex_music_publish_as_active_slot` RPC (DRAFT, not applied). The
 *  observable contract from the client's point of view is identical:
 *  input `{ trackId, publishAsMode, publishRequestId? }` → output
 *  `{ ok, data: { requestId, trackId, publishGeneration } }` or an
 *  honest `{ ok: false, code, message }` with one of the locked error
 *  classes.
 *
 *  Trust boundary (R7-3):
 *    · This action is the end-user authentication boundary. It resolves
 *      the session on the server before calling the repository.
 *    · The repository's owner-check is defense-in-depth against bugs,
 *      NOT against server compromise.
 *
 *  Dev-impersonation handling (D11-B Option A, recommended default):
 *    · Not yet enforced at the server-action layer. Owner-pending
 *      decision tracked in the sealed memory. Current behaviour: dev
 *      impersonation CAN publish; the audit table referenced at
 *      `dev-impersonation.ts:32-35` is NOT yet built. Flagged in the
 *      Live-Flow build report.
 *
 *  Rights-ack enforcement (D11-7 + Correction §1):
 *    · This action does NOT yet enforce the acknowledgement check.
 *      That check belongs to M-2 Part 2 (reads
 *      `nex_account_music_rights_ack`, Migration 237). Rights-ack
 *      enforcement is a separate owner authorisation. */
export async function publishMusicAsActivePostAction(input: {
  readonly trackId: string;
  readonly publishAsMode: "cover_audio" | "music_video";
  readonly publishRequestId?: string;
}): Promise<
  NexMusicResult<{
    readonly requestId: string;
    readonly trackId: string;
    readonly publishGeneration: number;
  }>
> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return { ok: false, code: "not-signed-in", message: "Sign in required" };
  }
  // Required request_id per locked F1. Server generates one when the
  // client doesn't supply (both paths produce the same durable dedup
  // behaviour).
  const requestId = input.publishRequestId ?? generatePublishRequestId();
  if (
    input.publishAsMode !== "cover_audio" &&
    input.publishAsMode !== "music_video"
  ) {
    return {
      ok: false,
      code: "invalid-input",
      message: "Invalid publish mode",
    };
  }
  const result = await publishActiveMusicSlot({
    requestId,
    ownerAccountId: session.account.id,
    trackId: input.trackId,
    publishAsMode: input.publishAsMode,
  });
  if (result.ok) {
    revalidatePath("/nex-native/nex-feed");
    revalidatePath("/nex-native/music");
  }
  return result;
}

/** Owner-authorised 2026-10-30 (M-2 companion) · soft-unpublish the
 *  caller's active Music post. The library track is NEVER deleted.
 *  Idempotent. */
export async function unpublishMusicActivePostAction(): Promise<
  NexMusicResult<{ readonly unpublished: boolean }>
> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return { ok: false, code: "not-signed-in", message: "Sign in required" };
  }
  const r = await unpublishActiveMusicSlot(session.account.id);
  revalidatePath("/nex-native/nex-feed");
  return { ok: true, data: { unpublished: r.unpublished } };
}

/** Mint a short-lived signed URL for an uploaded_audio track so the
 *  client-side <audio> element can play it. Owner identity is
 *  enforced server-side. External-source tracks (Spotify / YouTube)
 *  return `{ok:true, data:{signedUrl:null, sourceUrl:...}}` so the
 *  overlay can present the link-out instead. Also mints signed URLs
 *  for cover and background images when they are opaque adapter
 *  references. */
export async function getMusicPlayUrlAction(input: {
  readonly trackId: string;
}): Promise<
  NexMusicResult<{
    readonly signedUrl: string | null;
    readonly coverUrl: string | null;
    readonly backgroundUrl: string | null;
    readonly sourceUrl: string | null;
  }>
> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return { ok: false, code: "not-signed-in", message: "Sign in required" };
  }
  const track = await getTrackById(input.trackId);
  if (!track) {
    return { ok: false, code: "not-found", message: "Track not found" };
  }
  if (track.owner_account_id !== session.account.id) {
    return { ok: false, code: "forbidden", message: "Not the owner" };
  }

  const storage = getMusicStorageAdapter();
  let signedUrl: string | null = null;
  if (track.media_url) {
    const signed = await storage.getSignedReadUrl({
      reference: track.media_url,
      ownerAccountId: session.account.id,
      expiresInSeconds: 3600,
    });
    signedUrl = signed.signedUrl;
  }
  let coverUrl: string | null = null;
  if (track.cover_image_url && track.cover_image_url.startsWith("fs://")) {
    const signed = await storage.getSignedReadUrl({
      reference: track.cover_image_url,
      ownerAccountId: session.account.id,
      expiresInSeconds: 3600,
    });
    coverUrl = signed.signedUrl;
  } else if (track.cover_image_url) {
    coverUrl = track.cover_image_url;
  }
  let backgroundUrl: string | null = null;
  if (
    track.background_image_url &&
    track.background_image_url.startsWith("fs://")
  ) {
    const signed = await storage.getSignedReadUrl({
      reference: track.background_image_url,
      ownerAccountId: session.account.id,
      expiresInSeconds: 3600,
    });
    backgroundUrl = signed.signedUrl;
  } else if (track.background_image_url) {
    backgroundUrl = track.background_image_url;
  }
  return {
    ok: true,
    data: {
      signedUrl,
      coverUrl,
      backgroundUrl,
      sourceUrl: track.source_url,
    },
  };
}

/** Owner-authorised 2026-10-29 (preview-first flow) · update the
 *  editable metadata on a track the caller owns. Image fields are
 *  uploaded via the dedicated API route (/api/.../music/upload) when
 *  binary; this action handles title/artist text edits and existing-
 *  reference reassignment. */
export async function updateMusicTrackMetadataAction(input: {
  readonly trackId: string;
  readonly title?: string;
  readonly artist?: string | null;
  readonly coverImageUrl?: string | null;
  readonly backgroundImageUrl?: string | null;
  readonly description?: string | null;
}): Promise<NexMusicResult<{ readonly trackId: string }>> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return { ok: false, code: "not-signed-in", message: "Sign in required" };
  }
  let sanitisedTitle: string | undefined = undefined;
  if (input.title !== undefined) {
    const t = sanitiseTitle(input.title);
    if (!t) {
      return { ok: false, code: "invalid-input", message: "Title is required" };
    }
    sanitisedTitle = t;
  }
  let sanitisedArtist: string | null | undefined = undefined;
  if (input.artist !== undefined) {
    sanitisedArtist =
      input.artist === null
        ? null
        : sanitiseName(input.artist, MUSIC_UPLOAD_LIMITS.MAX_ARTIST_LEN);
  }
  let sanitisedDescription: string | null | undefined = undefined;
  if (input.description !== undefined) {
    sanitisedDescription =
      input.description === null ? null : sanitiseDescription(input.description);
  }

  const row = await updateTrackMetadata({
    trackId: input.trackId,
    ownerAccountId: session.account.id,
    title: sanitisedTitle,
    artist: sanitisedArtist,
    coverImageUrl: input.coverImageUrl,
    backgroundImageUrl: input.backgroundImageUrl,
    description: sanitisedDescription,
  });
  if (!row) {
    return { ok: false, code: "not-found", message: "Track not found" };
  }
  revalidatePath("/nex-native/music");
  revalidatePath("/nex-native/create/upload-music");
  revalidatePath(`/nex-native/create/upload-music/preview/${input.trackId}`);
  return { ok: true, data: { trackId: row.id } };
}

/** Server-rendered list of the broadcaster's `shared_live` tracks ·
 *  consumed by the Live surface to populate the Music picker. */
export async function listSharedLiveTracksAction(): Promise<
  NexMusicResult<{ readonly tracks: readonly import("@/lib/nex-native/music/types").NexMusicTrackRow[] }>
> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return { ok: false, code: "not-signed-in", message: "Sign in required" };
  }
  const all = await listTracksByOwner(session.account.id);
  return {
    ok: true,
    data: { tracks: all.filter((t) => t.visibility === "shared_live") },
  };
}

/** Owner-authorised 2026-10-29 (library card metrics) · bump view
 *  counter when the preview page server-renders. Ownership-scoped. */
export async function recordMusicTrackViewAction(input: {
  readonly trackId: string;
}): Promise<NexMusicResult<{ readonly viewCount: number }>> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, code: "not-signed-in", message: "Sign in required" };
  const limited = rateLimitedReject("preview", session.account.id);
  if (limited) return limited;
  const row = await bumpTrackViewCount({
    trackId: input.trackId,
    ownerAccountId: session.account.id,
  });
  if (!row) return { ok: false, code: "not-found", message: "Track not found" };
  return { ok: true, data: { viewCount: row.view_count } };
}

/** Owner-authorised 2026-10-30 · universal plays counter · any
 *  signed-in viewer increments the track's view_count on first
 *  playback per mount. Not ownership-scoped (any viewer bumps any
 *  track). Guest sessions are rejected per sealed Music Directory
 *  doctrine §12.4 (guest plays excluded from Phase 1 trending).
 *  Caller-side dedup via a ref prevents multiple bumps per mount.
 *
 *  Honest limitation: this is a Phase 1 approximate counter, not
 *  the sealed Phase 2 per-event nex_music_play ingestion with
 *  valid-play criteria (heard_ms threshold, exposure dedup window).
 *  Phase 2 analytics remain unauthorised. */
export async function recordMusicTrackPlayAction(input: {
  readonly trackId: string;
}): Promise<NexMusicResult<{ readonly viewCount: number }>> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, code: "not-signed-in", message: "Sign in required" };
  const limited = rateLimitedReject("preview", session.account.id);
  if (limited) return limited;
  const row = await bumpTrackPlayCountAnyViewer({ trackId: input.trackId });
  if (!row) return { ok: false, code: "not-found", message: "Track not found" };
  return { ok: true, data: { viewCount: row.view_count } };
}

/** Toggle a like for the caller on the given track. Likes are
 *  per-user; the aggregate `like_count` reflects the total. */
export async function toggleMusicTrackLikeAction(input: {
  readonly trackId: string;
}): Promise<NexMusicResult<{ readonly liked: boolean; readonly likeCount: number }>> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, code: "not-signed-in", message: "Sign in required" };
  const limited = rateLimitedReject("like", session.account.id);
  if (limited) return limited;
  const result = await toggleTrackLike({
    trackId: input.trackId,
    likerAccountId: session.account.id,
  });
  if (!result) return { ok: false, code: "not-found", message: "Track not found" };
  return { ok: true, data: { liked: result.liked, likeCount: result.row.like_count } };
}

/** Record a share event (bumps share_count). The actual share rail
 *  (link copy, native share-sheet, Spotify intent, etc.) is a
 *  separate scope not implemented here. */
export async function recordMusicTrackShareAction(input: {
  readonly trackId: string;
}): Promise<NexMusicResult<{ readonly shareCount: number }>> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, code: "not-signed-in", message: "Sign in required" };
  const limited = rateLimitedReject("share", session.account.id);
  if (limited) return limited;
  const row = await bumpTrackShareCount({
    trackId: input.trackId,
    ownerAccountId: session.account.id,
  });
  if (!row) return { ok: false, code: "not-found", message: "Track not found" };
  return { ok: true, data: { shareCount: row.share_count } };
}

export async function getMusicTrackLikeStateAction(input: {
  readonly trackId: string;
}): Promise<NexMusicResult<{ readonly liked: boolean }>> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, code: "not-signed-in", message: "Sign in required" };
  const liked = await hasLikedTrack({
    trackId: input.trackId,
    likerAccountId: session.account.id,
  });
  return { ok: true, data: { liked } };
}

export async function hardDeleteMusicTrackAction(input: {
  readonly trackId: string;
}): Promise<NexMusicResult<{ readonly trackId: string }>> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return { ok: false, code: "not-signed-in", message: "Sign in required" };
  }
  const existing = await getTrackById(input.trackId);
  if (!existing) {
    return { ok: false, code: "not-found", message: "Track not found" };
  }
  if (existing.owner_account_id !== session.account.id) {
    return { ok: false, code: "forbidden", message: "Not the owner" };
  }
  const storage = getMusicStorageAdapter();
  try {
    if (existing.media_url) {
      await storage.deleteObject({ reference: existing.media_url });
    }
    if (existing.cover_image_url && existing.cover_image_url.startsWith("fs://")) {
      await storage.deleteObject({ reference: existing.cover_image_url });
    }
  } catch {
    // Non-fatal · continue to row delete.
  }
  const row = await hardDeleteTrack({
    trackId: input.trackId,
    ownerAccountId: session.account.id,
  });
  if (!row) {
    return { ok: false, code: "not-found", message: "Track vanished mid-delete" };
  }
  revalidatePath("/nex-native/music");
  return { ok: true, data: { trackId: row.id } };
}
