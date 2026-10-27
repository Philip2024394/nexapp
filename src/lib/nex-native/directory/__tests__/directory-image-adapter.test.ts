// src/lib/nex-native/directory/__tests__/directory-image-adapter.test.ts
//
// A-strict CATEGORY_FALLBACK adapter · unit tests · 2026-10-27.
//
// Covers the 5 owner-authorised regression scenarios:
//   1. Eligible food business (canonical · country=ID · entity_type=food)
//   2. Non-food business
//   3. Non-Indonesian business
//   4. Missing match (unknown entity_type, out-of-library canonical row)
//   5. Preservation of higher-priority tiers (OWNER_IMAGE via logo_url)
//
// Scope boundary tests ADDED:
//   · nex_business rows (no country column) stay out of A-strict scope.
//   · Universal-fallback branch is rejected (resolver's own PHASE 1
//     placeholder would otherwise leak nva-011 to any gated row).

import { describe, expect, it, vi } from "vitest";

// `landing-feed-service` imports `server-only` + the discovery service
// (which eagerly reads NEX_SUPABASE_URL) + the local-directory service.
// Stub all three the same way the sister `landing-feed-service.test.ts`
// does. We never call these mocks · we only use `__internal.adaptRowToCard`.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/nex-native/discovery-service", () => ({
  listBusinessesPaged: vi.fn(),
}));
vi.mock("@/lib/nex-native/local-directory-service", () => ({
  listCanonicalBusinessesPaged: vi.fn(),
  searchCanonicalBusinesses: vi.fn(),
}));

import { resolveCategoryFallbackImageUrl } from "../directory-image-adapter";
import { __internal } from "../landing-feed-service";
import type { NexBusinessRow } from "@/lib/nex-native/types";
import { NEX_VISUAL_ASSETS } from "@/lib/nexapp/nexVisualAssets";

const { adaptRowToCard } = __internal;

/** Shape-cast helper · the adapter reads `country` defensively off the
 *  row even though `NexBusinessRow` does not declare it. Mirrors how
 *  the canonical adapter emits it. Keeps tests honest about the live
 *  surface shape. */
function makeRow(overrides: Partial<NexBusinessRow> & { country?: string | null }): NexBusinessRow {
  return {
    id: "row-id",
    owner_account_id: "",
    display_name: "Test Business",
    slug: "test-business",
    description: null,
    logo_url: null,
    hours: null,
    address: null,
    public_phone: null,
    public_email: null,
    website_url: null,
    payment_instructions: null,
    accepts_cod: false,
    accepts_pickup: false,
    status_message: null,
    status_message_expires_at: null,
    market_reach: "both",
    business_category: null,
    search_keywords: null,
    accepted_payment_methods: ["cod"],
    archived_at: null,
    created_at: "2026-10-27T00:00:00Z",
    updated_at: "2026-10-27T00:00:00Z",
    verified_at: null,
    ...(overrides as Partial<NexBusinessRow>),
    // Attach `country` as an extra property · adapter reads defensively.
    ...(overrides.country !== undefined ? { country: overrides.country } : {}),
  } as unknown as NexBusinessRow;
}

const FOOD_FALLBACK_URL = (() => {
  const asset = NEX_VISUAL_ASSETS.find((a) => a.id === "nva-011");
  if (!asset) throw new Error("Fixture precondition failed: nva-011 missing from NEX_VISUAL_ASSETS");
  return asset.imageUrl;
})();

