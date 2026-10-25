// src/lib/nex-native/live-broadcast/__tests__/feed-ranking-service.test.ts
//
// Pure unit tests · no DB · covers the 70/20/10 country-weighted
// feed ranking algorithm.

import { describe, test, expect } from "vitest";
import {
  rankFeedCandidates,
  DEFAULT_WEIGHTS_WITH_INTEREST,
  DEFAULT_WEIGHTS_NO_INTEREST,
  type RankableVideo,
  type FeedRankingContext,
} from "../feed-ranking-service";

/** Minimal builder for a candidate video. */
function v(
  id: string,
  country: string,
  tags: readonly string[] = [],
  publishedAt = "2026-10-24T00:00:00Z",
): RankableVideo {
  return { id, countryOfOrigin: country, topicTags: tags, publishedAt };
}

const SEED = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";

describe("rankFeedCandidates · default weights", () => {
  test("no interest · weights fall back to 70/0/30 home-vs-discovery", () => {
    expect(DEFAULT_WEIGHTS_NO_INTEREST.home).toBe(0.7);
    expect(DEFAULT_WEIGHTS_NO_INTEREST.topic).toBe(0);
    expect(DEFAULT_WEIGHTS_NO_INTEREST.discovery).toBe(0.3);
  });

  test("with interest · weights are 70/20/10", () => {
    expect(DEFAULT_WEIGHTS_WITH_INTEREST.home).toBe(0.7);
    expect(DEFAULT_WEIGHTS_WITH_INTEREST.topic).toBe(0.2);
    expect(DEFAULT_WEIGHTS_WITH_INTEREST.discovery).toBe(0.1);
  });
});

describe("rankFeedCandidates · home-weighted (70%)", () => {
  test("Indonesian viewer with no interest signal · 70% ID + 30% others", () => {
    const candidates: RankableVideo[] = [
      ...Array.from({ length: 20 }, (_, i) => v(`id-${i}`, "ID")),
      ...Array.from({ length: 20 }, (_, i) => v(`us-${i}`, "US")),
      ...Array.from({ length: 20 }, (_, i) => v(`jp-${i}`, "JP")),
    ];
    const ctx: FeedRankingContext = {
      viewerCountryIso: "ID",
      activeInterestTags: new Set(),
      totalSlots: 20,
      shuffleSeedHex: SEED,
    };
    const result = rankFeedCandidates(ctx, candidates);
    expect(result).toHaveLength(20);
    const idCount = result.filter((r) => r.countryOfOrigin === "ID").length;
    // 20 * 0.7 = 14 slots for home, 20 * 0.3 = 6 for discovery.
    expect(idCount).toBe(14);
    const otherCount = result.length - idCount;
    expect(otherCount).toBe(6);
  });

  test("US viewer sees US-dominant feed (70/30)", () => {
    const candidates: RankableVideo[] = [
      ...Array.from({ length: 10 }, (_, i) => v(`us-${i}`, "US")),
      ...Array.from({ length: 10 }, (_, i) => v(`id-${i}`, "ID")),
      ...Array.from({ length: 10 }, (_, i) => v(`jp-${i}`, "JP")),
    ];
    const result = rankFeedCandidates(
      {
        viewerCountryIso: "US",
        activeInterestTags: new Set(),
        totalSlots: 10,
        shuffleSeedHex: SEED,
      },
      candidates,
    );
    const usCount = result.filter((r) => r.countryOfOrigin === "US").length;
    expect(usCount).toBe(7); // 10 * 0.7
  });
});

