// src/lib/nex-native/seo/__tests__/json-ld.test.ts
//
// NEX SEO B2 · Schema.org builder safety contract.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBreadcrumbList,
  buildLocalBusiness,
  buildOrganization,
  buildPerson,
  buildProduct,
  buildSoftwareApplication,
  buildWebSite,
  renderJsonLd,
} from "../json-ld";

const ENV_KEYS = [
  "NEX_APP_IDENTITY",
  "NEX_APP_COUNTRY",
  "NEX_PUBLIC_SITE_URL_IE",
  "NEX_PUBLIC_SITE_URL_WW",
  "NEX_PUBLIC_LOCAL_DEV_URL",
  "PORT",
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

describe("Organization", () => {
  it("emits name + url + logo with canonical URL", () => {
    const org = buildOrganization();
    expect(org["@type"]).toBe("Organization");
    expect(org.name).toBe("NEX");
    expect(org.url).toBe("https://staging.nexapp.com/nex-native");
  });
});

describe("WebSite", () => {
  it("emits name + url", () => {
    const site = buildWebSite();
    expect(site["@type"]).toBe("WebSite");
    expect(site.url).toBe("https://staging.nexapp.com/nex-native");
  });
});

describe("SoftwareApplication", () => {
  it("emits platform + pricing offer url · no fabricated rating", () => {
    const app = buildSoftwareApplication();
    expect(app["@type"]).toBe("SoftwareApplication");
    expect(app.applicationCategory).toBe("BusinessApplication");
    expect(app).not.toHaveProperty("aggregateRating");
    expect(app).not.toHaveProperty("ratingValue");
  });
});

describe("LocalBusiness", () => {
  it("returns null when slug or displayName missing", () => {
    expect(buildLocalBusiness({ slug: "", displayName: "Cafe" })).toBeNull();
    expect(buildLocalBusiness({ slug: "cafe", displayName: "" })).toBeNull();
  });

  it("emits only the fields that exist · no invented ratings", () => {
    const biz = buildLocalBusiness({
      slug: "molly-cafe",
      displayName: "Molly's Cafe",
      description: "Family cafe in Galway",
      logoUrl: "https://cdn.example.com/logo.png",
      coverImageUrl: "https://cdn.example.com/cover.jpg",
      publicPhone: "+353 91 123456",
      publicEmail: "hello@molly.ie",
      websiteUrl: "https://molly.ie",
      address: "15 High St",
      country: "IE",
    });
    expect(biz).not.toBeNull();
    expect(biz!.name).toBe("Molly's Cafe");
    expect(biz!.url).toBe("https://staging.nexapp.com/nex-native/molly-cafe");
    expect(biz!.description).toBe("Family cafe in Galway");
    expect(biz!.telephone).toBe("+353 91 123456");
    expect(biz!.email).toBe("hello@molly.ie");
    expect(biz!.image).toBe("https://cdn.example.com/cover.jpg");
    expect(biz!).not.toHaveProperty("aggregateRating");
    expect(biz!).not.toHaveProperty("priceRange");
  });

  it("omits empty optional fields instead of emitting null/empty strings", () => {
    const biz = buildLocalBusiness({
      slug: "min",
      displayName: "Min",
    });
    expect(biz).not.toBeNull();
    expect(biz!).not.toHaveProperty("description");
    expect(biz!).not.toHaveProperty("telephone");
    expect(biz!).not.toHaveProperty("address");
    expect(biz!).not.toHaveProperty("sameAs");
  });

  it("falls back to logo when cover image is missing", () => {
    const biz = buildLocalBusiness({
      slug: "logo-only",
      displayName: "Logo Only",
      logoUrl: "https://cdn.example.com/logo.png",
    });
    expect(biz!.image).toBe("https://cdn.example.com/logo.png");
  });
});

describe("Product", () => {
  it("requires businessSlug + productId + name", () => {
    expect(
      buildProduct({ businessSlug: "", productId: "p", name: "n" }),
    ).toBeNull();
  });

  it("emits Offer when price + currency present", () => {
    const p = buildProduct({
      businessSlug: "molly-cafe",
      productId: "p-123",
      name: "Latte",
      priceMinor: 350,
      currency: "EUR",
      availability: "https://schema.org/InStock",
    });
    expect(p).not.toBeNull();
    const offers = p!.offers as Record<string, unknown>;
    expect(offers).toBeTruthy();
    expect(offers.price).toBe("3.50");
    expect(offers.priceCurrency).toBe("EUR");
    expect(offers.availability).toBe("https://schema.org/InStock");
  });

  it("omits Offer when price missing", () => {
    const p = buildProduct({
      businessSlug: "molly-cafe",
      productId: "p-123",
      name: "Latte",
    });
    expect(p).not.toBeNull();
    expect(p!).not.toHaveProperty("offers");
  });

  it("never invents availability", () => {
    const p = buildProduct({
      businessSlug: "molly-cafe",
      productId: "p-123",
      name: "Latte",
      priceMinor: 350,
      currency: "EUR",
    });
    const offers = p!.offers as Record<string, unknown>;
    expect(offers).not.toHaveProperty("availability");
  });
});

describe("Person", () => {
  it("emits alternateName with @-prefixed handle", () => {
    const p = buildPerson({
      handle: "fiona",
      displayName: "Fiona O'Reilly",
    });
    expect(p).not.toBeNull();
    expect(p!.alternateName).toBe("@fiona");
    expect(p!.url).toBe("https://staging.nexapp.com/nex-native/profile/fiona");
  });
});

describe("BreadcrumbList", () => {
  it("renders position + name + item", () => {
    const bc = buildBreadcrumbList([
      { name: "Home", path: "/nex-native" },
      { name: "Directory", path: "/nex-native/directory" },
      { name: "Molly's Cafe", path: "/nex-native/molly-cafe" },
    ]);
    expect(bc).not.toBeNull();
    const items = bc!.itemListElement as Record<string, unknown>[];
    expect(items.length).toBe(3);
    expect(items[0].position).toBe(1);
    expect(items[2].name).toBe("Molly's Cafe");
    expect(items[2].item).toBe(
      "https://staging.nexapp.com/nex-native/molly-cafe",
    );
  });

  it("returns null when every item is invalid", () => {
    expect(buildBreadcrumbList([])).toBeNull();
    expect(buildBreadcrumbList([{ name: "", path: "" }])).toBeNull();
  });
});

describe("renderJsonLd", () => {
  it("returns null for null input", () => {
    expect(renderJsonLd(null)).toBeNull();
  });
  it("stringifies payloads", () => {
    const out = renderJsonLd(buildOrganization());
    expect(typeof out).toBe("string");
    const parsed = JSON.parse(out!);
    expect(parsed["@type"]).toBe("Organization");
  });
});
