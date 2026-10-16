// src/lib/nex-native/directory/__tests__/image-render-l1-5-integration.test.tsx
//
// L1.5 image-render integration proof.
//
// Scope: compose the pipeline from resolver OUTPUT (a canonical-id →
// media map) through projectDirectoryListings (the Phase B projector)
// through DirectoryCard (the real UI component) via react-dom/server's
// renderToString. Then assert the final HTML string contains the
// expected <img> tag with the correct src.
//
// What this proves:
//   · The projector consumes the media map and sets listing.primaryImage.
//   · DirectoryCard renders listing.primaryImage.url as a real <img>
//     with the resolver-produced URL.
//   · When the media map is empty, no <img> is rendered (honest-null).
//   · When primaryImage.url is a bucket-relative path (post resolveStorageKeyToUrl),
//     the resolver's URL builder already made it absolute — the card
//     renders whatever the resolver gave it.
//
// What this does NOT prove:
//   · Browser rendering · DOM mutation · hydration (would need jsdom · not
//     installed; the repo deliberately avoids that dependency per
//     LiveCountdown.test.tsx note).
//   · The dev server actually serving this URL end-to-end (L2).
//   · The browser actually loading the image bytes over HTTP (L3).
//   · Production rendering (L4).
//
// This is L1.5 · stronger than SQL-level unit test (which only proves
// the SQL has both gates); weaker than a browser-driven L2 test.

