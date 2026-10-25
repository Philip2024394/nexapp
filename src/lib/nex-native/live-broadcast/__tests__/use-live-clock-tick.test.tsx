// src/lib/nex-native/live-broadcast/__tests__/use-live-clock-tick.test.tsx
//
// NEX Live S8 · Plan v4 · AC-4 + AC-5 + AC-7 + AC-11 + AC-12 + AC-13.
// -----------------------------------------------------------------------------
// EVIDENCE BOUNDARY
//   · Pure-helper + source-shape assertions. The hook's React-wrapped
//     mount / interval / visibilitychange / pageshow behaviour is NOT
//     directly rendered here because the project does not currently
//     ship `@testing-library/react` (adding it is a separate approval
//     per the owner's dependency rule). Those behaviours are covered
//     by:
//       1 · Pure assertion on `pickLiveClockAnchorMs` for the anchor
//           selection logic.
//       2 · Source-shape text assertions that the hook wires the
//           required listeners (`visibilitychange`, `pageshow`),
//           uses `setInterval` with `LIVE_CLOCK_TICK_MS`, and never
//           reads a wall clock (AC-13).
//
//     Manual browser-level validation of the full countdown behaviour
//     is listed as a known limitation in the final report.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  pickLiveClockAnchorMs,
  LIVE_CLOCK_TICK_MS,
} from "../use-live-clock-tick";

// Controllable monotonic clock for `pickLiveClockAnchorMs`.
let nowMs = 0;
let fakeNavResponseEnd: number | null = 100;

const originalPerformance = globalThis.performance;

