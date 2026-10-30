// src/lib/nex-native/music/active-slot-repository.ts
//
// Owner-authorised 2026-10-30 (NEX Music Publishing → Live Feed · M-2) ·
// Dev-only filesystem mirror of Migration 236's two tables + publish
// function. Mirrors the sealed Migration 236 contract exactly in semantic
// terms:
//   · nex_creator_active_music   → `.dev-music-data/active-slots.json`
//   · nex_music_publish_idempotency → `.dev-music-data/publish-idempotency.json`
//   · nex_music_publish_as_active_slot() → `publishActiveMusicSlot(...)`
//   · nex_music_publish_idempotency_cleanup() → `cleanupExpiredIdempotency()`
//
// Production path (NOT YET APPLIED) will be a Supabase RPC. The dev-FS
// adapter follows the exact same observable semantics so the server
// action (M-2) can swap transport without changing its contract.
//
// Honest limitations
// -----------------------------------------------------------------
//   · Advisory lock is simulated via the music-repository `serialMutate`
//     write lock. Not safe under multi-process concurrency; a single
//     Next dev server is fine. Production will use pg_advisory_xact_lock
//     exactly as Migration 236 §B.2 step 1 encodes.
//   · "Transaction rollback on failure" is simulated by only persisting
//     the final snapshot after all validations pass. Partial state is
//     never written. If any check RAISEs (returns an error result), no
//     mutation is persisted.
//   · Fingerprint re-check on retry includes `(account_id, track_id,
//     publish_as_mode)` per locked R5-1 + §B.2 step 2.
//   · 72-hour expires_at + 15-min cleanup cadence (R4-#5) assumed; the
//     cleanup function is callable from a server-only scheduler/action.
//   · Error codes map 1:1 to the SQLSTATEs defined in Migration 236:
//     45001 → idempotency-rejected · 45002 → track-not-found · 45003 →
//     not-authorized · 45004 → track-removed · 45005 → rights-invalid ·
//     45006 → eligibility-race · 45007 → eligibility-invalid-state.
//   · 23505 (unique_violation) is unreachable in the dev path by
//     construction (the serialMutate chain is the only writer).

import "server-only";
import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

import type {
  NexCreatorActiveMusicRow,
  NexMusicPublishAsMode,
  NexMusicPublishIdempotencyRow,
  NexMusicPublishResult,
  NexMusicResult,
  NexMusicTrackRow,
  NexMusicVisibility,
  NexMusicRightsDeclaration,
} from "./types";

const DATA_DIR = path.resolve(process.cwd(), ".dev-music-data");
const SLOTS_FILE = path.join(DATA_DIR, "active-slots.json");
const DEDUP_FILE = path.join(DATA_DIR, "publish-idempotency.json");
const TRACKS_FILE = path.join(DATA_DIR, "tracks.json");

interface SlotsSnapshot {
  readonly slots: NexCreatorActiveMusicRow[];
}

interface DedupSnapshot {
  readonly rows: NexMusicPublishIdempotencyRow[];
}

interface TracksSnapshot {
  readonly tracks: NexMusicTrackRow[];
}

// Cross-bundle mutex. Mirrors the music-repository pattern so a publish
// action and the music-repository's own mutations serialise against each
// other within a single Next process. We publish AND flip
// nex_music_track.visibility inside the same critical section · the
// Migration 236 function body does both atomically.
interface ActiveSlotRepoGlobals {
  __nexMusicActiveSlotWriteLock?: Promise<void>;
}
const _g = globalThis as unknown as ActiveSlotRepoGlobals;
_g.__nexMusicActiveSlotWriteLock ??= Promise.resolve();

function getWriteLock(): Promise<void> {
  return _g.__nexMusicActiveSlotWriteLock ?? Promise.resolve();
}
function setWriteLock(next: Promise<void>): void {
  _g.__nexMusicActiveSlotWriteLock = next;
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadSlots(): Promise<SlotsSnapshot> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(SLOTS_FILE, "utf8");
    const parsed = JSON.parse(raw) as SlotsSnapshot;
    if (parsed && Array.isArray(parsed.slots)) return parsed;
  } catch {
    /* missing / corrupt · treat as empty */
  }
  return { slots: [] };
}

