// src/lib/nex-native/harvest/__tests__/canonical-metadata.test.ts
//
// Pure tests for buildCanonicalMetadata. No DB · no clock reads
// (test passes an explicit discoveredAt).

import { describe, it, expect } from "vitest";
import { buildCanonicalMetadata } from "../canonical-metadata";

const FIXED_DATE = new Date(Date.UTC(2026, 9, 13, 12, 30, 0)); // 2026-10-13 12:30 UTC
const CYCLE_ID = "4c2b8a9e-0000-4000-8000-000000000007";

describe("buildCanonicalMetadata · cycle_id propagation", () => {
  it("stamps the exact cycle_id passed in", () => {
    const meta = buildCanonicalMetadata({
      bbox: "id-jakarta",
      osmLat: -6.21,
      osmLon: 106.85,
      cycleId: CYCLE_ID,
      discoveredAt: FIXED_DATE,
    });
    expect(meta.cycle_id).toBe(CYCLE_ID);
  });

  it("preserves OSM provenance alongside the cycle_id", () => {
    const meta = buildCanonicalMetadata({
      bbox: "gb-london",
      osmLat: 51.5,
      osmLon: -0.1,
      cycleId: CYCLE_ID,
      discoveredAt: FIXED_DATE,
    });
    expect(meta.source).toBe("osm_overpass");
    expect(meta.bbox).toBe("gb-london");
    expect(meta.osm_lat).toBe(51.5);
    expect(meta.osm_lon).toBe(-0.1);
    expect(meta.discovered_at).toBe("2026-10-13T12:30:00.000Z");
    expect(meta.cycle_id).toBe(CYCLE_ID);
  });

  it("renders discovered_at as ISO 8601 UTC", () => {
    const meta = buildCanonicalMetadata({
      bbox: "us-nyc",
      osmLat: 40.75,
      osmLon: -73.98,
      cycleId: CYCLE_ID,
      discoveredAt: FIXED_DATE,
    });
    expect(meta.discovered_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("round-trips through JSON.stringify without data loss", () => {
    const original = buildCanonicalMetadata({
      bbox: "au-sydney",
      osmLat: -33.87,
      osmLon: 151.21,
      cycleId: CYCLE_ID,
      discoveredAt: FIXED_DATE,
    });
    const roundTrip = JSON.parse(JSON.stringify(original));
    expect(roundTrip.cycle_id).toBe(CYCLE_ID);
    expect(roundTrip.source).toBe("osm_overpass");
    expect(roundTrip.osm_lat).toBe(-33.87);
    expect(roundTrip.osm_lon).toBe(151.21);
    expect(roundTrip.bbox).toBe("au-sydney");
    expect(roundTrip.discovered_at).toBe(original.discovered_at);
  });

  it("is deterministic given explicit discoveredAt", () => {
    const a = buildCanonicalMetadata({
      bbox: "de-berlin",
      osmLat: 52.52,
      osmLon: 13.4,
      cycleId: CYCLE_ID,
      discoveredAt: FIXED_DATE,
    });
    const b = buildCanonicalMetadata({
      bbox: "de-berlin",
      osmLat: 52.52,
      osmLon: 13.4,
      cycleId: CYCLE_ID,
      discoveredAt: FIXED_DATE,
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("two different cycleIds produce two different metadata blobs for same OSM element", () => {
    const a = buildCanonicalMetadata({
      bbox: "fr-paris",
      osmLat: 48.85,
      osmLon: 2.35,
      cycleId: "11111111-1111-1111-1111-111111111111",
      discoveredAt: FIXED_DATE,
    });
    const b = buildCanonicalMetadata({
      bbox: "fr-paris",
      osmLat: 48.85,
      osmLon: 2.35,
      cycleId: "22222222-2222-2222-2222-222222222222",
      discoveredAt: FIXED_DATE,
    });
    expect(a.cycle_id).not.toBe(b.cycle_id);
    expect(a.source).toBe(b.source);
    expect(a.bbox).toBe(b.bbox);
    expect(a.osm_lat).toBe(b.osm_lat);
  });

  it("key order is stable (source,bbox,osm_lat,osm_lon,discovered_at,cycle_id) for grep consumers", () => {
    const meta = buildCanonicalMetadata({
      bbox: "it-rome",
      osmLat: 41.9,
      osmLon: 12.5,
      cycleId: CYCLE_ID,
      discoveredAt: FIXED_DATE,
    });
    const keys = Object.keys(meta);
    expect(keys).toEqual([
      "source",
      "bbox",
      "osm_lat",
      "osm_lon",
      "discovered_at",
      "cycle_id",
    ]);
  });
});
