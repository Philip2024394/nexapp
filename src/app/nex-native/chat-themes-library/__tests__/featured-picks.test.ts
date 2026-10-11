// src/app/nex-native/chat-themes-library/__tests__/featured-picks.test.ts
//
// NEX Space landing · Task #34 regression · pure helper.

import { describe, test, expect } from "vitest";
import {
  pickFeatured,
  POPULAR_THEME_IDS,
  DEFAULT_FEATURED_THEME_ID,
} from "../_featured-picks";
import type { BrowserThemeRow } from "../_theme-browser-client";

function row(id: string, overrides: Partial<BrowserThemeRow> = {}): BrowserThemeRow {
  return {
    id,
    name: id,
    tagline: null,
    accent_hex: "#000000",
    bubble_rim_hex: null,
    composer_rim_hex: null,
    tier: "gratis",
    category: "standard",
    category_id: "explore",
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
    ...overrides,
  };
}

const FULL_COLLECTION: BrowserThemeRow[] = [
  row("nex-bubbles"),
  row("nex-flat"),
  row("coffee"),
  row("waterworld"),
  row("food"),
  row("pizza"),
  row("bike-rental"),
  row("botanical-cafe"),
  row("midnight-cafe"),
  row("french-cafe"),
];

describe("pickFeatured · industry match", () => {
  test("food industry → food hero (2026-10-11 · was coffee)", () => {
    const { featured, featuredReason } = pickFeatured({
      themes: FULL_COLLECTION,
      businessCategory: "food",
    });
    expect(featured?.id).toBe("food");
    expect(featuredReason).toBe("industry-match");
  });

  test("products industry → nex-bubbles hero", () => {
    const { featured, featuredReason } = pickFeatured({
      themes: FULL_COLLECTION,
      businessCategory: "products",
    });
    expect(featured?.id).toBe("nex-bubbles");
    expect(featuredReason).toBe("industry-match");
  });

  test("services industry → nex-flat hero", () => {
    const { featured, featuredReason } = pickFeatured({
      themes: FULL_COLLECTION,
      businessCategory: "services",
    });
    expect(featured?.id).toBe("nex-flat");
    expect(featuredReason).toBe("industry-match");
  });

  test("accommodation industry → waterworld hero (Step 1G rename · was ocean)", () => {
    const { featured, featuredReason } = pickFeatured({
      themes: FULL_COLLECTION,
      businessCategory: "accommodation",
    });
    expect(featured?.id).toBe("waterworld");
    expect(featuredReason).toBe("industry-match");
  });

  test("property industry → waterworld hero (Step 1G rename)", () => {
    const { featured, featuredReason } = pickFeatured({
      themes: FULL_COLLECTION,
      businessCategory: "property",
    });
    expect(featured?.id).toBe("waterworld");
    expect(featuredReason).toBe("industry-match");
  });
});

describe("pickFeatured · fallback behaviour", () => {
  test("null industry → nex-default (nex-bubbles)", () => {
    const { featured, featuredReason } = pickFeatured({
      themes: FULL_COLLECTION,
      businessCategory: null,
    });
    expect(featured?.id).toBe(DEFAULT_FEATURED_THEME_ID);
    expect(featuredReason).toBe("nex-default");
  });

  test("unknown industry → nex-default fallback", () => {
    const { featured, featuredReason } = pickFeatured({
      themes: FULL_COLLECTION,
      businessCategory: "not-a-real-industry",
    });
    expect(featured?.id).toBe(DEFAULT_FEATURED_THEME_ID);
    expect(featuredReason).toBe("nex-default");
  });

  test("empty collection → no featured + no popular + reason=none", () => {
    const result = pickFeatured({ themes: [], businessCategory: "food" });
    expect(result.featured).toBeNull();
    expect(result.popular).toEqual([]);
    expect(result.featuredReason).toBe("none");
  });

  test("industry match MISSING from collection → nex-default fallback", () => {
    // Build a collection that DOES contain the default but NOT the
    // industry-match pick · the resolver should fall through.
    // Step 1G · the food-industry pick is now 'food' (was coffee).
    const partial = FULL_COLLECTION.filter((r) => r.id !== "food");
    const { featured, featuredReason } = pickFeatured({
      themes: partial,
      businessCategory: "food",
    });
    expect(featured?.id).toBe(DEFAULT_FEATURED_THEME_ID);
    expect(featuredReason).toBe("nex-default");
  });

  test("default also missing → no featured + reason=none", () => {
    const minimal = FULL_COLLECTION.filter(
      (r) => r.id !== DEFAULT_FEATURED_THEME_ID && r.id !== "coffee",
    );
    const { featured, featuredReason } = pickFeatured({
      themes: minimal,
      businessCategory: null,
    });
    expect(featured).toBeNull();
    expect(featuredReason).toBe("none");
  });
});