async function loadDedup(): Promise<DedupSnapshot> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(DEDUP_FILE, "utf8");
    const parsed = JSON.parse(raw) as DedupSnapshot;
    if (parsed && Array.isArray(parsed.rows)) return parsed;
  } catch {
    /* missing / corrupt · treat as empty */
  }
  return { rows: [] };
}

async function loadTracks(): Promise<TracksSnapshot> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(TRACKS_FILE, "utf8");
    const parsed = JSON.parse(raw) as TracksSnapshot;
    if (parsed && Array.isArray(parsed.tracks)) return parsed;
  } catch {
    /* missing / corrupt · treat as empty */
  }
  return { tracks: [] };
}

async function writeFileAtomic(file: string, data: string): Promise<void> {
  await ensureDataDir();
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}

async function writeSlots(next: SlotsSnapshot): Promise<void> {
  await writeFileAtomic(SLOTS_FILE, JSON.stringify(next, null, 2));
}

async function writeDedup(next: DedupSnapshot): Promise<void> {
  await writeFileAtomic(DEDUP_FILE, JSON.stringify(next, null, 2));
}

async function writeTracks(next: TracksSnapshot): Promise<void> {
  await writeFileAtomic(TRACKS_FILE, JSON.stringify(next, null, 2));
}

async function serialMutate<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => fn();
  const chained = getWriteLock().then(run, run);
  setWriteLock(
    chained.then(
      () => undefined,
      () => undefined,
    ),
  );
  return chained;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Narrowed-code type for publish-path error returns. Enumerated to
 *  the subset of the shared `NexMusicResult` codes the publish flow
 *  actually produces. */
type PublishErrorCode =
  | "idempotency-rejected"
  | "track-not-found"
  | "not-authorized"
  | "track-removed"
  | "rights-invalid"
  | "eligibility-race"
  | "eligibility-invalid-state"
  | "missing-request-id"
  | "internal-error";

function publishErr(
  code: PublishErrorCode,
  message: string,
): NexMusicResult<NexMusicPublishResult> {
  return { ok: false, code, message };
}

interface PublishInput {
  readonly requestId: string;
  readonly ownerAccountId: string;
  readonly trackId: string;
  readonly publishAsMode: NexMusicPublishAsMode;
}

/** Dev-FS mirror of Migration 236's `nex_music_publish_as_active_slot()`.
 *
 *  Observable semantics follow §B.2 of the sealed design:
 *    1. Validate inputs. Null-or-malformed → `idempotency-rejected`.
 *    2. Dedup fast-path lookup · fingerprint re-check · return stored
 *       result on match / `idempotency-rejected` on mismatch.
 *    3. Track eligibility · 45002 / 45003 / 45004 / 45007 / 45005.
 *    4. Slot UPSERT · increment publish_generation.
 *    5. Dedup write.
 *    6. Visibility flip from 'private' to 'shared_live' · 45006 on race.
 *    7. Return `{ requestId, trackId, publishGeneration }`.
 *
 *  The entire sequence runs inside `serialMutate` so partial state can
 *  never be observed by a concurrent call. On any error, the function
 *  returns an error result and NO files are written.
 */
