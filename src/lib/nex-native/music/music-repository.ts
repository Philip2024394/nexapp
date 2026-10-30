// src/lib/nex-native/music/music-repository.ts
//
// Owner-authorised 2026-10-29 · DRAFT §9 metadata persistence.
//
// Dev-only JSON-file repository. Atomic rewrite on every mutation
// (write-to-temp + rename). Honest about limitations:
//   · Not safe under concurrent process writes. Single Next dev
//     server is fine. Multi-worker production use would require a
//     real DB · which is the Gate-3 open decision.
//   · No RLS · the service layer enforces owner identity.

import "server-only";
import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

import type {
  NexMusicTrackInsert,
  NexMusicTrackRow,
  NexMusicVisibility,
} from "./types";

const DATA_DIR = path.resolve(process.cwd(), ".dev-music-data");
const TRACKS_FILE = path.join(DATA_DIR, "tracks.json");

interface Snapshot {
  readonly tracks: NexMusicTrackRow[];
}

// Mutation ordering has to be shared across module instances in the
// same Node process · Next dev with Turbopack builds API routes and
// page routes as separate bundles, so each gets its own copy of
// module-level `let` bindings. globalThis is the single shared handle
// both bundles can see.
//
// No read cache. The underlying file is small + local; a cross-bundle
// stale cache has already caused "upload succeeded but preview 404s"
// and the correctness win is worth the sub-ms disk read per op.
interface MusicRepoGlobals {
  __musicRepoWriteLock?: Promise<void>;
}
const _g = globalThis as unknown as MusicRepoGlobals;
_g.__musicRepoWriteLock ??= Promise.resolve();

function getWriteLock(): Promise<void> {
  return _g.__musicRepoWriteLock ?? Promise.resolve();
}
function setWriteLock(next: Promise<void>): void {
  _g.__musicRepoWriteLock = next;
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadSnapshot(): Promise<Snapshot> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(TRACKS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Snapshot;
    if (parsed && Array.isArray(parsed.tracks)) {
      return parsed;
    }
  } catch {
    // Missing / corrupt · treat as empty.
  }
  return { tracks: [] };
}

