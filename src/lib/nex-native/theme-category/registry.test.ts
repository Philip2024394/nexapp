// src/lib/nex-native/theme-category/registry.test.ts
//
// Theme Category Registry · regression tests · re-sealed 2026-10-11.
//
// Protects the thirteen-category IA the owner re-authorised on 2026-10-11:
//
//   · exactly thirteen categories registered: food, bakery, products,
//     services, rentals, accommodation, hollywood, vitamins, teddy,
//     property, haunted, waterworld, explore
//   · ids are stable, unique and valid
//   · resolveCategoryId defaults missing/unknown ids to "explore"
//   · every code-registered live-world ThemePackage declares a
//     REGISTERED categoryId · all current café worlds + food fold into
//     "food" · ocean folds into "explore"
//   · no DB migration seeds category rows / columns
//   · no category-specific Library UI exists (any per-category branch
//     is a doctrine violation — Universal Theme Colour Rule)

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  EXPLORE_CATEGORY_ID,
  getCategory,
  isRegisteredCategory,
  listCategories,
  resolveCategoryId,
} from "./registry";
import {
  LIVE_WORLD_IDS,
  LIVE_WORLD_PACKAGES,
} from "@/app/nex-native/chat-standard/_live-worlds";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "nex-supabase/migrations");

// ─── A · the four registered categories ─────────────────────────────

