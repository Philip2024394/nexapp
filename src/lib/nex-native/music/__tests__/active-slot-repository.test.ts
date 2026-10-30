// Owner-authorised 2026-10-30 (M-6 of NEX Music Publishing → Live Feed) ·
// focused vitest for the dev-FS mirror of Migration 236. Verifies the
// four invariants that matter for publish correctness:
//   · publish succeeds for a valid private track + flips visibility
//   · matching retry returns the stored result + does NOT mutate
//   · fingerprint mismatch is rejected with a single generic code
//   · atomic replace (new publish supersedes previous) + previous
//     library track remains intact

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import os from "node:os";

// Stub the `server-only` guard · tests run in a Node context, not a
// browser bundle, so the guard would throw spuriously.
vi.mock("server-only", () => ({}));

// Reset the module cache between every test · the repository resolves
// its DATA_DIR from process.cwd() at module-load time, and each test
// uses its own temp cwd. Without this, test N would read the cached
// snapshot pointing at test (N-1)'s temp dir.
beforeEach(() => {
  vi.resetModules();
  // Also clear the cross-bundle globalThis mutex so a prior test's
  // in-flight write lock does not chain into the next test's clean dir.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__nexMusicActiveSlotWriteLock = Promise.resolve();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__musicRepoWriteLock = Promise.resolve();
});

async function withTempCwd<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.cwd();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "nex-music-pub-"));
  process.chdir(tmp);
  try {
    return await fn();
  } finally {
    process.chdir(prev);
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function seedTracks(
  dir: string,
  tracks: Array<{
    id: string;
    owner_account_id: string;
    visibility: "private" | "shared_live" | "removed";
    rights_declaration: "owner_content" | "licensed" | "public_domain";
    title: string;
  }>,
): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  const full = tracks.map((t) => ({
    ...t,
    business_id: null,
    source_type: "uploaded_audio" as const,
    artist: null,
    album: null,
    duration_ms: 180_000,
    media_url: `fs://${t.owner_account_id}/${t.id}.m4a`,
    source_url: null,
    cover_image_url: null,
    background_image_url: null,
    byte_size: 1024,
    mime_type: "audio/mp4" as const,
    bitrate_kbps: 128,
    rights_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    removed_at: null,
    view_count: 0,
    like_count: 0,
    share_count: 0,
  }));
  await fs.writeFile(
    path.join(dir, "tracks.json"),
    JSON.stringify({ tracks: full }, null, 2),
  );
}

