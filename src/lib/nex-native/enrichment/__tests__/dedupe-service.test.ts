// src/lib/nex-native/enrichment/__tests__/dedupe-service.test.ts

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildDedupeReport,
  groupExactMatches,
  strongestMemberForReview,
  type DedupeInputRow,
} from "../dedupe-service";

function r(
  id: string,
  name: string,
  city: string | null,
  overrides: Partial<DedupeInputRow> = {},
): DedupeInputRow {
  return {
    canonical_business_id: id,
    name_canonical: name,
    name_norm: name.toLowerCase().replace(/\s+/g, "-"),
    city,
    country: "ID",
    lifecycle_state: "DISCOVERED",
    osm_id: null,
    phone_e164: null,
    website_apex: null,
    ...overrides,
  };
}

describe("groupExactMatches", () => {
  it("ignores singletons", () => {
    const groups = groupExactMatches([
      r("1", "Alpha Cafe", "Jakarta"),
      r("2", "Beta Store", "Jakarta"),
    ]);
    expect(groups).toHaveLength(0);
  });

  it("groups rows with the same (name_norm, city, country)", () => {
    const rows = [
      r("1", "Alpha Cafe", "Jakarta"),
      r("2", "Alpha Cafe", "Jakarta"),
      r("3", "Alpha Cafe", "Bandung"),
      r("4", "Beta Store", "Jakarta"),
    ];
    const groups = groupExactMatches(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.members).toHaveLength(2);
  });

  it("elevates confidence when all members share the same phone", () => {
    const rows = [
      r("1", "Gamma", "Jakarta", { phone_e164: "+62211234" }),
      r("2", "Gamma", "Jakarta", { phone_e164: "+62211234" }),
    ];
    const groups = groupExactMatches(rows);
    expect(groups[0]!.confidence).toBe(0.8);
    expect(groups[0]!.reason).toBe("same_name_same_city_same_phone");
  });

  it("elevates confidence (lower than phone) when all share website", () => {
    const rows = [
      r("1", "Delta", "Jakarta", { website_apex: "delta.co.id" }),
      r("2", "Delta", "Jakarta", { website_apex: "delta.co.id" }),
    ];
    const groups = groupExactMatches(rows);
    expect(groups[0]!.confidence).toBe(0.6);
    expect(groups[0]!.reason).toBe("same_name_same_city_same_website");
  });

  it("defaults to 0.4 confidence with name+city only", () => {
    const rows = [
      r("1", "Epsilon", "Jakarta"),
      r("2", "Epsilon", "Jakarta"),
    ];
    const groups = groupExactMatches(rows);
    expect(groups[0]!.confidence).toBe(0.4);
    expect(groups[0]!.reason).toBe("same_name_same_city");
  });

  it("sorts group members by canonical_business_id for review determinism", () => {
    const rows = [
      r("zzz", "Zeta", "Jakarta"),
      r("aaa", "Zeta", "Jakarta"),
      r("mmm", "Zeta", "Jakarta"),
    ];
    const groups = groupExactMatches(rows);
    expect(groups[0]!.members.map((m) => m.canonical_business_id)).toEqual([
      "aaa",
      "mmm",
      "zzz",
    ]);
  });

  it("NEVER merges · members are preserved", () => {
    const rows = [
      r("1", "Omega", "Jakarta"),
      r("2", "Omega", "Jakarta"),
    ];
    const groups = groupExactMatches(rows);
    expect(groups[0]!.members).toHaveLength(2);
    // No winner picked · reviewer decides.
    expect(groups[0]).not.toHaveProperty("mergeTo");
    expect(groups[0]).not.toHaveProperty("winner");
  });
});

describe("strongestMemberForReview", () => {
  it("prefers OWNER_VERIFIED over VERIFIED over DISCOVERED · never merges", () => {
    const g = {
      key: { name_norm: "x", city: "j", country: "ID" },
      members: [
        r("1", "X", "J", { lifecycle_state: "DISCOVERED" }),
        r("2", "X", "J", { lifecycle_state: "VERIFIED" }),
        r("3", "X", "J", { lifecycle_state: "OWNER_VERIFIED" }),
      ],
      reason: "same_name_same_city" as const,
      confidence: 0.4 as const,
    };
    expect(strongestMemberForReview(g).canonical_business_id).toBe("3");
  });

  it("breaks ties by contact density", () => {
    const g = {
      key: { name_norm: "y", city: "j", country: "ID" },
      members: [
        r("1", "Y", "J", { lifecycle_state: "VERIFIED" }),
        r("2", "Y", "J", {
          lifecycle_state: "VERIFIED",
          phone_e164: "+62",
          website_apex: "y.co",
        }),
      ],
      reason: "same_name_same_city" as const,
      confidence: 0.4 as const,
    };
    expect(strongestMemberForReview(g).canonical_business_id).toBe("2");
  });
});

describe("buildDedupeReport", () => {
  it("counts totals correctly", () => {
    const rows = [
      r("1", "A", "J"),
      r("2", "A", "J"),
      r("3", "B", "J"),
    ];
    const report = buildDedupeReport(rows);
    expect(report.totalInspected).toBe(3);
    expect(report.groupsFound).toBe(1);
    expect(report.rowsInGroups).toBe(2);
  });
});