describe("rankFeedCandidates · with interest signal (20% same-topic)", () => {
  test("Indonesian viewer with 'food' interest · 70% ID + 20% food (non-ID) + 10% other", () => {
    const candidates: RankableVideo[] = [
      ...Array.from({ length: 20 }, (_, i) => v(`id-${i}`, "ID", ["mix"])),
      ...Array.from({ length: 20 }, (_, i) => v(`food-us-${i}`, "US", ["food"])),
      ...Array.from({ length: 20 }, (_, i) => v(`other-us-${i}`, "US", ["games"])),
      ...Array.from({ length: 20 }, (_, i) => v(`food-jp-${i}`, "JP", ["food"])),
    ];
    const result = rankFeedCandidates(
      {
        viewerCountryIso: "ID",
        activeInterestTags: new Set(["food"]),
        totalSlots: 20,
        shuffleSeedHex: SEED,
      },
      candidates,
    );
    expect(result).toHaveLength(20);
    const idCount = result.filter((r) => r.countryOfOrigin === "ID").length;
    const foodNonId = result.filter(
      (r) => r.countryOfOrigin !== "ID" && r.topicTags.includes("food"),
    ).length;
    const otherNonId = result.filter(
      (r) => r.countryOfOrigin !== "ID" && !r.topicTags.includes("food"),
    ).length;
    expect(idCount).toBe(14); // 70%
    expect(foodNonId).toBe(4); // 20%
    expect(otherNonId).toBe(2); // 10%
  });

  test("home-country videos tagged with the interest still land in HOME (not double-counted)", () => {
    // Each candidate lands in exactly ONE bucket · no duplication.
    // ID-food videos are HOME, US-food videos are TOPIC, there is no
    // non-food non-ID candidate so DISCOVERY is empty.
    const candidates: RankableVideo[] = [
      ...Array.from({ length: 20 }, (_, i) => v(`id-food-${i}`, "ID", ["food"])),
      ...Array.from({ length: 20 }, (_, i) => v(`us-food-${i}`, "US", ["food"])),
    ];
    const result = rankFeedCandidates(
      {
        viewerCountryIso: "ID",
        activeInterestTags: new Set(["food"]),
        totalSlots: 20,
        shuffleSeedHex: SEED,
      },
      candidates,
    );
    expect(result).toHaveLength(20);
    // Core invariant · no duplicates across buckets.
    expect(new Set(result.map((r) => r.id)).size).toBe(20);
    // Discovery is empty · its 2 slots fall back to HOME (owner
    // intent: fill the feed with content the viewer most likely
    // wants when discovery is empty).
    const idCount = result.filter((r) => r.countryOfOrigin === "ID").length;
    const usTopicCount = result.filter((r) => r.countryOfOrigin === "US").length;
    expect(idCount).toBe(16); // 14 home + 2 rolled-over from empty discovery
    expect(usTopicCount).toBe(4); // 20% topic bucket, unchanged
  });
});

describe("rankFeedCandidates · underflow rolling", () => {
  test("home bucket underfills · remainder rolls to topic/discovery", () => {
    const candidates: RankableVideo[] = [
      // Only 3 Indonesian videos · home quota is 7 · 4 slot deficit
      ...Array.from({ length: 3 }, (_, i) => v(`id-${i}`, "ID")),
      ...Array.from({ length: 20 }, (_, i) => v(`us-${i}`, "US")),
    ];
    const result = rankFeedCandidates(
      {
        viewerCountryIso: "ID",
        activeInterestTags: new Set(),
        totalSlots: 10,
        shuffleSeedHex: SEED,
      },
      candidates,
    );
    expect(result).toHaveLength(10);
    const idCount = result.filter((r) => r.countryOfOrigin === "ID").length;
    const usCount = result.filter((r) => r.countryOfOrigin === "US").length;
    expect(idCount).toBe(3); // all available
    expect(usCount).toBe(7); // 3 discovery + 4 rolled from home deficit
  });

  test("every bucket underfills · returns what we have", () => {
    const candidates: RankableVideo[] = [v("x1", "ID"), v("y1", "US")];
    const result = rankFeedCandidates(
      {
        viewerCountryIso: "ID",
        activeInterestTags: new Set(),
        totalSlots: 20,
        shuffleSeedHex: SEED,
      },
      candidates,
    );
    expect(result).toHaveLength(2);
  });
});

