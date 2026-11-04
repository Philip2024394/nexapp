// Phase 1A replay protection · unit tests.

import { describe, test, expect } from "vitest";
import {
  checkFreshness,
  createReplayGuard,
} from "../replay-protection";

describe("checkFreshness", () => {
  test("fresh broadcast_at passes", () => {
    const r = checkFreshness({
      broadcastAtMs: 1_000_000,
      nowMs: 1_000_000 + 5_000,
    });
    expect(r.ok).toBe(true);
  });
  test("30-min-old broadcast_at is stale", () => {
    const r = checkFreshness({
      broadcastAtMs: 0,
      nowMs: 31 * 60 * 1000,
    });
    expect(r).toEqual({ ok: false, reason: "stale" });
  });
  test("future-dated beyond tolerance is rejected", () => {
    const r = checkFreshness({
      broadcastAtMs: 10 * 60_000,
      nowMs: 0,
    });
    expect(r).toEqual({ ok: false, reason: "future" });
  });
  test("invalid broadcast_at is rejected", () => {
    const r = checkFreshness({ broadcastAtMs: NaN, nowMs: 0 });
    expect(r).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("createReplayGuard", () => {
  test("first seen returns true, repeat returns false", () => {
    const g = createReplayGuard();
    expect(g.seen("device-a", "nonce-1")).toBe(true);
    expect(g.seen("device-a", "nonce-1")).toBe(false);
  });
  test("different senders don't collide", () => {
    const g = createReplayGuard();
    g.seen("a", "n");
    expect(g.seen("b", "n")).toBe(true);
  });
  test("LRU cap bounds memory", () => {
    const g = createReplayGuard(10);
    for (let i = 0; i < 20; i++) g.seen("device", `n-${i}`);
    expect(g.size()).toBeLessThanOrEqual(10);
    // Oldest entries evicted · first one now re-admittable.
    expect(g.seen("device", "n-0")).toBe(true);
  });
});
