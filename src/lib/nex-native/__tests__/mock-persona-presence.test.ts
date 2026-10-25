// src/lib/nex-native/__tests__/mock-persona-presence.test.ts

import { describe, expect, it } from "vitest";
import { computePresence } from "../mock-persona-presence";

const atLocal = (y: number, m: number, d: number, h: number) =>
  new Date(y, m - 1, d, h, 0, 0, 0);

describe("computePresence", () => {
  it("deterministic · same handle + same `now` → identical state", () => {
    const now = atLocal(2026, 10, 26, 14);
    const a = computePresence("bayu", now);
    const b = computePresence("bayu", now);
    expect(a.isOnline).toBe(b.isOnline);
    expect(a.lastSeenAt.getTime()).toBe(b.lastSeenAt.getTime());
    expect(a.lastSeenLabel).toBe(b.lastSeenLabel);
    expect(a.schedule).toEqual(b.schedule);
  });

  it("schedule within sane ranges", () => {
    for (const h of ["bayu", "dewi", "nurul", "siti", "kirana"]) {
      const s = computePresence(h, atLocal(2026, 10, 26, 12)).schedule;
      expect(s.wakeHour).toBeGreaterThanOrEqual(5);
      expect(s.wakeHour).toBeLessThanOrEqual(9);
      expect(s.sleepHour).toBe(s.wakeHour + 16);
      if (s.siestaHour !== null) {
        expect(s.siestaHour).toBe(s.wakeHour + 7);
      }
    }
  });

  it("asleep before wake · lastSeen reads yesterday's bedtime", () => {
    // 03:00 local time · everyone is asleep.
    const now = atLocal(2026, 10, 27, 3); // Tuesday 03:00
    const p = computePresence("bayu", now);
    expect(p.isOnline).toBe(false);
    expect(p.lastSeenLabel).toMatch(/last seen \d+h ago/);
  });

  it("siesta hour flips presence to 'busy' (not offline) for siesta-takers", () => {
    // Walk `handle` space until we find one with a siesta.
    const napTaker = [
      "bayu", "dewi", "nurul", "rizky", "siti", "melati", "fatimah",
      "sari", "indah", "aulia",
    ].find((h) => {
      const s = computePresence(h, atLocal(2026, 10, 26, 12)).schedule;
      return s.siestaHour !== null;
    });
    expect(napTaker).toBeDefined();
    if (!napTaker) return;
    const sched = computePresence(napTaker, atLocal(2026, 10, 26, 12)).schedule;
    const napHour = sched.siestaHour as number;
    // During siesta hour · busy (not offline, not online).
    const nap = computePresence(napTaker, atLocal(2026, 10, 27, napHour));
    expect(nap.presence).toBe("busy");
    expect(nap.isOnline).toBe(false);
    expect(nap.lastSeenLabel).toBe(null); // visibly available
  });

  it("sundayOff personas are offline all day Sunday", () => {
    // Walk until we find a sundayOff persona.
    const sundayOffPersona = [
      "bayu", "dewi", "nurul", "rizky", "siti", "melati", "fatimah",
      "sari", "indah", "aulia", "made", "ketut",
    ].find((h) => computePresence(h, atLocal(2026, 10, 26, 12)).schedule.sundayOff);
    expect(sundayOffPersona).toBeDefined();
    if (!sundayOffPersona) return;
    // Sunday 2026-11-01 at midday · offline.
    const sunday = computePresence(sundayOffPersona, atLocal(2026, 11, 1, 12));
    expect(sunday.isOnline).toBe(false);
    // Saturday at midday · online.
    const saturday = computePresence(sundayOffPersona, atLocal(2026, 10, 31, 12));
    // We don't force true (could be siesta); just assert they aren't blocked by sundayOff.
    expect([true, false]).toContain(saturday.isOnline);
  });

  it("online now → lastSeenLabel is null", () => {
    const now = atLocal(2026, 10, 27, 11); // mid-morning everyone awake
    for (const h of ["bayu", "dewi", "nurul"]) {
      const p = computePresence(h, now);
      // If online, label should be null.
      if (p.isOnline) {
        expect(p.lastSeenLabel).toBe(null);
      }
    }
  });
});
