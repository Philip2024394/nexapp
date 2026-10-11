// src/lib/nex-native/theme-category/__tests__/keyword-resolver.test.ts
//
// Step 1E · keyword-rule regression. The founder-authorised rule:
//
//   theme id/name says 'food'    → food
//   theme id/name says 'cake'    → bakery  (specific-first · beats food)
//   theme id/name says 'bike'    → rentals (hire · hostel · bike)
//   theme id/name says 'shop'    → products
//   theme id/name says 'studio'  → services
//
// Pure-function tests · no DB · no server-only imports needed.

import { describe, test, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  inferCategoryIdFromSignals,
  resolveCategoryIdFromSignals,
} from "../keyword-resolver";

describe("inferCategoryIdFromSignals · bakery specific-first", () => {
  test("'chocolate cake shop' → bakery (cake beats shop)", () => {
    expect(
      inferCategoryIdFromSignals({ id: "chocolate-cake-shop" }),
    ).toBe("bakery");
  });

  test("'warm bakery' → bakery", () => {
    expect(inferCategoryIdFromSignals({ name: "Warm Bakery" })).toBe(
      "bakery",
    );
  });

  test("'patisserie' → bakery", () => {
    expect(inferCategoryIdFromSignals({ id: "patisserie" })).toBe(
      "bakery",
    );
  });

  test("'bread house' → bakery", () => {
    expect(
      inferCategoryIdFromSignals({ name: "Bread House", id: "bread-house" }),
    ).toBe("bakery");
  });

  test("'macaron noir' → bakery", () => {
    expect(inferCategoryIdFromSignals({ id: "macaron-noir" })).toBe(
      "bakery",
    );
  });
});

describe("inferCategoryIdFromSignals · rentals (vehicles + equipment only · Step 1H)", () => {
  test("'bike-rental' → rentals (bike + rental both match)", () => {
    expect(inferCategoryIdFromSignals({ id: "bike-rental" })).toBe(
      "rentals",
    );
  });

  test("'scooter hire' → rentals", () => {
    expect(inferCategoryIdFromSignals({ id: "scooter-hire" })).toBe(
      "rentals",
    );
  });
});

describe("inferCategoryIdFromSignals · accommodation beats rentals (Step 1H)", () => {
  test("'hotel neo' → accommodation (hotel moved out of Rentals)", () => {
    expect(inferCategoryIdFromSignals({ name: "Hotel Neo" })).toBe(
      "accommodation",
    );
  });

  test("'villa host studio' → accommodation (villa wins over studio)", () => {
    expect(
      inferCategoryIdFromSignals({ name: "Villa Host Studio" }),
    ).toBe("accommodation");
  });

  test("'boutique guesthouse' → accommodation", () => {
    expect(
      inferCategoryIdFromSignals({ name: "Boutique Guesthouse" }),
    ).toBe("accommodation");
  });

  test("'coastal resort' → accommodation (not waterworld · hospitality intent)", () => {
    // waterworld keywords don't include "resort" · hotel/resort/
    // lodge/etc. belong to Accommodation.
    expect(inferCategoryIdFromSignals({ name: "Coastal resort" })).toBe(
      "accommodation",
    );
  });
});

describe("inferCategoryIdFromSignals · haunted beats rentals (Step 1F)", () => {
  test("'haunted-hotel' → haunted ('haunted' beats both 'hotel' and accommodation · Step 1F+1H)", () => {
    expect(inferCategoryIdFromSignals({ id: "haunted-hotel" })).toBe(
      "haunted",
    );
  });

  test("'Haunted Hotel' (display name) → haunted", () => {
    expect(
      inferCategoryIdFromSignals({ name: "Haunted Hotel", id: "haunted-hotel" }),
    ).toBe("haunted");
  });

  test("'ghost resort' → haunted (not rentals via 'resort')", () => {
    expect(inferCategoryIdFromSignals({ name: "Ghost Resort" })).toBe(
      "haunted",
    );
  });

  test("'cursed villa' → haunted (not rentals via 'villa')", () => {
    expect(inferCategoryIdFromSignals({ name: "Cursed Villa" })).toBe(
      "haunted",
    );
  });

  test("'phantom lodge' → haunted", () => {
    expect(inferCategoryIdFromSignals({ id: "phantom-lodge" })).toBe(
      "haunted",
    );
  });

  test("'spooky' alone → haunted", () => {
    expect(inferCategoryIdFromSignals({ name: "Spooky" })).toBe("haunted");
  });
});

