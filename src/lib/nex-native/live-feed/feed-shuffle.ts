// src/lib/nex-native/live-feed/feed-shuffle.ts
//
// Pure feed-building helpers · test-safe · no server-only, no DOM.
// -----------------------------------------------------------------------------
// Implements the owner-directed feed behaviour (2026-10-26 · Round 3i):
//
//   · Each like of a category increases that category's weight in the
//     viewer's feed. The FIRST like of a given category bumps weight
//     by +5%; subsequent likes of the SAME category bump by +10%.
//   · The feed never shows two consecutive videos from the same
//     broadcaster (`sellerId`). Where the constraint would require
//     exceeding the available diversity, the shuffler keeps the
//     ordering valid by falling back to best-effort separation (no
//     video is dropped).
//   · The feed is deterministically seeded so a given visitor seed
//     produces the SAME order across refresh (stability for pagination
//     and the Prev/Next contract that the directory already uses).
//   · Weighting is applied AT MIX TIME: videos in a higher-weighted
//     category get more early-feed slots in expectation, without
//     silently excluding the long tail (every video keeps a non-zero
//     base weight).
//
// Habits storage (client only · pre-DB)
//   · `nex-watch-cat-like-count:c=<category>` holds the aggregate
//     like count per category. `VideoLikeButton` writes this on
//     tap. `readHabitsFromStorage()` snapshots it for the shuffler.
//
// Future DB wire-up
//   · `nex_viewer_habit` table can store per-account category like
//     counts under RLS. The shuffler contract stays the same · only
//     `readHabits` swaps its data source.
//
// Pure-ness
//   · No `Math.random`, no `Date.now`, no fetch, no DOM reads inside
//     the pure helpers. `visitorSeed` + `nowMs` are inputs so tests
//     stay deterministic.

export type CategoryId = string;
export type SellerId = string;
export type VideoId = string;

export interface FeedVideo {
  readonly id: VideoId;
  readonly sellerId: SellerId;
  readonly categoryId: CategoryId;
}

/** Aggregate like count per category · the viewer's observed habits.
 *  Zero / missing categories default to count=0. */
export type HabitSnapshot = Readonly<Record<CategoryId, number>>;

// ─── Pure weighting ─────────────────────────────────────────────────────────

/** Returns the ADDITIONAL category weight (as a fraction of 1.0) the
 *  viewer's like history grants to videos in that category.
 *
 *  Owner-directed curve:
 *    · 0 likes · +0.00  (no bonus)
 *    · 1 like  · +0.05  (first like · +5%)
 *    · 2 likes · +0.15  (first +5% then second +10%)
 *    · n likes · +0.05 + (n-1) * 0.10, capped at +1.00 so the long
 *      tail never fully disappears.
 *
 *  Pure · deterministic. */
export function categoryWeightBonus(likeCount: number): number {
  if (!Number.isFinite(likeCount) || likeCount <= 0) return 0;
  const n = Math.floor(likeCount);
  const bonus = 0.05 + Math.max(0, n - 1) * 0.1;
  return Math.min(bonus, 1.0);
}

/** Final weight (per-video) · base 1.0 + category bonus. Pure. */
export function weightForVideo(video: FeedVideo, habits: HabitSnapshot): number {
  const bonus = categoryWeightBonus(habits[video.categoryId] ?? 0);
  return 1.0 + bonus;
}

// ─── Pure RNG (mulberry32) ──────────────────────────────────────────────────

/** FNV-1a 32-bit hash. Used to turn a visitor-seed string into a
 *  32-bit seed for the mulberry32 PRNG. Pure. */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic PRNG · the exact same seed produces the exact same
 *  stream. Keeps feed ordering stable across refresh. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Weighted draw-without-replacement ──────────────────────────────────────

/** Draw ONE item from a weighted pool, remove it, return it. Pure
 *  given a seeded `rand`. Returns null if the pool is empty. */
function weightedDraw(
  pool: FeedVideo[],
  weights: number[],
  rand: () => number,
): { readonly video: FeedVideo; readonly index: number } | null {
  if (pool.length === 0) return null;
  let total = 0;
  for (const w of weights) total += w > 0 ? w : 0;
  if (total <= 0) {
    // Degenerate pool · fall back to uniform.
    const idx = Math.floor(rand() * pool.length);
    return { video: pool[idx]!, index: idx };
  }
  const target = rand() * total;
  let running = 0;
  for (let i = 0; i < pool.length; i += 1) {
    running += weights[i] ?? 0;
    if (running >= target) {
      return { video: pool[i]!, index: i };
    }
  }
  // Floating-point safety · take the last item.
  return { video: pool[pool.length - 1]!, index: pool.length - 1 };
}

// ─── Build the ordered feed ─────────────────────────────────────────────────

export interface BuildFeedPlanArgs {
  readonly videos: readonly FeedVideo[];
  readonly habits: HabitSnapshot;
  readonly visitorSeed: string;
  readonly limit?: number;
}

export interface BuildFeedPlanResult {
  readonly feed: readonly FeedVideo[];
  readonly debug: {
    readonly totalPool: number;
    readonly consecutiveSellerFallbacks: number;
    readonly seed: string;
  };
}

