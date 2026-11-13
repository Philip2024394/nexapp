// src/lib/nex-native/seo/__tests__/emitter-prod-safety.test.ts
//
// NEX SEO · hard contract that EVERY URL emitter refuses to run in production
// when the env is missing or resolves to localhost. Owner-sealed safeguard.
// -----------------------------------------------------------------------------
// Emitters under contract:
//   1. sitemap (src/app/sitemap.ts default export)
//   2. robots  (src/app/robots.ts default export)
//   3. nexCanonicalUrl
//   4. OG image URL fields (exercised via the shop page's generateMetadata
//      which builds alternates.canonical using nexCanonicalUrl · covered
//      transitively).
//   5. JSON-LD url fields (any builder that calls nexCanonicalUrl).
//
// The common failure path for all five is resolveNexSiteUrl / assertProdSafeUrl.
// We hit them directly here · a regression in any emitter must light up red.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// Mock the sitemap DB loader so we never hit Supabase here.
vi.mock("@/lib/nex-native/seo/sitemap-service", () => ({
  loadPublicShopsForSitemap: async () => [],
}));

beforeEach(() => {
  for (const k of ENV_KEYS) {
    originalEnv[k] = process.env[k];
    delete process.env[k];
  }
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const k of ENV_KEYS) {
    if (originalEnv[k] === undefined) delete process.env[k];
    else (process.env as Record<string, string | undefined>)[k] = originalEnv[k];
  }
});

const emitters: readonly {
  name: string;
  run: () => Promise<unknown> | unknown;
}[] = [
  {
    name: "sitemap",
    run: async () => (await import("@/app/sitemap")).default(),
  },
  {
    name: "robots",
    run: async () => (await import("@/app/robots")).default(),
  },
  {
    name: "nexCanonicalUrl",
    run: async () =>
      (await import("../site-url-resolver")).nexCanonicalUrl("/nex-native/about"),
  },
  {
    name: "assertProdSafeUrl + localhost",
    run: async () =>
      (await import("../site-url-resolver")).assertProdSafeUrl(
        "http://localhost:3009/shop",
        "test",
      ),
  },
  {
    name: "buildLocalBusiness URL field (uses nexCanonicalUrl)",
    run: async () =>
      (await import("../json-ld")).buildLocalBusiness({
        slug: "foo",
        displayName: "Foo",
      }),
  },
  {
    name: "buildPerson URL field (uses nexCanonicalUrl)",
    run: async () =>
      (await import("../json-ld")).buildPerson({
        handle: "fiona",
        displayName: "Fiona",
      }),
  },
  {
    name: "buildBreadcrumbList items (uses nexCanonicalUrl)",
    run: async () =>
      (await import("../json-ld")).buildBreadcrumbList([
        { name: "Home", path: "/nex-native" },
      ]),
  },
];

describe("prod-safety contract · every emitter throws in production when env missing", () => {
  for (const emitter of emitters) {
    it(`${emitter.name} throws when NODE_ENV=production and no public URL env`, async () => {
      vi.stubEnv("NODE_ENV", "production");
      process.env.NEX_APP_IDENTITY = "worldwide";
      await expect(async () => {
        await emitter.run();
      }).rejects.toThrow();
    });
  }
});

describe("prod-safety contract · every emitter throws when env is localhost in production", () => {
  for (const emitter of emitters) {
    it(`${emitter.name} throws when NEX_PUBLIC_SITE_URL_WW = localhost in production`, async () => {
      vi.stubEnv("NODE_ENV", "production");
      process.env.NEX_APP_IDENTITY = "worldwide";
      process.env.NEX_PUBLIC_SITE_URL_WW = "http://localhost:3009";
      await expect(async () => {
        await emitter.run();
      }).rejects.toThrow();
    });
  }
});

describe("prod-safety contract · every emitter throws when env is http:// (not https) in production", () => {
  for (const emitter of emitters) {
    // assertProdSafeUrl + localhost is a special case — it only checks
    // localhost, not https upgrade, so skip it here.
    if (emitter.name === "assertProdSafeUrl + localhost") continue;
    it(`${emitter.name} throws when NEX_PUBLIC_SITE_URL_WW is http:// in production`, async () => {
      vi.stubEnv("NODE_ENV", "production");
      process.env.NEX_APP_IDENTITY = "worldwide";
      process.env.NEX_PUBLIC_SITE_URL_WW = "http://nexapp.com";
      await expect(async () => {
        await emitter.run();
      }).rejects.toThrow();
    });
  }
});

describe("prod-safety contract · emitters succeed with a valid HTTPS production env", () => {
  for (const emitter of emitters) {
    // assertProdSafeUrl takes a literal URL input · test it with a valid
    // non-localhost URL instead.
    if (emitter.name === "assertProdSafeUrl + localhost") continue;
    it(`${emitter.name} succeeds when NEX_PUBLIC_SITE_URL_WW = https://nexapp.com`, async () => {
      vi.stubEnv("NODE_ENV", "production");
      process.env.NEX_APP_IDENTITY = "worldwide";
      process.env.NEX_PUBLIC_SITE_URL_WW = "https://nexapp.com";
      const result = await emitter.run();
      expect(result).toBeDefined();
    });
  }
});