describe("inferCategoryIdFromSignals · food / products / services", () => {
  test("'food truck' → food", () => {
    expect(inferCategoryIdFromSignals({ id: "food-truck" })).toBe("food");
  });

  test("'coffee house' → food", () => {
    expect(inferCategoryIdFromSignals({ name: "Coffee House" })).toBe(
      "food",
    );
  });

  test("'warung nasi' → food (Indonesian keywords)", () => {
    expect(inferCategoryIdFromSignals({ id: "warung-nasi" })).toBe("food");
  });

  test("'market boutique' → products", () => {
    expect(inferCategoryIdFromSignals({ name: "Market Boutique" })).toBe(
      "products",
    );
  });

  test("'retail store' → products", () => {
    expect(inferCategoryIdFromSignals({ id: "retail-store" })).toBe(
      "products",
    );
  });

  test("'yoga studio' → services", () => {
    expect(inferCategoryIdFromSignals({ name: "Yoga Studio" })).toBe(
      "services",
    );
  });

  test("'tattoo clinic' → services", () => {
    expect(inferCategoryIdFromSignals({ id: "tattoo-clinic" })).toBe(
      "services",
    );
  });
});

describe("inferCategoryIdFromSignals · null / fallback", () => {
  test("empty signals → null (no match)", () => {
    expect(inferCategoryIdFromSignals({})).toBeNull();
  });

  test("null fields → null (no match)", () => {
    expect(
      inferCategoryIdFromSignals({
        id: null,
        name: null,
        tagline: null,
        conceptOneLine: null,
      }),
    ).toBeNull();
  });

  test("brand name with no keywords → null (safe · caller falls back to explore)", () => {
    expect(inferCategoryIdFromSignals({ id: "nex-bubbles" })).toBeNull();
    expect(inferCategoryIdFromSignals({ name: "Nex Flat" })).toBeNull();
  });

  test("'Ocean' now routes to waterworld (Step 1G · 'ocean' is a Waterworld keyword)", () => {
    expect(inferCategoryIdFromSignals({ name: "Ocean" })).toBe("waterworld");
  });

  test("'River rafting' → waterworld (Step 1G)", () => {
    expect(inferCategoryIdFromSignals({ name: "River rafting" })).toBe(
      "waterworld",
    );
  });

  test("'Haunted ship' → haunted (haunted still beats waterworld via priority order)", () => {
    expect(inferCategoryIdFromSignals({ name: "Haunted ship" })).toBe(
      "haunted",
    );
  });

  test("tagline + conceptOneLine are also inspected", () => {
    expect(
      inferCategoryIdFromSignals({
        id: "mystery",
        name: "Mystery",
        tagline: "A cosy coffee corner",
      }),
    ).toBe("food");
  });

  test("word-boundary respects: 'automatic' does not match 'auto'", () => {
    // "auto" is a rentals keyword · but it must NOT match "automatic"
    // because tokens are split on whitespace / dashes / dots etc.
    expect(inferCategoryIdFromSignals({ name: "Automatic" })).toBeNull();
  });

  test("case-insensitive match", () => {
    expect(inferCategoryIdFromSignals({ name: "COFFEE" })).toBe("food");
    expect(inferCategoryIdFromSignals({ name: "Rental" })).toBe("rentals");
    expect(inferCategoryIdFromSignals({ name: "BAKERY" })).toBe("bakery");
  });
});

describe("resolveCategoryIdFromSignals · with explore fallback", () => {
  test("match returns the category id", () => {
    expect(resolveCategoryIdFromSignals({ id: "cake-shop" })).toBe("bakery");
  });

  test("no match falls back to explore", () => {
    expect(resolveCategoryIdFromSignals({ id: "nex-bubbles" })).toBe(
      "explore",
    );
    expect(resolveCategoryIdFromSignals({})).toBe("explore");
  });
});
