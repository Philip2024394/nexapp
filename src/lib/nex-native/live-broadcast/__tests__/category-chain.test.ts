// src/lib/nex-native/live-broadcast/__tests__/category-chain.test.ts

import { describe, test, expect } from "vitest";
import {
  CATEGORY_CHAINS,
  getCategoryChain,
  buildCategoryQueue,
  resolveCurrentTopic,
  formatTopicLabel,
} from "../category-chain";

describe("CATEGORY_CHAINS registry", () => {
  test("has 12 chains · one per grid tile", () => {
    expect(CATEGORY_CHAINS.size).toBe(12);
  });
  test("every slug matches its own chain.slug", () => {
    for (const [k, v] of CATEGORY_CHAINS) {
      expect(v.slug).toBe(k);
    }
  });
  test("every chain has at least one topic", () => {
    for (const v of CATEGORY_CHAINS.values()) {
      expect(v.topics.length).toBeGreaterThan(0);
    }
  });
});

describe("getCategoryChain", () => {
  test("returns chain for known slug", () => {
    const c = getCategoryChain("travel");
    expect(c).not.toBeNull();
    expect(c?.topics).toContain("temple");
  });
  test("returns null for unknown slug", () => {
    expect(getCategoryChain("not-a-slug")).toBeNull();
  });
});

describe("buildCategoryQueue · owner's example chains", () => {
  const travel = getCategoryChain("travel")!;
  const transport = getCategoryChain("transport")!;

  test("travel · temple → volcano → beach ordering", () => {
    const videos = [
      { id: "v-beach-1",  topic_tags: ["beach"] },
      { id: "v-temple-1", topic_tags: ["temple"] },
      { id: "v-volcano-1",topic_tags: ["volcano"] },
      { id: "v-temple-2", topic_tags: ["temple"] },
      { id: "v-other",    topic_tags: ["random"] },
    ];
    const q = buildCategoryQueue(travel, videos);
    expect(q).toEqual(["v-temple-1", "v-temple-2", "v-volcano-1", "v-beach-1"]);
  });

  test("transport · bike → car → bicycle ordering (owner's example)", () => {
    const videos = [
      { id: "v-car",     topic_tags: ["car-rental"] },
      { id: "v-bike",    topic_tags: ["bike-rental"] },
      { id: "v-bicycle", topic_tags: ["bicycle-rental"] },
    ];
    const q = buildCategoryQueue(transport, videos);
    expect(q).toEqual(["v-bike", "v-car", "v-bicycle"]);
  });

  test("empty video list → empty queue", () => {
    expect(buildCategoryQueue(travel, [])).toEqual([]);
  });

  test("no video matches any chain topic → empty queue", () => {
    const q = buildCategoryQueue(travel, [
      { id: "v-x", topic_tags: ["xyz"] },
      { id: "v-y", topic_tags: [] },
    ]);
    expect(q).toEqual([]);
  });

  test("video with multiple matching topics appears ONCE in queue (dedup)", () => {
    const q = buildCategoryQueue(travel, [
      { id: "v-overlap", topic_tags: ["temple", "beach"] },
    ]);
    expect(q).toEqual(["v-overlap"]);
    expect(q.length).toBe(1);
  });

  test("tag matching is case-insensitive", () => {
    const q = buildCategoryQueue(travel, [
      { id: "v-shout", topic_tags: ["TEMPLE"] },
    ]);
    expect(q).toEqual(["v-shout"]);
  });
});

describe("resolveCurrentTopic", () => {
  const travel = getCategoryChain("travel")!;

  test("returns first matching topic from the chain's ordered topics", () => {
    const topic = resolveCurrentTopic(travel, {
      id: "x",
      topic_tags: ["beach", "temple"],
    });
    expect(topic).toBe("temple"); // temple comes before beach in the chain
  });

  test("null when no overlap", () => {
    expect(
      resolveCurrentTopic(travel, { id: "x", topic_tags: ["xyz"] }),
    ).toBeNull();
  });
});

describe("formatTopicLabel", () => {
  test("kebab-case → Title Case", () => {
    expect(formatTopicLabel("bike-rental")).toBe("Bike Rental");
    expect(formatTopicLabel("car-rental")).toBe("Car Rental");
    expect(formatTopicLabel("temple")).toBe("Temple");
    expect(formatTopicLabel("street-food")).toBe("Street Food");
  });
});
