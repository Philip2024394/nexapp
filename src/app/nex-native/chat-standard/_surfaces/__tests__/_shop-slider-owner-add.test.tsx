// src/app/nex-native/chat-standard/_surfaces/__tests__/_shop-slider-owner-add.test.tsx
//
// Owner-authorised 2026-10-20 · additive regression anchor for the
// optional `ownerAddListing` prop on `StandardShopSlider`.
//
// Uses `renderToStaticMarkup` per repo convention (matches the
// companion `_shop-slider-focus.test.tsx` · no jsdom).
//
// The prop is additive · existing callers that don't supply it must
// render exactly as before (verified by the companion test file
// `_shop-slider-focus.test.tsx` · unchanged by this cycle).

import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  StandardShopSlider,
  type StandardShopProduct,
} from "../_shop-slider";

// Minimal engine stub matching the shape used by `_shop-slider-focus.test.tsx`.
function stubEngine() {
  return {
    colours: {
      primary: "#00AFFF",
      secondary: "#040A1B",
      deep: "#000000",
    },
    shopTreatment: () => ({
      containerStyle: {
        display: "flex",
        flexDirection: "row" as const,
        gap: 12,
        overflowX: "auto" as const,
        padding: 16,
      },
      cardStyle: {
        minWidth: 120,
        maxWidth: 140,
        padding: 10,
        background: "#060B18",
        color: "#F2F5F8",
        borderRadius: 10,
      },
      cardAccentStyle: { color: "#00AFFF" },
      productFraming: "none" as const,
    }),
  } as unknown as Parameters<typeof StandardShopSlider>[0]["engine"];
}

const PRODUCTS: StandardShopProduct[] = [
  { id: "p1", name: "Thing", price: "Rp 10k", imageUrl: null },
  { id: "p2", name: "Other", price: "Rp 20k", imageUrl: null },
];

describe("StandardShopSlider · ownerAddListing (additive prop)", () => {
  test("absent prop · NO owner-add CTA rendered (behaviour preserved)", () => {
    const html = renderToStaticMarkup(
      <StandardShopSlider engine={stubEngine()} products={PRODUCTS} />,
    );
    expect(html).not.toContain("data-nex-se-shop-slider-owner-add-listing");
  });

  test("state=ready · renders an <a> link with the correct href + label", () => {
    const html = renderToStaticMarkup(
      <StandardShopSlider
        engine={stubEngine()}
        products={PRODUCTS}
        ownerAddListing={{
          state: "ready",
          href: "/nex-native/manage/menu",
          label: "Add menu item",
        }}
      />,
    );
    expect(html).toContain(
      'data-nex-se-shop-slider-owner-add-listing="ready"',
    );
    expect(html).toContain('href="/nex-native/manage/menu"');
    expect(html).toContain("Add menu item");
    // The ready CTA is an <a> tag · must not be a non-link element.
    expect(html).toMatch(
      /<a[^>]+data-nex-se-shop-slider-owner-add-listing="ready"/,
    );
  });

  test("state=blocked · renders a non-link status element with reason", () => {
    const html = renderToStaticMarkup(
      <StandardShopSlider
        engine={stubEngine()}
        products={PRODUCTS}
        ownerAddListing={{
          state: "blocked",
          label: "Rooms coming in Phase B",
          reason: "Accommodation listings depend on a Phase B migration",
        }}
      />,
    );
    expect(html).toContain(
      'data-nex-se-shop-slider-owner-add-listing="blocked"',
    );
    expect(html).toContain("Rooms coming in Phase B");
    expect(html).toContain('role="status"');
    expect(html).toMatch(/aria-label="[^"]*Phase B migration/i);
    // The blocked CTA must NOT be a <a> link.
    expect(html).not.toMatch(
      /<a[^>]+data-nex-se-shop-slider-owner-add-listing="blocked"/,
    );
  });

  test("ready CTA appears BEFORE the first product card in the markup", () => {
    const html = renderToStaticMarkup(
      <StandardShopSlider
        engine={stubEngine()}
        products={PRODUCTS}
        ownerAddListing={{
          state: "ready",
          href: "/nex-native/manage/products",
          label: "Add product",
        }}
      />,
    );
    const ctaIdx = html.indexOf(
      'data-nex-se-shop-slider-owner-add-listing="ready"',
    );
    const firstProductIdx = html.indexOf('data-nex-se-product-card="p1"');
    expect(ctaIdx).toBeGreaterThan(-1);
    expect(firstProductIdx).toBeGreaterThan(-1);
    expect(ctaIdx).toBeLessThan(firstProductIdx);
  });

  test("blocked CTA uses opacity dimming (honest coming-soon visual)", () => {
    const html = renderToStaticMarkup(
      <StandardShopSlider
        engine={stubEngine()}
        products={PRODUCTS}
        ownerAddListing={{
          state: "blocked",
          label: "Property listings coming soon",
          reason: "Property listing creation surface has not been built yet",
        }}
      />,
    );
    // React inline-style serialisation renders opacity as a decimal.
    // Match either form in the rendered style string.
    expect(html).toMatch(/opacity:\s*0\.65|opacity:0\.65/);
  });

  test("existing products still render alongside the owner-add CTA", () => {
    const html = renderToStaticMarkup(
      <StandardShopSlider
        engine={stubEngine()}
        products={PRODUCTS}
        ownerAddListing={{
          state: "ready",
          href: "/nex-native/manage/services",
          label: "Add service",
        }}
      />,
    );
    // Owner should see both the Add CTA AND their existing cards.
    expect(html).toContain('data-nex-se-product-card="p1"');
    expect(html).toContain('data-nex-se-product-card="p2"');
    expect(html).toContain('data-nex-se-shop-slider-owner-add-listing="ready"');
  });
});

// ─── Sealed source-anchor · /[businessSlug]/page.tsx owner-only block ─

describe("source anchor · /[businessSlug]/page.tsx preserves sealed gates and adds the owner-only Add Listing section", () => {
  test("sealed DemoRoomDesigns four-condition gate stays intact", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../[businessSlug]/page.tsx",
      ),
      "utf8",
    );
    // R8 regression anchor from `__tests__/demo-room-owner-gate-behaviour.test.tsx`
    // must stay matchable.
    expect(src).toMatch(
      /!isMenuVertical\s*&&[\s\S]{0,120}?isOwnerViewing\s*&&[\s\S]{0,120}?products\.length\s*===\s*0\s*&&[\s\S]{0,200}?hasDemoRoomDesignsForSubtype/,
    );
  });

  test("owner-only Add Listing section is present and uses listingAddRouteFor", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../[businessSlug]/page.tsx",
      ),
      "utf8",
    );
    expect(src).toContain("listingAddRouteFor");
    expect(src).toContain('data-nex-owner-add-listing=');
    expect(src).toContain("Owner-only");
  });

  test("owner-only block is gated on isOwnerViewing (never shown to guests)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../[businessSlug]/page.tsx",
      ),
      "utf8",
    );
    // The owner-only section's opening expression MUST include
    // `isOwnerViewing` so guests never see the Add Listing section.
    // The IIFE between the gate and the helper call needs a wider
    // allowance (subtype resolution + null-safety reads).
    expect(src).toMatch(
      /\{isOwnerViewing\s*&&[\s\S]{0,400}?listingAddRouteFor/,
    );
  });
});
