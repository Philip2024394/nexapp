// src/app/nex-native/[businessSlug]/__tests__/_owner-manage-listing-link.test.ts
//
// Owner-authorised 2026-10-20 (Track A · product management from the
// production shop surface).
// -----------------------------------------------------------------
// Source-level regression anchor for the owner-only "Manage listing"
// link appended under each product card on /[businessSlug]/. The
// link routes to the existing /manage/products/[productId] edit
// surface · changeProductStatusAction (archive/unarchive) already
// calls `revalidatePath("/nex-native/<slug>")` on save, so the
// shop refreshes automatically.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PAGE_PATH = path.resolve(__dirname, "../page.tsx");
const PAGE_SRC = fs.readFileSync(PAGE_PATH, "utf8");

// ─── A · owner-only gate preserved ─────────────────────────────────

describe("A · 'Manage listing' link is strictly owner-only", () => {
  test("the Manage link is wrapped by `isOwnerViewing && (`", () => {
    expect(PAGE_SRC).toMatch(
      /isOwnerViewing\s*&&\s*\(\s*<div[\s\S]{0,400}?data-nex-owner-manage-listing/,
    );
  });

  test("the data-nex-owner-manage-listing attribute carries the product id", () => {
    expect(PAGE_SRC).toContain("data-nex-owner-manage-listing={p.id}");
  });
});

// ─── B · routes to the EXISTING manage surface ─────────────────────

describe("B · 'Manage listing' link routes to /nex-native/manage/products/<id>", () => {
  test("href points at /nex-native/manage/products/${p.id}", () => {
    expect(PAGE_SRC).toContain(
      "href={`/nex-native/manage/products/${p.id}`}",
    );
  });

  test("does NOT invent a new /manage/products/edit/ or /manage/products/new/ route", () => {
    expect(PAGE_SRC).not.toContain("/manage/products/edit");
    expect(PAGE_SRC).not.toContain("/manage/products/new");
  });

  test("does NOT create any inline mutation action for products on this page", () => {
    // The authorisation forbade inline mutation APIs. All mutations
    // must flow through the existing /manage/products/* surface.
    expect(PAGE_SRC).not.toMatch(/updateProductAction/i);
    expect(PAGE_SRC).not.toMatch(/archiveProductAction/i);
    expect(PAGE_SRC).not.toMatch(/pauseProductAction/i);
    expect(PAGE_SRC).not.toMatch(/turnOffProductAction/i);
  });
});

// ─── C · sealed four-condition DemoRoomDesigns gate preserved ──────

describe("C · the sealed R8 four-condition DemoRoomDesigns gate stays intact", () => {
  test("the sealed gate regex still matches", () => {
    // Same anchor as `demo-room-owner-gate-behaviour.test.tsx` ·
    // adding Track A's Manage link must NOT break the sealed gate.
    expect(PAGE_SRC).toMatch(
      /!isMenuVertical\s*&&[\s\S]{0,120}?isOwnerViewing\s*&&[\s\S]{0,120}?products\.length\s*===\s*0\s*&&[\s\S]{0,200}?hasDemoRoomDesignsForSubtype/,
    );
  });

  test("hasDemoRoomDesignsForSubtype import is still present", () => {
    expect(PAGE_SRC).toContain("hasDemoRoomDesignsForSubtype");
  });

  test("DemoRoomDesigns component import is still present", () => {
    expect(PAGE_SRC).toMatch(/import\s*\{[^}]*DemoRoomDesigns[^}]*\}/);
  });
});

// ─── D · Add Listing CTA (same cycle · Phase 2) also preserved ─────

describe("D · the owner-only Add Listing CTA (same cycle) stays wired to listingAddRouteFor", () => {
  test("listingAddRouteFor import still present", () => {
    expect(PAGE_SRC).toContain("listingAddRouteFor");
  });

  test("owner-only Add Listing section is gated on isOwnerViewing", () => {
    expect(PAGE_SRC).toMatch(
      /\{isOwnerViewing\s*&&[\s\S]{0,400}?listingAddRouteFor/,
    );
  });
});

// ─── E · doctrine · the Manage link does NOT promise anything about
//          Turn off / Turn on (schema-blocker reported in receipt) ──

describe("E · doctrine · no inline Turn off / Turn on controls on the shop surface", () => {
  test("no 'Turn off' / 'Turn on' button copy appears on the shop page", () => {
    // The authorisation forbade silently equating draft/archived
    // with paused. The schema has no clean "paused" value distinct
    // from "archived" or "draft". Turn off / Turn on controls MUST
    // NOT ship on this surface until a schema decision is made.
    expect(PAGE_SRC).not.toMatch(/>\s*Turn off\s*</i);
    expect(PAGE_SRC).not.toMatch(/>\s*Turn on\s*</i);
    expect(PAGE_SRC).not.toMatch(/>\s*Pause listing\s*</i);
    expect(PAGE_SRC).not.toMatch(/>\s*Unpause listing\s*</i);
  });
});
