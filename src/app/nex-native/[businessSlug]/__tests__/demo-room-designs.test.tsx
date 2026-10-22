// src/app/nex-native/[businessSlug]/__tests__/demo-room-designs.test.tsx
//
// NEX · Phase A1 · demo-room-designs honesty.
// Owner-authorised 2026-10-20.
// -----------------------------------------------------------------------------
// The demo-room-designs panel is the single Phase A1 "visual
// guidance" surface. It MUST:
//   · Only render for Phase A1 accommodation subtypes (villa /
//     homestay / kost) · reject every other subtype.
//   · Carry the explicit "Only you see this" chip so the owner
//     understands this is private visual guidance.
//   · Carry the honest-copy footer about Phase B booking.
//   · Carry zero booking / reserve / buy CTAs (the only link is
//     "Add your rooms →" into the sealed products manage surface).
//
// These tests pin the sealed guard · if a future hand accidentally
// adds a booking CTA or widens the subtype gate, these fail loudly.

import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DemoRoomDesigns,
  hasDemoRoomDesignsForSubtype,
} from "../_demo-room-designs";
import type { BusinessSubtype } from "@/lib/nex-native/business/types";

describe("hasDemoRoomDesignsForSubtype · Phase A1 gate", () => {
  test.each(["villa", "homestay", "kost"] as const)(
    "returns true for %s",
    (s) => {
      expect(hasDemoRoomDesignsForSubtype(s)).toBe(true);
    },
  );

  test.each([
    "hotel",
    "guesthouse",
    "resort",
    "short_rental",
    "cafe",
    "restaurant",
    "retail",
    "beauty",
    "automotive",
  ] as const)("returns false for non-Phase-A1 subtype %s", (s) => {
    expect(hasDemoRoomDesignsForSubtype(s as BusinessSubtype)).toBe(false);
  });

  test("returns false for null / undefined", () => {
    expect(hasDemoRoomDesignsForSubtype(null)).toBe(false);
    expect(hasDemoRoomDesignsForSubtype(undefined)).toBe(false);
  });
});

describe("DemoRoomDesigns · honesty invariants", () => {
  const SUBTYPES: ReadonlyArray<BusinessSubtype> = [
    "villa",
    "homestay",
    "kost",
  ];

  test.each(SUBTYPES)(
    "%s · renders 'Only you see this' owner-only chip",
    (s) => {
      const html = renderToStaticMarkup(<DemoRoomDesigns subtype={s} />);
      expect(html).toContain("Only you see this");
      expect(html).toContain("data-nex-demo-room-owner-only-chip");
    },
  );

  test.each(SUBTYPES)(
    "%s · renders the Phase B honest-copy limitation footer",
    (s) => {
      const html = renderToStaticMarkup(<DemoRoomDesigns subtype={s} />);
      expect(html).toContain("Phase A1 limitation");
      expect(html).toContain("NEX room availability and booking land in Phase B");
    },
  );

  test.each(SUBTYPES)("%s · carries 3 example tiles", (s) => {
    const html = renderToStaticMarkup(<DemoRoomDesigns subtype={s} />);
    expect(html).toContain('data-nex-demo-room-tile="0"');
    expect(html).toContain('data-nex-demo-room-tile="1"');
    expect(html).toContain('data-nex-demo-room-tile="2"');
    expect(html).not.toContain('data-nex-demo-room-tile="3"');
  });

  test.each(SUBTYPES)(
    "%s · 'Add your rooms' CTA points to the sealed /manage/products surface",
    (s) => {
      const html = renderToStaticMarkup(<DemoRoomDesigns subtype={s} />);
      expect(html).toContain('href="/nex-native/manage/products"');
      expect(html).toContain("Add your rooms");
    },
  );

  test.each(SUBTYPES)(
    "%s · NO booking / reserve / buy CTAs appear anywhere in the panel",
    (s) => {
      const html = renderToStaticMarkup(<DemoRoomDesigns subtype={s} />);
      // Guard against future hands that might bolt a booking button
      // onto a demo tile · would silently imply bookable inventory.
      const forbidden = [
        "Book now",
        "Book this room",
        "Reserve",
        "Buy now",
        "Add to cart",
        "Check availability",
      ];
      for (const needle of forbidden) {
        expect(html.toLowerCase()).not.toContain(needle.toLowerCase());
      }
    },
  );

  test("returns null for a non-Phase-A1 subtype (safety-net)", () => {
    // Even though the call site guards against this, the component
    // also defends itself · if a Phase B subtype slips in before its
    // preset is wired, the component renders nothing instead of
    // crashing or showing a half-populated panel.
    const html = renderToStaticMarkup(
      <DemoRoomDesigns subtype={"hotel" as BusinessSubtype} />,
    );
    expect(html).toBe("");
  });
});
