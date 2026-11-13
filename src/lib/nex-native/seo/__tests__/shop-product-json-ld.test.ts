// src/lib/nex-native/seo/__tests__/shop-product-json-ld.test.ts
//
// NEX SEO B2 closeout · product listing filter + Schema.org contract.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildShopProductJsonLdStrings } from "../shop-product-json-ld";

const ENV_KEYS = [
  "NEX_APP_IDENTITY",
  "NEX_PUBLIC_SITE_URL_WW",
  "NODE_ENV",
] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    originalEnv[k] = process.env[k];
    delete process.env[k];
  }
  vi.stubEnv("NODE_ENV", "development");
  process.env.NEX_PUBLIC_SITE_URL_WW = "https://staging.nexapp.com";
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const k of ENV_KEYS) {
    if (originalEnv[k] === undefined) delete process.env[k];
    else (process.env as Record<string, string | undefined>)[k] = originalEnv[k];
  }
});

const BASE_LIVE = {
  id: "p-1",
  name: "Latte",
  description: "Oat milk latte",
  image_url: "https://cdn.example.com/latte.jpg",
  status: "live" as const,
  price_pence: 350,
  currency: "EUR",
  stock_status: "in_stock" as const,
};

describe("buildShopProductJsonLdStrings", () => {
  it("returns [] for empty or null input", () => {
    expect(buildShopProductJsonLdStrings("molly-cafe", [])).toEqual([]);
    expect(buildShopProductJsonLdStrings("molly-cafe", null)).toEqual([]);
    expect(buildShopProductJsonLdStrings("molly-cafe", undefined)).toEqual([]);
  });

  it("drops draft and archived products", () => {
    const items = [
      BASE_LIVE,
      { ...BASE_LIVE, id: "p-2", status: "draft" as const },
      { ...BASE_LIVE, id: "p-3", status: "archived" as const },
      { ...BASE_LIVE, id: "p-4", status: null as never },
    ];
    const out = buildShopProductJsonLdStrings("molly-cafe", items);
    expect(out.length).toBe(1);
    expect(out[0]).toContain("\"productID\":\"p-1\"");
  });

  it("drops products with missing id or name", () => {
    const items = [
      { ...BASE_LIVE, id: "" },
      { ...BASE_LIVE, id: "p-2", name: "" },
      { ...BASE_LIVE, id: "p-3", name: null as unknown as string },
    ];
    expect(buildShopProductJsonLdStrings("molly-cafe", items)).toEqual([]);
  });

  it("emits Offer only when price_pence AND currency are present", () => {
    const [withOffer] = buildShopProductJsonLdStrings("molly-cafe", [BASE_LIVE]);
    expect(withOffer).toContain("\"offers\"");
    expect(withOffer).toContain("\"price\":\"3.50\"");
    expect(withOffer).toContain("\"priceCurrency\":\"EUR\"");

    const [noPrice] = buildShopProductJsonLdStrings("molly-cafe", [
      { ...BASE_LIVE, price_pence: null as unknown as number },
    ]);
    expect(noPrice).not.toContain("\"offers\"");

    const [noCurrency] = buildShopProductJsonLdStrings("molly-cafe", [
      { ...BASE_LIVE, currency: "" },
    ]);
    expect(noCurrency).not.toContain("\"offers\"");

    const [badPrice] = buildShopProductJsonLdStrings("molly-cafe", [
      { ...BASE_LIVE, price_pence: Number.NaN },
    ]);
    expect(badPrice).not.toContain("\"offers\"");

    const [infinitePrice] = buildShopProductJsonLdStrings("molly-cafe", [
      { ...BASE_LIVE, price_pence: Number.POSITIVE_INFINITY },
    ]);
    expect(infinitePrice).not.toContain("\"offers\"");
  });

  it("maps availability only for sealed stock_status values", () => {
    const [inStock] = buildShopProductJsonLdStrings("molly-cafe", [BASE_LIVE]);
    expect(inStock).toContain("\"availability\":\"https://schema.org/InStock\"");

    const [preOrder] = buildShopProductJsonLdStrings("molly-cafe", [
      { ...BASE_LIVE, stock_status: "made_to_order" },
    ]);
    expect(preOrder).toContain("https://schema.org/PreOrder");

    const [soldOut] = buildShopProductJsonLdStrings("molly-cafe", [
      { ...BASE_LIVE, stock_status: "sold_out" },
    ]);
    expect(soldOut).toContain("https://schema.org/OutOfStock");

    const [unknown] = buildShopProductJsonLdStrings("molly-cafe", [
      { ...BASE_LIVE, stock_status: null },
    ]);
    expect(unknown).not.toContain("\"availability\"");
  });

  it("never fabricates brand, rating or review fields", () => {
    const [body] = buildShopProductJsonLdStrings("molly-cafe", [BASE_LIVE]);
    expect(body).not.toContain("aggregateRating");
    expect(body).not.toContain("review");
    expect(body).not.toContain("brand");
  });

  it("uses the canonical shop URL in product URL + ID", () => {
    const [body] = buildShopProductJsonLdStrings("molly-cafe", [BASE_LIVE]);
    expect(body).toContain(
      "https://staging.nexapp.com/nex-native/molly-cafe#product-p-1",
    );
  });

  it("emits every live product in order", () => {
    const items = [
      { ...BASE_LIVE, id: "p-1", name: "Latte" },
      { ...BASE_LIVE, id: "p-2", name: "Flat white" },
      { ...BASE_LIVE, id: "p-3", name: "Americano" },
    ];
    const out = buildShopProductJsonLdStrings("molly-cafe", items);
    expect(out.length).toBe(3);
    expect(out[0]).toContain("Latte");
    expect(out[1]).toContain("Flat white");
    expect(out[2]).toContain("Americano");
  });
});
