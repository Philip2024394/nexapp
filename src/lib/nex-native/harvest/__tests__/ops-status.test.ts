// src/lib/nex-native/harvest/__tests__/ops-status.test.ts
//
// Covers all seven HarvestOpsStatus states explicitly + the honest
// edge cases from the brief: secret safety, malformed timestamps,
// unknown ended_kind, stale thresholds.

import { describe, it, expect } from "vitest";
import {
  resolveHarvestOpsStatus,
  cityIdFromTriggeredBy,
  formatAgeShort,
  type HarvestOpsSnapshot,
  type HarvestTickCycle,
} from "../ops-status";

// Fixed "now" so tests are deterministic.
const NOW_MS = Date.UTC(2026, 9, 13, 12, 0, 0); // 2026-10-13 12:00:00 UTC

function baseSnapshot(
  overrides: Partial<HarvestOpsSnapshot> = {},
): HarvestOpsSnapshot {
  return {
    cronSecretPresent: true,
    customSecretPresent: false,
    programmeCountryCount: 17,
    programmeCountryIsos: ["GB", "US", "AU", "DE"],
    latestTickCycle: null,
    latestSuccessfulTickCycle: null,
    recentTickCycles: [],
    totalTickCycles: 0,
    latestCycleVerifiedCount: null,
    nowMs: NOW_MS,
    expectedScheduleIntervalMinutes: 60,
    maxExpectedRuntimeMinutes: 5,
    ...overrides,
  };
}

function makeCycle(
  overrides: Partial<HarvestTickCycle> = {},
): HarvestTickCycle {
  const started = new Date(NOW_MS - 10 * 60 * 1000).toISOString();
  const ended = new Date(NOW_MS - 9 * 60 * 1000).toISOString();
  return {
    cycleId: "11111111-1111-1111-1111-111111111111",
    startedAt: started,
    endedAt: ended,
    endedKind: "completed",
    candidatesAdded: 42,
    evidenceAdded: 0,
    triggeredBy: "nexapp-harvester-tick:id-jakarta",
    cityId: "id-jakarta",
    sourcesAttempted: ["osm_overpass"],
    sourcesSucceeded: ["osm_overpass"],
    sourcesCooledDown: [],
    durationMs: 60_000,
    ...overrides,
  };
}

// ── 1. not_configured ───────────────────────────────────────────────

describe("not_configured", () => {
  it("fires when neither secret env var is present", () => {
    const result = resolveHarvestOpsStatus(
      baseSnapshot({ cronSecretPresent: false, customSecretPresent: false }),
    );
    expect(result.status).toBe("not_configured");
    expect(result.reason).toContain("CRON_SECRET");
    expect(result.actionHint).toContain("Vercel");
  });

  it("fires when programme has 0 countries, even if secrets are present", () => {
    const result = resolveHarvestOpsStatus(
      baseSnapshot({ programmeCountryCount: 0, programmeCountryIsos: [] }),
    );
    expect(result.status).toBe("not_configured");
    expect(result.reason).toContain("countries");
    expect(result.actionHint).toContain("migration 187");
  });

  it("accepts either secret alone (CRON_SECRET)", () => {
    const result = resolveHarvestOpsStatus(
      baseSnapshot({ cronSecretPresent: true, customSecretPresent: false }),
    );
    expect(result.status).not.toBe("not_configured");
  });

  it("accepts either secret alone (NEX_HARVEST_CRON_SECRET)", () => {
    const result = resolveHarvestOpsStatus(
      baseSnapshot({ cronSecretPresent: false, customSecretPresent: true }),
    );
    expect(result.status).not.toBe("not_configured");
  });
});

// ── 2. waiting_for_run ──────────────────────────────────────────────

describe("waiting_for_run", () => {
  it("fires when configured but no tick cycles exist", () => {
    const result = resolveHarvestOpsStatus(
      baseSnapshot({ latestTickCycle: null, totalTickCycles: 0 }),
    );
    expect(result.status).toBe("waiting_for_run");
    expect(result.reason).toContain("No harvester-tick cycle rows");
  });
});

// ── 3. running ──────────────────────────────────────────────────────

describe("running", () => {
  it("fires when latest cycle has no end-time and is recent", () => {
    const twoMinutesAgo = new Date(NOW_MS - 2 * 60 * 1000).toISOString();
    const result = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: makeCycle({
          startedAt: twoMinutesAgo,
          endedAt: null,
          endedKind: null,
        }),
        totalTickCycles: 1,
      }),
    );
    expect(result.status).toBe("running");
    expect(result.reason).toMatch(/started .+ ago/);
  });

  it("becomes failed when the open run has exceeded the max runtime window", () => {
    const tenMinutesAgo = new Date(NOW_MS - 10 * 60 * 1000).toISOString();
    const result = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: makeCycle({
          startedAt: tenMinutesAgo,
          endedAt: null,
          endedKind: null,
        }),
        totalTickCycles: 1,
      }),
    );
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("never recorded an end-time");
  });

  it("stays failed when started_at is malformed", () => {
    const result = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: makeCycle({
          startedAt: "not-a-timestamp",
          endedAt: null,
          endedKind: null,
        }),
        totalTickCycles: 1,
      }),
    );
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("malformed");
  });
});

