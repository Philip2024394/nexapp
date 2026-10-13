// src/lib/nex-native/harvest/__tests__/overpass-parser.test.ts
//
// parseOverpassElements · pure parser · no network.
// Tolerates malformed Overpass responses by filtering out invalid
// elements rather than throwing. Important because Overpass mirrors
// occasionally return partial / malformed JSON on heavy load.

import { describe, it, expect } from "vitest";
import { parseOverpassElements } from "../overpass-parser";

describe("parseOverpassElements", () => {
  it("returns [] for null / non-object input", () => {
    expect(parseOverpassElements(null)).toEqual([]);
    expect(parseOverpassElements(undefined)).toEqual([]);
    expect(parseOverpassElements("string")).toEqual([]);
    expect(parseOverpassElements(42)).toEqual([]);
  });

  it("returns [] when elements is missing or not an array", () => {
    expect(parseOverpassElements({})).toEqual([]);
    expect(parseOverpassElements({ elements: null })).toEqual([]);
    expect(parseOverpassElements({ elements: "nope" })).toEqual([]);
  });

  it("parses a well-formed node with lat/lon + tags", () => {
    const raw = {
      elements: [
        {
          type: "node",
          id: 123,
          lat: -6.21,
          lon: 106.85,
          tags: { name: "Warung Pak Budi", amenity: "restaurant" },
        },
      ],
    };
    const out = parseOverpassElements(raw);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: "node",
      id: 123,
      lat: -6.21,
      lon: 106.85,
    });
    expect(out[0].tags.name).toBe("Warung Pak Budi");
  });

  it("uses center lat/lon for ways / relations", () => {
    const raw = {
      elements: [
        {
          type: "way",
          id: 999,
          center: { lat: 51.5, lon: -0.1 },
          tags: { name: "Pret", shop: "coffee" },
        },
      ],
    };
    const out = parseOverpassElements(raw);
    expect(out).toHaveLength(1);
    expect(out[0].lat).toBe(51.5);
    expect(out[0].lon).toBe(-0.1);
  });

  it("filters out elements with no id or an unknown type", () => {
    const raw = {
      elements: [
        { type: "node", lat: 0, lon: 0, tags: {} }, // no id
        { type: "unknown", id: 1, tags: {} }, // bad type
        { type: "node", id: 7, lat: 1, lon: 2, tags: { name: "Keep" } },
      ],
    };
    const out = parseOverpassElements(raw);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(7);
  });

  it("falls back to empty tags when the tags field is missing", () => {
    const raw = { elements: [{ type: "node", id: 1, lat: 0, lon: 0 }] };
    const out = parseOverpassElements(raw);
    expect(out).toHaveLength(1);
    expect(out[0].tags).toEqual({});
  });

  it("allows null lat/lon · the caller filters those out before DB write", () => {
    const raw = {
      elements: [{ type: "relation", id: 42, tags: { name: "x" } }],
    };
    const out = parseOverpassElements(raw);
    expect(out).toHaveLength(1);
    expect(out[0].lat).toBeNull();
    expect(out[0].lon).toBeNull();
  });

  it("doesn't throw when a single element is garbage · processes the rest", () => {
    const raw = {
      elements: [
        null,
        42,
        "string",
        {},
        { type: "node", id: 100, lat: 10, lon: 20, tags: { name: "Real" } },
      ],
    };
    const out = parseOverpassElements(raw);
    expect(out).toHaveLength(1);
    expect(out[0].tags.name).toBe("Real");
  });
});
