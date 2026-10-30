// scripts/smoke-music-publish.mts
//
// Owner-authorised 2026-10-30 (M-6 of NEX Music Publishing → Live Feed) ·
// Dev-only one-shot smoke test for the end-to-end flow against the
// already-running dev server at http://localhost:3008.
//
// Strategy:
//   · The vitest at `src/lib/nex-native/music/__tests__/active-slot-repository.test.ts`
//     already proves the publishActiveMusicSlot repository's correctness
//     (6 invariants: publish, retry, mismatch, replace, removed, non-owner).
//   · This smoke verifies the OTHER half of the flow: that the feed-reader
//     + music-feed-card actually render a published slot in the feed page.
//
// Writes a plausible dev-FS state directly (bypasses server-only guards)
// then hits the live feed URL and grep's the HTML.
//
// Backs up and restores .dev-music-data so the dev tester's workspace is
// unchanged after the run.
//
// Run with:  npx tsx scripts/smoke-music-publish.mts

import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), ".dev-music-data");
const TRACKS = path.join(DATA_DIR, "tracks.json");
const SLOTS = path.join(DATA_DIR, "active-slots.json");
const DEDUP = path.join(DATA_DIR, "publish-idempotency.json");

const HENDRA_ACCOUNT_ID = "4f112c32-46a3-4fa4-8b4a-1c5f50caed42";
const FEED_URL = "http://localhost:3008/nex-native/live-commerce/feed";

async function backup(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function restore(file: string, snapshot: string | null): Promise<void> {
  if (snapshot === null) {
    await fs.rm(file, { force: true });
  } else {
    await fs.writeFile(file, snapshot);
  }
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

interface Track {
  readonly id: string;
  readonly owner_account_id: string;
  readonly title: string;
  readonly visibility: string;
  readonly rights_declaration: string;
}
interface TracksSnap {
  readonly tracks: Track[];
}

function pass(line: string): void {
  console.log(`  \x1b[32m✓\x1b[0m ${line}`);
}
function fail(line: string): void {
  console.log(`  \x1b[31m✗\x1b[0m ${line}`);
  process.exitCode = 1;
}
function info(line: string): void {
  console.log(`  · ${line}`);
}

async function main(): Promise<void> {
  console.log("NEX Music Publishing · M-6 smoke test · feed-render probe");
  console.log("");

  const tracksBefore = await backup(TRACKS);
  const slotsBefore = await backup(SLOTS);
  const dedupBefore = await backup(DEDUP);

  try {
    const tracks = await readJson<TracksSnap>(TRACKS);
    if (!tracks || tracks.tracks.length === 0) {
      fail("tracks.json missing or empty — ensure the dev music library is seeded");
      return;
    }
    const hendraTracks = tracks.tracks.filter(
      (t) => t.owner_account_id === HENDRA_ACCOUNT_ID,
    );
    if (hendraTracks.length < 2) {
      fail(`expected ≥2 Hendra tracks, found ${hendraTracks.length}`);
      return;
    }
    const trackA = hendraTracks[0]!;
    const trackB = hendraTracks[1]!;
    info(`Hendra has ${hendraTracks.length} tracks in library`);
    info(`Track A = ${trackA.title} (${trackA.id.slice(0, 8)}) · vis=${trackA.visibility}`);
    info(`Track B = ${trackB.title} (${trackB.id.slice(0, 8)}) · vis=${trackB.visibility}`);

    // Fabricate an active-slot row for track A as if the publish
    // function had just run. The feed-reader doesn't care how the
    // row got there; it just reads active-slots.json.
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
    const activeSlots = {
      slots: [
        {
          owner_account_id: HENDRA_ACCOUNT_ID,
          track_id: trackA.id,
          publish_as_mode: "cover_audio",
          publish_generation: 1,
          rights_declaration_frozen: trackA.rights_declaration,
          published_at: now,
          unpublished_at: null,
        },
      ],
    };
    const dedupRow = {
      rows: [
        {
          request_id: crypto.randomUUID(),
          account_id: HENDRA_ACCOUNT_ID,
          track_id: trackA.id,
          publish_as_mode: "cover_audio",
          publish_generation: 1,
          observed_at: now,
          expires_at: expires,
        },
      ],
    };
    await fs.writeFile(SLOTS, JSON.stringify(activeSlots, null, 2));
    await fs.writeFile(DEDUP, JSON.stringify(dedupRow, null, 2));
    pass("wrote active-slot + dedup rows for track A");

    // Give Next's HMR a moment to clear its module-level caches.
    await new Promise((r) => setTimeout(r, 500));

    // Fetch the feed.
    const feedRes = await fetch(FEED_URL, { redirect: "manual" });
    info(`feed HTTP ${feedRes.status}`);
    if (feedRes.status !== 200) {
      fail(`feed did not return 200 · got ${feedRes.status}`);
      return;
    }
    const html = await feedRes.text();
    if (html.includes("Music on NEX")) {
      pass("feed HTML contains 'Music on NEX' section header");
    } else {
      fail("feed HTML did NOT contain 'Music on NEX' header");
    }
    if (html.includes(trackA.title)) {
      pass(`feed HTML contains track A title: '${trackA.title}'`);
    } else {
      fail(`feed HTML did NOT contain track A title '${trackA.title}'`);
      // Print a short window for debugging.
      const idx = html.toLowerCase().indexOf("music on nex");
      if (idx >= 0) {
        info(`HTML window around 'Music on NEX': ${html.slice(idx, idx + 400)}`);
      }
    }

    // Replace: swap active slot to track B. Verify replacement.
    activeSlots.slots[0]!.track_id = trackB.id;
    activeSlots.slots[0]!.publish_generation = 2;
    activeSlots.slots[0]!.rights_declaration_frozen = trackB.rights_declaration;
    activeSlots.slots[0]!.published_at = new Date().toISOString();
    dedupRow.rows.push({
      request_id: crypto.randomUUID(),
      account_id: HENDRA_ACCOUNT_ID,
      track_id: trackB.id,
      publish_as_mode: "cover_audio",
      publish_generation: 2,
      observed_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    });
    await fs.writeFile(SLOTS, JSON.stringify(activeSlots, null, 2));
    await fs.writeFile(DEDUP, JSON.stringify(dedupRow, null, 2));
    pass("swapped active slot to track B (simulated replace)");

    await new Promise((r) => setTimeout(r, 500));

    const feedRes2 = await fetch(FEED_URL, { redirect: "manual" });
    const html2 = await feedRes2.text();
    if (html2.includes(trackB.title)) {
      pass(`feed HTML now contains track B title: '${trackB.title}'`);
    } else {
      fail(`feed HTML did NOT contain track B title '${trackB.title}'`);
    }

    // Library preservation check: track A should still exist in tracks.json.
    const tracksAfter = await readJson<TracksSnap>(TRACKS);
    const trackAStill = tracksAfter?.tracks.find((t) => t.id === trackA.id);
    if (trackAStill) {
      pass("track A still present in tracks.json (library preserved)");
    } else {
      fail("track A missing from tracks.json");
    }

    console.log("");
    console.log(
      process.exitCode === 1
        ? "\x1b[31mSmoke failed · see above\x1b[0m"
        : "\x1b[32mSmoke passed · feed renders published music + replace works\x1b[0m",
    );
  } finally {
    await Promise.all([
      restore(TRACKS, tracksBefore),
      restore(SLOTS, slotsBefore),
      restore(DEDUP, dedupBefore),
    ]);
    console.log("");
    console.log(
      "  (dev-FS state restored — your tracks + any prior slot/dedup are intact)",
    );
  }
}

void main();
