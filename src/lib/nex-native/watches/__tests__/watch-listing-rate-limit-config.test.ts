import { describe, it, expect } from "vitest";
import {
  WATCH_LISTING_RATE_LIMITS,
  floorToWindowStart,
  windowStartIso,
  isCountOverLimit,
} from "../watch-listing-rate-limit-config";

describe("WATCH_LISTING_RATE_LIMITS", () => {
  it("pins create_draft to 10 per hour", () => {
    expect(WATCH_LISTING_RATE_LIMITS.create_draft).toEqual({
      windowMinutes: 60,
      maxPerWindow: 10,
    });
  });
});

describe("floorToWindowStart", () => {
  it("floors to the enclosing window boundary", () => {
    const base = Date.UTC(2026, 9, 26, 12, 0, 0); // 12:00:00 UTC
    const mid = base + 37 * 60_000 + 42 * 1000; // 12:37:42
    expect(floorToWindowStart(mid, 60)).toBe(base);
  });

  it("already-floored timestamps are stable", () => {
    const base = Date.UTC(2026, 9, 26, 12, 0, 0);
    expect(floorToWindowStart(base, 60)).toBe(base);
  });

  it("floors a 5-minute window", () => {
    const base = Date.UTC(2026, 9, 26, 12, 15, 0);
    const mid = base + 2 * 60_000 + 30 * 1000; // 12:17:30
    expect(floorToWindowStart(mid, 5)).toBe(base);
  });
});

describe("windowStartIso", () => {
  it("returns the ISO string of the floored window", () => {
    const base = Date.UTC(2026, 9, 26, 12, 37, 42);
    const iso = windowStartIso(base, 60);
    expect(iso).toBe("2026-10-26T12:00:00.000Z");
  });
});

describe("isCountOverLimit", () => {
  it("permits counts up to and including the max", () => {
    expect(isCountOverLimit("create_draft", 1)).toBe(false);
    expect(isCountOverLimit("create_draft", 10)).toBe(false);
  });

  it("rejects counts above the max", () => {
    expect(isCountOverLimit("create_draft", 11)).toBe(true);
    expect(isCountOverLimit("create_draft", 100)).toBe(true);
  });
});