export async function publishActiveMusicSlot(
  input: PublishInput,
): Promise<NexMusicResult<NexMusicPublishResult>> {
  // Guard inputs BEFORE taking the lock · cheap rejection.
  if (
    !input.requestId ||
    !UUID_RE.test(input.requestId) ||
    !input.ownerAccountId ||
    !UUID_RE.test(input.ownerAccountId) ||
    !input.trackId ||
    !UUID_RE.test(input.trackId)
  ) {
    return publishErr(
      "idempotency-rejected",
      "This request was rejected. If you believe this is unexpected, generate a new request id and retry.",
    );
  }
  if (
    input.publishAsMode !== "cover_audio" &&
    input.publishAsMode !== "music_video"
  ) {
    return publishErr(
      "idempotency-rejected",
      "This request was rejected. If you believe this is unexpected, generate a new request id and retry.",
    );
  }

  return serialMutate(async () => {
    const [slots, dedup, tracks] = await Promise.all([
      loadSlots(),
      loadDedup(),
      loadTracks(),
    ]);

    // Step 2 · Dedup fast-path.
    const existing = dedup.rows.find((r) => r.request_id === input.requestId);
    if (existing) {
      if (
        existing.account_id !== input.ownerAccountId ||
        existing.track_id !== input.trackId ||
        existing.publish_as_mode !== input.publishAsMode
      ) {
        return publishErr(
          "idempotency-rejected",
          "This request was rejected. If you believe this is unexpected, generate a new request id and retry.",
        );
      }
      // Idempotent retry · stored result reflects original publish.
      // Current feed-reader eligibility is a separate concern (M-3).
      return {
        ok: true as const,
        data: {
          requestId: existing.request_id,
          trackId: existing.track_id,
          publishGeneration: existing.publish_generation,
        },
      };
    }

    // Step 3 · Track eligibility.
    const trackIdx = tracks.tracks.findIndex((t) => t.id === input.trackId);
    if (trackIdx < 0) {
      return publishErr(
        "track-not-found",
        "This track could not be found.",
      );
    }
    const track = tracks.tracks[trackIdx]!;
    if (track.owner_account_id !== input.ownerAccountId) {
      return publishErr(
        "not-authorized",
        "You don't own this track.",
      );
    }
    if (track.visibility === "removed") {
      return publishErr(
        "track-removed",
        "This track has been removed and can't be published.",
      );
    }
    if (track.visibility !== "private" && track.visibility !== "shared_live") {
      return publishErr(
        "eligibility-invalid-state",
        "This track isn't in a publishable state.",
      );
    }
    const permittedRights: ReadonlySet<NexMusicRightsDeclaration> = new Set([
      "owner_content",
      "licensed",
      "public_domain",
    ]);
    if (!permittedRights.has(track.rights_declaration)) {
      return publishErr(
        "rights-invalid",
        "This track isn't marked publishable.",
      );
    }
    const wasPrivate = track.visibility === "private";

    // Step 4 · Slot UPSERT.
    const now = new Date().toISOString();
    const slotIdx = slots.slots.findIndex(
      (s) => s.owner_account_id === input.ownerAccountId,
    );
    let newGeneration: number;
    let nextSlots: NexCreatorActiveMusicRow[];
    if (slotIdx < 0) {
      newGeneration = 1;
      nextSlots = [
        ...slots.slots,
        {
          owner_account_id: input.ownerAccountId,
          track_id: input.trackId,
          publish_as_mode: input.publishAsMode,
          publish_generation: newGeneration,
          rights_declaration_frozen: track.rights_declaration,
          published_at: now,
          unpublished_at: null,
        },
      ];
    } else {
      const prev = slots.slots[slotIdx]!;
      newGeneration = prev.publish_generation + 1;
      nextSlots = slots.slots.map((s, i) =>
        i === slotIdx
          ? {
              ...s,
              track_id: input.trackId,
              publish_as_mode: input.publishAsMode,
              publish_generation: newGeneration,
              rights_declaration_frozen: track.rights_declaration,
              published_at: now,
              unpublished_at: null,
            }
          : s,
      );
    }

    // Step 5 · Dedup INSERT.
    const expires = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const nextDedup: NexMusicPublishIdempotencyRow[] = [
      ...dedup.rows,
      {
        request_id: input.requestId,
        account_id: input.ownerAccountId,
        track_id: input.trackId,
        publish_as_mode: input.publishAsMode,
        publish_generation: newGeneration,
        observed_at: now,
        expires_at: expires,
      },
    ];

    // Step 6 · Visibility flip (only if was private). Equivalent to the
    // Migration 236 UPDATE ... WHERE visibility='private' guard. If a
    // concurrent writer has already flipped visibility, the index-based
    // match will still find the track row and we just re-affirm. Dev-FS
    // under serialMutate makes this race unreachable; we keep the guard
    // for parity with the production function.
    let nextTracks = tracks.tracks;
    if (wasPrivate) {
      const stillPrivate =
        nextTracks[trackIdx]!.visibility === "private";
      if (!stillPrivate) {
        return publishErr(
          "eligibility-race",
          "This track's eligibility changed during publishing. Please retry.",
        );
      }
      nextTracks = nextTracks.map((t, i) =>
        i === trackIdx ? { ...t, visibility: "shared_live" as NexMusicVisibility, updated_at: now } : t,
      );
    }

    // Persist · all three writes commit as one logical transaction in
    // the dev path. Order: tracks first (so a subsequent read of tracks
    // on a very fast turnaround sees the flip), then slots, then dedup.
    // Production uses one plpgsql transaction so order doesn't matter.
    if (wasPrivate) {
      await writeTracks({ tracks: nextTracks });
    }
    await writeSlots({ slots: nextSlots });
    await writeDedup({ rows: nextDedup });

    return {
      ok: true as const,
      data: {
        requestId: input.requestId,
        trackId: input.trackId,
        publishGeneration: newGeneration,
      },
    };
  });
}

