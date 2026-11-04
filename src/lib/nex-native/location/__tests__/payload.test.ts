// Phase 1A payload · unit tests · round-trip + shape validation.

import { describe, test, expect } from "vitest";
import {
  decodePayload,
  encodePayload,
  isValidPayload,
  type LocationPayload,
} from "../payload";

describe("payload · round trips", () => {
  const exact: LocationPayload = {
    kind: "exact",
    lat: 53.3498,
    lng: -6.26,
    accuracy_m: 8,
    captured_at: "2026-11-05T12:00:00.000Z",
    v: 1,
  };
  const nearby: LocationPayload = {
    kind: "nearby",
    cell_center_lat: 53.35,
    cell_center_lng: -6.258,
    cell_size_m: 250,
    jitter_applied: true,
    captured_at: "2026-11-05T12:00:00.000Z",
    v: 1,
  };
  const area: LocationPayload = {
    kind: "area",
    area_code: "IE-D02",
    area_label: "Dublin 2",
    country_iso: "IE",
    captured_at: "2026-11-05T12:00:00.000Z",
    v: 1,
  };

  test.each([exact, nearby, area])(
    "round-trips %j",
    (payload: LocationPayload) => {
      const bytes = encodePayload(payload);
      const decoded = decodePayload(bytes);
      expect(decoded).toEqual(payload);
    },
  );

  test("canonical encoding is deterministic regardless of key order", () => {
    const a = encodePayload(exact);
    const scrambled: LocationPayload = {
      v: 1,
      captured_at: exact.captured_at,
      accuracy_m: exact.accuracy_m,
      lng: exact.lng,
      lat: exact.lat,
      kind: "exact",
    };
    const b = encodePayload(scrambled);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe("payload · validation", () => {
  test("rejects wrong version", () => {
    expect(isValidPayload({ kind: "exact", lat: 0, lng: 0, accuracy_m: 1, captured_at: "", v: 2 })).toBe(false);
  });
  test("rejects out-of-range coordinates", () => {
    expect(isValidPayload({ kind: "exact", lat: 95, lng: 0, accuracy_m: 1, captured_at: "x", v: 1 })).toBe(false);
    expect(isValidPayload({ kind: "exact", lat: 0, lng: 200, accuracy_m: 1, captured_at: "x", v: 1 })).toBe(false);
  });
  test("rejects nearby with wrong cell_size_m", () => {
    expect(
      isValidPayload({
        kind: "nearby",
        cell_center_lat: 0,
        cell_center_lng: 0,
        cell_size_m: 100,
        jitter_applied: true,
        captured_at: "x",
        v: 1,
      }),
    ).toBe(false);
  });
  test("rejects area with missing fields", () => {
    expect(
      isValidPayload({
        kind: "area",
        area_code: "",
        area_label: "",
        country_iso: "",
        captured_at: "x",
        v: 1,
      }),
    ).toBe(false);
  });
  test("decodePayload returns null on malformed JSON", () => {
    const bytes = new TextEncoder().encode("{not valid}");
    expect(decodePayload(bytes)).toBeNull();
  });
});
