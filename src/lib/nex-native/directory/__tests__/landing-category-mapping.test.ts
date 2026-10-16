// src/lib/nex-native/directory/__tests__/landing-category-mapping.test.ts
//
// Phase A regression · landing slug → NEX_BUSINESS_CATEGORIES
// coverage. These anchors fail loudly if a future edit silently
// introduces fabricated "fill-in" mappings for unsupported tiles.

import { describe, expect, it } from "vitest";
import {
  LANDING_SLUG_TO_CATEGORIES,
  NEX_BUSINESS_CATEGORIES,
  isLandingCategorySlug,
  reportLandingSlugCoverage,
  resolveLandingSlugToCategories,
  slugHasCanonicalVerticalCoverage,
  slugHasNexBusinessCoverage,
} from "../landing-category-mapping";

// ─── Shape anchors ──────────────────────────────────────────────────

describe("LANDING_SLUG_TO_CATEGORIES · shape", () => {
  it("contains every landing slug the tile grid emits", () => {
    const required = [
      "products",
      "services",
      "accommodation",
      "stay",
      "food-drink",
      "food",
      "travel",
      "transport",
      "experiences",
      "events",
      "deals",
    ];
    for (const slug of required) {
      expect(Object.prototype.hasOwnProperty.call(LANDING_SLUG_TO_CATEGORIES, slug)).toBe(true);
    }
  });

  it("every mapped category exists in NEX_BUSINESS_CATEGORIES (no typos)", () => {
    const enumSet = new Set<string>(NEX_BUSINESS_CATEGORIES);
    for (const [slug, cats] of Object.entries(LANDING_SLUG_TO_CATEGORIES)) {
      for (const c of cats) {
        expect(
          enumSet.has(c),
          `slug "${slug}" references unknown category "${c}"`,
        ).toBe(true);
      }
    }
  });
});

// ─── Core semantic anchors ──────────────────────────────────────────

describe("LANDING_SLUG_TO_CATEGORIES · owner-approved mappings", () => {
  it("products → ecommerce + product-brand", () => {
    expect([...LANDING_SLUG_TO_CATEGORIES.products]).toEqual([
      "ecommerce",
      "product-brand",
    ]);
  });

  it("services → the ten service enum values the owner approved", () => {
    expect([...LANDING_SLUG_TO_CATEGORIES.services]).toEqual([
      "tradesperson",
      "construction",
      "staircase-company",
      "salon",
      "beauty",
      "fitness",
      "consultant",
      "agency",
      "local-service",
      "professional-service",
    ]);
  });

  it("food-drink and food aliases resolve to the SAME food enum values", () => {
    expect([...LANDING_SLUG_TO_CATEGORIES["food-drink"]]).toEqual([
      "bakery",
      "restaurant",
      "cafe",
      "ice-cream",
      "dessert-shop",
      "drinks-shop",
      "juice-bar",
    ]);
    expect([...LANDING_SLUG_TO_CATEGORIES.food]).toEqual(
      [...LANDING_SLUG_TO_CATEGORIES["food-drink"]],
    );
  });

  it("experiences and events aliases resolve to the SAME event values", () => {
    expect([...LANDING_SLUG_TO_CATEGORIES.experiences]).toEqual([
      "event",
      "community",
    ]);
    expect([...LANDING_SLUG_TO_CATEGORIES.events]).toEqual(
      [...LANDING_SLUG_TO_CATEGORIES.experiences],
    );
  });
});

// ─── Honest-empty anchors (G1 + G4) ─────────────────────────────────

