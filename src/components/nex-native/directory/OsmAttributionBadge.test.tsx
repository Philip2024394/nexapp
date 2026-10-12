// src/components/nex-native/directory/OsmAttributionBadge.test.tsx
//
// Structural tests · react-dom/server · matches the existing
// convention (CountryPicker.test.tsx, SetLocationChip.test.tsx).

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OsmAttributionBadge } from "./OsmAttributionBadge";

describe("OsmAttributionBadge · rendering", () => {
  it("renders a linked badge for a valid OSM node ref", () => {
    const html = renderToStaticMarkup(
      <OsmAttributionBadge osmId="node/123456789" />,
    );
    expect(html).toContain("data-nex-osm-attribution-badge");
    expect(html).toContain('data-nex-osm-attribution-badge-ref="node/123456789"');
    expect(html).toContain('href="https://www.openstreetmap.org/node/123456789"');
    expect(html).toContain("OpenStreetMap contributors (ODbL)");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("renders a linked badge for way and relation refs", () => {
    for (const ref of ["way/1000", "relation/42"]) {
      const html = renderToStaticMarkup(<OsmAttributionBadge osmId={ref} />);
      expect(html).toContain(`href="https://www.openstreetmap.org/${ref}"`);
    }
  });

  it("renders a non-linked badge for a malformed OSM ref · still shows attribution", () => {
    const html = renderToStaticMarkup(
      <OsmAttributionBadge osmId="12345" />,
    );
    expect(html).toContain("OpenStreetMap contributors (ODbL)");
    expect(html).not.toContain("<a");
    expect(html).toContain('data-nex-osm-attribution-badge-ref=""');
  });

  it("still renders a non-linked badge when osmId is null · ODbL requires attribution regardless", () => {
    const html = renderToStaticMarkup(<OsmAttributionBadge osmId={null} />);
    expect(html).toContain("OpenStreetMap contributors (ODbL)");
    expect(html).toContain("data-nex-osm-attribution-badge");
    expect(html).not.toContain("<a");
    expect(html).toContain('data-nex-osm-attribution-badge-ref=""');
  });

  it("still renders a non-linked badge when osmId is empty or whitespace", () => {
    expect(renderToStaticMarkup(<OsmAttributionBadge osmId="" />)).toContain(
      "OpenStreetMap contributors (ODbL)",
    );
    expect(renderToStaticMarkup(<OsmAttributionBadge osmId="   " />)).toContain(
      "OpenStreetMap contributors (ODbL)",
    );
  });

  it("larger size variant renders with increased padding/font", () => {
    const compact = renderToStaticMarkup(
      <OsmAttributionBadge osmId="node/1" size="compact" />,
    );
    const detail = renderToStaticMarkup(
      <OsmAttributionBadge osmId="node/1" size="detail" />,
    );
    expect(compact).not.toBe(detail);
  });
});
