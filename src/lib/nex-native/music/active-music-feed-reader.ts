// src/lib/nex-native/music/active-music-feed-reader.ts
//
// Owner-authorised 2026-10-30 (M-3 of NEX Music Publishing → Live Feed) ·
// Server-side reader that composes `MusicFeedEntry` rows for the shared
// Live Feed from the dev-FS active-slot + music-track + account tables.
//
// Trust / privilege:
//   · This file is server-only. Runs under service_role in production
//     (nexSupabaseAdmin equivalent). In dev, bypasses RLS because the
//     repository is file-backed.
//   · The reader is the only read path that joins active-slot metadata
//     with current nex_music_track eligibility. Per D2 Option 2a there
//     is no direct-client SELECT path on nex_creator_active_music.
//   · Each entry carries freshly-minted signed URLs for cover / audio /
//     background. The signing adapter re-verifies slot eligibility (slot
//     still active, track still eligible) before minting.
//
// Filter chain (sealed design §3.1 + Correction §2):
//   · slot.unpublished_at IS NULL
//   · slot.track_id IS NOT NULL
//   · track.visibility != 'removed'
//   · track.rights_declaration still permits publish ('owner_content' |
//     'licensed' | 'public_domain')
//   · slot.rights_declaration_frozen equals current track.rights_declaration
//     (if the owner has revoked rights post-publish, the slot is hidden)

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  listActiveMusicSlots,
} from "./active-slot-repository";
import { getMusicStorageAdapter } from "./storage-adapter";
import type {
  NexCreatorActiveMusicRow,
  NexMusicPublishAsMode,
  NexMusicTrackRow,
} from "./types";

const DATA_DIR = path.resolve(process.cwd(), ".dev-music-data");
const TRACKS_FILE = path.join(DATA_DIR, "tracks.json");

export interface MusicFeedEntry {
  readonly activeSlotOwnerId: string;
  readonly ownerAccountId: string;
  readonly ownerDisplayName: string;
  readonly ownerNexHandle: string | null;
  readonly ownerAvatarUrl: string | null;
  readonly trackId: string;
  readonly title: string;
  readonly artist: string | null;
  readonly publishAsMode: NexMusicPublishAsMode;
  /** Signed URL for the cover image. 60-second TTL in the dev adapter;
   *  production proxy also enforces per-request authorization. */
  readonly coverSignedUrl: string | null;
  /** Signed URL for the optional background image. May be null if the
   *  track has no background. */
  readonly backgroundSignedUrl: string | null;
  /** Signed URL for the audio stream. Only present when
   *  `publishAsMode === "cover_audio"`. */
  readonly audioSignedUrl: string | null;
  /** External-source URL for Spotify/YouTube tracks. Mutually exclusive
   *  with audioSignedUrl. */
  readonly sourceUrl: string | null;
  readonly publishedAtMs: number;
  readonly publishGeneration: number;
  readonly likeCount: number;
  readonly shareCount: number;
}

interface TracksSnapshot {
  readonly tracks: NexMusicTrackRow[];
}

async function loadTracks(): Promise<readonly NexMusicTrackRow[]> {
  // 2026-11-01 · owner-authorised DB wiring (NEX country programme ·
  // shared global feed). The FS adapter was dev-only; on Vercel the
  // `.dev-music-data/tracks.json` file does not exist so the feed
  // reader always returned []. In production we now read
  // `public.nex_music_track` via service_role · dev path keeps the FS
  // adapter untouched. Only non-removed rows are returned; the caller
  // filters further on rights + publication.
  if (process.env.NODE_ENV === "production") {
    const { nexSupabaseAdmin } = await import("../supabase-admin");
    const { data, error } = await nexSupabaseAdmin
      .from("nex_music_track")
      .select("*")
      .neq("visibility", "removed");
    if (error) return [];
    return (data ?? []) as readonly NexMusicTrackRow[];
  }
  try {
    const raw = await fs.readFile(TRACKS_FILE, "utf8");
    const parsed = JSON.parse(raw) as TracksSnapshot;
    if (parsed && Array.isArray(parsed.tracks)) return parsed.tracks;
  } catch {
    /* missing / corrupt · treat as empty */
  }
  return [];
}

interface AccountLookup {
  readonly id: string;
  readonly displayName: string;
  readonly nexHandle: string | null;
  readonly avatarUrl: string | null;
}

async function fetchAccountDetails(
  accountIds: readonly string[],
  lookup?: (ids: readonly string[]) => Promise<readonly AccountLookup[]>,
): Promise<Map<string, AccountLookup>> {
  const map = new Map<string, AccountLookup>();
  if (!lookup || accountIds.length === 0) return map;
  try {
    const rows = await lookup(accountIds);
    for (const r of rows) map.set(r.id, r);
  } catch {
    /* fail-open · entries render with fallback display name */
  }
  return map;
}

