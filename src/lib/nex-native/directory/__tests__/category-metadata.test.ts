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
    // `coffee-cafe` stays unregistered (vs `cafe` → coffee-shop).
    // `mystery-category` + arbitrary made-up slugs remain null.
    expect(getCategoryMetadata("coffee-cafe")).toBeNull();
    expect(getCategoryMetadata("mystery-category")).toBeNull();
    expect(getCategoryMetadata("unregistered-slug-xyz")).toBeNull();
  });

  it("resolves aliases to the canonical entry · coffee-shop family", () => {
    for (const alias of ["cafe", "coffee"]) {
      expect(getCategoryMetadata(alias)?.slug).toBe("coffee-shop");
    }
  });

  it("recognises ice-cream + its aliases", () => {
    expect(getCategoryMetadata("ice-cream")?.slug).toBe("ice-cream");
    for (const alias of ["icecream", "gelato"]) {
      expect(getCategoryMetadata(alias)?.slug).toBe("ice-cream");
    }
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

  it("resolves aliases to the canonical entry · health family (shared with hospitals since the 2026-10 expansion)", () => {
    // Pharmacy / dentist / optician aliases remain on `health`. The
    // `clinic` alias was additionally claimed by `hospitals` (added
    // later in the registry · last-write wins in the SLUG_INDEX), so
    // `clinic` canonicalises to hospitals now. Narrower assertion
    // locks the stable aliases.
    // Pharmacy + optician aliases remain exclusively on `health`.
    // `dentist` and `dentists` were promoted to a dedicated entry in
    // the 2026-10 expansion · they canonicalise to `dentist`.
    for (const alias of ["pharmacy", "pharmacies", "optician", "opticians"]) {
      expect(getCategoryMetadata(alias)?.slug).toBe("health");
    }
    // Shared-alias handoffs:
    expect(getCategoryMetadata("clinic")?.slug).toBe("hospitals");
    expect(getCategoryMetadata("dentist")?.slug).toBe("dentist");
    expect(getCategoryMetadata("dentists")?.slug).toBe("dentist");
  });

  it("resolves aliases to the canonical entry · sports/fitness family", () => {
    for (const alias of ["gym", "gyms", "fitness"]) {
      expect(getCategoryMetadata(alias)?.slug).toBe("sports");
    }
  });

  it("resolves aliases to the canonical entry · hair/beauty family", () => {
    // `hairdresser` was later also claimed by the `barber-hair`
    // entry (registry append-order winner). Narrower assertion
    // locks the stable `hair-salon` aliases and the `barber-hair`
    // precedence.
    for (const alias of ["salon", "salons", "beauty-salon"]) {
      expect(getCategoryMetadata(alias)?.slug).toBe("hair-salon");
    }
    expect(getCategoryMetadata("hairdresser")?.slug).toBe("barber-hair");
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
    // `cafe` resolves to coffee-shop since the 2026-10 expansion, so
    // the first-match wins the list below — fast-food is skipped.
    const meta = getPrimaryCategoryMetadata([
      "coffee-cafe",
      "cafe",
      "fast-food",
    ]);
    expect(meta?.slug).toBe("coffee-shop");
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
      "mystery-category",
      "unregistered-slug",
    ]);
    expect(meta).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(getPrimaryCategoryMetadata([])).toBeNull();
  });
});

describe("partitionCategories", () => {
  it("separates known from unknown preserving order", () => {
    // `cafe` → coffee-shop · `ice-cream` registered directly. Only
    // `coffee-cafe` stays unknown.
    const result = partitionCategories([
      "coffee-cafe",
      "fast-food",
      "cafe",
      "ice-cream",
    ]);
    expect(result.known.map((k) => k.slug)).toEqual([
      "fast-food",
      "coffee-shop",
      "ice-cream",
    ]);
    expect(result.unknown).toEqual(["coffee-cafe"]);
  });

  it("deduplicates while preserving first-seen order", () => {
    // `cafe` is a known alias (→ coffee-shop) since the 2026-10
    // expansion; dedupe keeps the first alias only.
    const result = partitionCategories([
      "fast-food",
      "fast-food",
      "cafe",
      "cafe",
    ]);
    expect(result.known.length).toBe(2);
    expect(result.known.map((k) => k.slug)).toEqual([
      "fast-food",
      "coffee-shop",
    ]);
    expect(result.unknown).toEqual([]);
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