describe("A · exactly thirteen categories registered (food · bakery · products · services · rentals · accommodation · hollywood · vitamins · teddy · property · haunted · waterworld · explore)", () => {
  test("food category exists", () => {
    const cat = getCategory("food");
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe("food");
    expect(cat?.name).toBe("Food");
    expect(cat?.tagline).not.toBeNull();
    expect(cat?.icon).not.toBeNull();
  });

  test("bakery category exists", () => {
    const cat = getCategory("bakery");
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe("bakery");
    expect(cat?.name).toBe("Bakery");
  });

  test("products category exists", () => {
    const cat = getCategory("products");
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe("products");
    expect(cat?.name).toBe("Products");
  });

  test("services category exists", () => {
    const cat = getCategory("services");
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe("services");
    expect(cat?.name).toBe("Services");
  });

  test("rentals category exists", () => {
    const cat = getCategory("rentals");
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe("rentals");
    expect(cat?.name).toBe("Rentals");
  });

  test("accommodation category exists", () => {
    const cat = getCategory("accommodation");
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe("accommodation");
    expect(cat?.name).toBe("Accommodation");
  });

  test("property category exists", () => {
    const cat = getCategory("property");
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe("property");
    expect(cat?.name).toBe("Property");
  });

  test("teddy category exists", () => {
    const cat = getCategory("teddy");
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe("teddy");
    expect(cat?.name).toBe("Teddy");
  });

  test("vitamins category exists", () => {
    const cat = getCategory("vitamins");
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe("vitamins");
    expect(cat?.name).toBe("Vitamins");
  });

  test("hollywood category exists", () => {
    const cat = getCategory("hollywood");
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe("hollywood");
    expect(cat?.name).toBe("Hollywood");
  });

  test("haunted category exists", () => {
    const cat = getCategory("haunted");
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe("haunted");
    expect(cat?.name).toBe("Haunted");
  });

  test("waterworld category exists", () => {
    const cat = getCategory("waterworld");
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe("waterworld");
    expect(cat?.name).toBe("Waterworld");
  });

  test("explore category exists", () => {
    const cat = getCategory(EXPLORE_CATEGORY_ID);
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe("explore");
    expect(cat?.name).toBe("Explore");
  });

  test("EXPLORE_CATEGORY_ID is the string literal 'explore'", () => {
    expect(EXPLORE_CATEGORY_ID).toBe("explore");
  });

  test("retired categories do NOT return (ocean · cafe)", () => {
    expect(getCategory("ocean")).toBeNull();
    expect(getCategory("cafe")).toBeNull();
    expect(isRegisteredCategory("ocean")).toBe(false);
    expect(isRegisteredCategory("cafe")).toBe(false);
  });

  test("listCategories returns exactly those fourteen", () => {
    const cats = listCategories();
    const ids = cats.map((c) => c.id).sort();
    expect(ids).toEqual([
      "accommodation",
      "bakery",
      "explore",
      "food",
      "haunted",
      "hollywood",
      "products",
      "property",
      "rentals",
      "services",
      "teddy",
      "vitamins",
      "watches",
      "waterworld",
    ]);
  });

  test("category ids are unique", () => {
    const cats = listCategories();
    const ids = cats.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every id is lowercase and hyphen-only (no spaces · no emoji · no uppercase)", () => {
    for (const cat of listCategories()) {
      expect(cat.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  test("every category has a non-empty name", () => {
    for (const cat of listCategories()) {
      expect(cat.name.length).toBeGreaterThan(0);
    }
  });
});

// ─── B · resolveCategoryId is deterministic ─────────────────────────

describe("B · resolveCategoryId behaviour", () => {
  test("null → explore", () => {
    expect(resolveCategoryId(null)).toBe("explore");
  });

  test("undefined → explore", () => {
    expect(resolveCategoryId(undefined)).toBe("explore");
  });

  test("empty string → explore", () => {
    expect(resolveCategoryId("")).toBe("explore");
  });

  test("registered id → same id", () => {
    expect(resolveCategoryId("food")).toBe("food");
    expect(resolveCategoryId("bakery")).toBe("bakery");
    expect(resolveCategoryId("products")).toBe("products");
    expect(resolveCategoryId("services")).toBe("services");
    expect(resolveCategoryId("rentals")).toBe("rentals");
    expect(resolveCategoryId("accommodation")).toBe("accommodation");
    expect(resolveCategoryId("haunted")).toBe("haunted");
    expect(resolveCategoryId("waterworld")).toBe("waterworld");
    expect(resolveCategoryId("explore")).toBe("explore");
  });

  test("retired ids → explore (not a throw)", () => {
    // ocean + cafe are no longer in the registry · they resolve to
    // explore via the safe-default path, same as any typo'd id.
    expect(resolveCategoryId("ocean")).toBe("explore");
    expect(resolveCategoryId("cafe")).toBe("explore");
  });

  test("unknown id → explore (safe default · not a throw)", () => {
    expect(resolveCategoryId("food-typo")).toBe("explore");
    expect(resolveCategoryId("not-a-category")).toBe("explore");
  });

  test("isRegisteredCategory distinguishes registered from unknown", () => {
    expect(isRegisteredCategory("food")).toBe(true);
    expect(isRegisteredCategory("bakery")).toBe(true);
    expect(isRegisteredCategory("products")).toBe(true);
    expect(isRegisteredCategory("services")).toBe(true);
    expect(isRegisteredCategory("rentals")).toBe(true);
    expect(isRegisteredCategory("accommodation")).toBe(true);
    expect(isRegisteredCategory("haunted")).toBe(true);
    expect(isRegisteredCategory("waterworld")).toBe(true);
    expect(isRegisteredCategory("explore")).toBe(true);
    expect(isRegisteredCategory("food-typo")).toBe(false);
    expect(isRegisteredCategory("")).toBe(false);
  });
});

// ─── C · live-world Theme Packages reference REGISTERED categories ──

describe("C · code-registered packages reference only registered categories", () => {
  test("waterworld package → identity.categoryId = 'waterworld' (Step 1G rename)", () => {
    const pkg = LIVE_WORLD_PACKAGES.waterworld;
    expect(pkg.identity.categoryId).toBe("waterworld");
  });

  const FOOD_WORLDS = [
    "coffee",
    "botanical-cafe",
    "midnight-cafe",
    "french-cafe",
    "food",
    "pizza",
  ] as const;
  for (const id of FOOD_WORLDS) {
    test(`${id} package → identity.categoryId = 'food'`, () => {
      const pkg = LIVE_WORLD_PACKAGES[id];
      expect(pkg.identity.categoryId).toBe("food");
    });
  }

  test("bike-rental package → identity.categoryId = 'rentals'", () => {
    const pkg = LIVE_WORLD_PACKAGES["bike-rental"];
    expect(pkg.identity.categoryId).toBe("rentals");
  });

  test("ac-service package → identity.categoryId = 'services'", () => {
    const pkg = LIVE_WORLD_PACKAGES["ac-service"];
    expect(pkg.identity.categoryId).toBe("services");
  });

  test("every live-world package declares an identity.categoryId", () => {
    for (const id of LIVE_WORLD_IDS) {
      const pkg = LIVE_WORLD_PACKAGES[id];
      expect(
        pkg.identity.categoryId,
        `live-world "${id}" must declare identity.categoryId`,
      ).toBeTruthy();
    }
  });

  test("every declared categoryId is REGISTERED (typos fail loudly)", () => {
    for (const id of LIVE_WORLD_IDS) {
      const pkg = LIVE_WORLD_PACKAGES[id];
      const declared = pkg.identity.categoryId;
      if (declared) {
        expect(
          isRegisteredCategory(declared),
          `live-world "${id}" declares categoryId "${declared}" which is NOT in the registry`,
        ).toBe(true);
      }
    }
  });

  test("future package declaring a registered id auto-resolves (parametric)", () => {
    const futureCategoryId = "food"; // already registered
    expect(resolveCategoryId(futureCategoryId)).toBe(futureCategoryId);
  });

  test("future package declaring an UNregistered id falls back to explore", () => {
    const future = "whatever-new-id-nobody-has-added";
    expect(resolveCategoryId(future)).toBe("explore");
    expect(isRegisteredCategory(future)).toBe(false);
  });
});

// ─── D · architectural guards · no DB · no UI · no Waterworld ───────

describe("D · architectural guards", () => {
  test("no migration file seeds a category_id column on nex_chat_theme", () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    for (const file of files) {
      if (!file.endsWith(".sql")) continue;
      const content = fs.readFileSync(
        path.join(MIGRATIONS_DIR, file),
        "utf8",
      );
      const addsCategoryColumn =
        /ALTER\s+TABLE\s+(?:public\.)?nex_chat_theme[\s\S]{0,120}ADD\s+COLUMN\s+category_id/i.test(
          content,
        );
      const seedsCategoryRows =
        /INSERT\s+INTO\s+(?:public\.)?nex_theme_category/i.test(content);
      expect(addsCategoryColumn, `${file} must not add category_id column`).toBe(false);
      expect(seedsCategoryRows, `${file} must not seed nex_theme_category rows`).toBe(false);
    }
  });

  test("Step 1G sealed · 'waterworld' package exists AND 'ocean' package is retired", () => {
    const packagesDir = path.join(
      REPO_ROOT,
      "src/app/nex-native/chat-standard/packages",
    );
    const files = fs
      .readdirSync(packagesDir)
      .filter((f) => f.endsWith(".ts"));
    expect(files.some((f) => f.toLowerCase() === "waterworld.package.ts")).toBe(true);
    expect(files.some((f) => f.toLowerCase() === "ocean.package.ts")).toBe(false);
    expect(LIVE_WORLD_IDS as readonly string[]).toContain("waterworld");
    expect(LIVE_WORLD_IDS as readonly string[]).not.toContain("ocean");
  });

  test("Waterworld world's identity.id is 'waterworld' (ocean renamed · Step 1G)", () => {
    const pkg = LIVE_WORLD_PACKAGES.waterworld;
    expect(pkg.identity.id).toBe("waterworld");
  });
});