async function mintSignedUrlIfReference(
  ref: string | null,
  ownerAccountId: string,
  expiresInSeconds: number,
): Promise<string | null> {
  if (!ref) return null;
  // Owner-authorised 2026-10-31 (Phase B+ · reference-prefix-aware
  // factory). Both fs:// (dev FS) and sb:// (Supabase Storage) are
  // honoured transparently. Anything else is treated as an already-
  // valid absolute URL (external cover art, etc.) and returned as-is.
  if (!ref.startsWith("fs://") && !ref.startsWith("sb://")) {
    return ref;
  }
  try {
    const storage = getMusicStorageAdapter(ref);
    const { signedUrl } = await storage.getSignedReadUrl({
      reference: ref,
      ownerAccountId,
      expiresInSeconds,
    });
    return signedUrl;
  } catch {
    return null;
  }
}

/**
 * Phase V · owner-sealed 2026-11-05 · supersedes the sealed mig 236
 * "one active slot per creator" rule. Reads every `nex_music_track`
 * with `visibility='shared_live'` and `rights_declaration` permitting
 * publish, synthesises MusicFeedEntry rows without consulting
 * `nex_creator_active_music`. Multiple tracks per creator ALL surface.
 * The caller (`listNexFeedEntries`) is responsible for the owner-sealed
 * "same creator never adjacent" scatter rule.
 *
 * Why not change `listActiveMusicFeedEntries` in place: the sealed
 * active-slot read path is kept callable (table + RPC + idempotency
 * are still in the schema) per the memory note
 * `project_nex_music_feed_fairness_2026_11_05.md`. Live callers
 * migrate to this reader; the old one becomes dead-read in the feed
 * path but remains available for any surface still relying on the
 * slot-level publish_generation metadata.
 *
 * Fail-open on per-entry errors · a single bad row is skipped rather
 * than erroring the whole feed (same contract as the slot reader).
 */