describe("pickFeatured · popular row", () => {
  test("popular row never includes the featured id (no overlap)", () => {
    for (const industry of [null, "food", "products", "services", "property"]) {
      const { featured, popular } = pickFeatured({
        themes: FULL_COLLECTION,
        businessCategory: industry,
      });
      if (featured) {
        expect(popular.map((r) => r.id)).not.toContain(featured.id);
      }
    }
  });

  test("popular row preserves POPULAR_THEME_IDS order (minus featured)", () => {
    const { popular } = pickFeatured({
      themes: FULL_COLLECTION,
      businessCategory: "food", // featured = food (Step 1G) · drop it from popular
    });
    const expected = POPULAR_THEME_IDS.filter((id) => id !== "food");
    expect(popular.map((r) => r.id)).toEqual(expected);
  });

  test("missing popular ids silently drop (no crash)", () => {
    const partial = FULL_COLLECTION.filter((r) => r.id !== "waterworld" && r.id !== "food");
    const { popular } = pickFeatured({
      themes: partial,
      businessCategory: null,
    });
    expect(popular.map((r) => r.id)).toEqual(["nex-flat", "coffee"]);
  });
});

describe("pickFeatured · view-ranked popular (Step 1G)", () => {
  test("viewRankedIds (non-empty) overrides the static POPULAR_THEME_IDS", () => {
    const { popular } = pickFeatured({
      themes: FULL_COLLECTION,
      businessCategory: null,
      viewRankedIds: ["pizza", "coffee", "waterworld"],
    });
    // featured = nex-bubbles (default · not in viewRankedIds)
    // → popular should match the view-ranked list verbatim
    expect(popular.map((r) => r.id)).toEqual([
      "pizza",
      "coffee",
      "waterworld",
    ]);
  });

  test("viewRankedIds (empty) falls back to the sealed POPULAR_THEME_IDS", () => {
    const { popular } = pickFeatured({
      themes: FULL_COLLECTION,
      businessCategory: null,
      viewRankedIds: [],
    });
    // Empty view-ranked list · fallback to static POPULAR_THEME_IDS
    // minus the featured (nex-bubbles)
    expect(popular.map((r) => r.id)).toEqual([
      "nex-flat",
      "coffee",
      "waterworld",
      "food",
    ]);
  });

  test("view-ranked popular drops the featured id (no overlap)", () => {
    const { featured, popular } = pickFeatured({
      themes: FULL_COLLECTION,
      businessCategory: "food", // featured = food
      viewRankedIds: ["food", "pizza", "coffee"],
    });
    expect(featured?.id).toBe("food");
    // food must be stripped from the popular row even though it tops
    // the view ranker.
    expect(popular.map((r) => r.id)).toEqual(["pizza", "coffee"]);
  });

  test("view-ranked ids missing from the collection silently drop", () => {
    const { popular } = pickFeatured({
      themes: FULL_COLLECTION,
      businessCategory: null,
      viewRankedIds: ["pizza", "ghost-theme-not-registered", "coffee"],
    });
    expect(popular.map((r) => r.id)).toEqual(["pizza", "coffee"]);
  });
});