describe("rankFeedCandidates · deterministic", () => {
  test("same inputs + same seed → same output", () => {
    const candidates: RankableVideo[] = Array.from({ length: 30 }, (_, i) =>
      v(`v-${i}`, i % 2 === 0 ? "ID" : "US", []),
    );
    const ctx: FeedRankingContext = {
      viewerCountryIso: "ID",
      activeInterestTags: new Set(),
      totalSlots: 10,
      shuffleSeedHex: SEED,
    };
    const r1 = rankFeedCandidates(ctx, candidates);
    const r2 = rankFeedCandidates(ctx, candidates);
    expect(r1.map((v) => v.id)).toEqual(r2.map((v) => v.id));
  });

  test("different seeds · may produce different intra-bucket order", () => {
    // Make all candidates share one published_at so the tiebreaker
    // kicks in · otherwise newest-first dominates.
    const same = "2026-10-24T22:00:00Z";
    const candidates: RankableVideo[] = Array.from({ length: 20 }, (_, i) =>
      v(`v-${i}`, "ID", [], same),
    );
    const base = {
      viewerCountryIso: "ID",
      activeInterestTags: new Set<string>(),
      totalSlots: 10,
    };
    const r1 = rankFeedCandidates(
      { ...base, shuffleSeedHex: "0000000000000000" },
      candidates,
    );
    const r2 = rankFeedCandidates(
      { ...base, shuffleSeedHex: "ffffffffffffffff" },
      candidates,
    );
    expect(r1.map((v) => v.id)).not.toEqual(r2.map((v) => v.id));
  });
});

describe("rankFeedCandidates · edge cases", () => {
  test("empty candidates · empty result", () => {
    const r = rankFeedCandidates(
      {
        viewerCountryIso: "ID",
        activeInterestTags: new Set(),
        totalSlots: 10,
        shuffleSeedHex: SEED,
      },
      [],
    );
    expect(r).toEqual([]);
  });

  test("totalSlots=0 · empty result", () => {
    const r = rankFeedCandidates(
      {
        viewerCountryIso: "ID",
        activeInterestTags: new Set(),
        totalSlots: 0,
        shuffleSeedHex: SEED,
      },
      [v("x", "ID")],
    );
    expect(r).toEqual([]);
  });

  test("viewer has no country · home weight folds into discovery", () => {
    const candidates: RankableVideo[] = [
      v("a", "ID"),
      v("b", "US"),
      v("c", "JP"),
      v("d", "GB"),
    ];
    const r = rankFeedCandidates(
      {
        viewerCountryIso: null,
        activeInterestTags: new Set(),
        totalSlots: 4,
        shuffleSeedHex: SEED,
      },
      candidates,
    );
    expect(r).toHaveLength(4);
    // Every candidate landed in discovery · all 4 returned.
    expect(new Set(r.map((x) => x.countryOfOrigin))).toEqual(
      new Set(["ID", "US", "JP", "GB"]),
    );
  });

  test("newest-first within a bucket", () => {
    const candidates: RankableVideo[] = [
      v("old", "ID", [], "2020-01-01T00:00:00Z"),
      v("new", "ID", [], "2026-10-24T00:00:00Z"),
      v("mid", "ID", [], "2024-06-15T00:00:00Z"),
    ];
    const r = rankFeedCandidates(
      {
        viewerCountryIso: "ID",
        activeInterestTags: new Set(),
        totalSlots: 3,
        shuffleSeedHex: SEED,
      },
      candidates,
    );
    expect(r.map((v) => v.id)).toEqual(["new", "mid", "old"]);
  });

  test("no duplicates even when a video would appear in multiple paths", () => {
    const candidates: RankableVideo[] = [
      v("a", "ID", ["food"]),
      v("b", "US", ["food"]),
    ];
    const r = rankFeedCandidates(
      {
        viewerCountryIso: "ID",
        activeInterestTags: new Set(["food"]),
        totalSlots: 10,
        shuffleSeedHex: SEED,
      },
      candidates,
    );
    expect(r).toHaveLength(2);
    expect(new Set(r.map((x) => x.id)).size).toBe(2);
  });
});

describe("rankFeedCandidates · owner-override weights", () => {
  test("50/50 override is honoured", () => {
    const candidates: RankableVideo[] = [
      ...Array.from({ length: 20 }, (_, i) => v(`id-${i}`, "ID")),
      ...Array.from({ length: 20 }, (_, i) => v(`us-${i}`, "US")),
    ];
    const r = rankFeedCandidates(
      {
        viewerCountryIso: "ID",
        activeInterestTags: new Set(),
        totalSlots: 10,
        shuffleSeedHex: SEED,
        weights: { home: 0.5, topic: 0, discovery: 0.5 },
      },
      candidates,
    );
    const idCount = r.filter((v) => v.countryOfOrigin === "ID").length;
    expect(idCount).toBe(5);
  });
});