beforeEach(() => {
  nowMs = 500;
  fakeNavResponseEnd = 100;
  Object.defineProperty(globalThis, "performance", {
    value: {
      now: () => nowMs,
      getEntriesByType: (type: string) => {
        if (type !== "navigation") return [];
        if (fakeNavResponseEnd === null) return [];
        return [
          { responseEnd: fakeNavResponseEnd } as PerformanceNavigationTiming,
        ];
      },
      timeOrigin: 0,
      mark: () => {},
      measure: () => {},
      clearMarks: () => {},
      clearMeasures: () => {},
    } as unknown as Performance,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "performance", {
    value: originalPerformance,
    writable: true,
    configurable: true,
  });
});

describe("pickLiveClockAnchorMs · AC-5 anchor selection", () => {
  test("returns navigation.responseEnd when it is recent (within 60s budget)", () => {
    fakeNavResponseEnd = 100;
    nowMs = 5_000; // 4.9s after responseEnd
    expect(pickLiveClockAnchorMs()).toBe(100);
  });

  test("edge of freshness budget · 59s after responseEnd → still uses responseEnd", () => {
    fakeNavResponseEnd = 1_000;
    nowMs = 1_000 + 59_000;
    expect(pickLiveClockAnchorMs()).toBe(1_000);
  });

  test("past freshness budget · 90s after responseEnd → falls back to now (soft-nav / bfcache)", () => {
    fakeNavResponseEnd = 100;
    nowMs = 100 + 90_000;
    expect(pickLiveClockAnchorMs()).toBe(nowMs);
  });

  test("no navigation entry (Safari ITP / soft-nav environments) → falls back to now", () => {
    fakeNavResponseEnd = null;
    nowMs = 42_000;
    expect(pickLiveClockAnchorMs()).toBe(42_000);
  });

  test("responseEnd === 0 (defensive · treats as missing) → falls back to now", () => {
    fakeNavResponseEnd = 0;
    nowMs = 7_000;
    expect(pickLiveClockAnchorMs()).toBe(7_000);
  });

  test("negative/NaN responseEnd (defensive) → falls back to now", () => {
    fakeNavResponseEnd = -5;
    nowMs = 500;
    expect(pickLiveClockAnchorMs()).toBe(500);
  });

  test("LIVE_CLOCK_TICK_MS is exactly 20 seconds (AC-4)", () => {
    expect(LIVE_CLOCK_TICK_MS).toBe(20_000);
  });
});

describe("pickLiveClockAnchorMs · fail-closed (AC-5 reinforced 2026-10-25)", () => {
  test("performance === undefined → returns null (hook fails closed)", () => {
    Object.defineProperty(globalThis, "performance", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(pickLiveClockAnchorMs()).toBeNull();
  });

  test("performance.now is not a function → returns null", () => {
    Object.defineProperty(globalThis, "performance", {
      value: { now: "not-a-function" } as unknown as Performance,
      writable: true,
      configurable: true,
    });
    expect(pickLiveClockAnchorMs()).toBeNull();
  });

  test("performance.now returns NaN → returns null", () => {
    Object.defineProperty(globalThis, "performance", {
      value: {
        now: () => Number.NaN,
        getEntriesByType: () => [],
        timeOrigin: 0,
      } as unknown as Performance,
      writable: true,
      configurable: true,
    });
    expect(pickLiveClockAnchorMs()).toBeNull();
  });

  test("performance.now returns negative → returns null", () => {
    Object.defineProperty(globalThis, "performance", {
      value: {
        now: () => -1,
        getEntriesByType: () => [],
        timeOrigin: 0,
      } as unknown as Performance,
      writable: true,
      configurable: true,
    });
    expect(pickLiveClockAnchorMs()).toBeNull();
  });

  test("performance.now returns Infinity → returns null", () => {
    Object.defineProperty(globalThis, "performance", {
      value: {
        now: () => Number.POSITIVE_INFINITY,
        getEntriesByType: () => [],
        timeOrigin: 0,
      } as unknown as Performance,
      writable: true,
      configurable: true,
    });
    expect(pickLiveClockAnchorMs()).toBeNull();
  });
});

describe("useLiveClockTick · source-shape (AC-13 + wiring)", () => {
  const HOOK_SOURCE = readFileSync(
    resolve(__dirname, "..", "use-live-clock-tick.ts"),
    "utf8",
  );
  // Strip line comments so the audit only inspects actual code.
  const CODE_ONLY = HOOK_SOURCE.replace(/^\s*\/\/[^\n]*\n/gm, "");

  test("AC-13 · no `Date.now()` call in code", () => {
    expect(CODE_ONLY).not.toMatch(/Date\.now\s*\(/);
  });

  test("AC-13 · no `new Date(` constructor in code", () => {
    expect(CODE_ONLY).not.toMatch(/new\s+Date\s*\(/);
  });

  test("AC-13 · no `Date.parse(` call in code", () => {
    expect(CODE_ONLY).not.toMatch(/Date\.parse\s*\(/);
  });

  test("uses `performance.now()` for elapsed-time arithmetic (monotonic)", () => {
    expect(CODE_ONLY).toMatch(/performance\.now\s*\(/);
  });

  test("reads navigation entry via `performance.getEntriesByType`", () => {
    expect(CODE_ONLY).toMatch(/performance\.getEntriesByType/);
  });

  test("installs a `visibilitychange` listener for AC-12 wake-up", () => {
    expect(CODE_ONLY).toMatch(/addEventListener\s*\(\s*["']visibilitychange["']/);
  });

  test("installs a `pageshow` listener for bfcache restoration", () => {
    expect(CODE_ONLY).toMatch(/addEventListener\s*\(\s*["']pageshow["']/);
  });

  test("uses `setInterval` with `LIVE_CLOCK_TICK_MS`", () => {
    expect(CODE_ONLY).toMatch(/setInterval\s*\([\s\S]*?LIVE_CLOCK_TICK_MS/);
  });

  test("schedules a dedicated `setTimeout` for exact expiry (not next-tick drift)", () => {
    expect(CODE_ONLY).toMatch(/setTimeout\s*\(/);
    expect(CODE_ONLY).toMatch(/expiryTimeoutRef/);
  });

  test("cleans up listeners + interval + expiry timeout in the useEffect return", () => {
    expect(CODE_ONLY).toMatch(/clearInterval/);
    expect(CODE_ONLY).toMatch(/clearTimeout|clearExpiryTimeout/);
    expect(CODE_ONLY).toMatch(/removeEventListener\s*\(\s*["']visibilitychange["']/);
    expect(CODE_ONLY).toMatch(/removeEventListener\s*\(\s*["']pageshow["']/);
  });

  test("short-circuits on non-finite TTL (no timer allocation)", () => {
    expect(CODE_ONLY).toMatch(/Number\.isFinite\s*\(\s*liveExpiresInMs\s*\)/);
  });

  test("AC-10 fail-safe · non-positive TTL → sets expired immediately", () => {
    expect(CODE_ONLY).toMatch(/liveExpiresInMs\s*<=\s*0/);
  });

  test("AC-5 fail-closed · null anchor triggers setExpired(true) in the useEffect", () => {
    // The hook calls `pickLiveClockAnchorMs()` and if it returns null,
    // immediately fails closed. We assert the pattern is present.
    expect(CODE_ONLY).toMatch(/anchor\s*===\s*null/);
    expect(CODE_ONLY).toMatch(/setExpired\s*\(\s*true\s*\)/);
  });

  test("safeNow helper fails closed when performance.now is unreliable mid-session", () => {
    expect(CODE_ONLY).toMatch(/safeNow|performance\.now\s*!==\s*["']function["']/);
  });
});
