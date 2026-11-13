// src/lib/nex-native/seo/__tests__/sitemap-xml.test.ts
//
// NEX SEO B1 audit · sitemap XML content verification.
// Owner-authorised 2026-11-11.
// -----------------------------------------------------------------------------
// Beyond the HTTP 200 check: inspects the ACTUAL sitemap output and asserts
//   · Every URL starts with the IE or WW base (no bare localhost when envs
//     are set).
//   · No URL carries a private-prefix (defence in depth).
//   · Empty DB → marketing routes still emit; no shop URLs appear.
//   · DB throw → fails gracefully, no uncaught error.
//   · Mock shop with a slug that LOOKS like a private prefix is dropped.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRIVATE_PATH_PREFIXES } from "../exclude-routes";

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

const mockLoader = vi.fn();
vi.mock("@/lib/nex-native/seo/sitemap-service", () => ({
  loadPublicShopsForSitemap: () => mockLoader(),
}));

beforeEach(() => {
  for (const k of ENV_KEYS) {
    originalEnv[k] = process.env[k];
    delete process.env[k];
  }
  vi.stubEnv("NODE_ENV", "development");
  process.env.NEX_PUBLIC_SITE_URL_IE = "https://staging.nex.ie";
  process.env.NEX_PUBLIC_SITE_URL_WW = "https://staging.nexapp.com";
  mockLoader.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const k of ENV_KEYS) {
    if (originalEnv[k] === undefined) delete process.env[k];
    else (process.env as Record<string, string | undefined>)[k] = originalEnv[k];
  }
});

async function sitemap() {
  const mod = await import("@/app/sitemap");
  return mod.default();
}

describe("sitemap XML content · URL origin", () => {
  it("every URL starts with the Ireland or Worldwide base when envs are set", async () => {
    mockLoader.mockResolvedValue([
      { slug: "molly-cafe", lastModified: new Date("2026-01-01") },
    ]);
    const entries = await sitemap();
    for (const entry of entries) {
      const okIe = entry.url.startsWith("https://staging.nex.ie/") || entry.url === "https://staging.nex.ie";
      const okWw = entry.url.startsWith("https://staging.nexapp.com/") || entry.url === "https://staging.nexapp.com";
      expect(okIe || okWw, `URL ${entry.url} does not start with IE or WW base`).toBe(true);
    }
  });

  it("no URL contains a private-prefix (defence in depth)", async () => {
    mockLoader.mockResolvedValue([
      { slug: "molly-cafe", lastModified: new Date("2026-01-01") },
    ]);
    const entries = await sitemap();
    for (const entry of entries) {
      for (const prefix of PRIVATE_PATH_PREFIXES) {
        expect(
          entry.url.includes(`${prefix}/`),
          `sitemap leaked ${prefix} in ${entry.url}`,
        ).toBe(false);
      }
    }
  });

  it("no URL contains localhost when prod envs are set (dev mode)", async () => {
    mockLoader.mockResolvedValue([]);
    const entries = await sitemap();
    for (const entry of entries) {
      expect(entry.url, `sitemap leaked localhost in ${entry.url}`).not.toContain("localhost");
      expect(entry.url, `sitemap leaked 127.0.0.1 in ${entry.url}`).not.toContain("127.0.0.1");
    }
  });
});

describe("sitemap XML content · database edge cases", () => {
  it("empty DB → marketing routes still emit, zero shop entries", async () => {
    mockLoader.mockResolvedValue([]);
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    const shopEntries = entries.filter((e) =>
      /\/nex-native\/[a-z0-9-]+$/i.test(new URL(e.url).pathname) &&
      !new URL(e.url).pathname.startsWith("/nex-native/features") &&
      ![
        "/nex-native",
        "/nex-native/about",
        "/nex-native/for-sellers",
        "/nex-native/for-creators",
        "/nex-native/developers",
        "/nex-native/directory",
        "/nex-native/pricing",
        "/nex-native/free-chat",
        "/nex-native/ireland-entry",
      ].includes(new URL(e.url).pathname),
    );
    expect(shopEntries.length).toBe(0);
  });

  it("DB throw → sitemap still emits marketing routes gracefully", async () => {
    mockLoader.mockRejectedValue(new Error("supabase down"));
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.find((e) => e.url.endsWith("/nex-native/about"))).toBeTruthy();
  });

  it("shop whose slug collides with a private prefix is dropped", async () => {
    mockLoader.mockResolvedValue([
      { slug: "shop-ok", lastModified: new Date("2026-01-01") },
      // These would resolve to private-prefix matches via isPrivatePath:
      { slug: "manage", lastModified: new Date("2026-02-01") },
      { slug: "vault", lastModified: new Date("2026-03-01") },
      { slug: "hq", lastModified: new Date("2026-04-01") },
    ]);
    const entries = await sitemap();
    const paths = entries.map((e) => new URL(e.url).pathname);
    expect(paths.filter((p) => p === "/nex-native/shop-ok").length).toBe(2);
    expect(paths.filter((p) => p === "/nex-native/manage").length).toBe(0);
    expect(paths.filter((p) => p === "/nex-native/vault").length).toBe(0);
    expect(paths.filter((p) => p === "/nex-native/hq").length).toBe(0);
  });
});

describe("sitemap XML content · dual-country URL count", () => {
  it("each static entry is emitted exactly twice (once per country)", async () => {
    mockLoader.mockResolvedValue([]);
    const entries = await sitemap();
    const pathCounts = new Map<string, number>();
    for (const e of entries) {
      const p = new URL(e.url).pathname;
      pathCounts.set(p, (pathCounts.get(p) ?? 0) + 1);
    }
    expect(pathCounts.get("/nex-native/about")).toBe(2);
    expect(pathCounts.get("/nex-native/for-sellers")).toBe(2);
    expect(pathCounts.get("/nex-native/features/shops")).toBe(2);
  });
});
