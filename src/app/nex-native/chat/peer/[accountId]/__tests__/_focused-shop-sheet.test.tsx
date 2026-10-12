// src/app/nex-native/chat/peer/[accountId]/__tests__/_focused-shop-sheet.test.tsx
//
// Pure render-contract tests. Uses renderToStaticMarkup · no jsdom.
// The sheet is a client component with React state, so we assert on
// the INITIAL server render (which is what the client first paints).

import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FocusedShopSheet,
  type FocusedShopSheetProduct,
} from "../_focused-shop-sheet";

function sampleProducts(ids: readonly string[]): FocusedShopSheetProduct[] {
  return ids.map((id, i) => ({
    id,
    name: `Item ${i}`,
    priceLabel: `Rp ${(1000 + i).toLocaleString()}`,
    imageUrl: i % 2 === 0 ? `/img/${id}.png` : null,
  }));
}

describe("FocusedShopSheet", () => {
  test("renders empty string when focusProductId is null", () => {
    const html = renderToStaticMarkup(
      <FocusedShopSheet
        focusProductId={null}
        products={sampleProducts(["a", "b", "c"])}
      />,
    );
    expect(html).toBe("");
  });

  test("renders empty string when products is empty (defence-in-depth)", () => {
    const html = renderToStaticMarkup(
      <FocusedShopSheet focusProductId="whatever" products={[]} />,
    );
    expect(html).toBe("");
  });

  test("mounts the sheet and marks the matching card as focused", () => {
    const products = sampleProducts(["alpha", "beta", "gamma"]);
    const html = renderToStaticMarkup(
      <FocusedShopSheet focusProductId="beta" products={products} />,
    );
    expect(html).toContain('data-nex-focused-shop-sheet="true"');
    expect(html).toContain('data-nex-focused-shop-sheet-focus-id="beta"');
    expect(html).toContain('data-nex-focused-shop-sheet-card="alpha"');
    expect(html).toContain('data-nex-focused-shop-sheet-card="beta"');
    expect(html).toContain('data-nex-focused-shop-sheet-card="gamma"');
    // Exactly ONE card should be focused.
    const focusedTrue = html.match(
      /data-nex-focused-shop-sheet-card-focused="true"/g,
    );
    expect(focusedTrue?.length).toBe(1);
    const focusedFalse = html.match(
      /data-nex-focused-shop-sheet-card-focused="false"/g,
    );
    expect(focusedFalse?.length).toBe(2);
  });

  test("mounts the sheet with NO focused card when focusProductId does not match (honest-null)", () => {
    const products = sampleProducts(["alpha", "beta"]);
    const html = renderToStaticMarkup(
      <FocusedShopSheet
        focusProductId="not-a-real-id"
        products={products}
      />,
    );
    expect(html).toContain('data-nex-focused-shop-sheet="true"');
    const focused = html.match(
      /data-nex-focused-shop-sheet-card-focused="true"/g,
    );
    expect(focused).toBeNull();
  });

  test("renders an initial-glyph fallback when a card has no image", () => {
    const products: FocusedShopSheetProduct[] = [
      { id: "p1", name: "noodle bowl", priceLabel: null, imageUrl: null },
    ];
    const html = renderToStaticMarkup(
      <FocusedShopSheet focusProductId="p1" products={products} />,
    );
    expect(html).toContain('data-nex-focused-shop-sheet-card="p1"');
    expect(html).not.toMatch(/<img\s[^>]*src="\/img/);
    expect(html).toContain("noodle bowl");
    // Initial glyph derived from first letter of first word
    expect(html).toMatch(/>N</);
  });
});
