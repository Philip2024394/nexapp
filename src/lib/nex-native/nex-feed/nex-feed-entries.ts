// src/lib/nex-native/nex-feed/nex-feed-entries.ts
//
// Owner directive 2026-10-30 · "when a user selects Live on their music
// preview, the music post must enter the NEX feed". The single NEX feed
// now carries BOTH uploaded videos AND published-music active slots.
// This module composes the two into one ordered pool consumed by the
// nex-feed route (/nex-native/nex-feed[/videoId]).
//
// Ordering rule (v2, owner directive 2026-10-30):
//   · Music posts are INTERLEAVED through the video pool so they are
//     discovered during swiping rather than clustered at the top.
//   · Each music post is placed at a position evenly spaced across the
//     combined pool: music `i` out of `M` lands at
//     `floor((i + 0.5) * total / M)`. This guarantees no two music
//     posts are adjacent (as long as there are ≥ 1 video per music).
//   · Within the music subset, newest publishedAt first — so a just-
//     published post appears earliest in the sprinkled sequence.
//   · The publisher of a music post is still routed directly to their
//     post via `/nex-native/nex-feed/music-<trackId>` after publish,
//     regardless of its interleaved position.
//
// Feed-entry URL slug scheme:
//   · music → `music-<uuid>`
//   · video → raw video id (unchanged · e.g. `dev-video-1`)
// The `music-` prefix is the discriminator the route page uses to pick
// the correct viewer client (music vs. video). No existing video id in
// the dev manifest or in `nex_uploaded_video` starts with `music-`.

import "server-only";
import {
  listPublishedUploadedVideos,
  type UploadedVideoRow,
} from "../live-broadcast/uploaded-video-service";
import {
  listDevUploadedVideos,
  isDevManifestActive,
  devVideoPublicUrl,
  DEV_VIDEO_MANIFEST,
} from "../live-broadcast/dev-video-manifest";
import { listActiveMusicFeedEntries, type MusicFeedEntry } from "../music/active-music-feed-reader";

/** The URL slug prefix that marks a feed entry as a music post. */
export const MUSIC_FEED_ENTRY_PREFIX = "music-";

/** Owner-authorised 2026-11-02 · handle-based alias prefix.
 *  URL form: `/nex-feed/music-nex-<handle>` · stable per creator,
 *  resolves at request time to the creator's current active-slot
 *  track. Backward compat: UUID-form `music-<trackId>` continues to
 *  work for every existing deep link and share URL. */
export const MUSIC_FEED_ENTRY_HANDLE_PREFIX = "music-nex-";

export function musicEntryIdForTrack(trackId: string): string {
  return `${MUSIC_FEED_ENTRY_PREFIX}${trackId}`;
}

/** Mint the handle-based alias URL slug. Expects the full `nex-NNNNN`
 *  handle (NOT the bare numeric id). Example: `nex-99901` →
 *  `music-nex-99901`. */
export function musicEntryIdForHandle(nexHandle: string): string {
  return `${MUSIC_FEED_ENTRY_PREFIX}${nexHandle}`;
}

export function isMusicEntryId(id: string): boolean {
  return id.startsWith(MUSIC_FEED_ENTRY_PREFIX);
}

/** True iff the slug is the handle-form (`music-nex-NNNNN`). */
export function isMusicHandleEntryId(id: string): boolean {
  return id.startsWith(MUSIC_FEED_ENTRY_HANDLE_PREFIX);
}

/** Extract the full `nex-NNNNN` handle from a handle-form slug.
 *  Returns null for UUID-form slugs or non-music slugs. */
export function handleFromMusicHandleEntryId(id: string): string | null {
  if (!isMusicHandleEntryId(id)) return null;
  // Strip the `music-` prefix (keep the `nex-` prefix as part of the handle)
  return id.slice(MUSIC_FEED_ENTRY_PREFIX.length);
}

export function trackIdFromMusicEntryId(id: string): string | null {
  if (!isMusicEntryId(id)) return null;
  // Handle-form slugs do NOT contain a track UUID; callers should
  // resolve the handle to an account + active-slot track separately.
  // This function returns the raw suffix (UUID or `nex-NNNNN` string).
  return id.slice(MUSIC_FEED_ENTRY_PREFIX.length);
}

export interface VideoFeedEntry {
  readonly kind: "video";
  readonly feedEntryId: string;
  readonly video: UploadedVideoRow;
  readonly publicUrl: string;
}

export interface MusicFeedEntryWrapped {
  readonly kind: "music";
  readonly feedEntryId: string;
  readonly entry: MusicFeedEntry;
}

export type NexFeedEntry = VideoFeedEntry | MusicFeedEntryWrapped;

/** Resolve a single video entry (dev manifest OR real DB). Returns null
 *  on not-found. */