// ── 4. failed ───────────────────────────────────────────────────────

describe("failed", () => {
  it("fires when latest ended_kind='failed'", () => {
    const result = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: makeCycle({ endedKind: "failed" }),
        totalTickCycles: 1,
      }),
    );
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("ended_kind='failed'");
  });

  it("fires when latest ended_kind='aborted'", () => {
    const result = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: makeCycle({ endedKind: "aborted" }),
        totalTickCycles: 1,
      }),
    );
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("ended_kind='aborted'");
  });

  it("fires when ended_kind is some unknown string", () => {
    const result = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: makeCycle({ endedKind: "weird_state" }),
        totalTickCycles: 1,
      }),
    );
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("unrecognised ended_kind");
  });

  it("fires when ended_kind is null even after an end-time was recorded", () => {
    const result = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: makeCycle({ endedKind: null }),
        totalTickCycles: 1,
      }),
    );
    expect(result.status).toBe("failed");
  });
});

// ── 5. partial ──────────────────────────────────────────────────────

describe("partial", () => {
  it("fires when a completed run has cooled_down signals", () => {
    const result = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: makeCycle({
          endedKind: "completed",
          sourcesCooledDown: ["canonical_writer"],
        }),
        totalTickCycles: 1,
      }),
    );
    expect(result.status).toBe("partial");
    expect(result.reason).toContain("canonical_writer");
    expect(result.actionHint).toContain("canonical_writer");
  });

  it("fires when overpass cooled down (even on completed)", () => {
    const result = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: makeCycle({
          endedKind: "completed",
          sourcesCooledDown: ["osm_overpass"],
          sourcesSucceeded: [],
        }),
        totalTickCycles: 1,
      }),
    );
    expect(result.status).toBe("partial");
  });

  it("does not fire when sourcesCooledDown is empty on completed", () => {
    const latest = makeCycle({
      endedKind: "completed",
      sourcesCooledDown: [],
    });
    const result = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: latest,
        latestSuccessfulTickCycle: latest,
        totalTickCycles: 1,
      }),
    );
    expect(result.status).toBe("succeeded");
  });
});

// ── 6. stale ────────────────────────────────────────────────────────

describe("stale", () => {
  it("fires when the last successful run is older than 2x the schedule", () => {
    // Last successful 150 minutes ago · schedule 60 min · 2x threshold = 120.
    const oldSuccess = makeCycle({
      startedAt: new Date(NOW_MS - 155 * 60 * 1000).toISOString(),
      endedAt: new Date(NOW_MS - 150 * 60 * 1000).toISOString(),
      endedKind: "completed",
      cityId: "id-bandung",
    });
    const result = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: oldSuccess,
        latestSuccessfulTickCycle: oldSuccess,
        totalTickCycles: 1,
      }),
    );
    expect(result.status).toBe("stale");
    expect(result.reason).toContain("Last successful run");
  });

  it("does NOT fire when last successful is within the schedule window", () => {
    const recentSuccess = makeCycle({
      startedAt: new Date(NOW_MS - 70 * 60 * 1000).toISOString(),
      endedAt: new Date(NOW_MS - 65 * 60 * 1000).toISOString(),
      endedKind: "completed",
    });
    const result = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: recentSuccess,
        latestSuccessfulTickCycle: recentSuccess,
        totalTickCycles: 1,
      }),
    );
    expect(result.status).toBe("succeeded");
  });
});

// ── 7. succeeded ────────────────────────────────────────────────────

describe("succeeded", () => {
  it("fires on a recent completed run with no cooled sources", () => {
    const latest = makeCycle({ endedKind: "completed" });
    const result = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: latest,
        latestSuccessfulTickCycle: latest,
        totalTickCycles: 1,
      }),
    );
    expect(result.status).toBe("succeeded");
    expect(result.reason).toMatch(/completed with \d+ candidate/);
  });
});

// ── Secret safety ───────────────────────────────────────────────────

