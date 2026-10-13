// src/lib/nex-native/harvest/__tests__/city-rotation.test.ts
//
// Deterministic coverage of the rotation picker. Pure logic · no
// network / DB · safe to run in CI.

import { describe, it, expect } from "vitest";
import { pickNextCity, CITY_ROTATION } from "../city-rotation";

describe("pickNextCity", () => {
  it("returns null when no allowed ISOs are passed", () => {
    expect(pickNextCity({ cursor: null }, new Set())).toBeNull();
  });

  it("returns the first eligible city when cursor is null", () => {
    const allowed = new Set(["ID"]);
    const next = pickNextCity({ cursor: null }, allowed);
    expect(next).not.toBeNull();
    expect(next?.isoAlpha2).toBe("ID");
  });

  it("advances to the next city within the same country", () => {
    const idCities = CITY_ROTATION.filter((c) => c.isoAlpha2 === "ID");
    expect(idCities.length).toBeGreaterThan(1);
    const first = idCities[0];
    const expectedSecond = idCities[1];
    const next = pickNextCity({ cursor: first.id }, new Set(["ID"]));
    expect(next?.id).toBe(expectedSecond.id);
  });

  it("wraps around to the first eligible city after the last", () => {
    const idCities = CITY_ROTATION.filter((c) => c.isoAlpha2 === "ID");
    const last = idCities[idCities.length - 1];
    const next = pickNextCity({ cursor: last.id }, new Set(["ID"]));
    expect(next?.id).toBe(idCities[0].id);
  });

  it("ignores an unknown cursor and starts from the beginning", () => {
    const next = pickNextCity(
      { cursor: "no-such-city-anywhere" },
      new Set(["GB"]),
    );
    expect(next?.isoAlpha2).toBe("GB");
    const gbCities = CITY_ROTATION.filter((c) => c.isoAlpha2 === "GB");
    expect(next?.id).toBe(gbCities[0].id);
  });

  it("respects the allowed ISO filter · skips countries not in the set", () => {
    const next = pickNextCity({ cursor: null }, new Set(["US"]));
    expect(next?.isoAlpha2).toBe("US");
  });

  it("after picking the last US city, wraps back to the first US city", () => {
    const usCities = CITY_ROTATION.filter((c) => c.isoAlpha2 === "US");
    const last = usCities[usCities.length - 1];
    const next = pickNextCity({ cursor: last.id }, new Set(["US"]));
    expect(next?.id).toBe(usCities[0].id);
  });

  it("multi-country rotation stays within the allowed set", () => {
    const allowed = new Set(["ID", "GB"]);
    // Start somewhere, confirm every step belongs to allowed
    let cursor: string | null = null;
    for (let i = 0; i < 20; i++) {
      const next = pickNextCity({ cursor }, allowed);
      expect(next).not.toBeNull();
      expect(allowed.has(next!.isoAlpha2)).toBe(true);
      cursor = next!.id;
    }
  });

  it("every city has a valid bbox (south<north, west<east, lat/lng in range)", () => {
    for (const c of CITY_ROTATION) {
      expect(c.south).toBeLessThan(c.north);
      expect(c.west).toBeLessThan(c.east);
      expect(c.south).toBeGreaterThanOrEqual(-90);
      expect(c.north).toBeLessThanOrEqual(90);
      expect(c.west).toBeGreaterThanOrEqual(-180);
      expect(c.east).toBeLessThanOrEqual(180);
      expect(c.isoAlpha2).toMatch(/^[A-Z]{2}$/);
      expect(c.id).toMatch(/^[a-z]{2}-[a-z0-9-]+$/);
    }
  });
});