export async function resolveVideoFeedEntry(
  videoId: string,
): Promise<VideoFeedEntry | null> {
  if (isDevManifestActive()) {
    const manifestEntry = DEV_VIDEO_MANIFEST.find((e) => e.id === videoId);
    if (!manifestEntry) return null;
    const rows = listDevUploadedVideos({ limit: DEV_VIDEO_MANIFEST.length });
    const row = rows.find((r) => r.id === videoId);
    if (!row) return null;
    return {
      kind: "video",
      feedEntryId: videoId,
      video: row,
      publicUrl: devVideoPublicUrl(manifestEntry),
    };
  }
  // Real-DB path · public URL assembled from storage_object_path.
  const rows = await listPublishedUploadedVideos({ limit: 100 }).catch(() => []);
  const row = rows.find((r) => r.id === videoId);
  if (!row) return null;
  const url = `${process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? ""}/storage/v1/object/public/${row.storage_bucket}/${row.storage_object_path}`;
  return {
    kind: "video",
    feedEntryId: videoId,
    video: row,
    publicUrl: url,
  };
}

interface AccountLookup {
  readonly id: string;
  readonly displayName: string;
  readonly nexHandle: string | null;
  readonly avatarUrl: string | null;
}

interface ListNexFeedEntriesArgs {
  readonly nowMs: number;
  readonly accountLookup?: (
    ids: readonly string[],
  ) => Promise<readonly AccountLookup[]>;
}

/** Compose music active-slots + uploaded videos into a single ordered
 *  feed pool. Fail-open on either side — if music composition errors,
 *  the pool is videos-only; if videos error, pool is music-only. */
export async function listNexFeedEntries(
  args: ListNexFeedEntriesArgs,
): Promise<readonly NexFeedEntry[]> {
  const [musicEntries, videoRows] = await Promise.all([
    listActiveMusicFeedEntries({
      limit: 50,
      nowMs: args.nowMs,
      accountLookup: args.accountLookup,
    }).catch<readonly MusicFeedEntry[]>(() => []),
    (async (): Promise<readonly UploadedVideoRow[]> => {
      if (isDevManifestActive()) {
        return listDevUploadedVideos({ limit: 100 });
      }
      return await listPublishedUploadedVideos({ limit: 50 }).catch(() => []);
    })(),
  ]);

  const musicWrapped: MusicFeedEntryWrapped[] = musicEntries.map((e) => ({
    kind: "music",
    feedEntryId: musicEntryIdForTrack(e.trackId),
    entry: e,
  }));

  const videoWrapped: VideoFeedEntry[] = [];
  for (const row of videoRows) {
    let publicUrl: string;
    if (isDevManifestActive()) {
      const manifestEntry = DEV_VIDEO_MANIFEST.find((e) => e.id === row.id);
      if (!manifestEntry) continue;
      publicUrl = devVideoPublicUrl(manifestEntry);
    } else {
      publicUrl = `${process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? ""}/storage/v1/object/public/${row.storage_bucket}/${row.storage_object_path}`;
    }
    videoWrapped.push({
      kind: "video",
      feedEntryId: row.id,
      video: row,
      publicUrl,
    });
  }

  // v2 ordering: interleave music into the video pool so music posts
  // are discovered during swipe. See the file header for the formula.
  return interleaveMusicIntoVideos(musicWrapped, videoWrapped);
}

/** Interleave music posts into the video pool at evenly-spaced positions.
 *  Deterministic given the same inputs. Exposed for testing. */
export function interleaveMusicIntoVideos(
  music: readonly MusicFeedEntryWrapped[],
  videos: readonly VideoFeedEntry[],
): readonly NexFeedEntry[] {
  if (music.length === 0) return videos;
  if (videos.length === 0) return music;
  const total = music.length + videos.length;
  // Position of music post `i` in the FINAL ordered list.
  const musicSlots = new Set<number>();
  for (let i = 0; i < music.length; i++) {
    // Even spacing · 1-based half-steps so no music lands at slot 0 when
    // there are enough videos to push it later.
    const slot = Math.min(
      total - 1,
      Math.floor(((i + 0.5) * total) / music.length),
    );
    // If a slot collides (dense ratio), nudge forward to the next free slot.
    let s = slot;
    while (musicSlots.has(s) && s < total - 1) s++;
    while (musicSlots.has(s) && s > 0) s--;
    musicSlots.add(s);
  }
  // Build the final list by stepping through positions, pulling music
  // from the queue when the position is a music slot, else pulling a
  // video.
  const musicQueue = [...music];
  const videoQueue = [...videos];
  const result: NexFeedEntry[] = [];
  for (let pos = 0; pos < total; pos++) {
    if (musicSlots.has(pos) && musicQueue.length > 0) {
      result.push(musicQueue.shift()!);
    } else if (videoQueue.length > 0) {
      result.push(videoQueue.shift()!);
    } else if (musicQueue.length > 0) {
      // Ran out of videos — tail with remaining music.
      result.push(musicQueue.shift()!);
    }
  }
  return result;
}
