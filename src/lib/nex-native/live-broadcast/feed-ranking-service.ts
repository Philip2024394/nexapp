// src/lib/nex-native/live-broadcast/feed-ranking-service.ts
//
// NEX Live feed · country-weighted ranking (pure, deterministic).
// -----------------------------------------------------------------------------
// Owner directive 2026-10-24 · "70 percent of their own feeds first ·
// unless user has shown interest in a topic within one viewing time
// we push similar 20% same type to viewer".
//
// This module is PURE · no DB, no network, no clock reads except an
// optional injected `now`. The caller (feed server component) fetches
// candidates from Postgres and passes them in; the function returns
// an ordered list sliced to `totalSlots`.
//
// Design (see docs/doctrine/nex-live-feed-ranking-brainstorm-2026-10-24.md):
//
//   Three non-overlapping buckets:
//     HOME     · candidate.countryOfOrigin === viewerCountryIso
//     TOPIC    · !HOME && topic_tags ∩ activeInterestTags ≠ ∅
//     DISCOVERY· !HOME && !TOPIC
//
//   Default weights (owner-approved · can be overridden per call):
//     With interest signal : home 0.70 · topic 0.20 · discovery 0.10
//     Without interest     : home 0.70 · topic 0.00 · discovery 0.30
//     Viewer has no country: home 0.00 · topic (if interest) · 100-rest discovery
//
//   Ordering within a bucket · published_at DESC (newest-first) with
//   a deterministic shuffle tiebreaker seeded by `shuffleSeed` so
//   two viewers in the same country at the same time don't see
//   identical order (fairness) but one viewer refreshing sees the
//   SAME order (stable per session).
//
//   Underfill rolls to the next bucket in order HOME → TOPIC →
//   DISCOVERY. If every bucket underfills we return what we have.

export type NexUuid = string;

export interface RankableVideo {
  readonly id: NexUuid;
  readonly countryOfOrigin: string; // ISO alpha-2 uppercase
  readonly topicTags: readonly string[];
  readonly publishedAt: string; // ISO
}

export interface FeedRankingWeights {
  readonly home: number;
  readonly topic: number;
  readonly discovery: number;
}

export interface FeedRankingContext {
  readonly viewerCountryIso: string | null;
  readonly activeInterestTags: ReadonlySet<string>;
  readonly totalSlots: number;
  /** Hex-encoded seed (even-length) for the deterministic shuffle
   *  tiebreaker within each bucket. Supplying the SAME seed with the
   *  SAME inputs returns the SAME order · supplying a different seed
   *  shuffles order within buckets. */
  readonly shuffleSeedHex: string;
  readonly weights?: FeedRankingWeights;
}

export const DEFAULT_WEIGHTS_WITH_INTEREST: FeedRankingWeights = {
  home: 0.7,
  topic: 0.2,
  discovery: 0.1,
};
export const DEFAULT_WEIGHTS_NO_INTEREST: FeedRankingWeights = {
  home: 0.7,
  topic: 0.0,
  discovery: 0.3,
};

/** Returns the ranked slice of up to `totalSlots` videos. Pure. */
export function rankFeedCandidates(
  ctx: FeedRankingContext,
  candidates: readonly RankableVideo[],
): RankableVideo[] {
  if (ctx.totalSlots <= 0 || candidates.length === 0) return [];

  const weights = ctx.weights ?? pickDefaultWeights(ctx);

  // Edge: viewer has no country · drop the HOME bucket (treat home
  // weight as discovery · the "70%" rule doesn't apply when there's
  // no "home").
  const effectiveWeights = ctx.viewerCountryIso === null
    ? { home: 0, topic: weights.topic, discovery: weights.home + weights.discovery }
    : weights;

  const partition = partitionCandidates(ctx, candidates);
  const slotCounts = allocateSlots(ctx.totalSlots, effectiveWeights);

  // Order inside each bucket · published_at DESC + deterministic
  // shuffle on ties (same ISO second).
  const orderedHome = orderBucket(partition.home, ctx.shuffleSeedHex, 1);
  const orderedTopic = orderBucket(partition.topic, ctx.shuffleSeedHex, 2);
  const orderedDiscovery = orderBucket(
    partition.discovery,
    ctx.shuffleSeedHex,
    3,
  );

  // Fill with underflow rolling · HOME → TOPIC → DISCOVERY.
  const out: RankableVideo[] = [];
  let homeTake = slotCounts.home;
  let topicTake = slotCounts.topic;
  let discoveryTake = slotCounts.discovery;

  const taken = new Set<string>();
  const push = (v: RankableVideo | undefined) => {
    if (!v || taken.has(v.id)) return;
    taken.add(v.id);
    out.push(v);
  };

  // 1 · take home
  for (let i = 0; i < homeTake && i < orderedHome.length; i++) {
    push(orderedHome[i]);
  }
  // Underflow roll · unfilled home → topic quota.
  topicTake += Math.max(0, homeTake - orderedHome.length);

  // 2 · take topic
  for (let i = 0; i < topicTake && i < orderedTopic.length; i++) {
    push(orderedTopic[i]);
  }
  discoveryTake += Math.max(0, topicTake - orderedTopic.length);

  // 3 · take discovery
  for (let i = 0; i < discoveryTake && i < orderedDiscovery.length; i++) {
    push(orderedDiscovery[i]);
  }
  // Underflow roll · still short · pull more from any remaining
  // home bucket (consistency with "home-first" intent).
  if (out.length < ctx.totalSlots) {
    for (const v of orderedHome) {
      if (out.length >= ctx.totalSlots) break;
      push(v);
    }
  }
  if (out.length < ctx.totalSlots) {
    for (const v of orderedTopic) {
      if (out.length >= ctx.totalSlots) break;
      push(v);
    }
  }
  if (out.length < ctx.totalSlots) {
    for (const v of orderedDiscovery) {
      if (out.length >= ctx.totalSlots) break;
      push(v);
    }
  }

  return out.slice(0, ctx.totalSlots);
}

