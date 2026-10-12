// src/app/nex-native/chat-themes-library/_category-grid.test.ts
//
// Step 1C · Category Library + Category Showcase · regression suite.
// Re-sealed 2026-10-11.
//
// Was sealed 2026-10-06 for Step 1B against the ocean/café/explore
// three-category state. Owner re-authorised 2026-10-11 to the four-
// category IA (food · products · services · explore) + softened the
// "hide zero-member" rule to show every registered category on the
// landing with a "Coming soon" state when empty. This suite rewrites
// the sealed sections accordingly.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  CATEGORY_REGISTRY_IDS,
  getCategory,
  listCategories,
  resolveCategoryId,
} from "./_test-registry-view";
import { countCategoryMembers } from "./_category-member-counts";
import { listLiveWorldsAsBrowserRows } from "./_live-worlds-adapter";
import { resolveHeroWorld } from "./_category-grid";
import type { BrowserThemeRow } from "./_theme-browser-client";
import type { ThemeCategory } from "@/lib/nex-native/theme-category/types";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const LIBRARY_DIR = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-themes-library",
);
const CATEGORY_GRID = path.join(LIBRARY_DIR, "_category-grid.tsx");
const SHOWCASE_ROUTE = path.join(
  LIBRARY_DIR,
  "category/[categoryId]/page.tsx",
);
const LANDING_PAGE = path.join(LIBRARY_DIR, "page.tsx");
const BROWSER_CLIENT = path.join(LIBRARY_DIR, "_theme-browser-client.tsx");

const liveRows = listLiveWorldsAsBrowserRows();

// ─── A · registry categories appear on the Library landing page ─────

describe("A · registry categories appear on the Library landing page", () => {
  test("CategoryGrid component source iterates listCategories()", () => {
    const src = fs.readFileSync(CATEGORY_GRID, "utf8");
    expect(src).toContain("listCategories()");
  });

  test("landing page.tsx mounts the CategoryGrid component", () => {
    const src = fs.readFileSync(LANDING_PAGE, "utf8");
    expect(src).toContain("<CategoryGrid");
    expect(src).toContain('from "./_category-grid"');
  });

  test("landing page.tsx no longer renders ThemeBrowserClient directly", () => {
    const src = fs.readFileSync(LANDING_PAGE, "utf8");
    expect(src).not.toContain("<ThemeBrowserClient");
  });
});

// ─── B · member counts are computed from the merged collection ──────

describe("B · member counts come from the actual merged world collection", () => {
  test("countCategoryMembers tallies ids correctly for a known fixture", () => {
    const fixture: BrowserThemeRow[] = [
      row("a", "food"),
      row("b", "food"),
      row("c", "explore"),
      row("d", "explore"),
      row("e", "explore"),
      row("f", "products"),
    ];
    const counts = countCategoryMembers(fixture);
    expect(counts["food"]).toBe(2);
    expect(counts["explore"]).toBe(3);
    expect(counts["products"]).toBe(1);
  });

  test("live-world rows produce food=7, waterworld=1, explore=2, rentals=1, services=1, property=1, teddy=2, hollywood=1, vitamins=1, accommodation=0, bakery=0, products=0, haunted=0 today", () => {
    // Re-sealed 2026-10-11 · Pink Dream ships as the first teddy
    // live-world · Vitamins remains DB-backed only.
    //   food          = coffee + botanical-cafe + midnight-cafe +
    //                   french-cafe + food + pizza + crispy-chicken
    //   waterworld    = waterworld
    //   explore       = nex-bubbles + nex-flat
    //   rentals       = bike-rental
    //   services      = ac-service
    //   property      = property1
    //   teddy         = teddy-play + pink-dream (pink-dream's
    //                   library tile paints a Standard Experience
    //                   approximation of the pink/plum palette ·
    //                   tapping through goes to the SEALED bespoke
    //                   `/themes/pink-dream` page which retains the
    //                   original "bubbles connected to the sides"
    //                   design via Next.js static-page routing)
    //   hollywood     = hollywood (Joker DB theme `theme-0` files
    //                   here via the keyword resolver when the
    //                   DB loader runs · live-world set carries
    //                   only the hollywood package)
    //   vitamins      = vitamin-fruit (DB `vitamins` row from
    //                   migration 137 also files here via the
    //                   keyword resolver · live-world set carries
    //                   only the vitamin-fruit package)
    //   accommodation / bakery / products / haunted / vitamins
    //                   = empty live-world set
    const counts = countCategoryMembers(liveRows);
    expect(counts["food"]).toBe(7);
    expect(counts["waterworld"] ?? 0).toBe(1);
    expect(counts["explore"] ?? 0).toBe(2);
    expect(counts["rentals"] ?? 0).toBe(1);
    expect(counts["services"] ?? 0).toBe(1);
    expect(counts["property"] ?? 0).toBe(1);
    expect(counts["teddy"] ?? 0).toBe(2);
    expect(counts["hollywood"] ?? 0).toBe(1);
    expect(counts["vitamins"] ?? 0).toBe(1);
    expect(counts["watches"] ?? 0).toBe(1);
    expect(counts["accommodation"] ?? 0).toBe(0);
    expect(counts["bakery"] ?? 0).toBe(0);
    expect(counts["products"] ?? 0).toBe(0);
    expect(counts["haunted"] ?? 0).toBe(0);
  });
});

