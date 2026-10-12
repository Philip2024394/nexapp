// src/lib/nex-native/user-location/__tests__/types.test.ts
//
// Pure-type tests for the hybrid user-location system. No DB, no clock
// (callers always pass `now`), no randomness.

import { describe, it, expect } from "vitest";
import {
  parseSavedLocation,
  isLocationFresh,
  isUsableLocation,
  makeGpsLocation,
  makeManualCityLocation,
  USER_LOCATION_TTL_DAYS,
} from "../types";

const FIXED_NOW = new Date("2026-10-12T12:00:00Z");
const FRESH_SET_AT = "2026-10-10T12:00:00Z"; // 2 days before FIXED_NOW
const STALE_SET_AT = "2026-09-10T12:00:00Z"; // 32 days before (past TTL)
const FUTURE_SET_AT = "2026-11-01T12:00:00Z"; // 20 days after (suspicious)

describe("parseSavedLocation · shape validation", () => {
  it("accepts a valid GPS location", () => {
    const parsed = parseSavedLocation({
      lat: -8.65,
      lng: 115.22,
      cityLabel: null,
      countryIso: "ID",
      source: "gps",
      setAt: FRESH_SET_AT,
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.source).toBe("gps");
    expect(parsed?.lat).toBe(-8.65);
  });

  it("accepts a valid manual_city location", () => {
    const parsed = parseSavedLocation({
      lat: -7.80,
      lng: 110.37,
      cityLabel: "Yogyakarta, Indonesia",
      countryIso: "ID",
      source: "manual_city",
      setAt: FRESH_SET_AT,
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.cityLabel).toBe("Yogyakarta, Indonesia");
  });

  it("rejects out-of-range latitude", () => {
    const parsed = parseSavedLocation({
      lat: 91,
      lng: 0,
      cityLabel: null,
      countryIso: null,
      source: "gps",
      setAt: FRESH_SET_AT,
    });
    expect(parsed).toBeNull();
  });

  it("rejects out-of-range longitude", () => {
    const parsed = parseSavedLocation({
      lat: 0,
      lng: -181,
      cityLabel: null,
      countryIso: null,
      source: "gps",
      setAt: FRESH_SET_AT,
    });
    expect(parsed).toBeNull();
  });

  it("rejects NaN latitude", () => {
    const parsed = parseSavedLocation({
      lat: Number.NaN,
      lng: 0,
      cityLabel: null,
      countryIso: null,
      source: "gps",
      setAt: FRESH_SET_AT,
    });
    expect(parsed).toBeNull();
  });

  it("rejects unknown source enum", () => {
    const parsed = parseSavedLocation({
      lat: 0,
      lng: 0,
      cityLabel: null,
      countryIso: null,
      source: "ip_lookup",
      setAt: FRESH_SET_AT,
    });
    expect(parsed).toBeNull();
  });

  it("rejects malformed setAt", () => {
    const parsed = parseSavedLocation({
      lat: 0,
      lng: 0,
      cityLabel: null,
      countryIso: null,
      source: "gps",
      setAt: "yesterday",
    });
    expect(parsed).toBeNull();
  });

  it("requires manual_city to have a cityLabel", () => {
    const parsed = parseSavedLocation({
      lat: 0,
      lng: 0,
      cityLabel: null,
      countryIso: null,
      source: "manual_city",
      setAt: FRESH_SET_AT,
    });
    expect(parsed).toBeNull();
  });

  it("accepts gps without a cityLabel (browser doesn't give one)", () => {
    const parsed = parseSavedLocation({
      lat: 0,
      lng: 0,
      cityLabel: null,
      countryIso: null,
      source: "gps",
      setAt: FRESH_SET_AT,
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.cityLabel).toBeNull();
  });

  it("rejects an ill-shaped countryIso (lowercase, 3-letter, etc.)", () => {
    for (const bad of ["id", "idn", "ID1", "I", "", "123"]) {
      const parsed = parseSavedLocation({
        lat: 0,
        lng: 0,
        cityLabel: "City",
        countryIso: bad,
        source: "manual_city",
        setAt: FRESH_SET_AT,
      });
      expect(parsed?.countryIso).toBeNull();
    }
  });

  it("rejects non-object input", () => {
    expect(parseSavedLocation(null)).toBeNull();
    expect(parseSavedLocation(undefined)).toBeNull();
    expect(parseSavedLocation("string")).toBeNull();
    expect(parseSavedLocation(42)).toBeNull();
    expect(parseSavedLocation([])).toBeNull();
  });

  it("truncates oversized cityLabel to 120 chars", () => {
    const long = "A".repeat(200);
    const parsed = parseSavedLocation({
      lat: 0,
      lng: 0,
      cityLabel: long,
      countryIso: null,
      source: "manual_city",
      setAt: FRESH_SET_AT,
    });
    expect(parsed?.cityLabel?.length).toBe(120);
  });
});

describe("isLocationFresh · TTL window", () => {
  it("is true for a fresh value", () => {
    const loc = parseSavedLocation({
      lat: 0,
      lng: 0,
      cityLabel: null,
      countryIso: null,
      source: "gps",
      setAt: FRESH_SET_AT,
    });
    expect(loc).not.toBeNull();
    if (loc) expect(isLocationFresh(loc, FIXED_NOW)).toBe(true);
  });

  it("is false past the 30-day TTL", () => {
    const loc = parseSavedLocation({
      lat: 0,
      lng: 0,
      cityLabel: null,
      countryIso: null,
      source: "gps",
      setAt: STALE_SET_AT,
    });
    expect(loc).not.toBeNull();
    if (loc) expect(isLocationFresh(loc, FIXED_NOW)).toBe(false);
  });

  it("is false for a future-dated setAt (defensive)", () => {
    const loc = parseSavedLocation({
      lat: 0,
      lng: 0,
      cityLabel: null,
      countryIso: null,
      source: "gps",
      setAt: FUTURE_SET_AT,
    });
    expect(loc).not.toBeNull();
    if (loc) expect(isLocationFresh(loc, FIXED_NOW)).toBe(false);
  });

  it("TTL constant is 30 days", () => {
    expect(USER_LOCATION_TTL_DAYS).toBe(30);
  });
});

describe("isUsableLocation · combined predicate", () => {
  it("is true for parseable + fresh", () => {
    expect(
      isUsableLocation(
        {
          lat: 0,
          lng: 0,
          cityLabel: null,
          countryIso: null,
          source: "gps",
          setAt: FRESH_SET_AT,
        },
        FIXED_NOW,
      ),
    ).toBe(true);
  });

  it("is false for parseable but stale", () => {
    expect(
      isUsableLocation(
        {
          lat: 0,
          lng: 0,
          cityLabel: null,
          countryIso: null,
          source: "gps",
          setAt: STALE_SET_AT,
        },
        FIXED_NOW,
      ),
    ).toBe(false);
  });

  it("is false for malformed input", () => {
    expect(isUsableLocation({ lat: "zero" }, FIXED_NOW)).toBe(false);
    expect(isUsableLocation(null, FIXED_NOW)).toBe(false);
  });
});

describe("makeGpsLocation · constructor", () => {
  it("builds a valid GPS SavedLocation", () => {
    const loc = makeGpsLocation(-8.65, 115.22, FIXED_NOW);
    expect(loc).not.toBeNull();
    expect(loc?.source).toBe("gps");
    expect(loc?.cityLabel).toBeNull();
    expect(loc?.setAt).toBe(FIXED_NOW.toISOString());
  });

  it("rejects out-of-range coords", () => {
    expect(makeGpsLocation(91, 0, FIXED_NOW)).toBeNull();
    expect(makeGpsLocation(0, 181, FIXED_NOW)).toBeNull();
  });
});

describe("makeManualCityLocation · constructor", () => {
  it("builds a valid manual_city SavedLocation", () => {
    const loc = makeManualCityLocation({
      lat: -7.8,
      lng: 110.37,
      cityLabel: "Yogyakarta",
      countryIso: "ID",
      now: FIXED_NOW,
    });
    expect(loc).not.toBeNull();
    expect(loc?.source).toBe("manual_city");
    expect(loc?.cityLabel).toBe("Yogyakarta");
    expect(loc?.countryIso).toBe("ID");
  });

  it("rejects empty cityLabel", () => {
    const loc = makeManualCityLocation({
      lat: 0,
      lng: 0,
      cityLabel: "   ",
      countryIso: null,
      now: FIXED_NOW,
    });
    expect(loc).toBeNull();
  });
});
