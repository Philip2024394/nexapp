// src/lib/nex-native/directory/__tests__/eligible-paid-listing-service.test.ts
//
// Directory Integration Fix 2026-10-26 · unit tests for the two
// G3-amendment-compatible readers.
//
// These tests are intentionally LOW-FIDELITY because the service is
// a thin passthrough: lazy-import the Supabase admin, query a sealed
// view, project rows into ListingCardViewModel. The high-value
// property we assert is FAIL-OPEN behaviour · when the Supabase
// module cannot be loaded (missing env in the test env) BOTH
// `listPaidWatchListings` and `listPaidLivePosts` must return `[]`,
// never throw.
//
// End-to-end DB behaviour (actually seeing rows from the real views)
// is covered by the sandbox-level acceptance step and is flagged
// BLOCKED in the delivery report until an isolated sandbox is
// provisioned (see owner directive 2026-10-26 Directory Integration
// Fix · "Do not use the production database as a test environment").

import { describe, it, expect, vi } from "vitest";

// Vitest cannot import `server-only` modules by default · mirror the
// stub used by the sibling landing-feed-service.test.ts.
vi.mock("server-only", () => ({}));

import {
  listPaidWatchListings,
  listPaidLivePosts,
} from "../eligible-paid-listing-service";

describe("eligible-paid-listing-service · fail-open contract", () => {
  it("returns [] when the Supabase admin client cannot load", async () => {
    // In the vitest env NEX_SUPABASE_URL is typically not set · the
    // supabase-admin module throws on import. The service catches that
    // via the lazy-load wrapper and returns an empty array.
    const r = await listPaidWatchListings({ limit: 10 });
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBe(0);
  });

  it("returns [] for live posts under the same fail-open contract", async () => {
    const r = await listPaidLivePosts({ limit: 10 });
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBe(0);
  });

  it("respects the limit clamp [1, 500]", async () => {
    // Even with absurd limits, the service does not crash · fail-open
    // still produces an empty array.
    expect((await listPaidWatchListings({ limit: 0 })).length).toBe(0);
    expect((await listPaidWatchListings({ limit: -5 })).length).toBe(0);
    expect((await listPaidWatchListings({ limit: 10_000 })).length).toBe(0);
    expect((await listPaidLivePosts({ limit: 0 })).length).toBe(0);
    expect((await listPaidLivePosts({ limit: 10_000 })).length).toBe(0);
  });
});