async function writeSnapshot(next: Snapshot): Promise<void> {
  await ensureDataDir();
  const tmp = `${TRACKS_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(next, null, 2));
  await fs.rename(tmp, TRACKS_FILE);
}

async function serialMutate<T>(
  fn: (snap: Snapshot) => Promise<{ next: Snapshot; result: T }>,
): Promise<T> {
  const run = async (): Promise<T> => {
    const snap = await loadSnapshot();
    const { next, result } = await fn(snap);
    await writeSnapshot(next);
    return result;
  };
  const chained = getWriteLock().then(run, run);
  setWriteLock(
    chained.then(
      () => undefined,
      () => undefined,
    ),
  );
  return chained;
}

export async function insertMusicTrack(
  input: NexMusicTrackInsert,
): Promise<NexMusicTrackRow> {
  return serialMutate(async (snap) => {
    const now = new Date().toISOString();
    const row: NexMusicTrackRow = {
      id: crypto.randomUUID(),
      owner_account_id: input.owner_account_id,
      business_id: input.business_id ?? null,
      source_type: input.source_type,
      title: input.title,
      artist: input.artist,
      album: input.album ?? null,
      duration_ms: input.duration_ms,
      media_url: input.media_url,
      source_url: input.source_url,
      cover_image_url: input.cover_image_url,
      background_image_url: input.background_image_url ?? null,
      byte_size: input.byte_size,
      mime_type: input.mime_type,
      bitrate_kbps: input.bitrate_kbps ?? null,
      rights_declaration: input.rights_declaration,
      rights_notes: input.rights_notes ?? null,
      visibility: "private",
      created_at: now,
      updated_at: now,
      removed_at: null,
      view_count: 0,
      like_count: 0,
      share_count: 0,
      description: null,
    };
    return {
      next: { tracks: [row, ...snap.tracks] },
      result: row,
    };
  });
}

function normaliseLoaded(row: NexMusicTrackRow): NexMusicTrackRow {
  // Owner-authorised 2026-10-29 · backwards-compat default for rows
  // persisted before the view/like/share counters shipped.
  // Owner-authorised 2026-10-30 · description defaults to null for
  // legacy rows written before the description field existed.
  return {
    ...row,
    view_count: typeof row.view_count === "number" ? row.view_count : 0,
    like_count: typeof row.like_count === "number" ? row.like_count : 0,
    share_count: typeof row.share_count === "number" ? row.share_count : 0,
    background_image_url:
      row.background_image_url === undefined ? null : row.background_image_url,
    description:
      typeof row.description === "string" || row.description === null
        ? row.description
        : null,
  };
}

export async function bumpTrackViewCount(args: {
  readonly trackId: string;
  readonly ownerAccountId: string;
}): Promise<NexMusicTrackRow | null> {
  return serialMutate(async (snap) => {
    const idx = snap.tracks.findIndex(
      (t) =>
        t.id === args.trackId && t.owner_account_id === args.ownerAccountId,
    );
    if (idx < 0) return { next: snap, result: null };
    const prev = normaliseLoaded(snap.tracks[idx]!);
    const next: NexMusicTrackRow = {
      ...prev,
      view_count: prev.view_count + 1,
      updated_at: new Date().toISOString(),
    };
    const nextTracks = snap.tracks.slice();
    nextTracks[idx] = next;
    return { next: { tracks: nextTracks }, result: next };
  });
}

/** Owner-authorised 2026-10-30 · universal play-count bump · any
 *  signed-in viewer can increment view_count on any track (not
 *  ownership-scoped). Caller supplies only the trackId. Used by the
 *  music feed viewer when a track transitions to isPlaying=true for
 *  the first time per mount (client-side dedup). Honest limitation:
 *  this is a Phase 1 approximate counter, not the sealed Phase 2
 *  per-event nex_music_play ingestion with valid-play criteria. */
export async function bumpTrackPlayCountAnyViewer(args: {
  readonly trackId: string;
}): Promise<NexMusicTrackRow | null> {
  return serialMutate(async (snap) => {
    const idx = snap.tracks.findIndex((t) => t.id === args.trackId);
    if (idx < 0) return { next: snap, result: null };
    const prev = normaliseLoaded(snap.tracks[idx]!);
    const next: NexMusicTrackRow = {
      ...prev,
      view_count: prev.view_count + 1,
      updated_at: new Date().toISOString(),
    };
    const nextTracks = snap.tracks.slice();
    nextTracks[idx] = next;
    return { next: { tracks: nextTracks }, result: next };
  });
}

export async function bumpTrackShareCount(args: {
  readonly trackId: string;
  readonly ownerAccountId: string;
}): Promise<NexMusicTrackRow | null> {
  return serialMutate(async (snap) => {
    const idx = snap.tracks.findIndex(
      (t) =>
        t.id === args.trackId && t.owner_account_id === args.ownerAccountId,
    );
    if (idx < 0) return { next: snap, result: null };
    const prev = normaliseLoaded(snap.tracks[idx]!);
    const next: NexMusicTrackRow = {
      ...prev,
      share_count: prev.share_count + 1,
      updated_at: new Date().toISOString(),
    };
    const nextTracks = snap.tracks.slice();
    nextTracks[idx] = next;
    return { next: { tracks: nextTracks }, result: next };
  });
}

/** Toggle a like for `(trackId, likerAccountId)`. Returns the new
 *  track row (with updated like_count) and whether the caller now
 *  likes the track. Per-user like state lives in a sibling JSON. */
export async function toggleTrackLike(args: {
  readonly trackId: string;
  readonly likerAccountId: string;
}): Promise<{ row: NexMusicTrackRow; liked: boolean } | null> {
  return serialMutate(async (snap) => {
    const idx = snap.tracks.findIndex((t) => t.id === args.trackId);
    if (idx < 0) return { next: snap, result: null };
    const prev = normaliseLoaded(snap.tracks[idx]!);
    // Load per-user like set.
    // Owner-authorised 2026-10-29 (Stage 5C · C1 · atomic likes
    // persistence) · the previous write used a bare `fs.writeFile`
    // which truncates the file before writing, so a concurrent
    // reader could observe a partial / empty JSON and silently
    // treat it as "no likes." We now:
    //   1. Distinguish ENOENT (first write · empty is correct)
    //      from JSON.parse failure or any other read error ·
    //      the latter aborts with a thrown error so we never
    //      overwrite existing like state with an empty snapshot.
    //   2. Write to a sibling `.tmp.<pid>.<ts>` then atomically
    //      `rename` on top of the real file, mirroring the sealed
    //      `writeSnapshot` pattern at lines 55-60.
    // Honest limitation: single-process dev adapter only; multi-
    // worker production use requires moving likes to Postgres.
    const likesPath = path.join(DATA_DIR, "track-likes.json");
    let allLikes: Record<string, string[]> = {};
    let fileExists = true;
    try {
      const raw = await fs.readFile(likesPath, "utf8");
      try {
        const parsed = JSON.parse(raw) as Record<string, string[]>;
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error(
            `track-likes.json: unexpected shape · refusing to overwrite valid data`,
          );
        }
        allLikes = parsed;
      } catch (err) {
        // Malformed / partially-written file · DO NOT silently
        // treat as empty · surface to caller so the mutation is
        // aborted and no like state is lost.
        throw err instanceof Error ? err : new Error(String(err));
      }
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "ENOENT"
      ) {
        // First write · empty is correct.
        fileExists = false;
        allLikes = {};
      } else {
        throw err;
      }
    }
    void fileExists; // documented for intent; not read elsewhere
    const current = allLikes[args.trackId] ?? [];
    let liked: boolean;
    let delta: number;
    if (current.includes(args.likerAccountId)) {
      allLikes[args.trackId] = current.filter((id) => id !== args.likerAccountId);
      liked = false;
      delta = -1;
    } else {
      allLikes[args.trackId] = [...current, args.likerAccountId];
      liked = true;
      delta = 1;
    }
    // Atomic write · tmp + rename (same pattern as writeSnapshot).
    const likesTmp = `${likesPath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(likesTmp, JSON.stringify(allLikes, null, 2));
    await fs.rename(likesTmp, likesPath);
    const next: NexMusicTrackRow = {
      ...prev,
      like_count: Math.max(0, prev.like_count + delta),
      updated_at: new Date().toISOString(),
    };
    const nextTracks = snap.tracks.slice();
    nextTracks[idx] = next;
    return { next: { tracks: nextTracks }, result: { row: next, liked } };
  });
}

