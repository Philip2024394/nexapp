// src/app/nex-native/create/upload-music/preview/[trackId]/page.tsx
//
// Owner-authorised 2026-10-29 (preview-first flow) · server shell
// for the post-upload preview page. Fetches the track row, mints
// signed URLs for cover + background + audio, hands them to the
// client component which renders a Live-surface mock plus the
// NexMusicPlayerOverlay. The author then chooses Edit or Go Live.

import { notFound, redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  getTrackById,
  bumpTrackViewCount,
  hasLikedTrack,
  listTracksByOwner,
} from "@/lib/nex-native/music/music-repository";
import { getMusicStorageAdapter } from "@/lib/nex-native/music/storage-adapter";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
import { PreviewClient } from "./_preview-client";
import type { NexMusicTrackRow } from "@/lib/nex-native/music/types";

export const metadata = { title: "Preview · NEX Music" };

export default async function PreviewPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly trackId: string }>;
  readonly searchParams: Promise<{ readonly edit?: string }>;
}): Promise<React.JSX.Element> {
  const { trackId } = await params;
  const { edit } = await searchParams;
  const startInEditMode = edit === "1";
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(
      `/nex-native/sign-in?next=${encodeURIComponent(`/nex-native/create/upload-music/preview/${trackId}`)}`,
    );
  }
  const track = await getTrackById(trackId);
  if (!track || track.owner_account_id !== session.account.id) {
    notFound();
  }

  // Owner-authorised 2026-10-29 (library card metrics) · bump view
  // counter on every preview load. Fire-and-forget · failures do
  // not block the render.
  void bumpTrackViewCount({
    trackId,
    ownerAccountId: session.account.id,
  }).catch(() => undefined);

  const likedByMe = await hasLikedTrack({
    trackId,
    likerAccountId: session.account.id,
  });
  // Owner-authorised 2026-10-31 (Phase B+ · reference-prefix-aware
  // factory). Each sign call now picks the correct adapter based on
  // the reference prefix (fs:// → dev FS · sb:// → Supabase Storage).
  // Legacy fs:// and new sb:// rows coexist in the same tracks snapshot
  // and play transparently.
  const signRef = async (ref: string) => {
    const { signedUrl } = await getMusicStorageAdapter(ref).getSignedReadUrl({
      reference: ref,
      ownerAccountId: session.account.id,
      expiresInSeconds: 3600,
    });
    return signedUrl;
  };

  let audioUrl: string | null = null;
  let coverUrl: string | null = null;
  let backgroundUrl: string | null = null;
  if (track.media_url) {
    audioUrl = await signRef(track.media_url);
  }
  if (
    track.cover_image_url &&
    (track.cover_image_url.startsWith("fs://") ||
      track.cover_image_url.startsWith("sb://"))
  ) {
    coverUrl = await signRef(track.cover_image_url);
  } else if (track.cover_image_url) {
    coverUrl = track.cover_image_url;
  }
  if (
    track.background_image_url &&
    (track.background_image_url.startsWith("fs://") ||
      track.background_image_url.startsWith("sb://"))
  ) {
    backgroundUrl = await signRef(track.background_image_url);
  } else if (track.background_image_url) {
    backgroundUrl = track.background_image_url;
  }

  // Owner-authorised 2026-10-29 · broadcaster chip on the music
  // overlay reads from the account profile (nex_account_profile).
  // Failure is non-fatal · the overlay falls back to its "NEX Music"
  // label when the avatar is missing.
  let selfAvatarUrl: string | null = null;
  try {
    const profile = await getProfileByAccountId(session.account.id);
    selfAvatarUrl = profile?.avatar_url ?? null;
  } catch {
    selfAvatarUrl = null;
  }

  // Owner-authorised 2026-10-29 (expanded cycle · next + prev
  // siblings include PRIVATE tracks) · the preview surface is
  // Hendra's own self-view · her private tracks are legitimately
  // part of her up-next cycle. `removed` tracks remain filtered
  // out. Visibility filter widened from `=== "shared_live"` to
  // `!== "removed"` so e.g. Hotel California (currently private)
  // appears in the next-up chronological wrap.
  const siblingTracks = await listTracksByOwner(session.account.id);
  const chronologicalCycle = siblingTracks
    .filter((t) => t.visibility !== "removed")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const currentChronoIdx = chronologicalCycle.findIndex(
    (t) => t.id === track.id,
  );
  let nextTrack: NexMusicTrackRow | null = null;
  let prevTrack: NexMusicTrackRow | null = null;
  if (currentChronoIdx !== -1 && chronologicalCycle.length > 1) {
    nextTrack =
      chronologicalCycle[
        (currentChronoIdx + 1) % chronologicalCycle.length
      ] ?? null;
    prevTrack =
      chronologicalCycle[
        (currentChronoIdx - 1 + chronologicalCycle.length) %
          chronologicalCycle.length
      ] ?? null;
  } else if (currentChronoIdx === -1) {
    // Current track is removed (should not happen · getTrackById
    // returns null first) · fall back to oldest live-worthy sibling.
    nextTrack = chronologicalCycle[0] ?? null;
  }
  let nextCoverUrl: string | null = null;
  let nextBackgroundUrl: string | null = null;
  // Owner-authorised 2026-10-31 · world-class gapless · also mint
  // next/prev audio URLs so the shell preloader can warm the browser
  // cache before swipe · the song starts the instant the user flips.
  let nextAudioUrl: string | null = null;
  if (nextTrack) {
    try {
      if (
        nextTrack.cover_image_url &&
        (nextTrack.cover_image_url.startsWith("fs://") ||
          nextTrack.cover_image_url.startsWith("sb://"))
      ) {
        nextCoverUrl = await signRef(nextTrack.cover_image_url);
      } else if (nextTrack.cover_image_url) {
        nextCoverUrl = nextTrack.cover_image_url;
      }
      if (
        nextTrack.background_image_url &&
        (nextTrack.background_image_url.startsWith("fs://") ||
          nextTrack.background_image_url.startsWith("sb://"))
      ) {
        nextBackgroundUrl = await signRef(nextTrack.background_image_url);
      } else if (nextTrack.background_image_url) {
        nextBackgroundUrl = nextTrack.background_image_url;
      }
      if (
        nextTrack.media_url &&
        (nextTrack.media_url.startsWith("fs://") ||
          nextTrack.media_url.startsWith("sb://"))
      ) {
        nextAudioUrl = await signRef(nextTrack.media_url);
      }
    } catch {
      /* signing failures are non-fatal · card falls back to text */
    }
  }

  // World-class preload path · prev track covers are signed here so the
  // client can hint-preload them (link rel=preload). Symmetric to the
  // next-track block above. Signing failures stay non-fatal.
  let prevCoverUrl: string | null = null;
  let prevBackgroundUrl: string | null = null;
  let prevAudioUrl: string | null = null;
  if (prevTrack) {
    try {
      if (
        prevTrack.cover_image_url &&
        (prevTrack.cover_image_url.startsWith("fs://") ||
          prevTrack.cover_image_url.startsWith("sb://"))
      ) {
        prevCoverUrl = await signRef(prevTrack.cover_image_url);
      } else if (prevTrack.cover_image_url) {
        prevCoverUrl = prevTrack.cover_image_url;
      }
      if (
        prevTrack.background_image_url &&
        (prevTrack.background_image_url.startsWith("fs://") ||
          prevTrack.background_image_url.startsWith("sb://"))
      ) {
        prevBackgroundUrl = await signRef(prevTrack.background_image_url);
      } else if (prevTrack.background_image_url) {
        prevBackgroundUrl = prevTrack.background_image_url;
      }
      if (
        prevTrack.media_url &&
        (prevTrack.media_url.startsWith("fs://") ||
          prevTrack.media_url.startsWith("sb://"))
      ) {
        prevAudioUrl = await signRef(prevTrack.media_url);
      }
    } catch {
      /* signing failures are non-fatal · preload hint simply skipped */
    }
  }

  // Owner-authorised 2026-10-30 (Main Feed → Creator Music feature) ·
  // precompute the full eligible-tracks list for the library overlay.
  // Reuses `chronologicalCycle` (already filtered to `visibility !==
  // "removed"`) so there is one single source of truth for "what
  // tracks are shown to this viewer." Covers are signed owner-scoped
  // (viewer == owner on this surface — same auth model as the audio
  // + background signing above). When the sealed D1 public-listening
  // primitive lands, the signing calls here would swap to the public
  // path; the overlay component contract does not change.
  // Owner-authorised 2026-10-30 · library overlay shows most popular
  // tracks first. Popularity score = like_count + share_count (the
  // signals the owner called out · "most likes or shares"). view_count
  // acts as a tiebreaker so an older track with many plays still beats
  // a newer silent one, and title keeps the order deterministic when
  // all counts are equal.
  const popularityOrdered = [...chronologicalCycle].sort((a, b) => {
    const scoreA = a.like_count + a.share_count;
    const scoreB = b.like_count + b.share_count;
    if (scoreB !== scoreA) return scoreB - scoreA;
    if (b.view_count !== a.view_count) return b.view_count - a.view_count;
    return a.title.localeCompare(b.title);
  });
  const libraryTracks = await Promise.all(
    popularityOrdered.map(async (t) => {
      let signedCover: string | null = null;
      if (
        t.cover_image_url &&
        (t.cover_image_url.startsWith("fs://") ||
          t.cover_image_url.startsWith("sb://"))
      ) {
        try {
          signedCover = await signRef(t.cover_image_url);
        } catch {
          signedCover = null;
        }
      } else if (t.cover_image_url) {
        signedCover = t.cover_image_url;
      }
      return {
        id: t.id,
        title: t.title,
        artist: t.artist,
        coverUrl: signedCover,
        viewCount: t.view_count,
      };
    }),
  );

  return (
    <PreviewClient
      track={track}
      audioUrl={audioUrl}
      coverUrl={coverUrl}
      backgroundUrl={backgroundUrl}
      selfDisplayName={session.account.display_name ?? "You"}
      selfAvatarUrl={selfAvatarUrl}
      selfNexHandle={session.account.nex_handle ?? null}
      startInEditMode={startInEditMode}
      initiallyLiked={likedByMe}
      nextTrack={nextTrack}
      nextCoverUrl={nextCoverUrl}
      nextBackgroundUrl={nextBackgroundUrl}
      nextAudioUrl={nextAudioUrl}
      prevTrack={prevTrack}
      prevCoverUrl={prevCoverUrl}
      prevBackgroundUrl={prevBackgroundUrl}
      prevAudioUrl={prevAudioUrl}
      libraryTracks={libraryTracks}
    />
  );
}
