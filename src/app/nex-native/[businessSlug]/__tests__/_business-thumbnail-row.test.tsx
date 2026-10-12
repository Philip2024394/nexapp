// src/app/nex-native/[businessSlug]/__tests__/_business-thumbnail-row.test.tsx
//
// Pure render-contract test for the business-page thumbnail row.
// Uses renderToStaticMarkup instead of jsdom · the repo convention
// is pure-logic tests, no jsdom in devDeps. We assert on the
// generated HTML substring + attribute shape.
//
// Covers:
//   · empty products → component renders null (no HTML output)
//   · N products → N anchors with correct href shape
//   · product id with special chars → href is URL-encoded
//   · product without image → initial-glyph fallback (no <img>)

import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BusinessThumbnailRow } from "../_business-thumbnail-row";
import type { ProductThumbnail } from "@/lib/nex-native/product-service";

const OWNER_ID = "11111111-aaaa-bbbb-cccc-222222222222";

function sampleProducts(n: number): ProductThumbnail[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `prod-${i}`,
    name: `Product ${i}`,
    price_pence: 1000 + i * 50,
    currency: "IDR",
    image_url: i % 2 === 0 ? `/img/${i}.png` : null,
  }));
}

describe("BusinessThumbnailRow", () => {
  test("renders empty string when the product list is empty", () => {
    const html = renderToStaticMarkup(
      <BusinessThumbnailRow ownerAccountId={OWNER_ID} products={[]} />,
    );
    expect(html).toBe("");
  });

  test("renders one anchor per product with correct href shape", () => {
    const products = sampleProducts(3);
    const html = renderToStaticMarkup(
      <BusinessThumbnailRow ownerAccountId={OWNER_ID} products={products} />,
    );
    expect(html).toContain('data-nex-business-thumbnail-row="true"');
    expect(html).toContain('data-nex-business-thumbnail-count="3"');
    const tileMatches = html.match(/data-nex-business-thumbnail-tile="true"/g);
    expect(tileMatches?.length).toBe(3);
    for (const p of products) {
      expect(html).toContain(
        `href="/nex-native/chat/peer/${OWNER_ID}?focus_product=${encodeURIComponent(p.id)}"`,
      );
      expect(html).toContain(`data-nex-business-thumbnail-product-id="${p.id}"`);
    }
  });

  test("renders an initial-glyph fallback when a product has no image", () => {
    const products: ProductThumbnail[] = [
      { id: "no-img", name: "quiet shoes", price_pence: 1000, currency: "IDR", image_url: null },
    ];
    const html = renderToStaticMarkup(
      <BusinessThumbnailRow ownerAccountId={OWNER_ID} products={products} />,
    );
    expect(html).toContain('data-nex-business-thumbnail-noimage="true"');
    expect(html).not.toMatch(/<img\s/);
    expect(html).toMatch(/>Q</);
  });

  test("renders a real <img> when image_url is present", () => {
    const products: ProductThumbnail[] = [
      { id: "p", name: "Teal Mug", price_pence: 500, currency: "IDR", image_url: "/x.png" },
    ];
    const html = renderToStaticMarkup(
      <BusinessThumbnailRow ownerAccountId={OWNER_ID} products={products} />,
    );
    expect(html).toContain('src="/x.png"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
  });

  test("URL-encodes special characters in product id into the href", () => {
    const products: ProductThumbnail[] = [
      { id: "pr&od id/weird", name: "x", price_pence: 1, currency: "IDR", image_url: null },
    ];
    const html = renderToStaticMarkup(
      <BusinessThumbnailRow ownerAccountId={OWNER_ID} products={products} />,
    );
    const encoded = encodeURIComponent("pr&od id/weird");
    expect(html).toContain(`focus_product=${encoded}`);
    // The raw unencoded form must not appear in the href attribute.
    expect(html).not.toContain('focus_product=pr&od id/weird"');
  });
});
