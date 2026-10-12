// src/lib/nex-native/directory/__tests__/area-intelligence-types.test.ts
//
// Pure parse-shape tests. No DB. No clock.

import { describe, it, expect } from "vitest";
import {
  parseAreaIntelligence,
  totalClaimCount,
  nonEmptyCategories,
  AREA_INTEL_CATEGORIES,
  type AreaIntelligence,
} from "../area-intelligence-types";

function wrap(payload: unknown): unknown {
  return { nex_directory_area_intelligence: payload };
}

const SAMPLE_CLAIM = {
  claim: "Gudeg is Yogyakarta's signature dish",
  source_url: "https://en.wikipedia.org/wiki/Gudeg",
  accessed_at: "2026-10-12T00:00:00Z",
};

describe("parseAreaIntelligence · happy path", () => {
  it("parses a complete payload with all four categories", () => {
    const intel = parseAreaIntelligence({
      areaId: "yogyakarta-city-overview",
      areaName: "Yogyakarta",
      country: "ID",
      city: "Yogyakarta",
      provenance: wrap({
        short_summary: "Cultural heart of Java",
        method: "nexapp-subagent-explore-v1",
        method_note: "WebSearch only",
        researched_at: "2026-10-12T00:00:00Z",
        known_for: {
          food: [SAMPLE_CLAIM],
          shopping: [SAMPLE_CLAIM, SAMPLE_CLAIM],
          attractions: [],
          transport: [SAMPLE_CLAIM],
        },
      }),
    });
    expect(intel).not.toBeNull();
    expect(intel?.areaId).toBe("yogyakarta-city-overview");
    expect(intel?.shortSummary).toBe("Cultural heart of Java");
    expect(intel?.knownFor.food.length).toBe(1);
    expect(intel?.knownFor.shopping.length).toBe(2);
    expect(intel?.knownFor.attractions.length).toBe(0);
    expect(intel?.knownFor.transport.length).toBe(1);
  });
});

describe("parseAreaIntelligence · honest nulls", () => {
  it("returns null when provenance is null", () => {
    expect(
      parseAreaIntelligence({
        areaId: "x",
        areaName: "x",
        country: "ID",
        city: "x",
        provenance: null,
      }),
    ).toBeNull();
  });

  it("returns null when provenance has no namespace key", () => {
    expect(
      parseAreaIntelligence({
        areaId: "x",
        areaName: "x",
        country: "ID",
        city: "x",
        provenance: { other_namespace: { known_for: {} } },
      }),
    ).toBeNull();
  });

  it("returns null when short_summary is missing", () => {
    expect(
      parseAreaIntelligence({
        areaId: "x",
        areaName: "x",
        country: "ID",
        city: "x",
        provenance: wrap({ known_for: {} }),
      }),
    ).toBeNull();
  });

  it("returns null when short_summary is empty whitespace", () => {
    expect(
      parseAreaIntelligence({
        areaId: "x",
        areaName: "x",
        country: "ID",
        city: "x",
        provenance: wrap({ short_summary: "   ", known_for: {} }),
      }),
    ).toBeNull();
  });
});

describe("parseAreaIntelligence · claim validation", () => {
  it("drops claims without a source URL", () => {
    const intel = parseAreaIntelligence({
      areaId: "x",
      areaName: "x",
      country: "ID",
      city: "x",
      provenance: wrap({
        short_summary: "test",
        known_for: {
          food: [
            { claim: "no url", accessed_at: "2026-10-12T00:00:00Z" },
            SAMPLE_CLAIM,
          ],
        },
      }),
    });
    expect(intel?.knownFor.food.length).toBe(1);
    expect(intel?.knownFor.food[0].claim).toBe(SAMPLE_CLAIM.claim);
  });

  it("drops claims with non-http(s) source URLs", () => {
    const intel = parseAreaIntelligence({
      areaId: "x",
      areaName: "x",
      country: "ID",
      city: "x",
      provenance: wrap({
        short_summary: "test",
        known_for: {
          food: [
            { claim: "bad url", source_url: "javascript:alert(1)", accessed_at: "2026-10-12T00:00:00Z" },
            { claim: "ftp url", source_url: "ftp://example.com", accessed_at: "2026-10-12T00:00:00Z" },
            SAMPLE_CLAIM,
          ],
        },
      }),
    });
    expect(intel?.knownFor.food.length).toBe(1);
  });

  it("drops claims with empty text", () => {
    const intel = parseAreaIntelligence({
      areaId: "x",
      areaName: "x",
      country: "ID",
      city: "x",
      provenance: wrap({
        short_summary: "test",
        known_for: {
          food: [
            { claim: "   ", source_url: "https://x.com", accessed_at: "2026-10-12T00:00:00Z" },
            SAMPLE_CLAIM,
          ],
        },
      }),
    });
    expect(intel?.knownFor.food.length).toBe(1);
  });

  it("tolerates missing category buckets · they resolve to empty", () => {
    const intel = parseAreaIntelligence({
      areaId: "x",
      areaName: "x",
      country: "ID",
      city: "x",
      provenance: wrap({ short_summary: "test", known_for: { food: [SAMPLE_CLAIM] } }),
    });
    expect(intel?.knownFor.food.length).toBe(1);
    expect(intel?.knownFor.shopping).toEqual([]);
    expect(intel?.knownFor.attractions).toEqual([]);
    expect(intel?.knownFor.transport).toEqual([]);
  });
});

describe("convenience helpers", () => {
  const complete: AreaIntelligence = {
    areaId: "x",
    areaName: "x",
    country: "ID",
    city: "x",
    shortSummary: "test",
    method: "test",
    methodNote: null,
    researchedAt: "2026-10-12T00:00:00Z",
    knownFor: {
      food: [{ claim: "a", sourceUrl: "https://x.com", accessedAt: "x" }],
      shopping: [
        { claim: "a", sourceUrl: "https://x.com", accessedAt: "x" },
        { claim: "b", sourceUrl: "https://x.com", accessedAt: "x" },
      ],
      attractions: [],
      transport: [{ claim: "a", sourceUrl: "https://x.com", accessedAt: "x" }],
    },
  };

  it("totalClaimCount sums across all categories", () => {
    expect(totalClaimCount(complete)).toBe(4);
  });

  it("nonEmptyCategories returns only categories with claims, in canonical order", () => {
    expect(nonEmptyCategories(complete)).toEqual([
      "food",
      "shopping",
      "transport",
    ]);
  });

  it("AREA_INTEL_CATEGORIES contains exactly the four known categories", () => {
    expect(AREA_INTEL_CATEGORIES).toEqual([
      "food",
      "shopping",
      "attractions",
      "transport",
    ]);
  });
});