// ─── C · Food category contains the five current food/café worlds ──

describe("C · Food category contains the seven current food/café/pizza/chicken worlds", () => {
  const EXPECTED = [
    "coffee",
    "botanical-cafe",
    "midnight-cafe",
    "french-cafe",
    "food",
    "pizza",
    "crispy-chicken",
  ] as const;

  test("every expected food world has category_id = 'food'", () => {
    const inFood = liveRows
      .filter((r) => r.category_id === "food")
      .map((r) => r.id)
      .sort();
    expect(inFood).toEqual([...EXPECTED].sort());
  });
});

// ─── D · Waterworld world lives in its own category (Step 1G) ──────

describe("D · Waterworld world lives in its own Waterworld category (Step 1G rename)", () => {
  test("waterworld row appears in the Waterworld category after filter", () => {
    const inWaterworld = liveRows.filter(
      (r) => r.category_id === "waterworld",
    );
    expect(inWaterworld.map((r) => r.id)).toContain("waterworld");
  });

  test("Explore no longer contains ocean / waterworld", () => {
    const inExplore = liveRows.filter((r) => r.category_id === "explore");
    expect(inExplore.map((r) => r.id)).not.toContain("ocean");
    expect(inExplore.map((r) => r.id)).not.toContain("waterworld");
  });

  test("waterworld world's identity.id is 'waterworld' (ocean rename sealed)", () => {
    const wworld = liveRows.find((r) => r.id === "waterworld");
    expect(wworld).toBeDefined();
    expect(wworld?.id).toBe("waterworld");
  });

  test("no 'ocean' live-world id survives in the merged collection", () => {
    expect(liveRows.find((r) => r.id === "ocean")).toBeUndefined();
  });
});

// ─── E · DB themes default to Explore ───────────────────────────────

describe("E · DB-backed themes routed by keyword resolver with Explore fallback", () => {
  test("shared library loader runs the keyword resolver with EXPLORE_CATEGORY_ID fallback", () => {
    // Re-sealed 2026-10-11 (Step 1E) · DB rows previously went
    // straight to EXPLORE_CATEGORY_ID. They now run through the
    // sealed keyword resolver first (cake→Bakery · bike→Rentals ·
    // shop→Products · etc) and fall back to EXPLORE_CATEGORY_ID
    // only when no keyword matched. Both signals (resolver call +
    // explore fallback) must appear in the loader source.
    const loaderSrc = fs.readFileSync(
      path.join(LIBRARY_DIR, "_load-library-data.ts"),
      "utf8",
    );
    expect(loaderSrc).toContain("inferCategoryIdFromSignals");
    expect(loaderSrc).toContain("EXPLORE_CATEGORY_ID");
  });

  test("countCategoryMembers surfaces DB-assigned explore rows", () => {
    const fixture: BrowserThemeRow[] = [
      row("db-1", "explore"),
      row("db-2", "explore"),
      row("coffee", "food"),
    ];
    const counts = countCategoryMembers(fixture);
    expect(counts["explore"]).toBe(2);
    expect(counts["food"]).toBe(1);
  });
});