/* ─── Private helpers ───────────────────────────────────── */

function pickDefaultWeights(ctx: FeedRankingContext): FeedRankingWeights {
  return ctx.activeInterestTags.size > 0
    ? DEFAULT_WEIGHTS_WITH_INTEREST
    : DEFAULT_WEIGHTS_NO_INTEREST;
}

interface Partition {
  readonly home: RankableVideo[];
  readonly topic: RankableVideo[];
  readonly discovery: RankableVideo[];
}

function partitionCandidates(
  ctx: FeedRankingContext,
  candidates: readonly RankableVideo[],
): Partition {
  const home: RankableVideo[] = [];
  const topic: RankableVideo[] = [];
  const discovery: RankableVideo[] = [];
  for (const v of candidates) {
    const isHome = ctx.viewerCountryIso !== null
      && v.countryOfOrigin === ctx.viewerCountryIso;
    if (isHome) {
      home.push(v);
      continue;
    }
    const isTopicMatch = ctx.activeInterestTags.size > 0
      && v.topicTags.some((t) => ctx.activeInterestTags.has(t));
    if (isTopicMatch) {
      topic.push(v);
    } else {
      discovery.push(v);
    }
  }
  return { home, topic, discovery };
}

interface SlotCounts {
  home: number;
  topic: number;
  discovery: number;
}

function allocateSlots(
  total: number,
  weights: FeedRankingWeights,
): SlotCounts {
  const home = Math.floor(total * weights.home);
  const topic = Math.floor(total * weights.topic);
  // Discovery takes the remainder so total exactness holds.
  const discovery = Math.max(0, total - home - topic);
  return { home, topic, discovery };
}

/** Sort by published_at DESC with deterministic shuffle tiebreaker
 *  seeded by `(seedHex, bucketTag)`. Pure. */
function orderBucket(
  bucket: readonly RankableVideo[],
  seedHex: string,
  bucketTag: number,
): RankableVideo[] {
  if (bucket.length <= 1) return bucket.slice();
  // Compute a stable hash per video id · deterministic.
  const seedBase = hashString(`${seedHex}:${bucketTag}`);
  const scored = bucket.map((v) => ({
    v,
    publishedMs: Date.parse(v.publishedAt),
    jitter: hashString(`${seedBase}:${v.id}`),
  }));
  scored.sort((a, b) => {
    if (a.publishedMs !== b.publishedMs) {
      return b.publishedMs - a.publishedMs; // newest-first
    }
    return a.jitter - b.jitter;
  });
  return scored.map((s) => s.v);
}

/** Pure non-linear mixing hash · deterministic across runs. Uses an
 *  FNV-1a-style mix with xorshift tail so two seeds that would
 *  otherwise produce order-preserving linear outputs diverge in
 *  relative rank, not just absolute value. */
function hashString(s: string): number {
  let h = 0x811c9dc5 | 0; // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0;
    // FNV prime multiplication followed by xorshift to break
    // linearity · two different starting states produce distinct
    // relative orders, not just shifted values.
    h = (h * 0x01000193) >>> 0;
    h ^= h >>> 7;
    h = (h * 0x9e3779b1) >>> 0;
    h ^= h >>> 13;
  }
  return h | 0;
}
