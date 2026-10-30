// scripts/stage-5c-tests.mts
//
// Stage 5C authorised integration tests, run via `tsx`:
//   1. Soft-delete persistence · setTrackVisibility("removed")
//      marks the row with removed_at, listTracksByOwner filters
//      it from the default view, the stored record remains.
//   2. Likes atomic-write behaviour · toggleTrackLike records a
//      like, toggling again removes it, bounded concurrency
//      leaves valid JSON without losing records.
//
// Preservation: this script SAVES the current tracks.json state
// before mutating, and RESTORES it at the end so the three seeded
// tracks are left exactly as the owner has them. The script also
// runs the rate-limit reset before each test so bucket state from
// prior runs does not interfere.

import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), ".dev-music-data");
const TRACKS = path.join(DATA_DIR, "tracks.json");
const LIKES = path.join(DATA_DIR, "track-likes.json");

async function snapshot<T>(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function restore(filePath: string, raw: string | null): Promise<void> {
  if (raw === null) {
    try {
      await fs.unlink(filePath);
    } catch {
      /* file didn't exist · fine */
    }
  } else {
    await fs.writeFile(filePath, raw);
  }
}

interface JsonTrack {
  id: string;
  owner_account_id: string;
  title: string;
  visibility: "private" | "shared_live" | "removed";
  removed_at: string | null;
}
interface JsonSnap {
  tracks: JsonTrack[];
}

async function readTracks(): Promise<JsonSnap> {
  const raw = await fs.readFile(TRACKS, "utf8");
  return JSON.parse(raw) as JsonSnap;
}

async function readLikes(): Promise<Record<string, string[]> | null> {
  try {
    const raw = await fs.readFile(LIKES, "utf8");
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return null;
  }
}

async function main() {
  console.log("=== STAGE 5C TESTS ===\n");

  // Save state
  const tracksSnap = await snapshot(TRACKS);
  const likesSnap = await snapshot(LIKES);
  console.log("Snapshotted tracks.json:", tracksSnap !== null ? `${tracksSnap.length} bytes` : "(missing)");
  console.log("Snapshotted track-likes.json:", likesSnap !== null ? `${likesSnap.length} bytes` : "(missing)");

  // Import the repo + rate-limit after snapshotting · tsx handles TS.
  // Use relative path from repo root (where tsx is being run).
  const repo = await import("../src/lib/nex-native/music/music-repository.ts");
  const rate = await import("../src/lib/nex-native/music/music-rate-limit.ts");

  rate.__resetMusicRateLimits__();

  const initial = await readTracks();
  if (initial.tracks.length < 1) {
    throw new Error("no seeded tracks · aborting · owner's seed state must have 3 tracks");
  }
  const subject = initial.tracks[0]!;
  const ownerId = subject.owner_account_id;
  console.log(`\nSubject track: "${subject.title}"`);
  console.log(`  id      = ${subject.id}`);
  console.log(`  owner   = ${ownerId}`);
  console.log(`  initial visibility = ${subject.visibility}`);
  console.log(`  initial removed_at = ${subject.removed_at ?? "null"}`);

  // -----------------------------------------------------
  // Test 1 · Soft-delete persistence
  // -----------------------------------------------------
  console.log("\n--- TEST 1 · Soft-delete persistence ---");
  const beforeAll = await repo.listTracksByOwner(ownerId);
  console.log(`[1a] listTracksByOwner (default filter) BEFORE: ${beforeAll.length} tracks`);
  if (!beforeAll.some((t: { id: string }) => t.id === subject.id)) {
    throw new Error("subject not visible before soft-delete · test premise broken");
  }
  console.log(`     · subject "${subject.title}" is visible: OK`);

  const beforeMsg = Date.now();
  const softResult = await repo.setTrackVisibility({
    trackId: subject.id,
    ownerAccountId: ownerId,
    visibility: "removed",
  });
  if (!softResult) throw new Error("setTrackVisibility returned null · subject not found by owner-scope");
  console.log(`[1b] setTrackVisibility(removed) returned row:`);
  console.log(`     visibility = ${softResult.visibility} (expected "removed")`);
  console.log(`     removed_at = ${softResult.removed_at}`);
  const removedAtMs = softResult.removed_at ? new Date(softResult.removed_at).getTime() : NaN;
  const removedAtDelta = removedAtMs - beforeMsg;
  console.log(`     removed_at is ${Math.abs(removedAtDelta)}ms from pre-call clock: ${Math.abs(removedAtDelta) < 5000 ? "OK (within tolerance)" : "FAIL"}`);

  const afterDefault = await repo.listTracksByOwner(ownerId);
  console.log(`[1c] listTracksByOwner (default filter) AFTER: ${afterDefault.length} tracks`);
  const visibleIds = new Set(afterDefault.map((t: { id: string }) => t.id));
  console.log(`     subject in default listing: ${visibleIds.has(subject.id) ? "FAIL (still visible)" : "OK (filtered out)"}`);

  const withRemoved = await repo.listTracksByOwner(ownerId, { includeRemoved: true });
  console.log(`[1d] listTracksByOwner (includeRemoved=true) AFTER: ${withRemoved.length} tracks`);
  const removedRow = withRemoved.find((t: { id: string }) => t.id === subject.id);
  console.log(`     subject in includeRemoved listing: ${removedRow ? "OK (preserved)" : "FAIL (lost)"}`);
  if (removedRow) {
    console.log(`     subject.visibility = ${removedRow.visibility} (expected "removed"): ${removedRow.visibility === "removed" ? "OK" : "FAIL"}`);
    console.log(`     subject.removed_at = ${removedRow.removed_at ?? "null"}: ${removedRow.removed_at ? "OK (set)" : "FAIL (missing)"}`);
  }

  // Re-read tracks.json directly to confirm persistence (not just in-memory cache)
  const diskAfter = await readTracks();
  const diskRow = diskAfter.tracks.find((t: JsonTrack) => t.id === subject.id);
  console.log(`[1e] tracks.json on disk · subject preserved: ${diskRow ? "OK" : "FAIL"}`);
  if (diskRow) {
    console.log(`     disk visibility = ${diskRow.visibility}: ${diskRow.visibility === "removed" ? "OK" : "FAIL"}`);
    console.log(`     disk removed_at = ${diskRow.removed_at ?? "null"}: ${diskRow.removed_at ? "OK" : "FAIL"}`);
  }

  // -----------------------------------------------------
  // Test 2 · Likes atomic-write behaviour
  // -----------------------------------------------------
  console.log("\n--- TEST 2 · Likes atomic-write behaviour ---");
  // Clean likes file so the test is deterministic.
  try { await fs.unlink(LIKES); } catch { /* fine */ }

  const fakeLikerA = "aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa";
  const fakeLikerB = "bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb";

  const r1 = await repo.toggleTrackLike({ trackId: subject.id, likerAccountId: fakeLikerA });
  console.log(`[2a] toggleTrackLike(A) first call: liked=${r1?.liked}, likeCount=${r1?.row.like_count}`);
  console.log(`     expect liked=true, likeCount increased by 1`);

  const likesAfterOne = await readLikes();
  console.log(`[2b] track-likes.json after 1st like:`, likesAfterOne);
  console.log(`     expected: { "${subject.id.slice(0, 8)}…": ["${fakeLikerA.slice(0,8)}…"] }`);

  const r2 = await repo.toggleTrackLike({ trackId: subject.id, likerAccountId: fakeLikerA });
  console.log(`[2c] toggleTrackLike(A) second call (toggle off): liked=${r2?.liked}, likeCount=${r2?.row.like_count}`);
  console.log(`     expect liked=false, likeCount back down`);

  const likesAfterToggle = await readLikes();
  console.log(`[2d] track-likes.json after toggle-off:`, likesAfterToggle);

  // Bounded concurrency: 10 parallel toggles from distinct fake users.
  // The number of users at the end should equal the number of odd-count toggles.
  // With a single toggle per user, all 10 users end liked.
  console.log(`\n[2e] Bounded concurrency · 10 parallel like-toggles from distinct fake users`);
  const fakeUsers = Array.from({ length: 10 }, (_, i) =>
    `cccccccc-${String(i).padStart(4, "0")}-0000-0000-cccccccccccc`,
  );
  const results = await Promise.all(
    fakeUsers.map((u) => repo.toggleTrackLike({ trackId: subject.id, likerAccountId: u })),
  );
  const likedCount = results.filter((r) => r?.liked === true).length;
  console.log(`     toggles that resulted in liked=true: ${likedCount} (expected 10)`);
  console.log(`     final likeCount from last toggle: ${results[results.length - 1]?.row.like_count}`);

  const finalLikes = await readLikes();
  if (!finalLikes) {
    console.log(`[2f] track-likes.json MISSING after concurrency burst: FAIL`);
  } else {
    const parsedOk = typeof finalLikes === "object" && !Array.isArray(finalLikes);
    console.log(`[2f] track-likes.json after 10 parallel toggles:`);
    console.log(`     parses: ${parsedOk ? "OK" : "FAIL"}`);
    console.log(`     keys: ${Object.keys(finalLikes).length}`);
    const trackLikes = finalLikes[subject.id] ?? [];
    console.log(`     likers for subject: ${trackLikes.length}`);
    const allUniqueFromBurst = fakeUsers.every((u) => trackLikes.includes(u));
    console.log(`     all 10 fake users present in track-likes.json: ${allUniqueFromBurst ? "OK (no updates lost)" : "FAIL (updates lost)"}`);
    const missing = fakeUsers.filter((u) => !trackLikes.includes(u));
    if (missing.length > 0) {
      console.log(`     missing: ${missing.length} users →`, missing);
    }
  }

  // -----------------------------------------------------
  // RESTORE snapshot
  // -----------------------------------------------------
  console.log("\n--- RESTORE snapshotted state ---");
  await restore(TRACKS, tracksSnap);
  await restore(LIKES, likesSnap);
  console.log("tracks.json restored:", tracksSnap !== null ? "yes" : "removed (none existed before)");
  console.log("track-likes.json restored:", likesSnap !== null ? "yes" : "removed (none existed before)");

  // Verify restore
  const restored = await readTracks();
  const restoredSubject = restored.tracks.find((t: JsonTrack) => t.id === subject.id);
  console.log(`\nSubject after restore:`);
  console.log(`  visibility = ${restoredSubject?.visibility} (expected "${subject.visibility}"): ${restoredSubject?.visibility === subject.visibility ? "OK" : "FAIL"}`);
  console.log(`  removed_at = ${restoredSubject?.removed_at ?? "null"} (expected "${subject.removed_at ?? "null"}"): ${restoredSubject?.removed_at === subject.removed_at ? "OK" : "FAIL"}`);

  console.log("\n=== TESTS COMPLETE ===");
}

main().catch((e) => {
  console.error("TEST SCRIPT ERROR:", e);
  process.exit(1);
});
