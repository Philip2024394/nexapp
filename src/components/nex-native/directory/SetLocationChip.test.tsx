// src/components/nex-native/directory/SetLocationChip.test.tsx
//
// Structural tests for SetLocationChip · react-dom/server pattern
// (matches CountryPicker.test.tsx convention · react-testing-library
// is not installed in this repo). We assert against serialised markup
// for both visual states + the data attributes downstream smoke tests
// select by.

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SetLocationChip } from "./SetLocationChip";
import type { SavedLocation } from "@/lib/nex-native/user-location/types";

const SAMPLE_GPS: SavedLocation = {
  lat: -8.6705,
  lng: 115.2126,
  cityLabel: null,
  countryIso: "ID",
  source: "gps",
  setAt: "2026-10-12T10:00:00Z",
};

const SAMPLE_CITY: SavedLocation = {
  lat: -7.78,
  lng: 110.37,
  cityLabel: "Yogyakarta, Indonesia",
  countryIso: "ID",
  source: "manual_city",
  setAt: "2026-10-12T10:00:00Z",
};

describe("SetLocationChip", () => {
  it("renders unset state when location is null", () => {
    const html = renderToStaticMarkup(
      <SetLocationChip location={null} onOpenSetup={() => undefined} />,
    );
    expect(html).toContain('data-nex-set-location-chip-state="unset"');
    expect(html).toContain("Set location");
  });

  it("renders set state with the city label for manual_city", () => {
    const html = renderToStaticMarkup(
      <SetLocationChip location={SAMPLE_CITY} onOpenSetup={() => undefined} />,
    );
    expect(html).toContain('data-nex-set-location-chip-state="set"');
    expect(html).toContain('data-nex-set-location-chip-source="manual_city"');
    expect(html).toContain("Yogyakarta, Indonesia");
  });

  it("renders rounded coord label for GPS without city label", () => {
    const html = renderToStaticMarkup(
      <SetLocationChip location={SAMPLE_GPS} onOpenSetup={() => undefined} />,
    );
    expect(html).toContain('data-nex-set-location-chip-source="gps"');
    expect(html).toContain("-8.67, 115.21");
    expect(html).toContain("GPS");
  });

  it("includes a Change button in set state", () => {
    const html = renderToStaticMarkup(
      <SetLocationChip location={SAMPLE_CITY} onOpenSetup={() => undefined} />,
    );
    expect(html).toContain("data-nex-set-location-chip-change");
    expect(html).toContain("Change");
  });

  it("never fabricates a city label for GPS", () => {
    // The GPS source has cityLabel === null; the chip must NOT
    // substitute a made-up city string. Rounded coords are the
    // honest display.
    const html = renderToStaticMarkup(
      <SetLocationChip location={SAMPLE_GPS} onOpenSetup={() => undefined} />,
    );
    expect(html).not.toContain("Yogyakarta");
    expect(html).not.toContain("Jakarta");
    expect(html).not.toContain("Denpasar");
  });
});
