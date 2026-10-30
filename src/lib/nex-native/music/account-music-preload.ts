// src/lib/nex-native/music/account-music-preload.ts
//
// Owner-authorised 2026-10-31 · world-class "premium app feel".
//
// Server-side helper used by surfaces that want to warm the viewer's
// browser cache for an account's music BEFORE the viewer taps the
// library / music link. Resolves the owner's top eligible track +
// signs its cover + background + audio URLs, and optionally returns
// a handful of library-row cover URLs for the library overlay.
//
// Fail-open: any resolution/signing error returns `null` fields; the
// caller renders the empty <AccountMusicPreloader /> and the user
// experience degrades to the pre-fix state (slide loads on tap, not
// before). No throws reach the page render path.

import "server-only";
import { listTracksByOwner } from "./music-repository";
import { getMusicStorageAdapter } from "./storage-adapter";
import type { NexMusicTrackRow } from "./types";

export interface AccountMusicPreloadBundle {
  readonly topTrackHref: string | null;
  readonly topCoverUrl: string | null;
  readonly topBackgroundUrl: string | null;
  readonly topAudioUrl: string | null;
  readonly libraryCoverUrls: readonly string[];
}

const EMPTY_BUNDLE: AccountMusicPreloadBundle = {
  topTrackHref: null,
  topCoverUrl: null,
  topBackgroundUrl: null,
  topAudioUrl: null,
  libraryCoverUrls: [],
};

const LIBRARY_PREVIEW_COUNT = 5;

/** Pick the "top" track for cache-warming. On this surface the
 *  heuristic is popularity (likes + shares, tiebreak views, tiebreak
 *  title) matching the sealed library-overlay ordering. Filters to
 *  non-removed shared_live tracks only — private tracks are never
 *  preloaded for other viewers. */
function pickTopTrackForViewer(
  tracks: readonly NexMusicTrackRow[],
  viewerIsOwner: boolean,
): NexMusicTrackRow | null {
  const eligible = tracks.filter((t) => {
    if (t.visibility === "removed") return false;
    if (!viewerIsOwner && t.visibility !== "shared_live") return false;
    return true;
  });
  if (eligible.length === 0) return null;
  const sorted = [...eligible].sort((a, b) => {
    const sa = (a.like_count ?? 0) + (a.share_count ?? 0);
    const sb = (b.like_count ?? 0) + (b.share_count ?? 0);
    if (sb !== sa) return sb - sa;
    const va = a.view_count ?? 0;
    const vb = b.view_count ?? 0;
    if (vb !== va) return vb - va;
    return a.title.localeCompare(b.title);
  });
  return sorted[0] ?? null;
}

async function signRef(
  ref: string | null,
  ownerAccountId: string,
): Promise<string | null> {
  if (!ref) return null;
  if (!ref.startsWith("fs://") && !ref.startsWith("sb://")) return ref;
  try {
    const s = await getMusicStorageAdapter(ref).getSignedReadUrl({
      reference: ref,
      ownerAccountId,
      expiresInSeconds: 3600,
    });
    return s.signedUrl;
  } catch {
    return null;
  }
}

/** Build a preload bundle for `ownerAccountId`'s music. Pass
 *  `viewerIsOwner=true` to include the owner's PRIVATE tracks in the
 *  pool (same visibility rule as the preview page). */
export async function resolveAccountMusicPreload(args: {
  readonly ownerAccountId: string;
  readonly viewerIsOwner: boolean;
}): Promise<AccountMusicPreloadBundle> {
  const { ownerAccountId, viewerIsOwner } = args;
  let tracks: readonly NexMusicTrackRow[] = [];
  try {
    tracks = await listTracksByOwner(ownerAccountId);
  } catch {
    return EMPTY_BUNDLE;
  }
  const top = pickTopTrackForViewer(tracks, viewerIsOwner);
  if (!top) return EMPTY_BUNDLE;

  const [topCoverUrl, topBackgroundUrl, topAudioUrl] = await Promise.all([
    signRef(top.cover_image_url, ownerAccountId),
    signRef(top.background_image_url, ownerAccountId),
    signRef(top.media_url, ownerAccountId),
  ]);

  // Also sign a handful of OTHER tracks' covers so the library overlay
  // paints without thumbnail pop-in when the viewer opens it.
  const libraryCovers = await Promise.all(
    tracks
      .filter((t) => t.id !== top.id)
      .filter((t) => t.visibility !== "removed")
      .filter((t) => viewerIsOwner || t.visibility === "shared_live")
      .slice(0, LIBRARY_PREVIEW_COUNT)
      .map((t) => signRef(t.cover_image_url, ownerAccountId)),
  );
  const libraryCoverUrls = libraryCovers.filter(
    (u): u is string => typeof u === "string" && u.length > 0,
  );

  return {
    topTrackHref: `/nex-native/nex-feed/music-${top.id}`,
    topCoverUrl,
    topBackgroundUrl,
    topAudioUrl,
    libraryCoverUrls,
  };
}