describe("resolveCategoryFallbackImageUrl · owner-authorised scope", () => {
  it("Scenario 1 · eligible canonical food business (country=ID, entity_type=food) → library hit", () => {
    const row = makeRow({
      id: "canonical-food-ID-1",
      display_name: "Warung Nasi Padang",
      business_category: "food",
      country: "ID",
    });
    const out = resolveCategoryFallbackImageUrl(row, "canonical");
    expect(out).not.toBeNull();
    expect(out).toBe(FOOD_FALLBACK_URL);
    // Honest shape · must be an http(s) URL · never a stub.
    expect(out).toMatch(/^https?:\/\//);
  });

  it("Scenario 2 · non-food canonical business (country=ID, entity_type=accommodation) → null (monogram)", () => {
    const row = makeRow({
      business_category: "accommodation",
      country: "ID",
    });
    expect(resolveCategoryFallbackImageUrl(row, "canonical")).toBeNull();
  });

  it("Scenario 3 · non-Indonesian canonical food business (country=GB, entity_type=food) → null (monogram)", () => {
    const row = makeRow({
      business_category: "food",
      country: "GB",
    });
    expect(resolveCategoryFallbackImageUrl(row, "canonical")).toBeNull();
  });

  it("Scenario 4a · canonical row with unknown entity_type → null (monogram)", () => {
    const row = makeRow({
      business_category: "mystery-vertical",
      country: "ID",
    });
    expect(resolveCategoryFallbackImageUrl(row, "canonical")).toBeNull();
  });

  it("Scenario 4b · canonical row with null entity_type → null (monogram)", () => {
    const row = makeRow({
      business_category: null,
      country: "ID",
    });
    expect(resolveCategoryFallbackImageUrl(row, "canonical")).toBeNull();
  });

  it("Scenario 4c · canonical row with missing country → null (monogram, cannot verify ID)", () => {
    const row = makeRow({
      business_category: "food",
      // No country property at all.
    });
    expect(resolveCategoryFallbackImageUrl(row, "canonical")).toBeNull();
  });

  it("Scope · nex_business rows are out of scope regardless of category (no country column)", () => {
    const row = makeRow({
      business_category: "restaurant",
      country: "ID", // even if the row defensively carries one
    });
    expect(resolveCategoryFallbackImageUrl(row, "nex_business")).toBeNull();
  });

  it("Scope · lowercase country code is normalised to uppercase and accepted", () => {
    const row = makeRow({
      business_category: "food",
      country: "id",
    });
    expect(resolveCategoryFallbackImageUrl(row, "canonical")).toBe(FOOD_FALLBACK_URL);
  });

  it("Scope · malformed country code (not alpha-2) → null", () => {
    const row = makeRow({
      business_category: "food",
      country: "IDN", // alpha-3, not alpha-2
    });
    expect(resolveCategoryFallbackImageUrl(row, "canonical")).toBeNull();
  });
});

describe("adaptRowToCard · priority preservation (Scenario 5)", () => {
  it("Scenario 5a · owner-uploaded logo_url wins over CATEGORY_FALLBACK", () => {
    // Row is in A-strict scope so the fallback WOULD fire · but logo_url
    // is present, so the owner image must take precedence.
    const row = makeRow({
      id: "canonical-food-ID-with-logo",
      display_name: "Famous Warung",
      logo_url: "https://owner-upload.example/famous-warung.jpg",
      business_category: "food",
      country: "ID",
      // Canonical path marker · slug === id triggers isCanonicalSyntheticSlug.
      slug: "canonical-food-ID-with-logo",
    });
    const card = adaptRowToCard(row);
    expect(card.imageUrl).toBe("https://owner-upload.example/famous-warung.jpg");
    // Honest provenance tag · not forced to CATEGORY_FALLBACK.
    expect(card.imageUrl).not.toBe(FOOD_FALLBACK_URL);
  });

  it("Scenario 5b · in-scope canonical food row without logo_url → CATEGORY_FALLBACK fires", () => {
    const row = makeRow({
      id: "canonical-food-ID-no-logo",
      display_name: "Nameless Warung",
      logo_url: null,
      business_category: "food",
      country: "ID",
      slug: "canonical-food-ID-no-logo",
    });
    const card = adaptRowToCard(row);
    expect(card.imageUrl).toBe(FOOD_FALLBACK_URL);
    expect(card.imageUrl).toMatch(/^https?:\/\//);
  });

  it("Scenario 5c · out-of-scope canonical row without logo_url → null (monogram preserved)", () => {
    const row = makeRow({
      id: "canonical-stay-ID",
      display_name: "Hotel Example",
      logo_url: null,
      business_category: "accommodation",
      country: "ID",
      slug: "canonical-stay-ID",
    });
    const card = adaptRowToCard(row);
    expect(card.imageUrl).toBeNull();
  });

  it("Scenario 5d · nex_business row without logo_url stays null regardless of category", () => {
    // Distinct slug + id so isCanonicalSyntheticSlug reports nex_business.
    const row = makeRow({
      id: "owner-row-1",
      display_name: "Owner Restaurant",
      slug: "owner-restaurant",
      logo_url: null,
      business_category: "restaurant", // food-family but owner-side
      country: "ID", // defensive · ignored for nex_business
    });
    const card = adaptRowToCard(row);
    expect(card.imageUrl).toBeNull();
  });
});
