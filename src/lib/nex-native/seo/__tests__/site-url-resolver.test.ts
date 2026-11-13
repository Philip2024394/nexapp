// src/lib/nex-native/seo/__tests__/site-url-resolver.test.ts
//
// NEX SEO B1 · URL resolver safety contract.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertAbsoluteHttpUrl,
  assertProdSafeUrl,
  isLocalhostUrl,
  nexCanonicalUrl,
  nexSiteUrl,
  readNexCountry,
  resolveNexSiteUrl,
  resolveNexSiteUrlForCountry,
} from "../site-url-resolver";

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
  vi.restoreAllMocks();
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

describe("readNexCountry", () => {
  it("defaults to worldwide", () => {
    expect(readNexCountry()).toBe("worldwide");
  });

  it("reads NEX_APP_IDENTITY first", () => {
    process.env.NEX_APP_IDENTITY = "ireland";
    expect(readNexCountry()).toBe("ireland");
  });

  it("falls through to NEX_APP_COUNTRY", () => {
    process.env.NEX_APP_COUNTRY = "indonesia";
    expect(readNexCountry()).toBe("indonesia");
  });

  it("is case-insensitive and trims", () => {
    process.env.NEX_APP_IDENTITY = "  IRELAND  ";
    expect(readNexCountry()).toBe("ireland");
  });

  it("normalises unknown values to worldwide", () => {
    process.env.NEX_APP_IDENTITY = "mars";
    expect(readNexCountry()).toBe("worldwide");
  });
});

describe("assertAbsoluteHttpUrl", () => {
  it("accepts https", () => {
    expect(() => assertAbsoluteHttpUrl("https://nexapp.com", "x")).not.toThrow();
  });
  it("accepts http (for dev)", () => {
    expect(() => assertAbsoluteHttpUrl("http://localhost:3009", "x")).not.toThrow();
  });
  it("rejects relative paths", () => {
    expect(() => assertAbsoluteHttpUrl("/foo", "label")).toThrow(/label/);
  });
  it("rejects non-http protocols", () => {
    expect(() => assertAbsoluteHttpUrl("ftp://nexapp.com", "x")).toThrow(/http\(s\)/);
  });
  it("rejects garbage strings", () => {
    expect(() => assertAbsoluteHttpUrl("nope", "x")).toThrow();
  });
});

describe("isLocalhostUrl", () => {
  it("detects localhost", () => {
    expect(isLocalhostUrl("http://localhost:3009")).toBe(true);
    expect(isLocalhostUrl("http://127.0.0.1")).toBe(true);
    expect(isLocalhostUrl("http://0.0.0.0:3000")).toBe(true);
  });
  it("doesn't flag production hosts", () => {
    expect(isLocalhostUrl("https://nexapp.com")).toBe(false);
    expect(isLocalhostUrl("https://nex.ie")).toBe(false);
  });
});

describe("assertProdSafeUrl", () => {
  it("throws on localhost in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() =>
      assertProdSafeUrl("http://localhost:3009/foo", "canonical"),
    ).toThrow(/localhost/);
  });
  it("passes localhost through in dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(assertProdSafeUrl("http://localhost:3009/foo", "canonical")).toBe(
      "http://localhost:3009/foo",
    );
  });
  it("passes production URL through in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(assertProdSafeUrl("https://nexapp.com/foo", "canonical")).toBe(
      "https://nexapp.com/foo",
    );
  });
});

