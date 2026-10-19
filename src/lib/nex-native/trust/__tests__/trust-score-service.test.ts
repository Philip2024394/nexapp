// src/lib/nex-native/trust/__tests__/trust-score-service.test.ts
//
// Unit tests for the pure Trust Score function. Covers each tier
// band + each reason token + the sealed clamp.

import { describe, it, expect } from "vitest";
import {
  computeTrustScore,
  type TrustScoreInput,
} from "../trust-score-shared";

const EMPTY: TrustScoreInput = {
  isClaimed: false,
  claimedSinceDays: null,
  distinctSourceCount: 0,
  freshestObservationDays: null,
  hasOwnerUploadSource: false,
};

describe("computeTrustScore · unknown band", () => {
  it("returns tier=unknown with score=0 when there is no evidence and no claim", () => {
    const r = computeTrustScore(EMPTY);
    expect(r.tier).toBe("unknown");
    expect(r.score).toBe(0);
    expect(r.reasons).toContain("no_evidence");
  });
});

describe("computeTrustScore · low band · 1..39", () => {
  it("claimed only · no evidence · scores 30, tier=low", () => {
    const r = computeTrustScore({ ...EMPTY, isClaimed: true });
    expect(r.score).toBe(30);
    expect(r.tier).toBe("low");
    expect(r.reasons).toContain("owner_claimed");
  });

  it("1 source · stale (>365d) · no claim · scores 10, tier=low", () => {
    const r = computeTrustScore({
      ...EMPTY,
      distinctSourceCount: 1,
      freshestObservationDays: 400,
    });
    expect(r.score).toBe(10);
    expect(r.tier).toBe("low");
    expect(r.reasons).toContain("sources_1");
    expect(r.reasons).toContain("stale");
  });
});

describe("computeTrustScore · medium band · 40..69", () => {
  it("claimed + 1 source + fresh · scores 50, tier=medium", () => {
    const r = computeTrustScore({
      ...EMPTY,
      isClaimed: true,
      distinctSourceCount: 1,
      freshestObservationDays: 20,
    });
    expect(r.score).toBe(50);
    expect(r.tier).toBe("medium");
    expect(r.reasons).toEqual(
      expect.arrayContaining(["owner_claimed", "sources_1", "fresh"]),
    );
  });

  it("2 sources + fresh · no claim · scores 30, tier=low (sits below medium band)", () => {
    const r = computeTrustScore({
      ...EMPTY,
      distinctSourceCount: 2,
      freshestObservationDays: 40,
    });
    expect(r.score).toBe(30);
    expect(r.tier).toBe("low");
    expect(r.reasons).toContain("sources_2");
  });

  it("claimed + 2 sources + aging · scores 55, tier=medium", () => {
    const r = computeTrustScore({
      ...EMPTY,
      isClaimed: true,
      distinctSourceCount: 2,
      freshestObservationDays: 200,
    });
    expect(r.score).toBe(55);
    expect(r.tier).toBe("medium");
    expect(r.reasons).toContain("aging");
  });
});

describe("computeTrustScore · high band · 70..100", () => {
  it("owner-verified + claimed + 2 sources + fresh · scores 90, tier=high", () => {
    const r = computeTrustScore({
      ...EMPTY,
      isClaimed: true,
      hasOwnerUploadSource: true,
      distinctSourceCount: 2,
      freshestObservationDays: 11,
    });
    expect(r.score).toBe(80);
    expect(r.tier).toBe("high");
    expect(r.reasons).toEqual(
      expect.arrayContaining([
        "owner_claimed",
        "owner_verified",
        "sources_2",
        "fresh",
      ]),
    );
  });

  it("owner-verified + claimed + 3+ sources + fresh · scores 100, tier=high", () => {
    const r = computeTrustScore({
      ...EMPTY,
      isClaimed: true,
      hasOwnerUploadSource: true,
      distinctSourceCount: 3,
      freshestObservationDays: 5,
    });
    expect(r.score).toBe(90);
    expect(r.tier).toBe("high");
    expect(r.reasons).toContain("sources_3_plus");
  });

  it("source count beyond 4 is capped at 4 (score=90)", () => {
    const r = computeTrustScore({
      ...EMPTY,
      isClaimed: true,
      hasOwnerUploadSource: true,
      distinctSourceCount: 99,
      freshestObservationDays: 5,
    });
    expect(r.score).toBe(100);
    expect(r.tier).toBe("high");
  });
});

describe("computeTrustScore · freshness thresholds mirror migration 172", () => {
  it("<90d is fresh (+10)", () => {
    const r = computeTrustScore({ ...EMPTY, distinctSourceCount: 1, freshestObservationDays: 89 });
    expect(r.reasons).toContain("fresh");
    expect(r.score).toBe(20); // sources_1=10 + fresh=10
  });

  it("90..364d is aging (+5)", () => {
    const r = computeTrustScore({ ...EMPTY, distinctSourceCount: 1, freshestObservationDays: 90 });
    expect(r.reasons).toContain("aging");
    expect(r.score).toBe(15);
  });

  it("365+d is stale (+0)", () => {
    const r = computeTrustScore({ ...EMPTY, distinctSourceCount: 1, freshestObservationDays: 365 });
    expect(r.reasons).toContain("stale");
    expect(r.score).toBe(10);
  });
});

describe("computeTrustScore · reasons preserve input for the UI", () => {
  it("returns the input unchanged in `inputs`", () => {
    const input: TrustScoreInput = {
      isClaimed: true,
      claimedSinceDays: 5,
      distinctSourceCount: 2,
      freshestObservationDays: 10,
      hasOwnerUploadSource: false,
    };
    const r = computeTrustScore(input);
    expect(r.inputs).toEqual(input);
  });
});