export async function hasLikedTrack(args: {
  readonly trackId: string;
  readonly likerAccountId: string;
}): Promise<boolean> {
  const likesPath = path.join(DATA_DIR, "track-likes.json");
  try {
    const raw = await fs.readFile(likesPath, "utf8");
    const allLikes = JSON.parse(raw) as Record<string, string[]>;
    return (allLikes[args.trackId] ?? []).includes(args.likerAccountId);
  } catch {
    return false;
  }
}

export async function listTracksByOwner(
  ownerAccountId: string,
  options?: { readonly includeRemoved?: boolean },
): Promise<NexMusicTrackRow[]> {
  const snap = await loadSnapshot();
  const includeRemoved = options?.includeRemoved === true;
  return snap.tracks
    .filter((t) => t.owner_account_id === ownerAccountId)
    .filter((t) => includeRemoved || t.visibility !== "removed")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(normaliseLoaded);
}

export async function getTrackById(
  trackId: string,
): Promise<NexMusicTrackRow | null> {
  const snap = await loadSnapshot();
  const found = snap.tracks.find((t) => t.id === trackId);
  return found ? normaliseLoaded(found) : null;
}

export async function setTrackVisibility(args: {
  readonly trackId: string;
  readonly ownerAccountId: string;
  readonly visibility: NexMusicVisibility;
}): Promise<NexMusicTrackRow | null> {
  return serialMutate(async (snap) => {
    const idx = snap.tracks.findIndex(
      (t) =>
        t.id === args.trackId && t.owner_account_id === args.ownerAccountId,
    );
    if (idx < 0) return { next: snap, result: null };
    const prev = snap.tracks[idx]!;
    const now = new Date().toISOString();
    const updated: NexMusicTrackRow = {
      ...prev,
      visibility: args.visibility,
      updated_at: now,
      removed_at: args.visibility === "removed" ? now : prev.removed_at,
    };
    const nextTracks = snap.tracks.slice();
    nextTracks[idx] = updated;
    return { next: { tracks: nextTracks }, result: updated };
  });
}

export async function updateTrackMetadata(args: {
  readonly trackId: string;
  readonly ownerAccountId: string;
  readonly title?: string;
  readonly artist?: string | null;
  readonly coverImageUrl?: string | null;
  readonly backgroundImageUrl?: string | null;
  readonly description?: string | null;
}): Promise<NexMusicTrackRow | null> {
  return serialMutate(async (snap) => {
    const idx = snap.tracks.findIndex(
      (t) =>
        t.id === args.trackId && t.owner_account_id === args.ownerAccountId,
    );
    if (idx < 0) return { next: snap, result: null };
    const prev = snap.tracks[idx]!;
    const now = new Date().toISOString();
    const updated: NexMusicTrackRow = {
      ...prev,
      title: args.title !== undefined ? args.title : prev.title,
      artist: args.artist !== undefined ? args.artist : prev.artist,
      cover_image_url:
        args.coverImageUrl !== undefined
          ? args.coverImageUrl
          : prev.cover_image_url,
      background_image_url:
        args.backgroundImageUrl !== undefined
          ? args.backgroundImageUrl
          : prev.background_image_url,
      description:
        args.description !== undefined ? args.description : prev.description,
      updated_at: now,
    };
    const nextTracks = snap.tracks.slice();
    nextTracks[idx] = updated;
    return { next: { tracks: nextTracks }, result: updated };
  });
}

export async function hardDeleteTrack(args: {
  readonly trackId: string;
  readonly ownerAccountId: string;
}): Promise<NexMusicTrackRow | null> {
  return serialMutate(async (snap) => {
    const idx = snap.tracks.findIndex(
      (t) =>
        t.id === args.trackId && t.owner_account_id === args.ownerAccountId,
    );
    if (idx < 0) return { next: snap, result: null };
    const removed = snap.tracks[idx]!;
    const nextTracks = snap.tracks.slice();
    nextTracks.splice(idx, 1);
    return { next: { tracks: nextTracks }, result: removed };
  });
}

export async function getOwnerStorageUsageBytes(
  ownerAccountId: string,
): Promise<number> {
  const snap = await loadSnapshot();
  return snap.tracks
    .filter((t) => t.owner_account_id === ownerAccountId)
    .filter((t) => t.visibility !== "removed")
    .reduce((sum, t) => sum + (t.byte_size ?? 0), 0);
}

export async function getOwnerTrackCount(
  ownerAccountId: string,
): Promise<number> {
  const snap = await loadSnapshot();
  return snap.tracks
    .filter((t) => t.owner_account_id === ownerAccountId)
    .filter((t) => t.visibility !== "removed").length;
}
