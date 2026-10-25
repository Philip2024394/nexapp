// src/lib/nex-native/live-broadcast/__tests__/market-cta-resolver.test.ts

import { describe, test, expect } from "vitest";
import {
  resolveMarketCta,
  pickCategorySlug,
  type MarketCtaVideoLike,
} from "../market-cta-resolver";

const OWNER_UUID = "00000000-0000-0000-0000-000000000001";
const BIZ_UUID   = "00000000-0000-0000-0000-000000000bbb";

const base = (overrides: Partial<MarketCtaVideoLike> = {}): MarketCtaVideoLike => ({
  owner_account_id: OWNER_UUID,
  business_id: null,
  topic_tags: [],
  ...overrides,
});

describe("resolveMarketCta · owner-shop vs market branch", () => {
  test("business attachment → View Shop · routes to /u/{owner}", () => {
    const cta = resolveMarketCta(base({ business_id: BIZ_UUID }));
    expect(cta.kind).toBe("shop");
    expect(cta.label).toBe("Shop");
    expect(cta.href).toBe(`/nex-native/u/${OWNER_UUID}`);
    expect(cta.matchedCategory).toBeNull();
    expect(cta.ariaLabel).toMatch(/shop/i);
  });

  test("no business + no tags → Market · /directory (unfiltered)", () => {
    const cta = resolveMarketCta(base());
    expect(cta.kind).toBe("market");
    expect(cta.label).toBe("Market");
    expect(cta.href).toBe("/nex-native/directory");
    expect(cta.matchedCategory).toBeNull();
    expect(cta.ariaLabel).toBe("Open NEX Market");
  });
});

describe("resolveMarketCta · topic → category routing", () => {
  const cases: Array<{ tag: string; slug: string }> = [
    { tag: "restaurant",    slug: "food-drink" },
    { tag: "RESTAURANT",    slug: "food-drink" }, // case-insensitive
    { tag: "cafe",          slug: "food-drink" },
    { tag: "coffee",        slug: "food-drink" },
    { tag: "fashion",       slug: "fashion" },
    { tag: "beauty",        slug: "fashion" },
    { tag: "travel",        slug: "travel" },
    { tag: "service",       slug: "services" },
    { tag: "product",       slug: "products" },
    { tag: "event",         slug: "events" },
    { tag: "hotel",         slug: "stay" },
    { tag: "car",           slug: "transport" },
    { tag: "scooter",       slug: "transport" },
    { tag: "bike",          slug: "transport" },
    { tag: "deal",          slug: "deals" },
    { tag: "creator",       slug: "creators" },
    { tag: "art",           slug: "art" },
    { tag: "fitness",       slug: "sports" },
  ];

  for (const c of cases) {
    test(`tag=${c.tag} → ${c.slug}`, () => {
      const cta = resolveMarketCta(base({ topic_tags: [c.tag] }));
      expect(cta.kind).toBe("market");
      expect(cta.href).toBe(`/nex-native/directory/${c.slug}`);
      expect(cta.matchedCategory).toBe(c.slug);
    });
  }

  test("first matching tag wins · unknown tags skipped", () => {
    const cta = resolveMarketCta(
      base({ topic_tags: ["   ", "nonsense-tag", "RESTAURANT", "car"] }),
    );
    expect(cta.matchedCategory).toBe("food-drink");
    expect(cta.href).toBe("/nex-native/directory/food-drink");
  });

  test("no known tag → unfiltered /directory", () => {
    const cta = resolveMarketCta(base({ topic_tags: ["xyz", "qqq"] }));
    expect(cta.matchedCategory).toBeNull();
    expect(cta.href).toBe("/nex-native/directory");
  });
});

describe("pickCategorySlug · pure function", () => {
  test("returns null for empty input", () => {
    expect(pickCategorySlug([])).toBeNull();
  });
  test("ignores empty/whitespace entries", () => {
    expect(pickCategorySlug(["", "   ", "food"])).toBe("food-drink");
  });
  test("normalises case + whitespace", () => {
    expect(pickCategorySlug(["  CAR  "])).toBe("transport");
  });
});

describe("resolveMarketCta · empty business_id string is treated as no business", () => {
  // Defensive · if upstream ever passes an empty string the resolver
  // must NOT route to /u/{owner} with a trailing slash and no body.
  test('business_id="" → market branch', () => {
    const cta = resolveMarketCta(base({ business_id: "" }));
    expect(cta.kind).toBe("market");
    expect(cta.href).toBe("/nex-native/directory");
  });
});