describe("secret safety", () => {
  it("evidence pack carries only presence boolean, never a value", () => {
    const result = resolveHarvestOpsStatus(baseSnapshot());
    // Type-level: evidence.cronSecretPresent is a boolean (verified
    // at compile time). Runtime double-check that no secret-looking
    // literal escaped into the result · a cronSecretPresent key is
    // allowed; a "cron_secret_value" string is not.
    const serialised = JSON.stringify(result);
    expect(serialised).not.toMatch(/secret[-_]?value/i);
    expect(serialised).not.toMatch(/"[^"]*CRON_SECRET[^"]*"/);
    expect(serialised).not.toMatch(/"[^"]*NEX_HARVEST_CRON_SECRET[^"]*"/);
    // The literal boolean key is allowed; its typed value is boolean.
    expect(typeof result.evidence.cronSecretPresent).toBe("boolean");
  });

  it("resolver never reads process.env or Date.now · pure", () => {
    const first = resolveHarvestOpsStatus(baseSnapshot());
    const second = resolveHarvestOpsStatus(baseSnapshot());
    expect(JSON.stringify(first)).toEqual(JSON.stringify(second));
  });
});

// ── Helper utilities ────────────────────────────────────────────────

// ── Run-to-record verification (claimed vs verified) ────────────────

describe("run-to-record verification", () => {
  it("counts match when claimed and verified are both the same number", () => {
    const latest = makeCycle({ candidatesAdded: 15 });
    const r = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: latest,
        latestSuccessfulTickCycle: latest,
        latestCycleVerifiedCount: 15,
        totalTickCycles: 1,
      }),
    );
    expect(r.evidence.latestCycleClaimedCount).toBe(15);
    expect(r.evidence.latestCycleVerifiedCount).toBe(15);
    expect(r.evidence.latestCycleCountsMatch).toBe(true);
  });

  it("counts flagged mismatch when the writer claimed more than the canonical count", () => {
    const latest = makeCycle({ candidatesAdded: 20 });
    const r = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: latest,
        latestSuccessfulTickCycle: latest,
        latestCycleVerifiedCount: 15,
        totalTickCycles: 1,
      }),
    );
    expect(r.evidence.latestCycleCountsMatch).toBe(false);
  });

  it("countsMatch is null when verification is not available", () => {
    const latest = makeCycle({ candidatesAdded: 10 });
    const r = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: latest,
        latestSuccessfulTickCycle: latest,
        latestCycleVerifiedCount: null,
        totalTickCycles: 1,
      }),
    );
    expect(r.evidence.latestCycleCountsMatch).toBeNull();
  });

  it("countsMatch is null when the writer did not report a count", () => {
    const latest = makeCycle({ candidatesAdded: null });
    const r = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: latest,
        latestSuccessfulTickCycle: latest,
        latestCycleVerifiedCount: 10,
        totalTickCycles: 1,
      }),
    );
    expect(r.evidence.latestCycleCountsMatch).toBeNull();
  });

  it("status stays 'succeeded' even when counts mismatch · mismatch is diagnostic only", () => {
    const latest = makeCycle({ candidatesAdded: 20 });
    const r = resolveHarvestOpsStatus(
      baseSnapshot({
        latestTickCycle: latest,
        latestSuccessfulTickCycle: latest,
        latestCycleVerifiedCount: 15,
        totalTickCycles: 1,
      }),
    );
    expect(r.status).toBe("succeeded");
    // The mismatch doesn't flip the overall status · it's a flag on
    // the evidence pack that the dashboard surfaces separately.
  });
});

describe("cityIdFromTriggeredBy", () => {
  it("extracts the city id from the canonical format", () => {
    expect(cityIdFromTriggeredBy("nexapp-harvester-tick:id-jakarta")).toBe(
      "id-jakarta",
    );
    expect(cityIdFromTriggeredBy("nexapp-harvester-tick:gb-london")).toBe(
      "gb-london",
    );
  });

  it("returns null for anything that doesn't follow the convention", () => {
    expect(cityIdFromTriggeredBy("manual-trigger")).toBeNull();
    expect(cityIdFromTriggeredBy("")).toBeNull();
    expect(cityIdFromTriggeredBy(null)).toBeNull();
  });
});

describe("formatAgeShort", () => {
  it("formats seconds, minutes, hours, days", () => {
    expect(formatAgeShort(3_000)).toBe("3s");
    expect(formatAgeShort(90_000)).toBe("1m 30s");
    expect(formatAgeShort(2 * 3_600_000 + 15 * 60_000)).toBe("2h 15m");
    expect(formatAgeShort(3 * 86_400_000)).toBe("3d 0h");
  });

  it("returns 'unknown' for negative or non-finite", () => {
    expect(formatAgeShort(-1)).toBe("unknown");
    expect(formatAgeShort(Number.POSITIVE_INFINITY)).toBe("unknown");
    expect(formatAgeShort(Number.NaN)).toBe("unknown");
  });
});