/** Read the current active slot for an owner. Returns null if the owner
 *  has no slot or the slot is unpublished / has a null track. */
export async function getActiveMusicSlot(
  ownerAccountId: string,
): Promise<NexCreatorActiveMusicRow | null> {
  const slots = await loadSlots();
  const row = slots.slots.find(
    (s) => s.owner_account_id === ownerAccountId,
  );
  if (!row) return null;
  if (row.unpublished_at !== null) return null;
  if (!row.track_id) return null;
  return row;
}

/** List every live active slot (unpublished_at IS NULL, track_id IS NOT
 *  NULL) ordered by published_at DESC. Used by the feed reader to
 *  compose music entries. */
export async function listActiveMusicSlots(): Promise<readonly NexCreatorActiveMusicRow[]> {
  const slots = await loadSlots();
  return slots.slots
    .filter((s) => s.unpublished_at === null && s.track_id !== null)
    .sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
}

/** Soft-unpublish the active slot for an owner. Idempotent · no-op if
 *  there is no slot or it is already unpublished. */
export async function unpublishActiveMusicSlot(
  ownerAccountId: string,
): Promise<{ unpublished: boolean }> {
  return serialMutate(async () => {
    const snap = await loadSlots();
    const idx = snap.slots.findIndex(
      (s) => s.owner_account_id === ownerAccountId,
    );
    if (idx < 0) return { unpublished: false };
    const row = snap.slots[idx]!;
    if (row.unpublished_at !== null) return { unpublished: false };
    const now = new Date().toISOString();
    const next = snap.slots.map((s, i) =>
      i === idx ? { ...s, unpublished_at: now } : s,
    );
    await writeSlots({ slots: next });
    return { unpublished: true };
  });
}

/** Scheduled sweep · deletes dedup rows past expires_at. Returns the
 *  count of deleted rows for operational logging. */
export async function cleanupExpiredIdempotency(): Promise<{
  deleted: number;
}> {
  return serialMutate(async () => {
    const snap = await loadDedup();
    const nowIso = new Date().toISOString();
    const keep = snap.rows.filter((r) => r.expires_at >= nowIso);
    const deleted = snap.rows.length - keep.length;
    if (deleted > 0) await writeDedup({ rows: keep });
    return { deleted };
  });
}

/** Generate a server-side request_id · used when the client does not
 *  supply one. UUIDv4 per locked F1. */
export function generatePublishRequestId(): string {
  return crypto.randomUUID();
}
