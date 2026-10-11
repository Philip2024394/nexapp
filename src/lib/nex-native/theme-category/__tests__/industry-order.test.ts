// src/lib/nex-native/theme-category/__tests__/industry-order.test.ts
//
// Industry-first category ordering · regression suite.
// Pure-function tests · no server-only imports needed.

import { describe, test, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  themeCategoryIdForBusinessCategory,
  sortCategoriesByIndustry,
} from "../industry-order";
import type { ThemeCategory } from "../types";

function cat(id: string): ThemeCategory {
  return {
    id,
    name: id,
    tagline: null,
    icon: null,
    colours: {
      primary: "#000",
      secondary: "#000",
      highlight: "#000",
      glow: "#000",
      deep: "#000",
    },
    heroThemeId: null,
  };
}

const REGISTRY = [
  cat("food"),
  cat("products"),
  cat("services"),
  cat("rentals"),
  cat("accommodation"),
  cat("explore"),
];

describe("themeCategoryIdForBusinessCategory", () => {
  test("food → food", () => {
    expect(themeCategoryIdForBusinessCategory("food")).toBe("food");
  });
  test("products → products", () => {
    expect(themeCategoryIdForBusinessCategory("products")).toBe("products");
  });
  test("services → services", () => {
    expect(themeCategoryIdForBusinessCategory("services")).toBe("services");
  });
  test("accommodation → accommodation (own room since Step 1H)", () => {
    expect(themeCategoryIdForBusinessCategory("accommodation")).toBe(
      "accommodation",
    );
  });
  test("property → accommodation (real-estate rental is a hosting · Step 1H)", () => {
    expect(themeCategoryIdForBusinessCategory("property")).toBe(
      "accommodation",
    );
  });
  test("null → null (no reorder)", () => {
    expect(themeCategoryIdForBusinessCategory(null)).toBeNull();
  });
  test("undefined → null (no reorder)", () => {
    expect(themeCategoryIdForBusinessCategory(undefined)).toBeNull();
  });
  test("empty string → null (no reorder)", () => {
    expect(themeCategoryIdForBusinessCategory("")).toBeNull();
  });
  test("unknown category → null (no reorder · safe fallback)", () => {
    expect(themeCategoryIdForBusinessCategory("whatever")).toBeNull();
  });
});

describe("sortCategoriesByIndustry", () => {
  const SEALED_ORDER = [
    "food",
    "products",
    "services",
    "rentals",
    "accommodation",
    "explore",
  ];

  test("null industry → keeps sealed order (immutable)", () => {
    const result = sortCategoriesByIndustry(REGISTRY, null);
    expect(result.map((c) => c.id)).toEqual(SEALED_ORDER);
    // Does not mutate the input.
    expect(REGISTRY.map((c) => c.id)).toEqual(SEALED_ORDER);
  });

  test("food industry → food stays first (no-op · sealed first)", () => {
    const result = sortCategoriesByIndustry(REGISTRY, "food");
    expect(result.map((c) => c.id)).toEqual(SEALED_ORDER);
  });

  test("products industry → products moves to front", () => {
    const result = sortCategoriesByIndustry(REGISTRY, "products");
    expect(result.map((c) => c.id)).toEqual([
      "products",
      "food",
      "services",
      "rentals",
      "accommodation",
      "explore",
    ]);
  });

  test("services industry → services moves to front", () => {
    const result = sortCategoriesByIndustry(REGISTRY, "services");
    expect(result.map((c) => c.id)).toEqual([
      "services",
      "food",
      "products",
      "rentals",
      "accommodation",
      "explore",
    ]);
  });

  test("rentals industry → rentals moves to front", () => {
    const result = sortCategoriesByIndustry(REGISTRY, "rentals");
    expect(result.map((c) => c.id)).toEqual([
      "rentals",
      "food",
      "products",
      "services",
      "accommodation",
      "explore",
    ]);
  });

  test("accommodation industry → accommodation moves to front (Step 1H)", () => {
    const result = sortCategoriesByIndustry(REGISTRY, "accommodation");
    expect(result.map((c) => c.id)).toEqual([
      "accommodation",
      "food",
      "products",
      "services",
      "rentals",
      "explore",
    ]);
  });

  test("unknown theme-category id → keeps sealed order", () => {
    const result = sortCategoriesByIndustry(REGISTRY, "not-a-category");
    expect(result.map((c) => c.id)).toEqual(SEALED_ORDER);
  });

  test("input array is never mutated", () => {
    const snapshot = REGISTRY.map((c) => c.id);
    sortCategoriesByIndustry(REGISTRY, "services");
    expect(REGISTRY.map((c) => c.id)).toEqual(snapshot);
  });
});
