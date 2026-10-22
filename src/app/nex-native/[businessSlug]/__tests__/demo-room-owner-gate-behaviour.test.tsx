// src/app/nex-native/[businessSlug]/__tests__/demo-room-owner-gate-behaviour.test.tsx
//
// R8 behaviour · prove the owner-vs-guest demo-room visibility
// gate renders correctly across the three-way matrix of
// (viewer identity × subtype × product count).
// Owner-authorised Stage 1 behaviour tests · 2026-10-20.
//
// The existing `demo-room-designs.test.tsx` (29 tests) covers the
// COMPONENT in isolation · it verifies the component's HTML output
// is honest, owner-only labelled, no booking CTAs, correct tile
// count, etc.
//
// This file adds the CALL-SITE gate behaviour · it imports the
// gate helper `hasDemoRoomDesignsForSubtype` + simulates the
// three variables that drive the panel's visibility and asserts
// the gate's boolean outcome for every cell of the matrix:
//   dimension 1: viewer identity · owner / guest / other-user
//   dimension 2: business subtype · Phase A1 (villa/homestay/kost) / non-Phase-A1 / null
//   dimension 3: product count · 0 / 1+ / unknown
//
// What this test suite CAN prove:
//   · The gate expression `isOwnerViewing && products.length === 0 &&
//     hasDemoRoomDesignsForSubtype(subtype)` returns the correct
//     boolean for every input combination.
//   · hasDemoRoomDesignsForSubtype has the correct domain.
//
// What this test suite CANNOT prove:
//   · That `page.tsx` actually consults the gate at render time
//     (that's a route-level test · the existing architecture
//     doesn't have one and introducing it would require mocking
//     ~15+ business/session/product/menu services · out of scope
//     for Stage 1).
//   · That a real browser visit as owner vs guest produces the
//     expected DOM (that's runtime verification · requires safe DB).

import { describe, test, expect } from "vitest";
import { hasDemoRoomDesignsForSubtype } from "../_demo-room-designs";
import type { BusinessSubtype } from "@/lib/nex-native/business/types";

// ─── The call-site gate expression (copied verbatim from page.tsx) ──
//
// This mirrors the gate at `[businessSlug]/page.tsx` line ~693:
//   {!isMenuVertical &&
//    isOwnerViewing &&
//    products.length === 0 &&
//    hasDemoRoomDesignsForSubtype(subtype) && (
//      <DemoRoomDesigns subtype={subtype} />
//    )}
//
// We extract the pure boolean portion for testing. If the gate
// expression in page.tsx changes, this test must be updated to
// match · the regression anchor is intentional.
function demoRoomPanelShouldRender(input: {
  isMenuVertical: boolean;
  isOwnerViewing: boolean;
  productCount: number;
  subtype: BusinessSubtype | null | undefined;
}): boolean {
  return (
    !input.isMenuVertical &&
    input.isOwnerViewing &&
    input.productCount === 0 &&
    hasDemoRoomDesignsForSubtype(input.subtype)
  );
}

// ─── R8 · the three-way visibility matrix ───────────────────────────

describe("R8 behaviour · owner × subtype × product-count matrix (27 cells)", () => {
  const subtypes: Array<BusinessSubtype | null | undefined> = [
    "villa",         // Phase A1
    "homestay",      // Phase A1
    "kost",          // Phase A1
    "hotel",         // Non-Phase-A1 accommodation
    "cafe",          // Non-Phase-A1 (food)
    "retail",        // Non-Phase-A1 (products)
    null,            // No subtype on profile
    undefined,       // Profile missing
  ];
  const owners = [true, false];
  const productCounts = [0, 1, 3, 12];

  for (const subtype of subtypes) {
    for (const isOwnerViewing of owners) {
      for (const productCount of productCounts) {
        const label = `subtype=${subtype ?? "null"} · owner=${isOwnerViewing} · products=${productCount}`;
        const isPhaseA1 =
          subtype === "villa" || subtype === "homestay" || subtype === "kost";
        const shouldRender =
          isOwnerViewing && productCount === 0 && isPhaseA1;

        test(`${label} → render=${shouldRender}`, () => {
          const actual = demoRoomPanelShouldRender({
            isMenuVertical: false,
            isOwnerViewing,
            productCount,
            subtype,
          });
          expect(actual).toBe(shouldRender);
        });
      }
    }
  }
});

// ─── R8 · explicit owner-vs-guest cells (the critical privacy case) ─

