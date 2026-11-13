// src/lib/nex-native/seo/__tests__/robots.test.ts
//
// NEX SEO B1 · robots route contract. Confirms the sealed crawler stance
// (Allow search bots · Disallow training bots) + private-path enforcement
// for every user-agent AND the sitemap URL emission.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
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

beforeEach(() => {
  for (const k of ENV_KEYS) {
    originalEnv[k] = process.env[k];
    delete process.env[k];
  }
  vi.stubEnv("NODE_ENV", "development");
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const k of ENV_KEYS) {
    if (originalEnv[k] === undefined) {
      delete process.env[k];
    } else {
      (process.env as Record<string, string | undefined>)[k] = originalEnv[k];
    }
  }
});

function rulesArray(r: ReturnType<typeof robots>) {
  const rules = r.rules;
  return Array.isArray(rules) ? rules : [rules];
}

// Owner-sealed crawler stance 2026-11-11. This is pinned here so a
// silent edit to robots.ts or the list in it would flip this test red.
const OWNER_APPROVED_ALLOW = [
  "Googlebot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
] as const;
const OWNER_APPROVED_DISALLOW = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
] as const;

describe("robots route · owner-approved crawler stance pinned", () => {
  it("emits exactly the owner-approved allow list (no additions, no drops)", () => {
    const entries = rulesArray(robots());
    const allowUas = entries
      .filter((r) => r.allow && Array.isArray(r.allow))
      .map((r) => r.userAgent)
      .filter((ua): ua is string => typeof ua === "string" && ua !== "*");
    // Any search-bot allow-entry must be in the owner-approved list.
    for (const ua of allowUas) {
      expect(
        [...OWNER_APPROVED_ALLOW].includes(ua as (typeof OWNER_APPROVED_ALLOW)[number]),
        `${ua} has an allow-entry but is not owner-approved`,
      ).toBe(true);
    }
    for (const ua of OWNER_APPROVED_ALLOW) {
      expect(allowUas.includes(ua), `owner-approved allow ${ua} missing`).toBe(true);
    }
  });

  it("emits exactly the owner-approved disallow list (training crawlers)", () => {
    const entries = rulesArray(robots());
    const uasBlanketDisallow = entries
      .filter(
        (r) =>
          Array.isArray(r.disallow) &&
          r.disallow.length === 1 &&
          r.disallow[0] === "/" &&
          !r.allow,
      )
      .map((r) => r.userAgent)
      .filter((ua): ua is string => typeof ua === "string" && ua !== "*");
    for (const ua of uasBlanketDisallow) {
      expect(
        [...OWNER_APPROVED_DISALLOW].includes(
          ua as (typeof OWNER_APPROVED_DISALLOW)[number],
        ),
        `${ua} has a blanket disallow but is not in the owner-approved training-crawler list`,
      ).toBe(true);
    }
    for (const ua of OWNER_APPROVED_DISALLOW) {
      expect(
        uasBlanketDisallow.includes(ua),
        `owner-approved training-crawler disallow ${ua} missing`,
      ).toBe(true);
    }
  });
});

describe("robots route", () => {
  it("emits an allow entry for every sealed search crawler", () => {
    const entries = rulesArray(robots());
    for (const ua of [
      "Googlebot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "PerplexityBot",
    ]) {
      const hit = entries.find((r) => r.userAgent === ua);
      expect(hit, `${ua} rule missing`).toBeTruthy();
      expect(hit?.allow).toEqual(["/"]);
    }
  });

  it("emits a disallow:/ entry for every sealed training crawler", () => {
    const entries = rulesArray(robots());
    for (const ua of [
      "GPTBot",
      "ClaudeBot",
      "anthropic-ai",
      "CCBot",
      "Google-Extended",
    ]) {
      const hit = entries.find((r) => r.userAgent === ua);
      expect(hit, `${ua} rule missing`).toBeTruthy();
      expect(hit?.disallow).toEqual(["/"]);
      expect(hit?.allow).toBeUndefined();
    }
  });

  it("disallows every private prefix for EVERY search/default user-agent", () => {
    const entries = rulesArray(robots());
    const uasThatMustDisallowPrivate = [
      "Googlebot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "PerplexityBot",
      "*",
    ];
    for (const ua of uasThatMustDisallowPrivate) {
      const hit = entries.find((r) => r.userAgent === ua);
      expect(hit, `${ua} rule missing`).toBeTruthy();
      for (const prefix of PRIVATE_PATH_PREFIXES) {
        expect(
          hit?.disallow,
          `${ua} must disallow ${prefix}/`,
        ).toContain(`${prefix}/`);
      }
    }
  });

  it("includes the fallback wildcard rule", () => {
    const entries = rulesArray(robots());
    const star = entries.find((r) => r.userAgent === "*");
    expect(star).toBeTruthy();
    expect(star?.allow).toEqual(["/"]);
  });

  it("emits the sitemap URL and site host", () => {
    process.env.NEX_PUBLIC_LOCAL_DEV_URL = "http://localhost:3010";
    const out = robots();
    expect(out.sitemap).toBe("http://localhost:3010/sitemap.xml");
    expect(out.host).toBe("http://localhost:3010");
  });

  it("sitemap URL throws in production if env resolves to localhost", () => {
    // Prod + no envs → the URL resolver throws before robots ever emits.
    vi.stubEnv("NODE_ENV", "production");
    process.env.NEX_APP_IDENTITY = "worldwide";
    expect(() => robots()).toThrow(/NEX_PUBLIC_SITE_URL_WW/);
  });
});