describe("resolveNexSiteUrl · production", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  it("throws when the Ireland env is missing", () => {
    process.env.NEX_APP_IDENTITY = "ireland";
    expect(() => resolveNexSiteUrl()).toThrow(/NEX_PUBLIC_SITE_URL_IE/);
  });

  it("throws when the Worldwide env is missing", () => {
    process.env.NEX_APP_IDENTITY = "worldwide";
    expect(() => resolveNexSiteUrl()).toThrow(/NEX_PUBLIC_SITE_URL_WW/);
  });

  it("throws when the env value is localhost", () => {
    process.env.NEX_APP_IDENTITY = "worldwide";
    process.env.NEX_PUBLIC_SITE_URL_WW = "http://localhost:3009";
    expect(() => resolveNexSiteUrl()).toThrow(/localhost/);
  });

  it("throws when the env value is http:// (not https) in prod", () => {
    process.env.NEX_APP_IDENTITY = "worldwide";
    process.env.NEX_PUBLIC_SITE_URL_WW = "http://nexapp.com";
    expect(() => resolveNexSiteUrl()).toThrow(/https/);
  });

  it("throws when the env value is invalid", () => {
    process.env.NEX_APP_IDENTITY = "worldwide";
    process.env.NEX_PUBLIC_SITE_URL_WW = "not-a-url";
    expect(() => resolveNexSiteUrl()).toThrow();
  });

  it("returns the Ireland URL in Ireland production", () => {
    process.env.NEX_APP_IDENTITY = "ireland";
    process.env.NEX_PUBLIC_SITE_URL_IE = "https://nex.ie/";
    const r = resolveNexSiteUrl();
    expect(r.url).toBe("https://nex.ie"); // trailing slash stripped
    expect(r.country).toBe("ireland");
    expect(r.source).toBe("env_ie");
    expect(r.isLocalhost).toBe(false);
    expect(r.isProduction).toBe(true);
  });

  it("returns the Worldwide URL in Worldwide production", () => {
    process.env.NEX_APP_IDENTITY = "worldwide";
    process.env.NEX_PUBLIC_SITE_URL_WW = "https://nexapp.com";
    const r = resolveNexSiteUrl();
    expect(r.url).toBe("https://nexapp.com");
    expect(r.source).toBe("env_ww");
  });
});

describe("resolveNexSiteUrl · development", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
  });

  it("falls back to http://localhost:3009 when nothing is set", () => {
    const r = resolveNexSiteUrl();
    expect(r.url).toBe("http://localhost:3009");
    expect(r.source).toBe("port_default");
    expect(r.isLocalhost).toBe(true);
  });

  it("honours PORT env", () => {
    process.env.PORT = "3008";
    const r = resolveNexSiteUrl();
    expect(r.url).toBe("http://localhost:3008");
    expect(r.source).toBe("port_env");
  });

  it("honours NEX_PUBLIC_LOCAL_DEV_URL above PORT", () => {
    process.env.PORT = "3008";
    process.env.NEX_PUBLIC_LOCAL_DEV_URL = "http://localhost:4000";
    const r = resolveNexSiteUrl();
    expect(r.url).toBe("http://localhost:4000");
    expect(r.source).toBe("env_local_dev");
  });

  it("honours the production env even in dev when set and valid", () => {
    process.env.NEX_APP_IDENTITY = "ireland";
    process.env.NEX_PUBLIC_SITE_URL_IE = "https://staging.nex.ie";
    const r = resolveNexSiteUrl();
    expect(r.url).toBe("https://staging.nex.ie");
    expect(r.source).toBe("env_ie");
  });

  it("warns and falls through when the production env is invalid in dev", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.NEX_APP_IDENTITY = "ireland";
    process.env.NEX_PUBLIC_SITE_URL_IE = "not-a-url";
    const r = resolveNexSiteUrl();
    expect(r.url).toBe("http://localhost:3009");
    expect(warn).toHaveBeenCalled();
  });
});

describe("resolveNexSiteUrlForCountry", () => {
  it("lets the sitemap enumerate both countries", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.NEX_PUBLIC_SITE_URL_IE = "https://nex.ie";
    process.env.NEX_PUBLIC_SITE_URL_WW = "https://nexapp.com";
    expect(resolveNexSiteUrlForCountry("ireland").url).toBe("https://nex.ie");
    expect(resolveNexSiteUrlForCountry("worldwide").url).toBe("https://nexapp.com");
  });
});

describe("nexSiteUrl + nexCanonicalUrl", () => {
  it("builds canonical URLs for a given path", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.NEX_APP_IDENTITY = "worldwide";
    process.env.NEX_PUBLIC_SITE_URL_WW = "https://nexapp.com";
    expect(nexSiteUrl()).toBe("https://nexapp.com");
    expect(nexCanonicalUrl("/for-sellers")).toBe("https://nexapp.com/for-sellers");
    expect(nexCanonicalUrl("for-sellers")).toBe("https://nexapp.com/for-sellers");
    expect(nexCanonicalUrl("/")).toBe("https://nexapp.com");
    expect(nexCanonicalUrl("")).toBe("https://nexapp.com");
  });
});
