// src/lib/nex-native/seo/__tests__/sitemap.test.ts
//
// NEX SEO B1 · sitemap safety contract.
//   · Enumerates both Ireland + Worldwide URLs.
//   · Never leaks a private prefix.
//   · Degrades gracefully when DB query returns empty.
//   · Static marketing routes always land.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRIVATE_PATH_PREFIXES } from "../exclude-routes";

vi.mock("@/lib/nex-native/seo/sitemap-service", () => ({
  loadPublicShopsForSitemap: vi.fn(async () => [
    { slug: "shop-a", lastModified: new Date("2026-01-01T00:00:00Z") },
    { slug: "shop-b", lastModified: new Date("2026-02-01T00:00:00Z") },
    // A slug that LOOKS private · the sitemap must drop it.
    { slug: "manage", lastModified: new Date("2026-03-01T00:00:00Z") },
  ]),
}));

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
  process.env.NEX_PUBLIC_SITE_URL_IE = "https://staging.nex.ie";
  process.env.NEX_PUBLIC_SITE_URL_WW = "https://staging.nexapp.com";
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const k of ENV_KEYS) {
    if (originalEnv[k] === undefined) delete process.env[k];
    else (process.env as Record<string, string | undefined>)[k] = originalEnv[k];
  }
});

async function sitemapNow() {
  const mod = await import("@/app/sitemap");
  return mod.default();
}

describe("sitemap route", () => {
  it("enumerates both Ireland + Worldwide bases", async () => {
    const entries = await sitemapNow();
    const ie = entries.filter((e) => e.url.startsWith("https://staging.nex.ie"));
    const ww = entries.filter((e) => e.url.startsWith("https://staging.nexapp.com"));
    expect(ie.length).toBeGreaterThan(0);
    expect(ww.length).toBeGreaterThan(0);
  });

  it("never emits any private path prefix", async () => {
    const entries = await sitemapNow();
    for (const entry of entries) {
      for (const prefix of PRIVATE_PATH_PREFIXES) {
        expect(
          entry.url,
          `sitemap leaked private prefix ${prefix} in ${entry.url}`,
        ).not.toContain(prefix + "/");
      }
    }
  });

  it("emits every static marketing route per country", async () => {
    const entries = await sitemapNow();
    const musts = [
      "/nex-native",
      "/nex-native/directory",
      "/nex-native/directory/landing",
      "/nex-native/pricing",
      "/nex-native/free-chat",
      "/nex-native/about",
      "/nex-native/for-sellers",
      "/nex-native/for-creators",
      "/nex-native/features/shops",
      "/nex-native/features/link-in-bio",
      "/nex-native/features/chat",
      "/nex-native/features/chat-themes",
      "/nex-native/features/directory",
      "/nex-native/features/vault",
      "/nex-native/developers",
    ];
    for (const path of musts) {
      expect(
        entries.find((e) => e.url === `https://staging.nex.ie${path}`),
        `IE missing ${path}`,
      ).toBeTruthy();
      expect(
        entries.find((e) => e.url === `https://staging.nexapp.com${path}`),
        `WW missing ${path}`,
      ).toBeTruthy();
    }
  });

  it("emits dynamic shop URLs for both countries, skipping private-looking slugs", async () => {
    const entries = await sitemapNow();
    const shopIe = entries.filter((e) =>
      e.url.startsWith("https://staging.nex.ie/nex-native/shop-"),
    );
    const shopWw = entries.filter((e) =>
      e.url.startsWith("https://staging.nexapp.com/nex-native/shop-"),
    );
    expect(shopIe.length).toBe(2);
    expect(shopWw.length).toBe(2);
    // "manage" slug collides with the private prefix list · must be dropped.
    const manageIe = entries.find(
      (e) => e.url === "https://staging.nex.ie/nex-native/manage",
    );
    expect(manageIe).toBeUndefined();
  });
});