describe("LANDING_SLUG_TO_CATEGORIES · honest-empty for unsupported slugs", () => {
  it("accommodation and stay resolve to empty (G1 · canonical vertical only)", () => {
    expect(LANDING_SLUG_TO_CATEGORIES.accommodation).toEqual([]);
    expect(LANDING_SLUG_TO_CATEGORIES.stay).toEqual([]);
  });

  it("travel resolves to empty (G4 · no matching category)", () => {
    expect(LANDING_SLUG_TO_CATEGORIES.travel).toEqual([]);
  });

  it("transport resolves to empty (G4 · no matching category)", () => {
    expect(LANDING_SLUG_TO_CATEGORIES.transport).toEqual([]);
  });

  it("deals resolves to empty (G4 · presentation facet, not a category)", () => {
    expect(LANDING_SLUG_TO_CATEGORIES.deals).toEqual([]);
  });

  it("resolveLandingSlugToCategories returns [] for unknown / null / undefined input", () => {
    expect(resolveLandingSlugToCategories(null)).toEqual([]);
    expect(resolveLandingSlugToCategories(undefined)).toEqual([]);
    expect(resolveLandingSlugToCategories("")).toEqual([]);
    expect(resolveLandingSlugToCategories("not-a-real-slug")).toEqual([]);
    expect(resolveLandingSlugToCategories("drop-table-businesses")).toEqual([]);
  });
});

// ─── isLandingCategorySlug validator ────────────────────────────────

describe("isLandingCategorySlug", () => {
  it("accepts every known slug", () => {
    for (const slug of Object.keys(LANDING_SLUG_TO_CATEGORIES)) {
      expect(isLandingCategorySlug(slug)).toBe(true);
    }
  });
  it("rejects unknown / non-string / empty", () => {
    expect(isLandingCategorySlug(null)).toBe(false);
    expect(isLandingCategorySlug(undefined)).toBe(false);
    expect(isLandingCategorySlug("")).toBe(false);
    expect(isLandingCategorySlug(42)).toBe(false);
    expect(isLandingCategorySlug({ slug: "products" })).toBe(false);
  });
});

// ─── Coverage helpers ───────────────────────────────────────────────

describe("slugHasNexBusinessCoverage", () => {
  it("true for the six wired slugs", () => {
    for (const s of ["products", "services", "food-drink", "food", "experiences", "events"]) {
      expect(slugHasNexBusinessCoverage(s)).toBe(true);
    }
  });
  it("false for canonical-only + gap slugs", () => {
    for (const s of ["accommodation", "stay", "travel", "transport", "deals"]) {
      expect(slugHasNexBusinessCoverage(s)).toBe(false);
    }
  });
});

describe("slugHasCanonicalVerticalCoverage", () => {
  it("true only for stay / accommodation (G1 vertical table)", () => {
    expect(slugHasCanonicalVerticalCoverage("accommodation")).toBe(true);
    expect(slugHasCanonicalVerticalCoverage("stay")).toBe(true);
  });
  it("false for everything else", () => {
    for (const s of [
      "products", "services", "food", "food-drink", "events",
      "experiences", "travel", "transport", "deals", "not-a-slug", null,
    ]) {
      expect(slugHasCanonicalVerticalCoverage(s)).toBe(false);
    }
  });
});

// ─── Owner-visible coverage report ─────────────────────────────────

describe("reportLandingSlugCoverage · dashboard surface", () => {
  it("classifies each slug as wired / canonical_only / gap", () => {
    const report = reportLandingSlugCoverage();
    const bySlug = new Map(report.map((r) => [r.slug, r]));

    // Wired
    for (const s of ["products", "services", "food-drink", "food", "experiences", "events"] as const) {
      expect(bySlug.get(s)?.status).toBe("wired");
      expect((bySlug.get(s)?.nexBusinessCategoryCount ?? 0)).toBeGreaterThan(0);
    }
    // Canonical-only
    for (const s of ["accommodation", "stay"] as const) {
      expect(bySlug.get(s)?.status).toBe("canonical_only");
      expect(bySlug.get(s)?.hasCanonicalVertical).toBe(true);
    }
    // Gaps
    for (const s of ["travel", "transport", "deals"] as const) {
      expect(bySlug.get(s)?.status).toBe("gap");
      expect(bySlug.get(s)?.nexBusinessCategoryCount).toBe(0);
      expect(bySlug.get(s)?.hasCanonicalVertical).toBe(false);
    }
  });
});