/** Build the feed · deterministic, weighted, no two consecutive
 *  same-seller videos (best-effort if the pool forces it).
 *
 *  Algorithm:
 *    1. Compute per-video weights from category habit bonuses.
 *    2. Repeat until pool empty or limit reached:
 *         a. Draw one video weighted at random.
 *         b. If its sellerId matches the previously-picked seller
 *            AND the pool still contains at least one video from
 *            another seller, re-queue it to the back of the pool
 *            and draw again (bounded by pool.length retries).
 *         c. Append the chosen video. Remember its sellerId.
 *    3. Return the feed.
 *
 *  Pure given `visitorSeed`. */
export function buildFeedPlan(args: BuildFeedPlanArgs): BuildFeedPlanResult {
  const pool: FeedVideo[] = args.videos.slice();
  const weights: number[] = pool.map((v) => weightForVideo(v, args.habits));
  const rand = mulberry32(fnv1a(args.visitorSeed));
  const limit = args.limit ?? pool.length;

  const feed: FeedVideo[] = [];
  let prevSeller: SellerId | null = null;
  let consecutiveFallbacks = 0;

  while (pool.length > 0 && feed.length < limit) {
    // Seller-scheduling-greedy · prevents the "A-majority pool gets
    // starved of X's early" failure mode a naive weighted draw hits
    // (the standard reorganize-array constraint). Steps:
    //   (1) Group remaining videos by sellerId.
    //   (2) Exclude the prev-seller bucket unless it's the only one
    //       left (unavoidable fallback · recorded).
    //   (3) Among the surviving buckets, prefer the HEAVIEST
    //       remaining counts · ties broken by weighted-random on
    //       bucket sum-of-weights (so category bias still shows up).
    //   (4) Within the chosen bucket, weighted-draw one video.
    const bySeller = new Map<SellerId, number[]>();
    for (let i = 0; i < pool.length; i += 1) {
      const sid = pool[i]!.sellerId;
      const list = bySeller.get(sid) ?? [];
      list.push(i);
      bySeller.set(sid, list);
    }
    let bucketEntries: Array<[SellerId, number[]]> = Array.from(bySeller.entries());

    const forcedSameSeller =
      prevSeller !== null &&
      bucketEntries.length === 1 &&
      bucketEntries[0]![0] === prevSeller;

    if (prevSeller !== null && bucketEntries.length > 1) {
      bucketEntries = bucketEntries.filter(([sid]) => sid !== prevSeller);
    }

    // Sort by count desc so the heaviest bucket wins the tie-break.
    bucketEntries.sort((a, b) => b[1].length - a[1].length);
    const maxCount = bucketEntries[0]![1].length;
    const topTied = bucketEntries.filter(([, idxs]) => idxs.length === maxCount);

    // Pick a tied bucket · weighted-random by sum-of-weights so
    // category bias flows through (heavier total weight = more likely).
    const bucketTotals: number[] = topTied.map(([, idxs]) =>
      idxs.reduce((acc, i) => acc + (weights[i] ?? 0), 0),
    );
    const totalSum = bucketTotals.reduce((a, b) => a + b, 0);
    let bucketPickIdx = 0;
    if (totalSum > 0 && topTied.length > 1) {
      const target = rand() * totalSum;
      let running = 0;
      for (let i = 0; i < topTied.length; i += 1) {
        running += bucketTotals[i] ?? 0;
        if (running >= target) {
          bucketPickIdx = i;
          break;
        }
      }
    }
    const [, chosenBucketIndices] = topTied[bucketPickIdx]!;

    // Within the chosen bucket, weighted-draw one video.
    const sellerVideos: FeedVideo[] = chosenBucketIndices.map((i) => pool[i]!);
    const sellerWeights: number[] = chosenBucketIndices.map((i) => weights[i] ?? 0);
    const draw = weightedDraw(sellerVideos, sellerWeights, rand);
    if (!draw) break;
    const originalIndex = chosenBucketIndices[draw.index]!;
    const chosen = { video: pool[originalIndex]!, index: originalIndex };

    if (forcedSameSeller) {
      consecutiveFallbacks += 1;
    }

    feed.push(chosen.video);
    prevSeller = chosen.video.sellerId;
    pool.splice(chosen.index, 1);
    weights.splice(chosen.index, 1);
  }

  return {
    feed,
    debug: {
      totalPool: args.videos.length,
      consecutiveSellerFallbacks: consecutiveFallbacks,
      seed: args.visitorSeed,
    },
  };
}

// ─── localStorage habit helpers (client-only) ───────────────────────────────

const LS_CAT_PREFIX = "nex-watch-cat-like-count:c=";

/** Snapshot the viewer's category like counts from localStorage.
 *  Returns an empty object when localStorage is unavailable (SSR,
 *  disabled storage, etc.) · the shuffler then falls back to pure
 *  base weights. */
export function readHabitsFromStorage(): HabitSnapshot {
  if (typeof window === "undefined") return {};
  try {
    const out: Record<string, number> = {};
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(LS_CAT_PREFIX)) continue;
      const category = key.slice(LS_CAT_PREFIX.length);
      const value = Number(window.localStorage.getItem(key) ?? "0");
      if (Number.isFinite(value) && value > 0) out[category] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/** Convenience for building a feed on the client from the current
 *  localStorage habits snapshot + a visitor seed. Pure composition
 *  of the pure helpers above · the only side-effect is the localStorage
 *  read. */
export function buildClientFeedPlan(args: {
  readonly videos: readonly FeedVideo[];
  readonly visitorSeed: string;
  readonly limit?: number;
}): BuildFeedPlanResult {
  return buildFeedPlan({
    videos: args.videos,
    habits: readHabitsFromStorage(),
    visitorSeed: args.visitorSeed,
    limit: args.limit,
  });
}