async function readSlots(dir: string): Promise<{
  slots: Array<{
    owner_account_id: string;
    track_id: string | null;
    publish_generation: number;
  }>;
}> {
  try {
    const raw = await fs.readFile(path.join(dir, "active-slots.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return { slots: [] };
  }
}

async function readDedup(dir: string): Promise<{
  rows: Array<{ request_id: string; track_id: string; publish_generation: number }>;
}> {
  try {
    const raw = await fs.readFile(
      path.join(dir, "publish-idempotency.json"),
      "utf8",
    );
    return JSON.parse(raw);
  } catch {
    return { rows: [] };
  }
}

async function readTracks(dir: string): Promise<{
  tracks: Array<{ id: string; visibility: string }>;
}> {
  const raw = await fs.readFile(path.join(dir, "tracks.json"), "utf8");
  return JSON.parse(raw);
}

describe("publishActiveMusicSlot (M-2 dev-FS mirror of Migration 236)", () => {
  // Reset module state between tests so the global write-lock
  // doesn't carry across test files.
  afterEach(async () => {
    // best-effort cleanup; withTempCwd handles its own temp dir
  });

  it("publishes a valid private track and flips its visibility", async () => {
    await withTempCwd(async () => {
      const dir = path.resolve(process.cwd(), ".dev-music-data");
      const ownerId = crypto.randomUUID();
      const trackId = crypto.randomUUID();
      const requestId = crypto.randomUUID();
      await seedTracks(dir, [
        {
          id: trackId,
          owner_account_id: ownerId,
          visibility: "private",
          rights_declaration: "owner_content",
          title: "Hello",
        },
      ]);

      const mod = await import("../active-slot-repository");
      const r = await mod.publishActiveMusicSlot({
        requestId,
        ownerAccountId: ownerId,
        trackId,
        publishAsMode: "cover_audio",
      });

      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.trackId).toBe(trackId);
        expect(r.data.publishGeneration).toBe(1);
      }
      const slots = await readSlots(dir);
      expect(slots.slots).toHaveLength(1);
      expect(slots.slots[0]!.track_id).toBe(trackId);
      const dedup = await readDedup(dir);
      expect(dedup.rows).toHaveLength(1);
      expect(dedup.rows[0]!.publish_generation).toBe(1);
      const tracks = await readTracks(dir);
      expect(tracks.tracks[0]!.visibility).toBe("shared_live");
    });
  });

  it("matching retry returns the stored result and does not mutate", async () => {
    await withTempCwd(async () => {
      const dir = path.resolve(process.cwd(), ".dev-music-data");
      const ownerId = crypto.randomUUID();
      const trackId = crypto.randomUUID();
      const requestId = crypto.randomUUID();
      await seedTracks(dir, [
        {
          id: trackId,
          owner_account_id: ownerId,
          visibility: "private",
          rights_declaration: "owner_content",
          title: "Hello",
        },
      ]);
      const mod = await import("../active-slot-repository");
      await mod.publishActiveMusicSlot({
        requestId,
        ownerAccountId: ownerId,
        trackId,
        publishAsMode: "cover_audio",
      });
      const r2 = await mod.publishActiveMusicSlot({
        requestId,
        ownerAccountId: ownerId,
        trackId,
        publishAsMode: "cover_audio",
      });
      expect(r2.ok).toBe(true);
      if (r2.ok) expect(r2.data.publishGeneration).toBe(1);
      const slots = await readSlots(dir);
      expect(slots.slots[0]!.publish_generation).toBe(1);
      const dedup = await readDedup(dir);
      expect(dedup.rows).toHaveLength(1);
    });
  });

  it("fingerprint mismatch is rejected with the single generic code", async () => {
    await withTempCwd(async () => {
      const dir = path.resolve(process.cwd(), ".dev-music-data");
      const ownerA = crypto.randomUUID();
      const ownerB = crypto.randomUUID();
      const trackA = crypto.randomUUID();
      const trackB = crypto.randomUUID();
      const sharedRequestId = crypto.randomUUID();
      await seedTracks(dir, [
        {
          id: trackA,
          owner_account_id: ownerA,
          visibility: "private",
          rights_declaration: "owner_content",
          title: "A",
        },
        {
          id: trackB,
          owner_account_id: ownerB,
          visibility: "private",
          rights_declaration: "owner_content",
          title: "B",
        },
      ]);
      const mod = await import("../active-slot-repository");
      const r1 = await mod.publishActiveMusicSlot({
        requestId: sharedRequestId,
        ownerAccountId: ownerA,
        trackId: trackA,
        publishAsMode: "cover_audio",
      });
      expect(r1.ok).toBe(true);
      // Same request_id, DIFFERENT account+track -> single generic rejection.
      const r2 = await mod.publishActiveMusicSlot({
        requestId: sharedRequestId,
        ownerAccountId: ownerB,
        trackId: trackB,
        publishAsMode: "cover_audio",
      });
      expect(r2.ok).toBe(false);
      if (!r2.ok) expect(r2.code).toBe("idempotency-rejected");
    });
  });

  it("replaces the active slot and preserves the previous library track", async () => {
    await withTempCwd(async () => {
      const dir = path.resolve(process.cwd(), ".dev-music-data");
      const ownerId = crypto.randomUUID();
      const trackA = crypto.randomUUID();
      const trackB = crypto.randomUUID();
      await seedTracks(dir, [
        {
          id: trackA,
          owner_account_id: ownerId,
          visibility: "private",
          rights_declaration: "owner_content",
          title: "A",
        },
        {
          id: trackB,
          owner_account_id: ownerId,
          visibility: "private",
          rights_declaration: "owner_content",
          title: "B",
        },
      ]);
      const mod = await import("../active-slot-repository");
      const r1 = await mod.publishActiveMusicSlot({
        requestId: crypto.randomUUID(),
        ownerAccountId: ownerId,
        trackId: trackA,
        publishAsMode: "cover_audio",
      });
      expect(r1.ok).toBe(true);
      const r2 = await mod.publishActiveMusicSlot({
        requestId: crypto.randomUUID(),
        ownerAccountId: ownerId,
        trackId: trackB,
        publishAsMode: "cover_audio",
      });
      expect(r2.ok).toBe(true);
      if (r2.ok) expect(r2.data.publishGeneration).toBe(2);
      const slots = await readSlots(dir);
      expect(slots.slots).toHaveLength(1);
      expect(slots.slots[0]!.track_id).toBe(trackB);
      // Both library tracks still exist (nothing deleted on replace).
      const tracks = await readTracks(dir);
      expect(tracks.tracks).toHaveLength(2);
      const trackAStill = tracks.tracks.find((t) => t.id === trackA);
      expect(trackAStill).toBeDefined();
      // Visibility of A still "shared_live" (set when A was published).
      expect(trackAStill!.visibility).toBe("shared_live");
    });
  });

  it("rejects publish for a removed track", async () => {
    await withTempCwd(async () => {
      const dir = path.resolve(process.cwd(), ".dev-music-data");
      const ownerId = crypto.randomUUID();
      const trackId = crypto.randomUUID();
      await seedTracks(dir, [
        {
          id: trackId,
          owner_account_id: ownerId,
          visibility: "removed",
          rights_declaration: "owner_content",
          title: "Gone",
        },
      ]);
      const mod = await import("../active-slot-repository");
      const r = await mod.publishActiveMusicSlot({
        requestId: crypto.randomUUID(),
        ownerAccountId: ownerId,
        trackId,
        publishAsMode: "cover_audio",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("track-removed");
    });
  });

  it("rejects publish for a non-owner caller", async () => {
    await withTempCwd(async () => {
      const dir = path.resolve(process.cwd(), ".dev-music-data");
      const owner = crypto.randomUUID();
      const attacker = crypto.randomUUID();
      const trackId = crypto.randomUUID();
      await seedTracks(dir, [
        {
          id: trackId,
          owner_account_id: owner,
          visibility: "private",
          rights_declaration: "owner_content",
          title: "Mine",
        },
      ]);
      const mod = await import("../active-slot-repository");
      const r = await mod.publishActiveMusicSlot({
        requestId: crypto.randomUUID(),
        ownerAccountId: attacker,
        trackId,
        publishAsMode: "cover_audio",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("not-authorized");
    });
  });
});