import { describe, test, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("server-only", () => ({}));

import { projectDirectoryListings } from "../project-canonical-row";
import type {
  DirectoryCanonicalRow,
  DirectoryImage,
  DirectoryListingMedia,
} from "../types";
import { DirectoryCard } from "@/app/nex-native/directory/_directory-card";

// ─── fixtures ──────────────────────────────────────────────────────

function makeRow(overrides: Partial<DirectoryCanonicalRow> = {}): DirectoryCanonicalRow {
  const base: DirectoryCanonicalRow = {
    canonical_business_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    entity_type: "food",
    lifecycle_state: "OWNER_CLAIMED",
    name_canonical: "Warung Pak Budi",
    country: "ID",
    city: "Jakarta",
    district: null,
    street_line: "Jl. Example 1",
    neighbourhood: null,
    phone_e164: null,
    website_apex: null,
    osm_id: null,
    wikidata_qid: null,
    coordinates: null,
    aliases: [],
    address: null,
    category_ids: ["restaurant"] as unknown as string[],
    services_products: null,
    supersedes_business_id: null,
    superseded_by_business_id: null,
    last_verified_at: null,
    created_at: new Date("2026-01-01T00:00:00Z").toISOString(),
    updated_at: new Date("2026-01-01T00:00:00Z").toISOString(),
  };
  return { ...base, ...overrides };
}

const CANONICAL_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const APPROVED_IMAGE: DirectoryImage = {
  url: "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-media/pilot/warung.jpg",
  altText: "Warung Pak Budi",
  sourceId: "owner_upload",
};

// ─── tests ─────────────────────────────────────────────────────────

describe("L1.5 render proof · media → projector → VM → card → HTML", () => {
  test("end-to-end: an approved + display-eligible image renders in the directory card HTML", () => {
    // Step 1 · simulate the resolver's output (the media map).
    //   In production, this map comes from fetchDirectoryMediaByCanonicalId
    //   which has already enforced BOTH gates:
    //     approved=true AND (can_display=true OR owner_upload+owner_approved).
    //   For this test we trust the resolver (covered by media-resolver.test.ts)
    //   and feed its already-gated output straight into the projector.
    const mediaMap = new Map<string, DirectoryListingMedia>([
      [CANONICAL_ID, { primaryImage: APPROVED_IMAGE }],
    ]);

    // Step 2 · project the canonical row → VM, passing the gated media map.
    const row = makeRow();
    const vms = projectDirectoryListings({
      rows: [row],
      mediaByCanonicalId: mediaMap,
    });
    expect(vms).toHaveLength(1);
    const vm = vms[0];
    expect(vm.primaryImage).not.toBe(null);
    expect(vm.primaryImage?.url).toBe(APPROVED_IMAGE.url);

    // Step 3 · render the card with the VM.
    const html = renderToString(
      <DirectoryCard
        listing={vm}
        destination={{ kind: "place_detail", canonicalBusinessId: CANONICAL_ID }}
        userCoords={null}
      />,
    );

    // Step 4 · assert the <img> tag is present with the EXACT src.
    expect(html).toContain('data-nex-directory-card-image="present"');
    expect(html).toContain('data-nex-directory-card-image-src');
    expect(html).toContain(APPROVED_IMAGE.url);
    // The HTML should carry the alt text from the resolver output.
    expect(html).toContain('alt="Warung Pak Budi"');
    // No "representative illustration" marker should leak in · tier 1 wins.
    expect(html).not.toContain('data-nex-directory-card-image="representative"');
    // No "no-image" fallback marker · tier 1 wins.
    expect(html).not.toContain('data-nex-directory-card-image="none"');
  });

  test("honest-null: when media map is empty, no business <img> tag renders (fallback glyph instead)", () => {
    const mediaMap = new Map<string, DirectoryListingMedia>(); // empty

    const vms = projectDirectoryListings({
      rows: [makeRow()],
      mediaByCanonicalId: mediaMap,
    });
    expect(vms[0].primaryImage).toBe(null);

    const html = renderToString(
      <DirectoryCard
        listing={vms[0]}
        destination={{ kind: "place_detail", canonicalBusinessId: CANONICAL_ID }}
        userCoords={null}
      />,
    );

    // Tier 1 marker MUST be absent.
    expect(html).not.toContain('data-nex-directory-card-image="present"');
    expect(html).not.toContain('data-nex-directory-card-image-src');
    // The APPROVED_IMAGE url must NOT leak in (ensures we're not accidentally
    // keeping stale state between tests).
    expect(html).not.toContain(APPROVED_IMAGE.url);
  });

  test("the VM carries primaryImage.sourceId through to downstream code (attribution path)", () => {
    const mediaMap = new Map<string, DirectoryListingMedia>([
      [CANONICAL_ID, { primaryImage: { ...APPROVED_IMAGE, sourceId: "wikimedia_commons" } }],
    ]);
    const vms = projectDirectoryListings({ rows: [makeRow()], mediaByCanonicalId: mediaMap });
    expect(vms[0].primaryImage?.sourceId).toBe("wikimedia_commons");
    // Downstream attribution renderers (OsmAttributionBadge etc.) can key
    // off this field. The test documents that the sourceId survives
    // projection intact · a future regression that drops it will fail here.
  });

  test("mixing claimed + unclaimed listings · only the one in the media map gets the image", () => {
    const claimedId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const unclaimedId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    const mediaMap = new Map<string, DirectoryListingMedia>([
      [claimedId, { primaryImage: APPROVED_IMAGE }],
      // unclaimedId intentionally absent from the map.
    ]);
    const rows = [
      makeRow({ canonical_business_id: claimedId, lifecycle_state: "OWNER_CLAIMED" }),
      makeRow({ canonical_business_id: unclaimedId, lifecycle_state: "VERIFIED" }),
    ];
    const vms = projectDirectoryListings({ rows, mediaByCanonicalId: mediaMap });
    expect(vms[0].primaryImage).not.toBe(null);
    expect(vms[1].primaryImage).toBe(null);

    const claimedHtml = renderToString(
      <DirectoryCard
        listing={vms[0]}
        destination={{ kind: "place_detail", canonicalBusinessId: claimedId }}
        userCoords={null}
      />,
    );
    const unclaimedHtml = renderToString(
      <DirectoryCard
        listing={vms[1]}
        destination={{ kind: "place_detail", canonicalBusinessId: unclaimedId }}
        userCoords={null}
      />,
    );
    expect(claimedHtml).toContain(APPROVED_IMAGE.url);
    expect(unclaimedHtml).not.toContain(APPROVED_IMAGE.url);
  });
});
