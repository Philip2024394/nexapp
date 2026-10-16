// src/lib/nex-native/directory/__tests__/mock-seed-listings.test.ts
//
// Owner-authorised preview mocks regression · sealed 2026-10-16.
//
// Hard rules the owner locked in:
//   · Exactly 2 mock seeds today.
//   · Every mock carries `source: "mock_seed"` so the ListingCard
//     renders the SAMPLE chip.
//   · No mock escapes into the real feed via the sealed service.

import { describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  MOCK_SEED_COUNT,
  getMockSeedListings,
  isMockSeedListing,
} from "../mock-seed-listings";

describe("mock-seed-listings · owner-approved count + shape", () => {
  it("MOCK_SEED_COUNT is pinned at 2", () => {
    expect(MOCK_SEED_COUNT).toBe(2);
  });

  it("getMockSeedListings returns exactly MOCK_SEED_COUNT entries", () => {
    const r = getMockSeedListings();
    expect(r.length).toBe(MOCK_SEED_COUNT);
  });

  it("every mock carries source='mock_seed' (so the SAMPLE chip renders)", () => {
    for (const m of getMockSeedListings()) {
      expect(m.source).toBe("mock_seed");
      expect(isMockSeedListing(m)).toBe(true);
    }
  });

  it("each mock has required ViewModel fields (title + href + category visuals)", () => {
    for (const m of getMockSeedListings()) {
      expect(m.id.length).toBeGreaterThan(0);
      expect(m.slug.length).toBeGreaterThan(0);
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.href.startsWith("/nex-native/")).toBe(true);
      expect(typeof m.categoryAccent).toBe("string");
      expect(m.categoryIconCol).toBeGreaterThanOrEqual(0);
      expect(m.categoryIconCol).toBeLessThanOrEqual(3);
      expect([0, 1]).toContain(m.categoryIconRow);
    }
  });

  it("isMockSeedListing distinguishes mocks from real sources", () => {
    const vm = { ...getMockSeedListings()[0]!, source: "nex_business" as const };
    expect(isMockSeedListing(vm)).toBe(false);
    const vm2 = { ...getMockSeedListings()[0]!, source: "canonical" as const };
    expect(isMockSeedListing(vm2)).toBe(false);
  });
});

describe("mock-seed-listings · frozen + isolated", () => {
  it("the returned array is frozen · mutation attempts throw in strict mode or are no-ops", () => {
    const r = getMockSeedListings();
    // Attempting to push a new entry should either throw or silently
    // fail (depending on strict mode). We just assert the length did
    // not change.
    const before = r.length;
    try {
      (r as unknown as { push: (x: unknown) => number }).push({});
    } catch {
      /* expected in strict mode */
    }
    expect(r.length).toBe(before);
  });
});

describe("mock-seed-listings · isolation anchor", () => {
  it("the sealed landing-feed-service does NOT import the mock-seed module (doctrine references in comments are allowed)", async () => {
    const feedSrc = fs.readFileSync(
      path.join(__dirname, "..", "landing-feed-service.ts"),
      "utf8",
    );
    // Strip comments before matching · a doctrine comment that
    // mentions "mock-seed-listings" by name is fine; what we're
    // guarding against is an actual IMPORT statement that would wire
    // mocks into the real-data pipeline.
    const stripped = feedSrc
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    // No import of the mock module.
    expect(stripped).not.toMatch(/from\s+["'][^"']*mock-seed-listings[^"']*["']/);
    expect(stripped).not.toMatch(/require\(\s*["'][^"']*mock-seed-listings[^"']*["']\s*\)/);
    // No reference to the mock module's exports in executable code.
    expect(stripped).not.toContain("getMockSeedListings");
    expect(stripped).not.toContain("MOCK_SEED_COUNT");
    expect(stripped).not.toContain("isMockSeedListing");
  });
});

// ─── Behavioural check · mocks never contaminate the real feed ─────

const { listRandomMock, listCanonicalMock } = vi.hoisted(() => ({
  listRandomMock: vi.fn(),
  listCanonicalMock: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/nex-native/discovery-service", () => ({
  listRandomBusinesses: listRandomMock,
}));
vi.mock("@/lib/nex-native/local-directory-service", () => ({
  listCanonicalBusinessesPaged: listCanonicalMock,
  searchCanonicalBusinesses: vi.fn(),
}));

describe("mock-seed-listings · do NOT leak into getLandingFeed", () => {
  it("getLandingFeed returns ZERO mock_seed rows even when both real sources are empty", async () => {
    listRandomMock.mockResolvedValueOnce([]);
    listCanonicalMock.mockResolvedValueOnce([]);
    const { getLandingFeed } = await import("../landing-feed-service");
    const r = await getLandingFeed({ limit: 2, visitorSeed: "x" });
    expect(r.cards.every((c) => c.source !== "mock_seed")).toBe(true);
    expect(r.cards.length).toBe(0);
  });
});
