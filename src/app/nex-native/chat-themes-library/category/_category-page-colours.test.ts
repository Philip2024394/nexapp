// src/app/nex-native/chat-themes-library/category/_category-page-colours.test.ts
//
// NEX App Chrome Rule · Category Showcase · sealed 2026-10-11.
// -------------------------------------------------------------
// Supersedes the earlier Universal Theme Colour Rule for THIS
// wrapper surface. The founder flipped the rule 2026-10-11:
//
//   "The category theme view pages should be the NEX app color.
//    not red · not brown · NEX navy."
//
// The wrapper on this page (page background · back-link · header
// text · tagline · empty-state card) uses the NEX app palette on
// every category · category identity shows through the icon + name
// + tagline text + the per-world cards rendered inside
// ThemeBrowserClient (that layer still paints each world in its own
// palette · unchanged).
//
// Three coverage layers:
//
//   A · the category registry still provides a ColourSystem per
//       entry · unchanged · consumed by the per-world cards
//   B · the showcase page source uses the NEX app palette for its
//       wrapper surface · does NOT consume category.colours for the
//       page bg / headers / back-link / empty-state card
//   C · architectural guards · the file has no per-category id
//       branches

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  getCategory,
  listCategories,
  EXPLORE_CATEGORY_ID,
} from "@/lib/nex-native/theme-category/registry";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
const CATEGORY_PAGE = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-themes-library/category/[categoryId]/page.tsx",
);

// ─── A · registry still carries a ColourSystem for every category ───

describe("A · every registered category declares a ColourSystem", () => {
  const cats = listCategories();

  test("there are categories to validate", () => {
    expect(cats.length).toBeGreaterThan(0);
  });

  test.each(cats.map((c) => [c.id] as const))(
    "category '%s' declares a non-null `colours` field with a primary",
    (id) => {
      const cat = getCategory(id);
      expect(cat).not.toBeNull();
      expect(cat?.colours).toBeDefined();
      expect(cat?.colours.primary).toBeTruthy();
      expect(cat?.colours.deep).toBeTruthy();
      expect(cat?.colours.highlight).toBeTruthy();
    },
  );

  test("Explore category palette is the NEX default (coherent with its uncategorised-bucket role)", () => {
    const explore = getCategory(EXPLORE_CATEGORY_ID);
    expect(explore?.colours.primary).toBe("#00AFFF");
    expect(explore?.colours.deep).toBe("var(--nex-world-background-base, #020914)");
  });
});

// ─── B · the page source uses the NEX app palette for its wrapper ───

describe("B · category showcase page uses the NEX app palette for its wrapper", () => {
  const src = fs.readFileSync(CATEGORY_PAGE, "utf8");

  test("source carries the NEX App Chrome Rule doctrine comment", () => {
    expect(src.toLowerCase()).toContain("nex app chrome rule");
  });

  test("source declares a local palette with the NEX navy / cyan / off-white / gray constants", () => {
    // The wrapper atmosphere is a NEX-fixed palette, not a category
    // colour. All four NEX constants must appear verbatim in the file.
    expect(src).toContain('"var(--nex-world-background-base, #020914)"'); // NEX navy · page bg
    expect(src).toContain('"#F4F7FC"'); // NEX off-white · body text
    expect(src).toContain('"#00AFFF"'); // NEX cyan · accent / icon rim
    expect(src).toContain('"#8BA9D1"'); // NEX gray · dim / tagline / back-link
  });

  test("source does NOT consume category.colours for its wrapper atmosphere", () => {
    // The previous rule had `const palette = category.colours` ·
    // that pulled brown / red / sand into the page chrome. The flipped
    // rule forbids that specific binding.
    expect(src).not.toMatch(/palette\s*=\s*category\.colours/);
  });

  test("source does NOT inline the category-specific wrapper hex literals (brown Food · red Haunted · sand Accommodation)", () => {
    // These are the category deep-tones that previously drove the
    // page background. Their presence as inline literals would mean
    // the rule has been bypassed.
    const forbiddenLiterals = [
      '"#2A160A"', // Food deep · espresso brown
      '"#3A1420"', // Bakery deep · berry
      '"#141A0D"', // Services deep · sage olive
      '"#0C0918"', // Haunted deep · midnight indigo
      '"#1E1407"', // Accommodation deep · sand brown
      '"#0A2535"', // Waterworld deep · deep sea blue
      '"#0E1824"', // Products deep · cool slate
      '"#0C2229"', // Rentals deep · teal
    ];
    for (const lit of forbiddenLiterals) {
      expect(
        src,
        `category page must not inline ${lit} · wrapper is the fixed NEX palette`,
      ).not.toContain(lit);
    }
  });
});

// ─── C · no per-category colour branches · the rule stays universal ─

describe("C · architectural guards · no per-category colour branches", () => {
  const src = fs.readFileSync(CATEGORY_PAGE, "utf8");

  test("no `if categoryId === \"ocean\"` style per-category colour selection", () => {
    const forbidden = [
      /categoryId\s*===\s*["'`]food["'`]/,
      /categoryId\s*===\s*["'`]bakery["'`]/,
      /categoryId\s*===\s*["'`]products["'`]/,
      /categoryId\s*===\s*["'`]services["'`]/,
      /categoryId\s*===\s*["'`]rentals["'`]/,
      /categoryId\s*===\s*["'`]accommodation["'`]/,
      /categoryId\s*===\s*["'`]haunted["'`]/,
      /categoryId\s*===\s*["'`]waterworld["'`]/,
      /categoryId\s*===\s*["'`]explore["'`]/,
      /category\.id\s*===\s*["'`]food["'`]/,
      /category\.id\s*===\s*["'`]bakery["'`]/,
      /category\.id\s*===\s*["'`]products["'`]/,
      /category\.id\s*===\s*["'`]services["'`]/,
      /category\.id\s*===\s*["'`]rentals["'`]/,
      /category\.id\s*===\s*["'`]accommodation["'`]/,
      /category\.id\s*===\s*["'`]haunted["'`]/,
      /category\.id\s*===\s*["'`]waterworld["'`]/,
      /category\.id\s*===\s*["'`]explore["'`]/,
    ];
    for (const pat of forbidden) {
      expect(
        src,
        `category page must not branch on specific id · ${pat}`,
      ).not.toMatch(pat);
    }
  });

  test("no world-specific hex literals leak into the page (ocean · coffee)", () => {
    // The CATEGORY page should never carry a world's hex directly ·
    // the per-world cards get their colours from each ThemePackage
    // through ThemeBrowserClient.
    expect(src).not.toContain("#2E90B5"); // ocean primary
    expect(src).not.toContain("#6B3F22"); // coffee primary
  });
});
