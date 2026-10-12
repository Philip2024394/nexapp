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

  it("resolves aliases to the canonical entry · accommodation family", () => {
    for (const alias of ["guesthouse", "hostel", "kos", "apartment", "resort", "homestay"]) {
      const meta = getCategoryMetadata(alias);
      expect(meta?.slug).toBe("hotel");
    }
  });

  it("resolves aliases to the canonical entry · car-service family", () => {
    for (const alias of ["car-repair", "car-wash", "car_repair", "car_wash"]) {
      expect(getCategoryMetadata(alias)?.slug).toBe("car-service");
    }
  });

  it("resolves aliases to the canonical entry · health family", () => {
    for (const alias of ["pharmacy", "pharmacies", "clinic", "dentist", "dentists", "optician", "opticians"]) {
      expect(getCategoryMetadata(alias)?.slug).toBe("health");
    }
  });

  it("resolves aliases to the canonical entry · sports/fitness family", () => {
    for (const alias of ["gym", "gyms", "fitness"]) {
      expect(getCategoryMetadata(alias)?.slug).toBe("sports");
    }
  });

  it("resolves aliases to the canonical entry · hair/beauty family", () => {
    for (const alias of ["salon", "salons", "beauty-salon", "hairdresser"]) {
      expect(getCategoryMetadata(alias)?.slug).toBe("hair-salon");
    }
  });

  it("alias lookup is case- and whitespace-tolerant", () => {
    expect(getCategoryMetadata("  Guesthouse  ")?.slug).toBe("hotel");
    expect(getCategoryMetadata("CAR-REPAIR")?.slug).toBe("car-service");
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

  it("deduplicates by canonical entry when multiple aliases hit the same registry row", () => {
    const result = partitionCategories(["hotel", "guesthouse", "hostel"]);
    expect(result.known.length).toBe(1);
    expect(result.known[0].slug).toBe("hotel");
    expect(result.unknown).toEqual([]);
  });

  it("mixes known+alias+unknown without crashing", () => {
    const result = partitionCategories([
      "pharmacies",
      "mystery-category",
      "car-repair",
    ]);
    expect(result.known.map((k) => k.slug)).toEqual(["health", "car-service"]);
    expect(result.unknown).toEqual(["mystery-category"]);
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
