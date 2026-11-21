// src/components/nex-native/directory/OsmAttributionBadge.test.tsx
//
// Structural tests · react-dom/server · matches the existing
// convention (CountryPicker.test.tsx, SetLocationChip.test.tsx).

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OsmAttributionBadge } from "./OsmAttributionBadge";

describe("OsmAttributionBadge · rendering", () => {
  // 2026-11-21 · Test updated to match the component's current
  // button-with-onClick shape (renderToStaticMarkup can't execute the
  // onClick). The component intentionally uses <button> rather than
  // <a href> to avoid invalid <a>-inside-<a> nesting when the badge
  // is placed inside card-wide anchor wrappers (DirectoryCard,
  // ListingDetailPanel) — see OsmAttributionBadge.tsx:73-82.
  // ODbL attribution is still carried via aria-label + ref data
  // attribute + onClick window.open · the SSR markup doesn't emit
  // the href because the open happens at click time.
  it("renders a linked badge for a valid OSM node ref", () => {
    const html = renderToStaticMarkup(
      <OsmAttributionBadge osmId="node/123456789" />,
    );
    expect(html).toContain("data-nex-osm-attribution-badge");
    expect(html).toContain('data-nex-osm-attribution-badge-ref="node/123456789"');
    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="OpenStreetMap source: node/123456789');
    expect(html).toContain("OpenStreetMap contributors (ODbL)");
  });

  it("renders a linked badge for way and relation refs", () => {
    for (const ref of ["way/1000", "relation/42"]) {
      const html = renderToStaticMarkup(<OsmAttributionBadge osmId={ref} />);
      expect(html).toContain(`data-nex-osm-attribution-badge-ref="${ref}"`);
      expect(html).toContain(`aria-label="OpenStreetMap source: ${ref}`);
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
