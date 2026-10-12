// src/app/nex-native/chat-standard/_surfaces/__tests__/_shop-slider-focus.test.tsx
//
// Phase 3 · additive-prop regression test for StandardShopSlider.
//
// The slider's existing preview-mode usage passes no `focusProductId`
// so behaviour must be unchanged (prop defaults to null).
// When `focusProductId` is supplied AND matches a product, the
// corresponding card carries `data-nex-se-product-card-focused="true"`
// and the slider container carries the id as its focus-id attribute.
//
// Uses renderToStaticMarkup · no jsdom (matches repo convention).

import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  StandardShopSlider,
  type StandardShopProduct,
} from "../_shop-slider";

const COLOURS = {
  primary: "#FF7200",
  secondary: "#182540",
  deep: "#03101D",
  ink: "#F2F5F8",
};

function stubEngine() {
  return {
    colours: COLOURS,
    shopTreatment: () => ({
      containerStyle: { display: "flex", gap: 8 },
      cardStyle: { background: "#0E1C33", padding: 8, borderRadius: 10 },
      cardAccentStyle: { color: COLOURS.primary },
      productFraming: "card" as const,
    }),
  } as unknown as import("../../_engine/theme-engine").ResolvedEngine;
}

const products: StandardShopProduct[] = [
  { id: "alpha", name: "Alpha", price: "Rp 1,000", imageUrl: null },
  { id: "beta", name: "Beta", price: "Rp 2,000", imageUrl: null },
  { id: "gamma", name: "Gamma", price: "Rp 3,000", imageUrl: "/g.png" },
];

describe("StandardShopSlider focus prop", () => {
  test("behaves exactly as before when focusProductId is omitted", () => {
    const html = renderToStaticMarkup(
      <StandardShopSlider engine={stubEngine()} products={products} />,
    );
    expect(html).toContain('data-nex-se-shop-slider="true"');
    expect(html).toContain('data-nex-se-shop-slider-focus-id=""');
    const focusedTrue = html.match(
      /data-nex-se-product-card-focused="true"/g,
    );
    expect(focusedTrue).toBeNull();
  });

  test("marks the matching card as focused and exposes the id on the container", () => {
    const html = renderToStaticMarkup(
      <StandardShopSlider
        engine={stubEngine()}
        products={products}
        focusProductId="beta"
      />,
    );
    expect(html).toContain('data-nex-se-shop-slider-focus-id="beta"');
    const focusedTrue = html.match(
      /data-nex-se-product-card-focused="true"/g,
    );
    expect(focusedTrue?.length).toBe(1);
    const focusedFalse = html.match(
      /data-nex-se-product-card-focused="false"/g,
    );
    expect(focusedFalse?.length).toBe(2);
    // The focused card is beta specifically.
    expect(html).toMatch(
      /data-nex-se-product-card="beta"[^>]*data-nex-se-product-card-focused="true"/,
    );
  });

  test("renders slider normally when focusProductId does not match any product (honest-null)", () => {
    const html = renderToStaticMarkup(
      <StandardShopSlider
        engine={stubEngine()}
        products={products}
        focusProductId="not-a-real-id"
      />,
    );
    const focusedTrue = html.match(
      /data-nex-se-product-card-focused="true"/g,
    );
    expect(focusedTrue).toBeNull();
    const cardMatches = html.match(/data-nex-se-product-card="[^"]+"/g);
    expect(cardMatches?.length).toBe(3);
  });
});
