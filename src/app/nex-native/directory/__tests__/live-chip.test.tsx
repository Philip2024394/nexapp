// src/app/nex-native/directory/__tests__/live-chip.test.tsx
//
// Phase 2 · G2 · directory-card Live indicator chip.
// -----------------------------------------------------------------------------
// EVIDENCE BOUNDARY
//   · Rendered-HTML tests via renderToString.
//   · Verifies the chip is purely additive and never changes
//     unrelated card internals (image slot, distance chip, title).
//   · All props optional · default behaviour unchanged.

import { describe, test, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("server-only", () => ({}));

import { DirectoryCard } from "@/app/nex-native/directory/_directory-card";
import type { DirectoryListingVM } from "@/lib/nex-native/directory";

const CANONICAL_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function makeListing(name = "Warung Pak Budi"): DirectoryListingVM {
  return {
    canonicalBusinessId: CANONICAL_ID,
    entityType: "food",
    classification: "business",
    lifecycleState: "OWNER_CLAIMED",
    name,
    aliases: [],
    country: "ID",
    city: "Jakarta",
    district: null,
    streetLine: null,
    neighbourhood: null,
    phoneE164: null,
    websiteApex: null,
    coordinates: null,
    categoryIds: ["restaurant"],
    primaryImage: null,
    isOsmAttributed: false,
    osmId: null,
  } as unknown as DirectoryListingVM;
}

describe("DirectoryCard · Live indicator chip", () => {
  test("default (no live props) renders no live chip · existing surfaces intact", () => {
    const html = renderToString(
      <DirectoryCard
        listing={makeListing()}
        destination={{ kind: "place_detail", canonicalBusinessId: CANONICAL_ID }}
        userCoords={null}
      />,
    );
    expect(html).not.toContain('data-nex-directory-card-chip="live"');
    expect(html).not.toContain("data-nex-directory-card-live-link");
    // The distance chip + title + image slot are untouched.
    expect(html).toContain('data-nex-directory-card-chip="distance"');
    expect(html).toContain("data-nex-directory-card-name");
    expect(html).toContain("data-nex-directory-card-image");
  });

  test("isOwnerLive=false renders no live chip", () => {
    const html = renderToString(
      <DirectoryCard
        listing={makeListing()}
        destination={{ kind: "place_detail", canonicalBusinessId: CANONICAL_ID }}
        userCoords={null}
        isOwnerLive={false}
      />,
    );
    expect(html).not.toContain('data-nex-directory-card-chip="live"');
  });

  test("isOwnerLive=true + no href renders a non-interactive chip (span, not Link)", () => {
    const html = renderToString(
      <DirectoryCard
        listing={makeListing("Aisha Vintage Cameras")}
        destination={{
          kind: "nex_business",
          path: "/nex-native/aisha-vintage",
          slug: "aisha-vintage",
          businessId: CANONICAL_ID,
        } as never}
        userCoords={null}
        isOwnerLive={true}
      />,
    );
    expect(html).toContain('data-nex-directory-card-chip="live"');
    expect(html).not.toContain("data-nex-directory-card-live-link");
    expect(html).toContain("Aisha Vintage Cameras is live now");
    expect(html).toContain("Live");
  });

  test("isOwnerLive=true + href wraps the chip in a Link to the broadcast", () => {
    const html = renderToString(
      <DirectoryCard
        listing={makeListing("Aisha Vintage Cameras")}
        destination={{
          kind: "nex_business",
          path: "/nex-native/aisha-vintage",
          slug: "aisha-vintage",
          businessId: CANONICAL_ID,
        } as never}
        userCoords={null}
        isOwnerLive={true}
        liveWatchHref="/nex-native/live-commerce/sess-123?product=prod-9"
      />,
    );
    expect(html).toContain("data-nex-directory-card-live-link");
    expect(html).toContain("/nex-native/live-commerce/sess-123");
    expect(html).toContain("product=prod-9");
    expect(html).toContain("Watch Aisha Vintage Cameras on NEX Live");
  });

  test("live chip never swallows the surrounding card <Link> for the default tap target", () => {
    // The card's whole-card <Link> + the chip Link coexist. The chip
    // has an onClick stopPropagation guard. We assert the top-level
    // card Link is still present AND distinct from the chip Link.
    const html = renderToString(
      <DirectoryCard
        listing={makeListing("Aisha Vintage Cameras")}
        destination={{
          kind: "nex_business",
          path: "/nex-native/aisha-vintage",
          slug: "aisha-vintage",
          businessId: CANONICAL_ID,
        } as never}
        userCoords={null}
        isOwnerLive={true}
        liveWatchHref="/nex-native/live-commerce/sess-123"
      />,
    );
    expect(html).toContain("data-nex-directory-card-link");
    expect(html).toContain("data-nex-directory-card-live-link");
    // The chip Link's href is the broadcast · the card Link's href is
    // the directory destination · they are different.
    expect(html).toContain("/nex-native/live-commerce/sess-123");
    expect(html).toContain("/nex-native/aisha-vintage");
  });

  test("accessibility · chip exposes aria-label with the owner name + 'live now'", () => {
    const html = renderToString(
      <DirectoryCard
        listing={makeListing("Aisha Vintage Cameras")}
        destination={{ kind: "place_detail", canonicalBusinessId: CANONICAL_ID }}
        userCoords={null}
        isOwnerLive={true}
      />,
    );
    expect(html).toMatch(/aria-label="Aisha Vintage Cameras is live now"/);
  });

  test("prefers-reduced-motion suppressed animation via CSS", () => {
    const html = renderToString(
      <DirectoryCard
        listing={makeListing()}
        destination={{ kind: "place_detail", canonicalBusinessId: CANONICAL_ID }}
        userCoords={null}
        isOwnerLive={true}
      />,
    );
    expect(html).toContain("prefers-reduced-motion");
  });

  test("preserves 92×92 image slot · chip never wraps the thumbnail", () => {
    const html = renderToString(
      <DirectoryCard
        listing={makeListing()}
        destination={{ kind: "place_detail", canonicalBusinessId: CANONICAL_ID }}
        userCoords={null}
        isOwnerLive={true}
      />,
    );
    // Image slot still renders at its own data attribute · chip is
    // in the title row, NOT wrapping the image.
    expect(html).toContain('data-nex-directory-card-image="absent"');
    // The chip is rendered inside the title row (sits after the h3,
    // not inside the image container's parent). We assert order:
    // image data attribute appears BEFORE the live chip data attribute.
    const imgIdx = html.indexOf("data-nex-directory-card-image");
    const chipIdx = html.indexOf('data-nex-directory-card-chip="live"');
    expect(imgIdx).toBeGreaterThan(-1);
    expect(chipIdx).toBeGreaterThan(-1);
    expect(imgIdx).toBeLessThan(chipIdx);
  });

  test("ended-session / unavailable → caller passes isOwnerLive=false → chip disappears", () => {
    // Guarantees the fail-open contract: when the server resolution
    // returns null (session not open · or query failed), the chip is
    // not rendered. No "ghost LIVE" state.
    const html = renderToString(
      <DirectoryCard
        listing={makeListing()}
        destination={{ kind: "place_detail", canonicalBusinessId: CANONICAL_ID }}
        userCoords={null}
        isOwnerLive={false}
        liveWatchHref="/nex-native/live-commerce/sess-123"
      />,
    );
    expect(html).not.toContain('data-nex-directory-card-chip="live"');
    expect(html).not.toContain("sess-123");
  });
});
