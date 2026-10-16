// src/lib/nex-native/directory/__tests__/landing-feed-service.test.ts
//
// Phase A regression · landing-feed-service.
//
// Covers the owner's acceptance criteria:
//   · 2-card mobile ask when ≥2 eligible rows exist
//   · 1-card reduced state when only 1 exists
//   · honest empty state when 0 exist
//   · deduplication by slug (owner-claimed wins)
//   · stable ordering per visitor seed · fresh seed → different order
//   · honest empty for unsupported slugs (travel / transport / deals)
//   · category filter narrows the nex_business pool correctly
//   · country filter skips the nex_business source (honest-null)
//   · source failure in ONE path does not poison the OTHER
//   · adapter never fabricates fields that aren't present on the row

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NexBusinessRow } from "@/lib/nex-native/types";

vi.mock("server-only", () => ({}));

// Phase A.1 fix (owner 2026-10-16) · the feed service now consumes
// the DETERMINISTIC `listBusinessesPaged` instead of the non-
// deterministic `listRandomBusinesses`. The local mock variable
// name `listRandomMock` is kept for diff-stability · it is wired
// to the correct sealed export below.
const { listRandomMock, listCanonicalMock, searchCanonicalMock } =
  vi.hoisted(() => ({
    listRandomMock: vi.fn(),
    listCanonicalMock: vi.fn(),
    searchCanonicalMock: vi.fn(),
  }));

vi.mock("@/lib/nex-native/discovery-service", () => ({
  listBusinessesPaged: listRandomMock,
}));
vi.mock("@/lib/nex-native/local-directory-service", () => ({
  listCanonicalBusinessesPaged: listCanonicalMock,
  searchCanonicalBusinesses: searchCanonicalMock,
}));

import {
  getLandingFeed,
  pickOrMintSeed,
  __internal,
} from "../landing-feed-service";

beforeEach(() => {
  listRandomMock.mockReset();
  listCanonicalMock.mockReset();
  searchCanonicalMock.mockReset();
});
afterEach(() => vi.clearAllMocks());

// ─── Row factories · minimal shape · never fabricates fields ───────

let rowCounter = 0;
function nexBiz(partial: Partial<NexBusinessRow> = {}): NexBusinessRow {
  rowCounter++;
  return {
    id: partial.id ?? `nb-${rowCounter}`,
    owner_account_id: "owner-x",
    display_name: partial.display_name ?? `Shop ${rowCounter}`,
    slug: partial.slug ?? `shop-${rowCounter}`,
    description: partial.description ?? null,
    logo_url: partial.logo_url ?? null,
    hours: null,
    address: null,
    public_phone: null,
    public_email: null,
    website_url: null,
    payment_instructions: null,
    accepts_cod: true,
    accepts_pickup: false,
    status_message: null,
    status_message_expires_at: null,
    market_reach: "both",
    business_category: partial.business_category ?? null,
    search_keywords: null,
    accepted_payment_methods: ["cod"],
  } as unknown as NexBusinessRow;
}

function canonicalRow(partial: Partial<NexBusinessRow> = {}): NexBusinessRow {
  // Canonical rows coming through local-directory have slug === id
  // when no proper slug exists · the adapter uses that to classify
  // source.
  rowCounter++;
  const id = partial.id ?? `cbid-${rowCounter}`;
  return nexBiz({
    id,
    slug: partial.slug ?? id,
    display_name: partial.display_name ?? `Canonical ${rowCounter}`,
    business_category: partial.business_category ?? null,
    logo_url: partial.logo_url ?? null,
    description: partial.description ?? null,
  });
}

// ─── 2-card mobile · happy path ─────────────────────────────────────

