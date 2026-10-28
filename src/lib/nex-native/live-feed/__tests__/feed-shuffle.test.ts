// src/lib/nex-native/live-feed/__tests__/feed-shuffle.test.ts
//
// Pure unit tests for the feed-shuffle library (Round 3i).
// Deterministic · no DOM, no fetch, no clock.

import { describe, it, expect } from "vitest";
import {
  categoryWeightBonus,
  weightForVideo,
  fnv1a,
  mulberry32,
  buildFeedPlan,
  type FeedVideo,
  type HabitSnapshot,
} from "../feed-shuffle";

const v = (id: string, sellerId: string, categoryId: string): FeedVideo => ({
  id,
  sellerId,
  categoryId,
});

describe("categoryWeightBonus · owner curve", () => {
  it("returns 0 for a never-liked category", () => {
    expect(categoryWeightBonus(0)).toBe(0);
    expect(categoryWeightBonus(-5)).toBe(0);
    expect(categoryWeightBonus(Number.NaN)).toBe(0);
  });

  it("first like of a category grants +5%", () => {
    expect(categoryWeightBonus(1)).toBeCloseTo(0.05, 5);
  });

  it("second same-category like grants an additional +10% (total +15%)", () => {
    expect(categoryWeightBonus(2)).toBeCloseTo(0.15, 5);
  });

  it("third like grants +25%", () => {
    expect(categoryWeightBonus(3)).toBeCloseTo(0.25, 5);
  });

  it("caps at +100% so the long tail never fully disappears", () => {
    expect(categoryWeightBonus(1000)).toBe(1.0);
  });

  it("ignores fractional counts (uses floor)", () => {
    expect(categoryWeightBonus(1.9)).toBeCloseTo(0.05, 5);
  });
});

describe("weightForVideo", () => {
  const habits: HabitSnapshot = { watches: 2 };
  it("gives base weight 1.0 to videos in an unlocked category", () => {
    expect(weightForVideo(v("x", "s1", "misc"), habits)).toBe(1.0);
  });
  it("adds the category bonus to the base weight", () => {
    expect(weightForVideo(v("x", "s1", "watches"), habits)).toBeCloseTo(
      1.15,
      5,
    );
  });
});

describe("fnv1a + mulberry32 · determinism", () => {
  it("fnv1a is deterministic for the same input", () => {
    expect(fnv1a("alpha")).toBe(fnv1a("alpha"));
  });
  it("mulberry32 produces the same stream for the same seed", () => {
    const r1 = mulberry32(123);
    const r2 = mulberry32(123);
    const stream1 = [r1(), r1(), r1(), r1(), r1()];
    const stream2 = [r2(), r2(), r2(), r2(), r2()];
    expect(stream1).toEqual(stream2);
  });
});

describe("buildFeedPlan · deterministic ordering", () => {
  const videos: readonly FeedVideo[] = [
    v("1", "A", "watches"),
    v("2", "A", "watches"),
    v("3", "B", "food"),
    v("4", "B", "food"),
    v("5", "C", "stay"),
    v("6", "C", "misc"),
  ];

  it("the same seed produces the same feed order", () => {
    const r1 = buildFeedPlan({ videos, habits: {}, visitorSeed: "stable-seed" });
    const r2 = buildFeedPlan({ videos, habits: {}, visitorSeed: "stable-seed" });
    expect(r1.feed.map((f) => f.id)).toEqual(r2.feed.map((f) => f.id));
  });

  it("different seeds generally produce different orders", () => {
    const r1 = buildFeedPlan({ videos, habits: {}, visitorSeed: "seed-a" });
    const r2 = buildFeedPlan({ videos, habits: {}, visitorSeed: "seed-b" });
    expect(r1.feed.map((f) => f.id)).not.toEqual(r2.feed.map((f) => f.id));
  });

  it("every input video appears in the feed exactly once (no drops)", () => {
    const r = buildFeedPlan({ videos, habits: {}, visitorSeed: "no-drops" });
    expect(r.feed.length).toBe(videos.length);
    const idsIn = new Set(videos.map((x) => x.id));
    const idsOut = new Set(r.feed.map((x) => x.id));
    expect(idsOut).toEqual(idsIn);
  });

  it("the feed respects the limit when passed", () => {
    const r = buildFeedPlan({
      videos,
      habits: {},
      visitorSeed: "limited",
      limit: 3,
    });
    expect(r.feed.length).toBe(3);
  });
});

describe("buildFeedPlan · no two consecutive same seller when avoidable", () => {
  it("never produces two consecutive same-seller videos in a diverse pool", () => {
    const videos: readonly FeedVideo[] = [
      v("1", "A", "watches"),
      v("2", "A", "watches"),
      v("3", "A", "watches"),
      v("4", "B", "watches"),
      v("5", "C", "watches"),
      v("6", "D", "watches"),
    ];
    for (const seed of ["s1", "s2", "s3", "s4", "s5"]) {
      const r = buildFeedPlan({ videos, habits: {}, visitorSeed: seed });
      for (let i = 1; i < r.feed.length; i += 1) {
        expect(
          r.feed[i]!.sellerId,
          `seed=${seed} positions ${i - 1}/${i} share seller`,
        ).not.toBe(r.feed[i - 1]!.sellerId);
      }
    }
  });

  it("falls back gracefully when every remaining video is the same seller", () => {
    // Only one seller · the constraint is unsatisfiable at the end.
    const videos: readonly FeedVideo[] = [
      v("1", "A", "watches"),
      v("2", "A", "watches"),
      v("3", "A", "watches"),
    ];
    const r = buildFeedPlan({ videos, habits: {}, visitorSeed: "mono" });
    expect(r.feed.length).toBe(3);
    expect(r.debug.consecutiveSellerFallbacks).toBeGreaterThan(0);
  });
});

describe("buildFeedPlan · category weighting biases distribution", () => {
  it("liked category videos appear more often in the early feed slots across seeds", () => {
    // 10 videos per category, all different sellers so the no-same-
    // seller constraint doesn't dominate. The liked category is
    // "watches" with weight bonus 1.0 (+100% from 10 likes).
    const videos: FeedVideo[] = [];
    for (let i = 0; i < 10; i += 1) videos.push(v("w" + i, "S-w" + i, "watches"));
    for (let i = 0; i < 10; i += 1) videos.push(v("m" + i, "S-m" + i, "misc"));
    const habits: HabitSnapshot = { watches: 10 }; // caps at +100%

    const earlySlots = 5;
    let watchesInEarly = 0;
    const seeds = 40;
    for (let s = 0; s < seeds; s += 1) {
      const r = buildFeedPlan({
        videos,
        habits,
        visitorSeed: `w-vs-m-${s}`,
        limit: earlySlots,
      });
      for (const f of r.feed) {
        if (f.categoryId === "watches") watchesInEarly += 1;
      }
    }
    const share = watchesInEarly / (earlySlots * seeds);
    // Pure base-weight expectation is 0.5. The +100% bonus should
    // push the empirical early-slot share to ~0.66+. We allow a
    // generous floor so the test is stable across small-sample
    // variance.
    expect(share).toBeGreaterThan(0.55);
  });
});
