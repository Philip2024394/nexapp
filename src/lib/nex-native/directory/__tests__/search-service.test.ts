// src/lib/nex-native/directory/__tests__/search-service.test.ts
//
// Regression · 2026-10-27 · Feature A · owner-authorised directory
// search path. The directory's <input name="q"> was decorative prior
// to this feature. These tests lock the new behaviour so a future
// refactor cannot silently sever the search wire-up again.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { searchCanonicalMock, searchBusinessesMock } = vi.hoisted(() => ({
  searchCanonicalMock: vi.fn(),
  searchBusinessesMock: vi.fn(),
}));

vi.mock("@/lib/nex-native/local-directory-service", () => ({
  searchCanonicalBusinesses: searchCanonicalMock,
  listCanonicalBusinessesPaged: vi.fn(),
  searchCanonicalBusinesses_test: searchCanonicalMock,
}));

vi.mock("@/lib/nex-native/discovery-service", () => ({
  searchBusinesses: searchBusinessesMock,
  listBusinessesPaged: vi.fn(),
}));

import {
  getDirectorySearchResults,
  normaliseSearchQuery,
} from "../search-service";

beforeEach(() => {
  searchCanonicalMock.mockReset();
  searchBusinessesMock.mockReset();
});
afterEach(() => vi.clearAllMocks());

function row(id: string, displayName: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    slug: id,
    display_name: displayName,
    business_category: null,
    logo_url: null,
    description: null,
    city: null,
    country: null,
    accepts_cod: false,
    accepts_pickup: false,
    status_message: null,
    status_message_expires_at: null,
    created_at: "2026-10-27T00:00:00Z",
    updated_at: "2026-10-27T00:00:00Z",
    ...extra,
  };
}

describe("normaliseSearchQuery · safe input", () => {
  it("trims whitespace", () => {
    expect(normaliseSearchQuery("  starbucks  ")).toBe("starbucks");
  });

  it("collapses internal whitespace runs", () => {
    expect(normaliseSearchQuery("burger   king")).toBe("burger king");
  });

  it("caps at 100 chars", () => {
    const long = "a".repeat(500);
    const out = normaliseSearchQuery(long);
    expect(out.length).toBe(100);
  });

  it("returns empty for null / undefined / non-string input", () => {
    expect(normaliseSearchQuery(null)).toBe("");
    expect(normaliseSearchQuery(undefined)).toBe("");
    expect(normaliseSearchQuery(123 as unknown as string)).toBe("");
  });
});

describe("getDirectorySearchResults · honest-empty guard", () => {
  it("returns honest-empty when query is blank · never calls either service", async () => {
    const r = await getDirectorySearchResults({
      query: "   ",
      limit: 20,
      offset: 0,
      seed: "S",
    });
    expect(r.ok).toBe(true);
    expect(r.cards).toEqual([]);
    expect(r.reducedState).toBe("no_eligible_rows");
    expect(searchCanonicalMock).not.toHaveBeenCalled();
    expect(searchBusinessesMock).not.toHaveBeenCalled();
  });
});

describe("getDirectorySearchResults · reads BOTH sources", () => {
  it("calls searchCanonicalBusinesses + searchBusinesses in parallel", async () => {
    searchCanonicalMock.mockResolvedValueOnce([
      row("cb-1", "Starbucks", { country: "US" }),
    ]);
    searchBusinessesMock.mockResolvedValueOnce([
      row("nb-1", "Starbucks Lounge"),
    ]);
    const r = await getDirectorySearchResults({
      query: "Starbucks",
      limit: 20,
      offset: 0,
      seed: "S",
    });
    expect(searchCanonicalMock).toHaveBeenCalledTimes(1);
    expect(searchBusinessesMock).toHaveBeenCalledTimes(1);
    expect(r.cards.map((c) => c.id).sort()).toEqual(["cb-1", "nb-1"]);
  });
});

describe("getDirectorySearchResults · ranking", () => {
  it("exact name match beats prefix match beats substring match", async () => {
    searchCanonicalMock.mockResolvedValueOnce([
      row("cb-1", "Starbucks Reserve"), // prefix
      row("cb-2", "Starbucks"), // exact
      row("cb-3", "The Starbucks Experience"), // substring
    ]);
    searchBusinessesMock.mockResolvedValueOnce([]);
    const r = await getDirectorySearchResults({
      query: "Starbucks",
      limit: 20,
      offset: 0,
      seed: "S",
    });
    expect(r.cards[0]!.id).toBe("cb-2");
    expect(r.cards[1]!.id).toBe("cb-1");
    expect(r.cards[2]!.id).toBe("cb-3");
  });
});

describe("getDirectorySearchResults · dedup + source precedence", () => {
  it("same slug · owner-authored nex_business row wins over canonical", async () => {
    const commonSlug = "burger-palace";
    searchCanonicalMock.mockResolvedValueOnce([
      row("cb-1", "Burger Palace (OSM)", { slug: commonSlug }),
    ]);
    searchBusinessesMock.mockResolvedValueOnce([
      row("nb-1", "Burger Palace (Owner)", { slug: commonSlug }),
    ]);
    const r = await getDirectorySearchResults({
      query: "burger palace",
      limit: 20,
      offset: 0,
      seed: "S",
    });
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0]!.id).toBe("nb-1");
    expect(r.cards[0]!.title).toBe("Burger Palace (Owner)");
  });
});