describe("R8 behaviour · owner-only is the critical privacy case", () => {
  test("owner viewing their own Villa with zero products → PANEL RENDERS", () => {
    expect(
      demoRoomPanelShouldRender({
        isMenuVertical: false,
        isOwnerViewing: true,
        productCount: 0,
        subtype: "villa",
      }),
    ).toBe(true);
  });

  test("GUEST viewing a Villa with zero products → PANEL HIDDEN (owner-only)", () => {
    expect(
      demoRoomPanelShouldRender({
        isMenuVertical: false,
        isOwnerViewing: false,
        productCount: 0,
        subtype: "villa",
      }),
    ).toBe(false);
  });

  test("GUEST viewing a Homestay with zero products → PANEL HIDDEN", () => {
    expect(
      demoRoomPanelShouldRender({
        isMenuVertical: false,
        isOwnerViewing: false,
        productCount: 0,
        subtype: "homestay",
      }),
    ).toBe(false);
  });

  test("GUEST viewing a Kost with zero products → PANEL HIDDEN", () => {
    expect(
      demoRoomPanelShouldRender({
        isMenuVertical: false,
        isOwnerViewing: false,
        productCount: 0,
        subtype: "kost",
      }),
    ).toBe(false);
  });
});

// ─── R8 · product-count disappearance behaviour ─────────────────────

describe("R8 behaviour · owner's panel disappears as soon as a product is added", () => {
  test("owner · Villa · 0 products → RENDERS", () => {
    expect(
      demoRoomPanelShouldRender({
        isMenuVertical: false,
        isOwnerViewing: true,
        productCount: 0,
        subtype: "villa",
      }),
    ).toBe(true);
  });

  test("owner · Villa · 1 product → HIDDEN (demo replaced by real inventory)", () => {
    expect(
      demoRoomPanelShouldRender({
        isMenuVertical: false,
        isOwnerViewing: true,
        productCount: 1,
        subtype: "villa",
      }),
    ).toBe(false);
  });

  test("owner · Villa · many products → HIDDEN", () => {
    expect(
      demoRoomPanelShouldRender({
        isMenuVertical: false,
        isOwnerViewing: true,
        productCount: 50,
        subtype: "villa",
      }),
    ).toBe(false);
  });
});

// ─── R8 · menu-vertical isolation ───────────────────────────────────

describe("R8 behaviour · menu-first verticals (cafe / restaurant) do not show demo-room panel", () => {
  test("owner · cafe · 0 products → HIDDEN (even though owner · even though 0 products · wrong subtype AND menu-vertical)", () => {
    expect(
      demoRoomPanelShouldRender({
        isMenuVertical: true,
        isOwnerViewing: true,
        productCount: 0,
        subtype: "cafe",
      }),
    ).toBe(false);
  });

  test("menu-vertical flag alone blocks the panel even for a Villa (defensive)", () => {
    expect(
      demoRoomPanelShouldRender({
        isMenuVertical: true,
        isOwnerViewing: true,
        productCount: 0,
        subtype: "villa",
      }),
    ).toBe(false);
  });
});

// ─── R8 · subtype safety-net ────────────────────────────────────────

describe("R8 behaviour · subtype safety-net rejects every non-Phase-A1 value", () => {
  const rejectedSubtypes: Array<BusinessSubtype | null | undefined> = [
    "hotel",
    "guesthouse",
    "resort",
    "short_rental",
    "restaurant",
    "cafe",
    "bakery",
    "retail",
    "manufacturer",
    "beauty",
    "automotive",
    "trade_construction",
    null,
    undefined,
  ];

  for (const subtype of rejectedSubtypes) {
    test(`subtype=${subtype ?? "null"} with owner+0-products+non-menu → HIDDEN (gate rejects non-Phase-A1 subtype)`, () => {
      expect(
        demoRoomPanelShouldRender({
          isMenuVertical: false,
          isOwnerViewing: true,
          productCount: 0,
          subtype,
        }),
      ).toBe(false);
    });
  }
});

// ─── R8 · page.tsx mirror-check (regression anchor) ─────────────────

describe("R8 regression anchor · page.tsx gate expression stays source-pinned", () => {
  test("page.tsx line ~693 still carries the four-condition AND gate", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../page.tsx"),
      "utf8",
    );
    // All four gate conditions must co-occur · if any is deleted,
    // the panel either leaks to guests OR fails to render for the
    // owner. This mirrors the gate above.
    expect(src).toContain("isMenuVertical");
    expect(src).toContain("isOwnerViewing");
    expect(src).toContain("products.length === 0");
    expect(src).toContain("hasDemoRoomDesignsForSubtype");
    // The gate wrapper for the panel.
    expect(src).toMatch(
      /!isMenuVertical\s*&&[\s\S]{0,120}?isOwnerViewing\s*&&[\s\S]{0,120}?products\.length\s*===\s*0\s*&&[\s\S]{0,200}?hasDemoRoomDesignsForSubtype/,
    );
  });
});