describe("getLandingFeed · 2-card mobile Featured Deals", () => {
  it("returns exactly 2 cards when both sources contribute at least 2 eligible rows", async () => {
    listRandomMock.mockResolvedValueOnce([
      nexBiz({ display_name: "Owner A", slug: "owner-a" }),
      nexBiz({ display_name: "Owner B", slug: "owner-b" }),
    ]);
    listCanonicalMock.mockResolvedValueOnce([
      canonicalRow({ display_name: "Canon A", slug: "canon-a" }),
      canonicalRow({ display_name: "Canon B", slug: "canon-b" }),
    ]);
    const r = await getLandingFeed({ limit: 2, visitorSeed: "SEED-1" });
    expect(r.ok).toBe(true);
    expect(r.cards.length).toBe(2);
    expect(r.reducedState).toBeUndefined();
    expect(r.totalEligible).toBe(4);
  });

  it("returns 1 card + reduced state when only 1 eligible row exists", async () => {
    listRandomMock.mockResolvedValueOnce([nexBiz({ slug: "only-owner" })]);
    listCanonicalMock.mockResolvedValueOnce([]);
    const r = await getLandingFeed({ limit: 2, visitorSeed: "SEED-2" });
    expect(r.cards.length).toBe(1);
    expect(r.reducedState).toBe("fewer_than_requested");
  });

  it("returns 0 cards + honest no_eligible_rows when both sources are empty", async () => {
    listRandomMock.mockResolvedValueOnce([]);
    listCanonicalMock.mockResolvedValueOnce([]);
    const r = await getLandingFeed({ limit: 2, visitorSeed: "SEED-3" });
    expect(r.cards).toEqual([]);
    expect(r.reducedState).toBe("no_eligible_rows");
    expect(r.totalEligible).toBe(0);
  });
});

// ─── Dedup · owner-claimed WINS on slug collision ───────────────────

describe("getLandingFeed · deduplication (owner-claimed wins)", () => {
  it("when nex_business and canonical both carry 'shared-slug', only the nex_business row survives", async () => {
    listRandomMock.mockResolvedValueOnce([
      nexBiz({ display_name: "Owner's version", slug: "shared-slug" }),
    ]);
    listCanonicalMock.mockResolvedValueOnce([
      canonicalRow({ display_name: "Canonical version", slug: "shared-slug" }),
      canonicalRow({ display_name: "Only canonical", slug: "canon-unique" }),
    ]);
    const r = await getLandingFeed({ limit: 24, visitorSeed: "SEED-A" });
    const slugs = r.cards.map((c) => c.slug);
    const titles = r.cards.map((c) => c.title);
    expect(slugs).toContain("shared-slug");
    expect(slugs).toContain("canon-unique");
    expect(titles).toContain("Owner's version");
    expect(titles).not.toContain("Canonical version");
    expect(r.cards.length).toBe(2);
  });
});

// ─── Seed stability ────────────────────────────────────────────────

describe("getLandingFeed · Phase A.1 D-1 / D-2 fix · pagination determinism", () => {
  it("same seed + same page → identical cards (refresh is stable)", async () => {
    const pool = Array.from({ length: 60 }, (_, i) =>
      nexBiz({ slug: `nb-${i}` }),
    );
    listRandomMock.mockResolvedValue(pool);
    listCanonicalMock.mockResolvedValue([]);
    const a = await getLandingFeed({
      limit: 24,
      visitorSeed: "STABLE-ABC",
      offset: 0,
    });
    const b = await getLandingFeed({
      limit: 24,
      visitorSeed: "STABLE-ABC",
      offset: 0,
    });
    expect(a.cards.map((c) => c.id)).toEqual(b.cards.map((c) => c.id));
  });

  it("page 1 vs page 2 share ZERO overlapping ids (no duplicates across pages)", async () => {
    const pool = Array.from({ length: 100 }, (_, i) =>
      nexBiz({ slug: `nb-${i}` }),
    );
    listRandomMock.mockResolvedValue(pool);
    listCanonicalMock.mockResolvedValue([]);
    const page1 = await getLandingFeed({
      limit: 24,
      visitorSeed: "STABLE-ABC",
      offset: 0,
    });
    const page2 = await getLandingFeed({
      limit: 24,
      visitorSeed: "STABLE-ABC",
      offset: 24,
    });
    const page1Ids = new Set(page1.cards.map((c) => c.id));
    const page2Ids = page2.cards.map((c) => c.id);
    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false);
    }
    expect(page1.cards.length).toBe(24);
    expect(page2.cards.length).toBe(24);
  });

  it("feed service calls the DETERMINISTIC listBusinessesPaged (NOT listRandomBusinesses)", async () => {
    // Structural anchor · if a future refactor accidentally re-wires
    // to the non-deterministic version, this test file's vi.mock
    // export binding breaks and the suite stops passing.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(__dirname, "..", "landing-feed-service.ts"),
      "utf8",
    );
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    expect(stripped).toContain("listBusinessesPaged");
    expect(stripped).not.toContain("listRandomBusinesses");
  });
});