export async function listSharedLiveMusicFeedEntries(args: {
  readonly limit?: number;
  readonly nowMs: number;
  readonly accountLookup?: (
    ids: readonly string[],
  ) => Promise<readonly AccountLookup[]>;
}): Promise<readonly MusicFeedEntry[]> {
  const tracks = await loadTracks();
  if (tracks.length === 0) return [];

  const permittedRights = new Set([
    "owner_content",
    "licensed",
    "public_domain",
  ]);
  const eligible: NexMusicTrackRow[] = [];
  for (const track of tracks) {
    if (track.visibility !== "shared_live") continue;
    if (!permittedRights.has(track.rights_declaration)) continue;
    eligible.push(track);
  }
  if (eligible.length === 0) return [];

  const limit =
    typeof args.limit === "number" && args.limit > 0 ? args.limit : 50;

  // Sort by updated_at DESC (recently flipped to shared_live surfaces
  // first) with a stable tie-break on id. The nex-feed-entries
  // scatter layer may reorder further to enforce the "same creator
  // never adjacent" rule.
  const sorted = eligible
    .slice()
    .sort((a, b) => {
      const at = Date.parse(a.updated_at ?? a.created_at);
      const bt = Date.parse(b.updated_at ?? b.created_at);
      if (bt !== at) return bt - at;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .slice(0, limit);

  const accountIds = Array.from(new Set(sorted.map((t) => t.owner_account_id)));
  const accountMap = await fetchAccountDetails(accountIds, args.accountLookup);

  const entries: MusicFeedEntry[] = [];
  for (const track of sorted) {
    const account = accountMap.get(track.owner_account_id);
    const [coverSignedUrl, backgroundSignedUrl, audioSignedUrl] =
      await Promise.all([
        mintSignedUrlIfReference(track.cover_image_url, track.owner_account_id, 3600),
        mintSignedUrlIfReference(track.background_image_url, track.owner_account_id, 3600),
        track.source_type === "uploaded_audio"
          ? mintSignedUrlIfReference(track.media_url, track.owner_account_id, 3600)
          : Promise.resolve<string | null>(null),
      ]);

    // publishedAtMs falls back through updated_at → created_at so
    // "newest in feed" means "most recently flipped to shared_live"
    // in the common case.
    const publishedAtMs = Date.parse(track.updated_at ?? track.created_at);
    if (!Number.isFinite(publishedAtMs)) continue;

    entries.push({
      activeSlotOwnerId: track.owner_account_id,
      ownerAccountId: track.owner_account_id,
      ownerDisplayName: account?.displayName ?? "NEX user",
      ownerNexHandle: account?.nexHandle ?? null,
      ownerAvatarUrl: account?.avatarUrl ?? null,
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      // External sources (spotify/youtube) render as music_video style
      // on the viewer. Uploaded audio renders as cover_audio. This
      // mirrors the sealed `nex_music_publish_as_active_slot()`
      // publish_as_mode derivation without requiring a slot row.
      publishAsMode:
        track.source_type === "uploaded_audio" ? "cover_audio" : "music_video",
      coverSignedUrl,
      backgroundSignedUrl,
      audioSignedUrl,
      sourceUrl: track.source_url,
      publishedAtMs,
      publishGeneration: 1,
      likeCount: track.like_count,
      shareCount: track.share_count,
    });
  }

  return entries;
}

/** Compose music feed entries from the active-slot table. Fail-open on
 *  per-entry errors (missing track, failed URL signing) · a single bad
 *  row is skipped rather than erroring the whole feed.
 *
 *  Phase V 2026-11-05 note: this function is NO LONGER consumed by
 *  `listNexFeedEntries`; callers have migrated to
 *  `listSharedLiveMusicFeedEntries` above per the owner-sealed music
 *  feed fairness doctrine. Kept callable so any surface still relying
 *  on `publish_generation` metadata continues to work. */
export async function listActiveMusicFeedEntries(args: {
  readonly limit?: number;
  readonly nowMs: number;
  readonly accountLookup?: (
    ids: readonly string[],
  ) => Promise<readonly AccountLookup[]>;
}): Promise<readonly MusicFeedEntry[]> {
  const slots = await listActiveMusicSlots();
  if (slots.length === 0) return [];

  const tracks = await loadTracks();
  const trackById = new Map<string, NexMusicTrackRow>();
  for (const t of tracks) trackById.set(t.id, t);

  // Pre-filter slots whose referenced track is ineligible (missing,
  // removed, or rights-mismatch). Keep eligible ones for signing +
  // account hydration. Service_role equivalent of the Migration 236
  // comment at §2.3 (reader WHERE clause).
  const eligible: {
    slot: NexCreatorActiveMusicRow;
    track: NexMusicTrackRow;
  }[] = [];
  const permittedRights = new Set([
    "owner_content",
    "licensed",
    "public_domain",
  ]);
  for (const slot of slots) {
    if (!slot.track_id) continue;
    const track = trackById.get(slot.track_id);
    if (!track) continue;
    if (track.visibility === "removed") continue;
    if (!permittedRights.has(track.rights_declaration)) continue;
    if (slot.rights_declaration_frozen !== track.rights_declaration) {
      // Rights revoked after publish; feed hides the slot per §2.5.
      continue;
    }
    eligible.push({ slot, track });
  }

  const limit =
    typeof args.limit === "number" && args.limit > 0 ? args.limit : 50;
  const capped = eligible.slice(0, limit);

  const accountIds = Array.from(
    new Set(capped.map((e) => e.slot.owner_account_id)),
  );
  const accountMap = await fetchAccountDetails(accountIds, args.accountLookup);

  const entries: MusicFeedEntry[] = [];
  for (const { slot, track } of capped) {
    const account = accountMap.get(slot.owner_account_id);
    // Owner-authorised 2026-10-30 · bumped signed-URL TTL from
    // 60 s → 3600 s to match the preview page. The 60 s cap was
    // expiring before the `<audio>` could buffer on swipe
    // navigation / pause-resume, surfacing the "Playback error ·
    // the file may be unavailable" message.
    const [coverSignedUrl, backgroundSignedUrl, audioSignedUrl] =
      await Promise.all([
        mintSignedUrlIfReference(track.cover_image_url, track.owner_account_id, 3600),
        mintSignedUrlIfReference(track.background_image_url, track.owner_account_id, 3600),
        slot.publish_as_mode === "cover_audio"
          ? mintSignedUrlIfReference(track.media_url, track.owner_account_id, 3600)
          : Promise.resolve<string | null>(null),
      ]);

    const publishedAtMs = Date.parse(slot.published_at);
    if (!Number.isFinite(publishedAtMs)) continue;

    entries.push({
      activeSlotOwnerId: slot.owner_account_id,
      ownerAccountId: slot.owner_account_id,
      ownerDisplayName: account?.displayName ?? "NEX user",
      ownerNexHandle: account?.nexHandle ?? null,
      ownerAvatarUrl: account?.avatarUrl ?? null,
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      publishAsMode: slot.publish_as_mode,
      coverSignedUrl,
      backgroundSignedUrl,
      audioSignedUrl,
      sourceUrl: track.source_url,
      publishedAtMs,
      publishGeneration: slot.publish_generation,
      likeCount: track.like_count,
      shareCount: track.share_count,
    });
  }

  // Return in chronological order (newest first) · H1 default pending
  // owner lock.
  return entries.sort((a, b) => b.publishedAtMs - a.publishedAtMs);
}
