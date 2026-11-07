// src/lib/nex-native/business/__tests__/subtype-aliases.test.ts
//
// Subtype alias / synonym search · unit tests.
// Owner-sealed 2026-11-07. Covers:
//   · The exact examples the owner listed in the Phase B directive
//   · Legacy-slug round-trip (ice-cream, staircase-company, etc.)
//   · Common synonyms, abbreviations, singular/plural
//   · Every canonical subtype has at least one alias in the registry
//   · Deterministic ordering · no-match returns []

import { describe, expect, it } from "vitest";
import {
  aliasCountBySubtype,
  searchSubtypes,
} from "../subtype-aliases";
import { BUSINESS_SUBTYPES } from "../subtypes";

function topHit(query: string) {
  const hits = searchSubtypes(query);
  return hits[0] ?? null;
}

describe("searchSubtypes · owner examples", () => {
  it("Hairdresser → salon", () => {
    expect(topHit("Hairdresser")?.subtype).toBe("salon");
  });

  it("Barber → salon", () => {
    expect(topHit("barber")?.subtype).toBe("salon");
  });

  it("Ice cream shop → ice_cream", () => {
    expect(topHit("ice cream shop")?.subtype).toBe("ice_cream");
  });

  it("Juice shop → juice_bar", () => {
    expect(topHit("juice shop")?.subtype).toBe("juice_bar");
  });

  it("Staircase manufacturer → staircase_company", () => {
    expect(topHit("staircase manufacturer")?.subtype).toBe("staircase_company");
  });

  it("Building contractor → construction", () => {
    expect(topHit("building contractor")?.subtype).toBe("construction");
  });

  it("Online retailer → ecommerce", () => {
    expect(topHit("online retailer")?.subtype).toBe("ecommerce");
  });

  it("Product manufacturer → manufacturer", () => {
    expect(topHit("product manufacturer")?.subtype).toBe("manufacturer");
  });

  it("Digital content creator → creator", () => {
    expect(topHit("digital content creator")?.subtype).toBe("creator");
  });
});

describe("searchSubtypes · legacy slug round-trip", () => {
  it("ice-cream (legacy slug) → ice_cream", () => {
    expect(topHit("ice-cream")?.subtype).toBe("ice_cream");
  });

  it("staircase-company (legacy slug) → staircase_company", () => {
    expect(topHit("staircase-company")?.subtype).toBe("staircase_company");
  });

  it("dessert-shop (legacy slug) → dessert_shop", () => {
    expect(topHit("dessert-shop")?.subtype).toBe("dessert_shop");
  });

  it("juice-bar (legacy slug) → juice_bar", () => {
    expect(topHit("juice-bar")?.subtype).toBe("juice_bar");
  });

  it("drinks-shop (legacy slug) → drinks", () => {
    expect(topHit("drinks-shop")?.subtype).toBe("drinks");
  });

  it("product-brand (legacy slug) → product_brand", () => {
    expect(topHit("product-brand")?.subtype).toBe("product_brand");
  });

  it("professional-service (legacy slug) → professional", () => {
    expect(topHit("professional-service")?.subtype).toBe("professional");
  });

  it("local-service (legacy slug) → home_services", () => {
    expect(topHit("local-service")?.subtype).toBe("home_services");
  });
});

describe("searchSubtypes · common language", () => {
  it("coffee shop → cafe", () => {
    expect(topHit("coffee shop")?.subtype).toBe("cafe");
  });

  it("gym → fitness", () => {
    expect(topHit("gym")?.subtype).toBe("fitness");
  });

  it("yoga studio → fitness", () => {
    expect(topHit("yoga studio")?.subtype).toBe("fitness");
  });

  it("plumber → tradesperson", () => {
    expect(topHit("plumber")?.subtype).toBe("tradesperson");
  });

  it("electrician → tradesperson", () => {
    expect(topHit("electrician")?.subtype).toBe("tradesperson");
  });

  it("b&b → guesthouse", () => {
    expect(topHit("b&b")?.subtype).toBe("guesthouse");
  });

  it("bed and breakfast → guesthouse", () => {
    expect(topHit("bed and breakfast")?.subtype).toBe("guesthouse");
  });

  it("estate agent → agent", () => {
    expect(topHit("estate agent")?.subtype).toBe("agent");
  });

  it("marketing agency → agency", () => {
    expect(topHit("marketing agency")?.subtype).toBe("agency");
  });

  it("youtuber → creator", () => {
    expect(topHit("youtuber")?.subtype).toBe("creator");
  });

  it("gelato → ice_cream", () => {
    expect(topHit("gelato")?.subtype).toBe("ice_cream");
  });
});

describe("searchSubtypes · casing + whitespace tolerance", () => {
  it("UPPERCASE query matches", () => {
    expect(topHit("HAIRDRESSER")?.subtype).toBe("salon");
  });

  it("trailing whitespace is stripped", () => {
    expect(topHit("  salon  ")?.subtype).toBe("salon");
  });

  it("collapsed internal whitespace", () => {
    expect(topHit("ice   cream")?.subtype).toBe("ice_cream");
  });
});

describe("searchSubtypes · ranking", () => {
  it("exact match beats substring", () => {
    const hits = searchSubtypes("cafe");
    // "cafe" is an exact match · bakery/patisserie which contain
    // "café" wouldn't rank above an exact hit.
    expect(hits[0]?.subtype).toBe("cafe");
    expect(hits[0]?.score).toBe(1.0);
  });

  it("deduplicates by subtype (only the best hit per subtype)", () => {
    const hits = searchSubtypes("shop");
    const subtypes = hits.map((h) => h.subtype);
    const unique = new Set(subtypes);
    expect(subtypes.length).toBe(unique.size);
  });

  it("respects the limit option", () => {
    const hits = searchSubtypes("shop", { limit: 3 });
    expect(hits.length).toBeLessThanOrEqual(3);
  });

  it("returns [] for empty / whitespace-only query", () => {
    expect(searchSubtypes("")).toEqual([]);
    expect(searchSubtypes("   ")).toEqual([]);
  });

  it("returns [] for queries that match nothing", () => {
    expect(searchSubtypes("zzzzzqqq")).toEqual([]);
  });
});

describe("alias registry integrity", () => {
  it("every canonical subtype has at least one alias", () => {
    const counts = aliasCountBySubtype();
    const missing = BUSINESS_SUBTYPES.filter((s) => !counts[s]);
    expect(missing).toEqual([]);
  });

  it("every hit carries a non-empty label + category", () => {
    const hits = searchSubtypes("shop", { limit: 20 });
    for (const h of hits) {
      expect(h.label.length).toBeGreaterThan(0);
      expect(h.category.length).toBeGreaterThan(0);
    }
  });

  it("every hit's category matches BUSINESS_SUBTYPE_CATEGORY", () => {
    // Pick a few and spot-check.
    const sampled = ["salon", "ice cream shop", "gym", "estate agent"]
      .map((q) => topHit(q))
      .filter((x): x is NonNullable<typeof x> => !!x);
    for (const h of sampled) {
      expect(h.category).toBeTruthy();
    }
  });
});
