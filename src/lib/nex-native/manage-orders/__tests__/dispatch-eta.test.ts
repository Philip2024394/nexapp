// src/lib/nex-native/manage-orders/__tests__/dispatch-eta.test.ts
//
// Deterministic unit tests for calendar-month boundary + ETA. These prove
// the helper is correct without needing a real sandbox or waiting months.
// Vitest.

import { describe, expect, it } from "vitest";
import {
  addDaysUTC,
  addMonthsUTC,
  computeDispatchEta,
  computeIllustrativeProgress,
} from "../dispatch-eta";

const utc = (iso: string) => new Date(iso);

describe("addMonthsUTC · clamp-to-month-end", () => {
  it("Jan 31 + 1 month → Feb 28 in non-leap year", () => {
    const r = addMonthsUTC(utc("2026-01-31T12:00:00Z"), 1);
    expect(r.toISOString()).toBe("2026-02-28T12:00:00.000Z");
  });

  it("Jan 31 + 1 month → Feb 29 in leap year 2024", () => {
    const r = addMonthsUTC(utc("2024-01-31T00:00:00Z"), 1);
    expect(r.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("May 31 + 3 months → Aug 31 (preserves original day)", () => {
    const r = addMonthsUTC(utc("2026-05-31T00:00:00Z"), 3);
    expect(r.toISOString()).toBe("2026-08-31T00:00:00.000Z");
  });

  it("Aug 31 + 1 month → Sep 30", () => {
    const r = addMonthsUTC(utc("2026-08-31T00:00:00Z"), 1);
    expect(r.toISOString()).toBe("2026-09-30T00:00:00.000Z");
  });

  it("Dec 15 + 1 month → Jan 15 next year", () => {
    const r = addMonthsUTC(utc("2026-12-15T00:00:00Z"), 1);
    expect(r.toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });

  it("Jan 15 + 12 months → Jan 15 next year (full year roll)", () => {
    const r = addMonthsUTC(utc("2026-01-15T00:00:00Z"), 12);
    expect(r.toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });
});

describe("addDaysUTC", () => {
  it("7 days later", () => {
    const r = addDaysUTC(utc("2026-11-17T00:00:00Z"), 7);
    expect(r.toISOString()).toBe("2026-11-24T00:00:00.000Z");
  });

  it("DST-neutral · UTC never shifts", () => {
    // Spring-forward would be 2026-03-29 for UK. UTC must not shift.
    const r = addDaysUTC(utc("2026-03-27T00:00:00Z"), 5);
    expect(r.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });
});

describe("computeDispatchEta", () => {
  it("returns null ETA when dispatched_at is null (before dispatch)", () => {
    const r = computeDispatchEta({
      dispatched_at: null,
      estimated_transit_qty: 7,
      estimated_transit_unit: "days",
    });
    expect(r.can_compute_absolute_eta).toBe(false);
    expect(r.estimated_arrival_at).toBeNull();
    expect(r.has_transit_duration).toBe(true);
    expect(r.transit_duration_label).toBe("7 days");
  });

  it("returns absolute ETA after dispatch for days unit", () => {
    const r = computeDispatchEta({
      dispatched_at: utc("2026-11-17T00:00:00Z"),
      estimated_transit_qty: 7,
      estimated_transit_unit: "days",
    });
    expect(r.estimated_arrival_at?.toISOString()).toBe("2026-11-24T00:00:00.000Z");
    expect(r.can_compute_absolute_eta).toBe(true);
  });

  it("returns absolute ETA for sea freight · 2 months", () => {
    const r = computeDispatchEta({
      dispatched_at: utc("2026-01-31T00:00:00Z"),
      estimated_transit_qty: 2,
      estimated_transit_unit: "months",
    });
    expect(r.estimated_arrival_at?.toISOString()).toBe("2026-03-31T00:00:00.000Z");
    expect(r.transit_duration_label).toBe("2 months");
  });

  it("rejects 0 and negative qty", () => {
    const r0 = computeDispatchEta({
      dispatched_at: utc("2026-01-01T00:00:00Z"),
      estimated_transit_qty: 0,
      estimated_transit_unit: "days",
    });
    expect(r0.has_transit_duration).toBe(false);
    const rNeg = computeDispatchEta({
      dispatched_at: utc("2026-01-01T00:00:00Z"),
      estimated_transit_qty: -1,
      estimated_transit_unit: "days",
    });
    expect(rNeg.has_transit_duration).toBe(false);
  });

  it("rejects qty without unit (paired-required)", () => {
    const r = computeDispatchEta({
      dispatched_at: utc("2026-01-01T00:00:00Z"),
      estimated_transit_qty: 5,
      estimated_transit_unit: null,
    });
    expect(r.has_transit_duration).toBe(false);
    expect(r.can_compute_absolute_eta).toBe(false);
  });

  it("ETA depends on dispatched_at, NOT on 'now'", () => {
    const r1 = computeDispatchEta({
      dispatched_at: utc("2026-11-17T00:00:00Z"),
      estimated_transit_qty: 10,
      estimated_transit_unit: "days",
    });
    // Compute again · result must be identical (idempotent on same inputs)
    const r2 = computeDispatchEta({
      dispatched_at: utc("2026-11-17T00:00:00Z"),
      estimated_transit_qty: 10,
      estimated_transit_unit: "days",
    });
    expect(r1.estimated_arrival_at?.toISOString()).toBe(
      r2.estimated_arrival_at?.toISOString(),
    );
  });
});

describe("computeIllustrativeProgress", () => {
  const dispatched = utc("2026-11-17T00:00:00Z");
  const input = {
    dispatched_at: dispatched,
    estimated_transit_qty: 10 as number | null,
    estimated_transit_unit: "days" as const,
  };

  it("0 at the moment of dispatch", () => {
    const p = computeIllustrativeProgress(input, dispatched);
    expect(p).toBe(0);
  });

  it("~0.5 at midpoint", () => {
    const p = computeIllustrativeProgress(input, utc("2026-11-22T00:00:00Z"));
    expect(p).toBeCloseTo(0.5, 5);
  });

  it("CAPPED at 0.95 · never 1.0 from elapsed time alone", () => {
    const p = computeIllustrativeProgress(input, utc("2026-12-30T00:00:00Z"));
    expect(p).toBe(0.95);
  });

  it("0 before dispatch (dispatched_at === null)", () => {
    const p = computeIllustrativeProgress(
      { ...input, dispatched_at: null },
      utc("2026-11-22T00:00:00Z"),
    );
    expect(p).toBe(0);
  });
});
