// src/app/nex-generated/buying-guides/_guides-manifest.ts
//
// Single source of truth for published Buying Guides. Replaces the
// inlined `GUIDES` array that used to live inside `_guides-search.tsx`
// (owner directive 2026-11-18 Phase 2 · centralise before guide #3).
//
// Any new guide must:
//   1. Add an entry below with status: "published"
//   2. Add its own page.tsx at `./<slug>/page.tsx`
//   3. Ship with its own evidence ledger under
//      `evidence/buying-guides/<slug>/`
//
// Only entries with status: "published" are shown by the index page
// and by the hero search input. Draft entries let us pre-wire the
// taxonomy without surfacing dead links.
//
// Scope: /nex-generated/buying-guides/* only. Does NOT touch the main
// nex-native catalogue (src/lib/nex-native/catalogue/departments.ts)
// or middleware.
//
// Go-live 2026-11-17 (owner-authorised outstanding-gate wiring):
//   - Page-scoped `robots: { index: false, follow: false }` lifted on
//     all 7 routes (index + 6 guides).
//   - /nex-generated/buying-guides/* added to sitemap.ts STATIC_ENTRIES
//     (country-replicated across Ireland + Worldwide bases).
//   - /nex-generated private-path prefix narrowed in
//     src/lib/nex-native/seo/exclude-routes.ts so only
//     /nex-generated/tiny-calculator stays private.

export type GuideStatus = "published" | "draft";

export type GuideEntry = {
  /** URL slug · route = `/nex-generated/buying-guides/<slug>`. */
  slug: string;
  /** Card + hero title, e.g. "Rolex Buying Guide". */
  title: string;
  /** Short index-card body copy. One sentence. */
  shortDesc: string;
  /**
   * Grouping key on the index page. Maps a guide to its parent
   * subcategory in departments.ts (or a brand grouping like "watches"
   * where guides sit under a shared umbrella). Does not drive routing.
   */
  categoryGroupId: string;
  /** Display label for the group heading on the index page. */
  categoryGroupLabel: string;
  /** Search keywords, lowercased · matched client-side by the hero input. */
  keywords: ReadonlyArray<string>;
  /** Only "published" guides are rendered to users. */
  status: GuideStatus;
};

export const GUIDES: ReadonlyArray<GuideEntry> = [
  {
    slug: "rolex",
    title: "Rolex Buying Guide",
    shortDesc:
      "History, manufacture, ownership & market value. Independent · not affiliated with Rolex SA.",
    categoryGroupId: "watches",
    categoryGroupLabel: "Watches",
    keywords: [
      "rolex",
      "watches",
      "watch",
      "submariner",
      "daytona",
      "gmt-master",
      "datejust",
      "oystersteel",
      "history",
      "manufacture",
      "ownership",
      "market value",
    ],
    status: "published",
  },
  {
    slug: "mobile-phones",
    title: "Mobile Phone Buying Guide",
    shortDesc:
      "New, refurbished or used — specs that matter, used-phone checks, and software-support length. Independent.",
    categoryGroupId: "mobile_phones",
    categoryGroupLabel: "Mobile Phones",
    keywords: [
      "mobile phone",
      "mobile phones",
      "phone",
      "phones",
      "smartphone",
      "smartphones",
      "iphone",
      "android",
      "pixel",
      "samsung",
      "refurbished",
      "used phone",
      "imei",
      "battery health",
      "esim",
      "ip68",
      "activation lock",
      "factory reset protection",
      "software updates",
      "ecodesign",
    ],
    status: "published",
  },
  {
    slug: "handbags",
    title: "Handbag Buying Guide",
    shortDesc:
      "Judge a handbag at any price — leather, construction, stitching, hardware, lining, and buying pre-owned. Independent.",
    categoryGroupId: "bags_luggage",
    categoryGroupLabel: "Bags & Luggage",
    keywords: [
      "handbag",
      "handbags",
      "bag",
      "bags",
      "purse",
      "tote",
      "shoulder bag",
      "leather",
      "full-grain",
      "top-grain",
      "bonded leather",
      "pu",
      "vegan leather",
      "chrome tanned",
      "vegetable tanned",
      "stitching",
      "ykk",
      "riri",
      "lampo",
      "lining",
      "counterfeit",
      "pre-owned",
    ],
    status: "published",
  },
  {
    slug: "laptops",
    title: "Laptop Buying Guide",
    shortDesc:
      "Match spec sheets to the work you actually do — longevity, repairability, battery, and buying used. Independent.",
    categoryGroupId: "computers_laptops",
    categoryGroupLabel: "Computers & Laptops",
    keywords: [
      "laptop",
      "laptops",
      "notebook",
      "ultrabook",
      "chromebook",
      "macbook",
      "windows",
      "ram",
      "ssd",
      "cpu",
      "gpu",
      "battery",
      "cycle count",
      "soldered ram",
      "oled",
      "ips",
      "ifixit",
      "activation lock",
      "aue",
      "refurbished",
      "used laptop",
    ],
    status: "published",
  },
  {
    slug: "running-shoes",
    title: "Running Shoes Buying Guide",
    shortDesc:
      "Choose by the running you actually do — surface, fit, drop, stack, and when to retire a pair. Independent.",
    categoryGroupId: "shoes",
    categoryGroupLabel: "Shoes",
    keywords: [
      "running shoes",
      "running shoe",
      "trainers",
      "sneakers",
      "daily trainer",
      "race shoe",
      "super shoe",
      "carbon plate",
      "trail shoe",
      "stability shoe",
      "pronation",
      "drop",
      "stack height",
      "cushioning",
      "midsole",
      "outsole",
      "foot width",
      "runner's loop",
    ],
    status: "published",
  },
  {
    slug: "leather-wallets",
    title: "Leather Wallet Buying Guide",
    shortDesc:
      "Judge a wallet on leather grade, tanning, stitching, edges and RFID claims — not on the brand stamped inside. Independent.",
    categoryGroupId: "accessories",
    categoryGroupLabel: "Fashion Accessories",
    keywords: [
      "wallet",
      "wallets",
      "leather wallet",
      "bifold",
      "cardholder",
      "full-grain",
      "top-grain",
      "corrected-grain",
      "genuine leather",
      "bonded leather",
      "vegan leather",
      "pu",
      "vegetable tanned",
      "chrome tanned",
      "saddle stitch",
      "lock stitch",
      "spi",
      "burnished edge",
      "painted edge",
      "rfid",
      "emv",
    ],
    status: "published",
  },
];

/** Returns only guides that are live and should be surfaced to users. */
export function getPublishedGuides(): ReadonlyArray<GuideEntry> {
  return GUIDES.filter((g) => g.status === "published");
}

/**
 * Groups published guides by their `categoryGroupId`, preserving the
 * first-seen order of both groups and guides within a group. Used by
 * the index page to render cards under subheadings.
 */
export function getPublishedGuidesByGroup(): ReadonlyArray<{
  id: string;
  label: string;
  guides: ReadonlyArray<GuideEntry>;
}> {
  const order: string[] = [];
  const byId = new Map<
    string,
    { id: string; label: string; guides: GuideEntry[] }
  >();
  for (const g of getPublishedGuides()) {
    if (!byId.has(g.categoryGroupId)) {
      order.push(g.categoryGroupId);
      byId.set(g.categoryGroupId, {
        id: g.categoryGroupId,
        label: g.categoryGroupLabel,
        guides: [],
      });
    }
    byId.get(g.categoryGroupId)!.guides.push(g);
  }
  return order.map((id) => byId.get(id)!);
}
