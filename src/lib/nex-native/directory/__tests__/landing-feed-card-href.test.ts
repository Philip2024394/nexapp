// src/lib/nex-native/directory/__tests__/landing-feed-card-href.test.ts
//
// Regression test · 2026-10-27 · owner-authorised card href fix.
//
// Prior behaviour (BROKEN): adaptRowToCard emitted href=`/nex-native/${slug}`.
// This URL has no matching route · the request falls through to the
// catch-all and 307-redirects to /nex-native/home. The result was that
// EVERY card on the main /nex-native/directory page was not navigable
// to its detail surface.
//
// Fixed behaviour: adaptRowToCard emits href=`/nex-native/directory/${slug}`,
// which matches the dynamic route at src/app/nex-native/directory/[id]/page.tsx.
// Verified live 2026-10-27 against the running dev server · all 20
// collected canonical cards return HTTP 200 at the new URL.
//
// This test LOCKS the correct URL shape so a future regression cannot
// silently re-break card navigation.

import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock the same two seams the sealed landing-feed-service.test.ts
// mocks · this test only needs the single CANONICAL path (we're
// verifying href shape, not the pool merge).
const { listNexBusinessMock, listCanonicalMock, searchCanonicalMock } =
  vi.hoisted(() => ({
    listNexBusinessMock: vi.fn(),
    listCanonicalMock: vi.fn(),
    searchCanonicalMock: vi.fn(),
  }));

vi.mock("@/lib/nex-native/discovery-service", () => ({
  listBusinessesPaged: listNexBusinessMock,
}));
vi.mock("@/lib/nex-native/local-directory-service", () => ({
  listCanonicalBusinessesPaged: listCanonicalMock,
  searchCanonicalBusinesses: searchCanonicalMock,
}));

import { getLandingFeed, pickOrMintSeed } from "../landing-feed-service";

beforeEach(() => {
  listNexBusinessMock.mockReset();
  listCanonicalMock.mockReset();
  searchCanonicalMock.mockReset();
});
afterEach(() => vi.clearAllMocks());

function canonicalRow(id: string, name: string): Record<string, unknown> {
  return {
    id,
    slug: id,
    display_name: name,
    description: null,
    business_category: null,
    logo_url: null,
    status_message: null,
    status_message_expires_at: null,
    is_online: false,
    accepts_cod: false,
    accepts_pickup: false,
    created_at: "2026-10-27T00:00:00Z",
    updated_at: "2026-10-27T00:00:00Z",
  };
}

describe("adaptRowToCard · card href path · 2026-10-27", () => {
  it("canonical card href points at /nex-native/directory/<slug> (not /nex-native/<slug>)", async () => {
    const CBID = "ca2d53a4-f23d-4398-bada-ff4295569b21";
    listCanonicalMock.mockResolvedValueOnce([canonicalRow(CBID, "Geblek Pari")]);
    listNexBusinessMock.mockResolvedValueOnce([]);

    const r = await getLandingFeed({
      limit: 2,
      visitorSeed: pickOrMintSeed(null),
    });

    expect(r.ok).toBe(true);
    const card = r.cards.find((c) => c.id === CBID);
    expect(card).toBeDefined();
    expect(card!.href).toBe(`/nex-native/directory/${CBID}`);

    // Guard against regression · the previous broken shape MUST NOT return.
    expect(card!.href).not.toBe(`/nex-native/${CBID}`);
    expect(card!.href).toMatch(/^\/nex-native\/directory\/[a-f0-9-]{8,}$/i);
  });

  it("nex_business card href also goes through /nex-native/directory/<slug>", async () => {
    const SLUG = "anonshop-v288978";
    // Simulate a nex_business row by giving it a non-UUID slug.
    const row = {
      ...canonicalRow(SLUG, "AnonShop"),
      id: "11111111-2222-3333-4444-555555555555",
      slug: SLUG,
    };
    listNexBusinessMock.mockResolvedValueOnce([row]);
    listCanonicalMock.mockResolvedValueOnce([]);

    const r = await getLandingFeed({
      limit: 2,
      visitorSeed: pickOrMintSeed(null),
    });

    expect(r.ok).toBe(true);
    const card = r.cards.find((c) => c.slug === SLUG);
    expect(card).toBeDefined();
    // The detail route handles BOTH canonical UUIDs AND nex_business slugs
    // (301-redirects nex_business to the owner cover page internally).
    expect(card!.href).toBe(`/nex-native/directory/${SLUG}`);
    expect(card!.href).not.toBe(`/nex-native/${SLUG}`);
  });

  it("the broken shape /nex-native/<slug> is NEVER emitted for any card source", async () => {
    const CBID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    listCanonicalMock.mockResolvedValueOnce([canonicalRow(CBID, "Test")]);
    listNexBusinessMock.mockResolvedValueOnce([]);

    const r = await getLandingFeed({
      limit: 10,
      visitorSeed: pickOrMintSeed(null),
    });

    expect(r.ok).toBe(true);
    // Owner-sealed: no card may ever point at /nex-native/<slug> directly
    // because that path has no route handler and redirects to /home.
    for (const c of r.cards) {
      expect(c.href).not.toMatch(/^\/nex-native\/[^/]+$/);
    }
  });
});