describe("getDirectorySearchResults · detail href shape", () => {
  it("emits /nex-native/directory/<slug> for canonical rows (owner directive 2026-10-27)", async () => {
    const CBID = "ca2d53a4-f23d-4398-bada-ff4295569b21";
    searchCanonicalMock.mockResolvedValueOnce([row(CBID, "Geblek Pari")]);
    searchBusinessesMock.mockResolvedValueOnce([]);
    const r = await getDirectorySearchResults({
      query: "Geblek Pari",
      limit: 20,
      offset: 0,
      seed: "S",
    });
    expect(r.cards[0]!.href).toBe(`/nex-native/directory/${CBID}`);
    expect(r.cards[0]!.source).toBe("canonical");
  });

  it("emits /nex-native/directory/<slug> for nex_business slug rows", async () => {
    searchCanonicalMock.mockResolvedValueOnce([]);
    searchBusinessesMock.mockResolvedValueOnce([
      row("00000000-0000-0000-0000-000000000001", "AnonShop", {
        slug: "anonshop-v288978",
      }),
    ]);
    const r = await getDirectorySearchResults({
      query: "AnonShop",
      limit: 20,
      offset: 0,
      seed: "S",
    });
    expect(r.cards[0]!.href).toBe("/nex-native/directory/anonshop-v288978");
    expect(r.cards[0]!.source).toBe("nex_business");
  });

  it("the broken shape /nex-native/<slug> is NEVER emitted", async () => {
    searchCanonicalMock.mockResolvedValueOnce([row("cb-1", "Test")]);
    searchBusinessesMock.mockResolvedValueOnce([
      row("nb-1", "Owner Shop", { slug: "owner-shop" }),
    ]);
    const r = await getDirectorySearchResults({
      query: "shop",
      limit: 20,
      offset: 0,
      seed: "S",
    });
    for (const c of r.cards) {
      expect(c.href).not.toMatch(/^\/nex-native\/[^/]+$/);
      expect(c.href).toMatch(/^\/nex-native\/directory\/[^/]+$/);
    }
  });
});

describe("getDirectorySearchResults · empty query / no-match honesty", () => {
  it("no-match query returns 0 cards + no_eligible_rows · never fabricates", async () => {
    searchCanonicalMock.mockResolvedValueOnce([]);
    searchBusinessesMock.mockResolvedValueOnce([]);
    const r = await getDirectorySearchResults({
      query: "xxyyzzqqqqq1234567890",
      limit: 20,
      offset: 0,
      seed: "S",
    });
    expect(r.cards).toHaveLength(0);
    expect(r.reducedState).toBe("no_eligible_rows");
    expect(r.totalEligible).toBe(0);
  });
});

describe("getDirectorySearchResults · pagination", () => {
  it("offset + limit correctly slice the ranked pool", async () => {
    const canonical = Array.from({ length: 30 }, (_, i) =>
      row(`cb-${String(i).padStart(2, "0")}`, `Starbucks ${i}`),
    );
    // Both page calls hit the same services with the same query ·
    // use mockResolvedValue (not Once) so both calls see the pool.
    searchCanonicalMock.mockResolvedValue(canonical);
    searchBusinessesMock.mockResolvedValue([]);
    const page1 = await getDirectorySearchResults({
      query: "Starbucks",
      limit: 10,
      offset: 0,
      seed: "S",
    });
    const page2 = await getDirectorySearchResults({
      query: "Starbucks",
      limit: 10,
      offset: 10,
      seed: "S",
    });
    expect(page1.cards).toHaveLength(10);
    expect(page2.cards).toHaveLength(10);
    const page1Ids = new Set(page1.cards.map((c) => c.id));
    const page2Ids = new Set(page2.cards.map((c) => c.id));
    for (const id of page2Ids) expect(page1Ids.has(id)).toBe(false);
  });

  it("limit is clamped to [1, 24] · never unbounded", async () => {
    searchCanonicalMock.mockResolvedValueOnce(
      Array.from({ length: 100 }, (_, i) => row(`cb-${i}`, `Starbucks ${i}`)),
    );
    searchBusinessesMock.mockResolvedValueOnce([]);
    const r = await getDirectorySearchResults({
      query: "Starbucks",
      limit: 9999,
      offset: 0,
      seed: "S",
    });
    expect(r.cards.length).toBeLessThanOrEqual(24);
  });
});

describe("getDirectorySearchResults · failure isolation", () => {
  it("canonical source throws · nex_business results still returned", async () => {
    searchCanonicalMock.mockRejectedValueOnce(new Error("DB down"));
    searchBusinessesMock.mockResolvedValueOnce([row("nb-1", "Shop")]);
    const r = await getDirectorySearchResults({
      query: "Shop",
      limit: 20,
      offset: 0,
      seed: "S",
    });
    expect(r.ok).toBe(true);
    expect(r.cards.map((c) => c.id)).toEqual(["nb-1"]);
  });

  it("nex_business source throws · canonical results still returned", async () => {
    searchCanonicalMock.mockResolvedValueOnce([row("cb-1", "Shop")]);
    searchBusinessesMock.mockRejectedValueOnce(new Error("Supabase 500"));
    const r = await getDirectorySearchResults({
      query: "Shop",
      limit: 20,
      offset: 0,
      seed: "S",
    });
    expect(r.ok).toBe(true);
    expect(r.cards.map((c) => c.id)).toEqual(["cb-1"]);
  });
});

describe("getDirectorySearchResults · country filter", () => {
  it("filters canonical rows by country when a country is set", async () => {
    searchCanonicalMock.mockResolvedValueOnce([
      row("cb-us", "Burger King USA", { country: "US" }),
      row("cb-gb", "Burger King UK", { country: "GB" }),
    ]);
    searchBusinessesMock.mockResolvedValueOnce([]);
    const r = await getDirectorySearchResults({
      query: "Burger King",
      limit: 20,
      offset: 0,
      country: "US",
      seed: "S",
    });
    expect(r.cards.map((c) => c.id)).toEqual(["cb-us"]);
  });
});
