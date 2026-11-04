// Phase 1A area-resolver · unit tests.

import { describe, test, expect } from "vitest";
import {
  isFixtureDataset,
  resolveArea,
  type AreaDataset,
} from "../area-resolver";

const dublinDataset: AreaDataset = {
  country_iso: "IE",
  country_label: "Ireland",
  generated_at: "2026-11-05T00:00:00Z",
  source: "test",
  license: "test",
  areas: [
    {
      code: "IE-D02",
      label: "Dublin 2",
      bbox: [-6.27, 53.33, -6.24, 53.35],
      polygon: [
        [-6.27, 53.33],
        [-6.24, 53.33],
        [-6.24, 53.35],
        [-6.27, 53.35],
      ],
    },
  ],
};

const fixtureDataset: AreaDataset = {
  ...dublinDataset,
  generated_at: "fixture-2026-11-05",
};

describe("resolveArea", () => {
  test("point inside Dublin 2 bbox resolves", () => {
    const out = resolveArea(53.3418, -6.26, dublinDataset);
    expect(out?.area_label).toBe("Dublin 2");
    expect(out?.country_iso).toBe("IE");
  });

  test("point outside bbox returns null", () => {
    const out = resolveArea(0, 0, dublinDataset);
    expect(out).toBeNull();
  });

  test("invalid coords return null", () => {
    expect(resolveArea(NaN, 0, dublinDataset)).toBeNull();
    expect(resolveArea(0, 200, dublinDataset)).toBeNull();
  });

  test("fixture dataset returns null in production mode", () => {
    const out = resolveArea(53.3418, -6.26, fixtureDataset);
    expect(out).toBeNull();
  });

  test("fixture dataset resolves when allowFixture:true", () => {
    const out = resolveArea(53.3418, -6.26, fixtureDataset, {
      allowFixture: true,
    });
    expect(out?.area_label).toBe("Dublin 2");
  });
});

describe("isFixtureDataset", () => {
  test("true when generated_at starts with 'fixture-'", () => {
    expect(isFixtureDataset(fixtureDataset)).toBe(true);
  });
  test("false for real timestamp", () => {
    expect(isFixtureDataset(dublinDataset)).toBe(false);
  });
});
