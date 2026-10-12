// src/lib/nex-native/directory/__tests__/category-metadata.test.ts
//
// Pure-registry tests · no DB, no clock, no randomness.

import { describe, it, expect } from "vitest";
import {
  CATEGORY_METADATA,
  getCategoryMetadata,
  getPrimaryCategoryMetadata,
  partitionCategories,
} from "../category-metadata";

describe("CATEGORY_METADATA · registry shape", () => {
  it("contains the fast-food entry", () => {
    const entry = CATEGORY_METADATA["fast-food"];
    expect(entry).toBeDefined();
    expect(entry.slug).toBe("fast-food");
    expect(entry.heroImageUrl).toBe("/nex-category-images/fast-food/p01.png");
    expect(entry.title.length).toBeGreaterThan(0);
    expect(entry.description.length).toBeGreaterThan(0);
    expect(entry.altText.length).toBeGreaterThan(0);
  });

  it("entries are frozen · the registry cannot be mutated", () => {
    expect(Object.isFrozen(CATEGORY_METADATA)).toBe(true);
    expect(Object.isFrozen(CATEGORY_METADATA["fast-food"])).toBe(true);
  });
});

describe("getCategoryMetadata", () => {
  it("returns the fast-food entry", () => {
    expect(getCategoryMetadata("fast-food")?.slug).toBe("fast-food");
  });

  it("is case-insensitive and whitespace-tolerant", () => {
    expect(getCategoryMetadata("Fast-Food")?.slug).toBe("fast-food");
    expect(getCategoryMetadata("  fast-food  ")?.slug).toBe("fast-food");
  });

  it("returns null for unknown slugs · never fabricates", () => {
    expect(getCategoryMetadata("coffee-cafe")).toBeNull();
    expect(getCategoryMetadata("cafe")).toBeNull();
    expect(getCategoryMetadata("ice-cream")).toBeNull();
    expect(getCategoryMetadata("restaurant")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(getCategoryMetadata("")).toBeNull();
    expect(getCategoryMetadata("   ")).toBeNull();
    expect(getCategoryMetadata(null)).toBeNull();
    expect(getCategoryMetadata(undefined)).toBeNull();
  });
});

describe("getPrimaryCategoryMetadata · first-match order", () => {
  it("picks the first known category in the list", () => {
    const meta = getPrimaryCategoryMetadata([
      "coffee-cafe",
      "cafe",
      "fast-food",
    ]);
    expect(meta?.slug).toBe("fast-food");
  });

  it("picks the first entry when it is a known category", () => {
    const meta = getPrimaryCategoryMetadata([
      "fast-food",
      "coffee-cafe",
    ]);
    expect(meta?.slug).toBe("fast-food");
  });

  it("returns null when no category is registered", () => {
    const meta = getPrimaryCategoryMetadata([
      "coffee-cafe",
      "cafe",
      "ice-cream",
    ]);
    expect(meta).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(getPrimaryCategoryMetadata([])).toBeNull();
  });
});

describe("partitionCategories", () => {
  it("separates known from unknown preserving order", () => {
    const result = partitionCategories([
      "coffee-cafe",
      "fast-food",
      "cafe",
      "ice-cream",
    ]);
    expect(result.known.map((k) => k.slug)).toEqual(["fast-food"]);
    expect(result.unknown).toEqual(["coffee-cafe", "cafe", "ice-cream"]);
  });

  it("deduplicates while preserving first-seen order", () => {
    const result = partitionCategories([
      "fast-food",
      "fast-food",
      "cafe",
      "cafe",
    ]);
    expect(result.known.length).toBe(1);
    expect(result.unknown).toEqual(["cafe"]);
  });

  it("drops empty / whitespace-only strings honestly", () => {
    const result = partitionCategories(["", "  ", "fast-food"]);
    expect(result.known.length).toBe(1);
    expect(result.unknown.length).toBe(0);
  });

  it("returns empty buckets for an empty list", () => {
    const r = partitionCategories([]);
    expect(r.known).toEqual([]);
    expect(r.unknown).toEqual([]);
  });
});