// ─── F · future registered category auto-gets a tile ────────────────

describe("F · future registered category auto-flows through the grid", () => {
  test("CategoryGrid renders ONE tile per registered category · no hardcoded list", () => {
    const src = fs.readFileSync(CATEGORY_GRID, "utf8");
    expect(src).toContain("listCategories()");
    // Guard against someone writing a conditional list of specific ids.
    expect(src).not.toMatch(/\[\s*["']food["']\s*,\s*["']products["']/);
    expect(src).not.toMatch(/\[\s*["']ocean["']\s*,\s*["']cafe["']/);
  });

  test("adding a hypothetical category to the fixture produces an extra tile count", () => {
    const fixture: BrowserThemeRow[] = [
      row("w1", "food"),
      row("w2", "explore"),
      row("w3", "products"),
    ];
    const counts = countCategoryMembers(fixture);
    for (const id of ["food", "explore", "products"]) {
      expect(counts[id]).toBeGreaterThan(0);
    }
  });
});

// ─── G · future world in existing category auto-appears ─────────────

describe("G · future world declaring an existing category auto-appears", () => {
  test("a hypothetical food-2 row would appear under Food", () => {
    const hypothetical: BrowserThemeRow = row("food-2-future", "food");
    const merged = [...liveRows, hypothetical];
    const inFood = merged.filter((r) => r.category_id === "food");
    expect(inFood.map((r) => r.id)).toContain("food-2-future");
  });
});

// ─── H · unknown category route handled correctly ───────────────────

describe("H · unknown category route handled with notFound()", () => {
  test("showcase page calls notFound() when getCategory returns null", () => {
    const src = fs.readFileSync(SHOWCASE_ROUTE, "utf8");
    expect(src).toContain('import { notFound');
    expect(src).toContain("if (!category) notFound()");
  });

  test("resolveCategoryId does not accidentally map unknown → food / products / services", () => {
    expect(resolveCategoryId("food-typo")).toBe("explore");
    expect(resolveCategoryId("whatever")).toBe("explore");
    // Retired ids also route safely to explore.
    expect(resolveCategoryId("ocean")).toBe("explore");
    expect(resolveCategoryId("cafe")).toBe("explore");
  });
});

// ─── I · zero-world category handled with Coming Soon tile ──────────

describe("I · zero-world category rendered with Coming Soon tile (re-seal 2026-10-11)", () => {
  test("showcase page renders an empty state when worlds.length === 0", () => {
    const src = fs.readFileSync(SHOWCASE_ROUTE, "utf8");
    expect(src).toContain("worlds.length === 0");
    expect(src).toContain("data-nex-category-empty");
  });

  test("CategoryGrid NO LONGER filters zero-member categories out", () => {
    // Re-sealed 2026-10-11 · the old `.filter(({ count }) => count > 0)`
    // call is gone · every registered category now gets a tile. The
    // `data-nex-category-empty="true"` marker + EmptyScreen render do
    // the work the filter used to do.
    const src = fs.readFileSync(CATEGORY_GRID, "utf8");
    expect(src).not.toMatch(/\.filter\(\s*\(\{\s*count\s*\}\)\s*=>\s*count\s*>\s*0\s*\)/);
  });

  test("CategoryGrid tags empty tiles with data-nex-category-empty", () => {
    const src = fs.readFileSync(CATEGORY_GRID, "utf8");
    expect(src).toContain("data-nex-category-empty");
    expect(src).toContain("Coming soon");
  });

  test("CategoryGrid paints an EmptyScreen for empty categories", () => {
    const src = fs.readFileSync(CATEGORY_GRID, "utf8");
    expect(src).toContain("data-nex-category-empty-screen");
    expect(src).toContain("<EmptyScreen");
  });
});

// ─── J · existing world handoff preserved ───────────────────────────

describe("J · universal theme handoff /nex-native/themes/${theme.id} preserved", () => {
  test("themePreviewHref helper still exists and returns the universal pattern", () => {
    const src = fs.readFileSync(BROWSER_CLIENT, "utf8");
    expect(src).toContain("themePreviewHref");
    expect(src).toMatch(/return\s+`\/nex-native\/themes\/\$\{themeId\}`;/);
  });

  test("Step 1C introduces no alternative theme destination logic", () => {
    const landing = fs.readFileSync(LANDING_PAGE, "utf8");
    const showcase = fs.readFileSync(SHOWCASE_ROUTE, "utf8");
    const grid = fs.readFileSync(CATEGORY_GRID, "utf8");
    for (const src of [landing, showcase, grid]) {
      expect(src).not.toMatch(/`\/nex-native\/themes\/\$\{[^}]*\}`/);
    }
  });
});

// ─── K · no old four-entry preview allowlist returns ────────────────

describe("K · the old four-entry preview allowlist does not return", () => {
  test("THEME_PREVIEW_HREF object literal is absent from _theme-browser-client.tsx", () => {
    const src = fs.readFileSync(BROWSER_CLIENT, "utf8");
    expect(src).not.toMatch(/const\s+THEME_PREVIEW_HREF\s*[:=]/);
    expect(src).not.toMatch(
      /["'`]theme-0["'`]\s*:\s*["'`]\/nex-native\/themes\//,
    );
  });
});

// ─── L · no category-specific rendering branches ────────────────────

describe("L · zero category-id branches in the Library surfaces", () => {
  const SURFACES = [LANDING_PAGE, SHOWCASE_ROUTE, CATEGORY_GRID];
  const FORBIDDEN = [
    /categoryId\s*===\s*["'`]food["'`]/,
    /categoryId\s*===\s*["'`]products["'`]/,
    /categoryId\s*===\s*["'`]services["'`]/,
    /categoryId\s*===\s*["'`]explore["'`]/,
    /category\.id\s*===\s*["'`]food["'`]/,
    /category\.id\s*===\s*["'`]products["'`]/,
    /category_id\s*===\s*["'`]food["'`]/,
    /category_id\s*===\s*["'`]products["'`]/,
  ];

  for (const surface of SURFACES) {
    test(`${path.basename(path.dirname(surface))}/${path.basename(surface)} has no per-category branch`, () => {
      const src = fs.readFileSync(surface, "utf8");
      for (const pat of FORBIDDEN) {
        expect(src, `pattern ${pat} must not appear`).not.toMatch(pat);
      }
    });
  }

  test("CategoryGrid may compare id against EXPLORE_CATEGORY_ID for soft presentation only", () => {
    const src = fs.readFileSync(CATEGORY_GRID, "utf8");
    expect(src).toContain("EXPLORE_CATEGORY_ID");
  });
});

// ─── M · ThemeMockHero remains used for the Library grid ────────────

describe("M · ThemeMockHero remains the grid tile preview", () => {
  test("_theme-browser-client.tsx still references ThemeMockHero", () => {
    const src = fs.readFileSync(BROWSER_CLIENT, "utf8");
    expect(src).toContain("ThemeMockHero");
    expect(src).toContain("<ThemeMockHero");
  });

  test("no PhoneFramePreview iframe mount reintroduced in grid tiles", () => {
    const src = fs.readFileSync(BROWSER_CLIENT, "utf8");
    const mountCount = (src.match(/<PhoneFramePreview\b/g) ?? []).length;
    expect(mountCount).toBe(0);
  });
});

// ─── N · no iframe grid reintroduced ────────────────────────────────

describe("N · no iframe grid pattern reintroduced", () => {
  test("no new Library file uses `<iframe` for grid tiles", () => {
    const files = [LANDING_PAGE, SHOWCASE_ROUTE, CATEGORY_GRID];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      expect(src.toLowerCase()).not.toContain("<iframe");
    }
  });
});

// ─── O · Step 1G rename (Ocean → Waterworld) is DONE ────────────────

describe("O · Step 1G (Ocean → Waterworld) is sealed", () => {
  test("waterworld.package.ts exists in the packages directory", () => {
    const packagesDir = path.join(
      REPO_ROOT,
      "src/app/nex-native/chat-standard/packages",
    );
    const files = fs.readdirSync(packagesDir);
    expect(files.some((f) => f.toLowerCase() === "waterworld.package.ts")).toBe(true);
  });

  test("ocean.package.ts has been retired", () => {
    const packagesDir = path.join(
      REPO_ROOT,
      "src/app/nex-native/chat-standard/packages",
    );
    const files = fs.readdirSync(packagesDir);
    expect(files.some((f) => f.toLowerCase() === "ocean.package.ts")).toBe(false);
  });

  test("waterworld world's identity.id in the live-world registry is 'waterworld'", () => {
    const wworld = liveRows.find((r) => r.id === "waterworld");
    expect(wworld).toBeDefined();
    expect(wworld?.id).toBe("waterworld");
  });

  test("no live-world row carries the retired 'ocean' id", () => {
    expect(liveRows.find((r) => r.id === "ocean")).toBeUndefined();
  });
});

// ─── Sanity · the four registered ids are what the surfaces assume ──

describe("Sanity · the registered category ids today", () => {
  test("food, bakery, products, services, rentals, accommodation, hollywood, vitamins, teddy, watches, property, haunted, waterworld, explore are registered", () => {
    expect([...CATEGORY_REGISTRY_IDS].sort()).toEqual([
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

  test("getCategory returns a record for each", () => {
    for (const id of CATEGORY_REGISTRY_IDS) {
      expect(getCategory(id)).not.toBeNull();
    }
  });

  test("every live-world row maps to a registered category id", () => {
    for (const r of liveRows) {
      expect(CATEGORY_REGISTRY_IDS as readonly string[]).toContain(r.category_id);
    }
  });

  test("listCategories order is deterministic (snapshot)", () => {
    const ids = listCategories().map((c) => c.id);
    expect(ids).toEqual([
      "food",
      "bakery",
      "products",
      "services",
      "rentals",
      "accommodation",
      "haunted",
      "waterworld",
      "hollywood",
      "vitamins",
      "teddy",
      "watches",
      "property",
      "explore",
    ]);
  });
});

// ─── P · heroThemeId · every registered category declares a hero ────

describe("P · heroThemeId · every registered category declares a hero", () => {
  const cats = listCategories();

  test.each(cats.map((c) => [c.id] as const))(
    "category '%s' declares a `heroThemeId` field (string or null)",
    (id) => {
      const cat = getCategory(id);
      expect(cat).not.toBeNull();
      expect(cat).toHaveProperty("heroThemeId");
      const hero = cat?.heroThemeId;
      expect(hero === null || typeof hero === "string").toBe(true);
    },
  );

  test("Food hero is 'food' (grilled wallpaper reads as food more directly than coffee cup)", () => {
    expect(getCategory("food")?.heroThemeId).toBe("food");
  });

  test("Products hero is null (zero worlds today)", () => {
    expect(getCategory("products")?.heroThemeId).toBeNull();
  });

  test("Services hero is null (zero worlds today)", () => {
    expect(getCategory("services")?.heroThemeId).toBeNull();
  });

  test("Rentals hero is null (zero worlds today)", () => {
    expect(getCategory("rentals")?.heroThemeId).toBeNull();
  });

  test("Bakery hero is null (zero worlds today)", () => {
    expect(getCategory("bakery")?.heroThemeId).toBeNull();
  });

  test("Haunted hero is null (loader-routed · relies on first-in-category fallback)", () => {
    expect(getCategory("haunted")?.heroThemeId).toBeNull();
  });

  test("Accommodation hero is null (zero worlds today)", () => {
    expect(getCategory("accommodation")?.heroThemeId).toBeNull();
  });

  test("Waterworld hero is 'waterworld' (Step 1G renamed from ocean)", () => {
    expect(getCategory("waterworld")?.heroThemeId).toBe("waterworld");
  });

  test("Explore hero is 'nex-bubbles' (ocean left for Waterworld · NEX brand becomes face)", () => {
    expect(getCategory("explore")?.heroThemeId).toBe("nex-bubbles");
  });
});

// ─── Q · hero ids resolve to a world actually in that category ──────

describe("Q · every heroThemeId resolves to a world in its category", () => {
  test.each(
    listCategories().filter((c) => c.heroThemeId !== null).map((c) => [c.id, c.heroThemeId!] as const),
  )(
    "category '%s' · hero '%s' is a live-world row with matching category_id",
    (id, heroId) => {
      const hero = liveRows.find((r) => r.id === heroId);
      expect(hero, `heroThemeId=${heroId} must exist as a live-world row`).toBeDefined();
      expect(hero?.category_id, `hero ${heroId} must belong to category ${id}`).toBe(id);
    },
  );
});

// ─── R · phone-frame tile uses Theme Engine primitives (no iframe) ──

describe("R · phone-frame tile paints the hero via Theme Engine primitives", () => {
  const src = fs.readFileSync(CATEGORY_GRID, "utf8");

  test("imports ThemeWorld + ThemeBubble from the engine (single implementation of the World)", () => {
    expect(src).toContain("ThemeWorld");
    expect(src).toContain("ThemeBubble");
    expect(src).toContain('from "@/lib/nex-native/chat-render/theme-world"');
  });

  test("renders <ThemeWorld and <ThemeBubble inside the tile", () => {
    expect(src).toContain("<ThemeWorld");
    expect(src).toContain("<ThemeBubble");
  });

  test("has no iframe element anywhere (sealed 8f805d7d · dev-mode performance.measure race)", () => {
    expect(src.toLowerCase()).not.toContain("<iframe");
    expect(src.toLowerCase()).not.toMatch(/createelement\s*\(\s*["'`]iframe["'`]/);
  });

  test("tile exposes stable test hooks for the phone frame", () => {
    expect(src).toContain("data-nex-category-phone");
    expect(src).toContain("data-nex-category-tile");
    expect(src).toContain("data-nex-category-caption");
  });
});

// ─── S · the rejected rectangular card is gone ──────────────────────

describe("S · the rejected icon/name/'Enter →' rectangular card is gone", () => {
  const src = fs.readFileSync(CATEGORY_GRID, "utf8");

  test("file no longer renders the 'Enter →' affordance", () => {
    expect(src).not.toContain("Enter →");
  });

  test("file no longer carries the rejected linear-gradient card background", () => {
    expect(src).not.toContain("rgba(16,30,52,0.75)");
    expect(src).not.toContain("rgba(4,10,20,0.90)");
  });
});

// ─── T · outer phone frame derives from category.colours, not NEX ───

describe("T · outer phone-frame chrome derives from category.colours (Universal Theme Colour Rule)", () => {
  const src = fs.readFileSync(CATEGORY_GRID, "utf8");

  test("file consumes category.colours (not a hardcoded NEX palette)", () => {
    expect(src).toContain("category.colours");
    expect(src).toContain("colours.deep");
    expect(src).toContain("colours.primary");
    expect(src).toContain("colours.glow");
    expect(src).toContain("colours.highlight");
  });

  test("file does NOT redeclare a generic NEX palette constant", () => {
    expect(src).not.toMatch(/const\s+NEX\s*=\s*\{[^}]*bg\s*:\s*["']#020914["']/);
  });

  test("no world-specific hex literals leak into the grid (ocean · coffee primaries)", () => {
    expect(src).not.toContain("#2E90B5"); // ocean primary
    expect(src).not.toContain("#6B3F22"); // coffee primary
  });
});

// ─── U · resolveHeroWorld fallback behaviour (unit test) ────────────

describe("U · resolveHeroWorld · universal, no per-id branches", () => {
  test("returns the row matching heroThemeId when present", () => {
    const inCategory: BrowserThemeRow[] = [
      row("world-a", "waterworld"),
      row("world-b", "waterworld"),
    ];
    const cat = withHero("waterworld", "world-b");
    expect(resolveHeroWorld(cat, inCategory)?.id).toBe("world-b");
  });

  test("falls back to the first in-category row when heroThemeId is null", () => {
    const inCategory: BrowserThemeRow[] = [
      row("world-x", "explore"),
      row("world-y", "explore"),
    ];
    const cat = withHero("explore", null);
    expect(resolveHeroWorld(cat, inCategory)?.id).toBe("world-x");
  });

  test("falls back to the first in-category row when heroThemeId does not resolve", () => {
    const inCategory: BrowserThemeRow[] = [
      row("world-m", "food"),
      row("world-n", "food"),
    ];
    const cat = withHero("food", "world-does-not-exist");
    expect(resolveHeroWorld(cat, inCategory)?.id).toBe("world-m");
  });

  test("returns null for a category with zero in-category rows (empty-tile EmptyScreen path)", () => {
    const cat = withHero("products", null);
    expect(resolveHeroWorld(cat, [])).toBeNull();
  });
});

// ─── V · all current hero worlds exist in the merged collection ─────

describe("V · all current hero worlds exist in the live-world collection", () => {
  // Guards against a sealed-registry hero id drifting out of sync
  // with the live-world package set. Products + Services have null
  // heroes today so they're not asserted here · the EmptyScreen path
  // is their visual home.
  test("food + waterworld are registered live-world rows (Step 1G)", () => {
    for (const id of ["food", "waterworld"]) {
      const r = liveRows.find((r) => r.id === id);
      expect(r, `hero world '${id}' must be a registered live-world row`).toBeDefined();
    }
  });
});

// ─── W · wallpaper-null fallback keeps the phone screen visible ─────

describe("W · phone screen falls back to World palette when wallpaperUrl is null", () => {
  const src = fs.readFileSync(CATEGORY_GRID, "utf8");

  test("source renders a palette-derived fallback when hero_image_url is null", () => {
    expect(src).toContain("data-nex-category-phone-fallback");
    expect(src).toContain("hero.accent_hex");
    expect(src).toContain("hero.bubble_rim_hex");
    expect(src).toContain("hero.composer_rim_hex");
  });

  test("coffee row today has wallpaperUrl=null · the fallback path is exercised", () => {
    const coffee = liveRows.find((r) => r.id === "coffee");
    expect(coffee).toBeDefined();
    expect(coffee?.hero_image_url).toBeNull();
  });

  test("waterworld + food rows have wallpaperUrl set · the fallback is NOT painted for them", () => {
    const wworld = liveRows.find((r) => r.id === "waterworld");
    const food = liveRows.find((r) => r.id === "food");
    expect(wworld?.hero_image_url).toBeTruthy();
    expect(food?.hero_image_url).toBeTruthy();
  });
});

// ─── Helpers ────────────────────────────────────────────────────────

function row(id: string, categoryId: string): BrowserThemeRow {
  return {
    id,
    name: id,
    tagline: null,
    accent_hex: "#000000",
    bubble_rim_hex: null,
    composer_rim_hex: null,
    tier: "gratis",
    category: "standard",
    category_id: categoryId,
    hero_image_url: null,
    sort_order: 0,
    intro_video_url: null,
    intro_poster_url: null,
    wallpaper_config: null,
    palette: {
      primary: "#000000",
      secondary: "#000000",
      highlight: "#F4F7FC",
      glow: "rgba(0,0,0,0.4)",
      deep: "#020914",
    },
    ambient_families: null,
    bubble_material: "glass",
  };
}

/** Build a minimal ThemeCategory stub with a specific heroThemeId for
 *  the resolveHeroWorld unit tests · uses the real category when the
 *  id is registered (so colour fields stay valid) and only overrides
 *  heroThemeId. */
function withHero(id: string, heroThemeId: string | null): ThemeCategory {
  const base = getCategory(id);
  if (!base) {
    throw new Error(`test fixture: unknown category '${id}'`);
  }
  return { ...base, heroThemeId };
}