describe("getLandingFeed · seed-stable ordering", () => {
  it("same seed → same card order (across repeated calls)", async () => {
    const rows = [
      nexBiz({ slug: "a" }),
      nexBiz({ slug: "b" }),
      nexBiz({ slug: "c" }),
      nexBiz({ slug: "d" }),
      nexBiz({ slug: "e" }),
    ];
    listRandomMock.mockResolvedValue(rows);
    listCanonicalMock.mockResolvedValue([]);
    const a = await getLandingFeed({ limit: 5, visitorSeed: "STABLE-123" });
    const b = await getLandingFeed({ limit: 5, visitorSeed: "STABLE-123" });
    expect(a.cards.map((c) => c.slug)).toEqual(b.cards.map((c) => c.slug));
  });

  it("different seed CAN produce different ordering (not a hard requirement but likely)", async () => {
    // We can't guarantee that two arbitrary seeds will differ for every
    // input shape · but across many pairs at least ONE should differ
    // if the shuffle is seeded. Use 10-item input to make collision
    // vanishingly rare.
    const rows = Array.from({ length: 10 }, (_, i) =>
      nexBiz({ slug: `s-${i}` }),
    );
    listRandomMock.mockResolvedValue(rows);
    listCanonicalMock.mockResolvedValue([]);
    const seen = new Set<string>();
    for (const seed of ["x1", "x2", "x3", "x4", "x5", "x6"]) {
      const r = await getLandingFeed({ limit: 10, visitorSeed: seed });
      seen.add(r.cards.map((c) => c.slug).join(","));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

// ─── Honest empty for unsupported slugs (G1 / G4) ──────────────────

describe("getLandingFeed · honest empty for unsupported slugs", () => {
  it("travel → slug_unsupported · no DB calls at all", async () => {
    const r = await getLandingFeed({
      limit: 2,
      visitorSeed: "x",
      categorySlug: "travel",
    });
    expect(r.cards).toEqual([]);
    expect(r.reducedState).toBe("slug_unsupported");
    expect(listRandomMock).not.toHaveBeenCalled();
    expect(listCanonicalMock).not.toHaveBeenCalled();
  });

  it("transport → slug_unsupported", async () => {
    const r = await getLandingFeed({
      limit: 2,
      visitorSeed: "x",
      categorySlug: "transport",
    });
    expect(r.reducedState).toBe("slug_unsupported");
    expect(listRandomMock).not.toHaveBeenCalled();
  });

  it("deals → slug_unsupported (owner locked: never fabricate discounts)", async () => {
    const r = await getLandingFeed({
      limit: 2,
      visitorSeed: "x",
      categorySlug: "deals",
    });
    expect(r.reducedState).toBe("slug_unsupported");
    expect(listRandomMock).not.toHaveBeenCalled();
  });

  it("stay / accommodation DO call the canonical source (vertical table coverage)", async () => {
    listRandomMock.mockResolvedValueOnce([]); // Supabase has no `accommodation` enum · empty
    listCanonicalMock.mockResolvedValueOnce([
      canonicalRow({ display_name: "Hotel X" }),
    ]);
    const r = await getLandingFeed({
      limit: 2,
      visitorSeed: "x",
      categorySlug: "stay",
    });
    expect(r.cards.length).toBe(1);
    expect(r.cards[0]!.title).toBe("Hotel X");
    expect(listCanonicalMock).toHaveBeenCalled();
  });
});

// ─── Category filter narrows the nex_business pool ─────────────────

describe("getLandingFeed · category filter", () => {
  it("services slug: keeps only rows whose business_category is in the services enum list", async () => {
    listRandomMock.mockResolvedValueOnce([
      nexBiz({ slug: "s1", business_category: "salon" }),
      nexBiz({ slug: "s2", business_category: "restaurant" }), // wrong vertical · filtered out
      nexBiz({ slug: "s3", business_category: "tradesperson" }),
      nexBiz({ slug: "s4", business_category: null }),
    ]);
    listCanonicalMock.mockResolvedValueOnce([]);
    const r = await getLandingFeed({
      limit: 24,
      visitorSeed: "x",
      categorySlug: "services",
    });
    const slugs = r.cards.map((c) => c.slug);
    expect(slugs).toContain("s1");
    expect(slugs).toContain("s3");
    expect(slugs).not.toContain("s2");
    expect(slugs).not.toContain("s4");
  });

  it("food / food-drink aliases filter identically", async () => {
    const pool = [
      nexBiz({ slug: "r1", business_category: "restaurant" }),
      nexBiz({ slug: "r2", business_category: "ecommerce" }),
      nexBiz({ slug: "r3", business_category: "cafe" }),
    ];
    listRandomMock.mockResolvedValue(pool);
    listCanonicalMock.mockResolvedValue([]);
    const a = await getLandingFeed({
      limit: 24,
      visitorSeed: "x",
      categorySlug: "food",
    });
    const b = await getLandingFeed({
      limit: 24,
      visitorSeed: "x",
      categorySlug: "food-drink",
    });
    expect(a.cards.map((c) => c.slug).sort()).toEqual(
      b.cards.map((c) => c.slug).sort(),
    );
    expect(a.cards.map((c) => c.slug).sort()).toEqual(["r1", "r3"]);
  });
});

// ─── Country filter · honest-null on nex_business side ─────────────

describe("getLandingFeed · country filter", () => {
  it("country=GB skips nex_business entirely (no country column there)", async () => {
    listCanonicalMock.mockResolvedValueOnce([
      canonicalRow({ display_name: "GB Shop" }),
    ]);
    const r = await getLandingFeed({
      limit: 24,
      visitorSeed: "x",
      country: "GB",
    });
    expect(listRandomMock).not.toHaveBeenCalled();
    expect(listCanonicalMock).toHaveBeenCalled();
    expect(r.cards.length).toBe(1);
  });

  it("lowercase country is accepted and uppercased before passing to canonical source", async () => {
    listCanonicalMock.mockResolvedValueOnce([]);
    await getLandingFeed({
      limit: 2,
      visitorSeed: "x",
      country: "id",
    });
    expect(listCanonicalMock).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ country: "ID" }),
    );
  });

  it("garbage country ('XX3' / '') is silently dropped · nex_business runs again", async () => {
    listRandomMock.mockResolvedValueOnce([nexBiz({ slug: "any" })]);
    listCanonicalMock.mockResolvedValueOnce([]);
    const r = await getLandingFeed({
      limit: 2,
      visitorSeed: "x",
      country: "XX3",
    });
    expect(listRandomMock).toHaveBeenCalled();
    expect(r.cards.length).toBe(1);
  });
});

// ─── Robustness · one source failing never poisons the other ───────

describe("getLandingFeed · source failure containment", () => {
  it("nex_business throws · canonical rows still returned", async () => {
    listRandomMock.mockRejectedValueOnce(new Error("supabase 503"));
    listCanonicalMock.mockResolvedValueOnce([
      canonicalRow({ display_name: "Still here" }),
    ]);
    const r = await getLandingFeed({ limit: 2, visitorSeed: "x" });
    expect(r.cards.length).toBe(1);
    expect(r.cards[0]!.title).toBe("Still here");
  });

  it("canonical throws · nex_business rows still returned", async () => {
    listRandomMock.mockResolvedValueOnce([
      nexBiz({ display_name: "Owner only" }),
    ]);
    listCanonicalMock.mockRejectedValueOnce(new Error("pg timeout"));
    const r = await getLandingFeed({ limit: 2, visitorSeed: "x" });
    expect(r.cards.length).toBe(1);
    expect(r.cards[0]!.title).toBe("Owner only");
  });

  it("BOTH throw · honest empty · ok=true (not crashing)", async () => {
    listRandomMock.mockRejectedValueOnce(new Error("x"));
    listCanonicalMock.mockRejectedValueOnce(new Error("y"));
    const r = await getLandingFeed({ limit: 2, visitorSeed: "x" });
    expect(r.ok).toBe(true);
    expect(r.cards).toEqual([]);
    expect(r.reducedState).toBe("no_eligible_rows");
  });
});

// ─── Adapter honesty · no fabricated fields ────────────────────────

describe("adaptRowToCard · never fabricates missing fields", () => {
  it("null logo_url stays null in the card view model", () => {
    const row = nexBiz({ slug: "no-image", logo_url: null });
    const vm = __internal.adaptRowToCard(row);
    expect(vm.imageUrl).toBe(null);
  });
  it("null description stays null", () => {
    const row = nexBiz({ slug: "no-desc", description: null });
    const vm = __internal.adaptRowToCard(row);
    expect(vm.description).toBe(null);
  });
  it("null business_category → categoryId null, falls back to the neutral default visuals (not an empty label)", () => {
    const row = nexBiz({ slug: "uncat", business_category: null });
    const vm = __internal.adaptRowToCard(row);
    expect(vm.categoryId).toBe(null);
    // Neutral fallback: label is 'Listings' and accent is the cyan default.
    expect(vm.categoryLabel).toBe("Listings");
    expect(vm.categoryAccent).toBe("#00AFFF");
  });
  it("canonical row (slug === id) tags source='canonical' + routes through the canonical-entity-type visuals (neutral default)", () => {
    const row = canonicalRow({ id: "same", slug: "same" });
    const vm = __internal.adaptRowToCard(row);
    expect(vm.source).toBe("canonical");
    expect(vm.categoryLabel).toBe("Listings");
    expect(vm.categoryAccent).toBe("#00AFFF");
  });
  it("nex_business row (slug ≠ id) tags source='nex_business' + routes through the per-category visuals", () => {
    const row = nexBiz({ id: "x", slug: "y", business_category: "restaurant" });
    const vm = __internal.adaptRowToCard(row);
    expect(vm.source).toBe("nex_business");
    expect(vm.categoryLabel).toBe("Food");
    expect(vm.categoryAccent).toBe("#4DD17A");
    expect(vm.categoryIconCol).toBe(3);
    expect(vm.categoryIconRow).toBe(0);
  });
  it("ALL pricing fields default to null · adapter NEVER fabricates (owner rule #6)", () => {
    const row = nexBiz({ slug: "any", business_category: "ecommerce" });
    const vm = __internal.adaptRowToCard(row);
    expect(vm.priceNow).toBe(null);
    expect(vm.priceWas).toBe(null);
    expect(vm.discountLabel).toBe(null);
  });
  it("per-category visuals mapping · spot checks across the four landing groups", () => {
    const ecom = __internal.adaptRowToCard(
      nexBiz({ slug: "ec", business_category: "ecommerce" }),
    );
    expect(ecom.categoryAccent).toBe("#FF8A2A");
    expect(ecom.categoryLabel).toBe("Products");

    const salon = __internal.adaptRowToCard(
      nexBiz({ slug: "sa", business_category: "salon" }),
    );
    expect(salon.categoryAccent).toBe("#00AFFF");
    expect(salon.categoryLabel).toBe("Services");

    const cafe = __internal.adaptRowToCard(
      nexBiz({ slug: "cf", business_category: "cafe" }),
    );
    expect(cafe.categoryAccent).toBe("#4DD17A");
    expect(cafe.categoryLabel).toBe("Food");

    const evt = __internal.adaptRowToCard(
      nexBiz({ slug: "ev", business_category: "event" }),
    );
    expect(evt.categoryAccent).toBe("#FF5EB4");
    expect(evt.categoryLabel).toBe("Events");
  });
});

// ─── pickOrMintSeed ────────────────────────────────────────────────

describe("pickOrMintSeed", () => {
  it("passes through a usable existing seed", () => {
    expect(pickOrMintSeed("abc-123")).toBe("abc-123");
  });
  it("mints a short seed (6 chars) when none supplied · owner directive 'url is small'", () => {
    const s = pickOrMintSeed(null);
    expect(typeof s).toBe("string");
    expect(s.length).toBe(6);
    expect(s).toMatch(/^[0-9a-z]{6}$/);
  });
  it("mints a short seed for an over-long input (>64)", () => {
    const long = "x".repeat(100);
    const s = pickOrMintSeed(long);
    expect(s).not.toBe(long);
    expect(s.length).toBe(6);
  });
});

// ─── Shuffle primitive · determinism anchor ───────────────────────

describe("shuffleInPlaceWithSeed · determinism", () => {
  it("same seed produces same permutation of the input", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const b = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    __internal.shuffleInPlaceWithSeed(a, "deterministic-seed");
    __internal.shuffleInPlaceWithSeed(b, "deterministic-seed");
    expect(a).toEqual(b);
  });
  it("different seeds produce (usually) different permutations", () => {
    const base = () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const outcomes = new Set<string>();
    for (const s of ["a", "b", "c", "d", "e"]) {
      const arr = base();
      __internal.shuffleInPlaceWithSeed(arr, s);
      outcomes.add(arr.join(","));
    }
    expect(outcomes.size).toBeGreaterThan(1);
  });
});
