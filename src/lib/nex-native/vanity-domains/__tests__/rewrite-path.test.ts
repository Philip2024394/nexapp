// Unit tests for the vanity-domain rewrite decision function.
//
// These are exercised separately from the middleware so the
// decision logic is proven in isolation before it is wired into
// the Edge runtime.

import { describe, expect, it } from "vitest";
import {
  findVanityByHost,
  isWwwHost,
  normaliseHost,
  VANITY_DOMAINS,
} from "../map";
import { resolveVanityAction } from "../rewrite-path";

const xratedbelts = VANITY_DOMAINS.find((v) => v.host === "xratedbelts.com");
if (!xratedbelts) throw new Error("xratedbelts.com config missing · test fixture broken");

describe("normaliseHost", () => {
  it("lowercases and strips port", () => {
    expect(normaliseHost("XRatedBelts.com:443")).toBe("xratedbelts.com");
  });
  it("returns null for empty / nullish / whitespace", () => {
    expect(normaliseHost(null)).toBeNull();
    expect(normaliseHost(undefined)).toBeNull();
    expect(normaliseHost("")).toBeNull();
    expect(normaliseHost("   ")).toBeNull();
  });
  it("rejects wildcard and empty port-stripped", () => {
    expect(normaliseHost("*")).toBeNull();
    expect(normaliseHost(":3008")).toBeNull();
  });
});

describe("findVanityByHost", () => {
  it("resolves apex", () => {
    expect(findVanityByHost("xratedbelts.com")?.shopSlug).toBe("x-rated-tool-belts");
  });
  it("resolves www", () => {
    expect(findVanityByHost("www.xratedbelts.com")?.shopSlug).toBe("x-rated-tool-belts");
  });
  it("is case-insensitive and ignores port", () => {
    expect(findVanityByHost("WWW.XratedBelts.com:443")?.shopSlug).toBe(
      "x-rated-tool-belts",
    );
  });
  it("returns null for unknown hosts", () => {
    expect(findVanityByHost("nexcorner.com")).toBeNull();
    expect(findVanityByHost("example.com")).toBeNull();
    expect(findVanityByHost(null)).toBeNull();
  });
});

describe("isWwwHost", () => {
  it("true for www variant", () => {
    expect(isWwwHost("www.xratedbelts.com", xratedbelts)).toBe(true);
    expect(isWwwHost("WWW.xratedbelts.com", xratedbelts)).toBe(true);
  });
  it("false for apex", () => {
    expect(isWwwHost("xratedbelts.com", xratedbelts)).toBe(false);
  });
  it("false for null / unrelated", () => {
    expect(isWwwHost(null, xratedbelts)).toBe(false);
    expect(isWwwHost("nexcorner.com", xratedbelts)).toBe(false);
  });
});

describe("resolveVanityAction · www → apex redirect", () => {
  it("emits 308 redirect for www regardless of path", () => {
    const paths = ["/", "/our-story", "/product/123", "/_next/static/x.js", "/api/foo"];
    for (const p of paths) {
      const action = resolveVanityAction(p, xratedbelts, /* isWww */ true);
      expect(action).toEqual({ kind: "www_redirect", targetHost: "xratedbelts.com" });
    }
  });
});

describe("resolveVanityAction · reserved paths pass through", () => {
  const cases = [
    "/_next/static/chunks/main.js",
    "/_next/image?url=...",
    "/api/nex-native/version",
    "/favicon.ico",
    "/favicon-32x32.png",
    "/sitemap.xml",
    "/robots.txt",
    "/manifest.webmanifest",
    "/opengraph-image",
  ];
  for (const path of cases) {
    it(`passthrough · ${path}`, () => {
      expect(resolveVanityAction(path, xratedbelts, false)).toEqual({ kind: "passthrough" });
    });
  }
});

describe("resolveVanityAction · already-internal /nex-native paths pass through", () => {
  const cases = [
    "/nex-native",
    "/nex-native/x-rated-tool-belts",
    "/nex-native/x-rated-tool-belts/our-story",
    "/nex-native/product/abc-123",
    "/nex-native/cart",
    "/nex-native/sign-in",
  ];
  for (const path of cases) {
    it(`passthrough · ${path}`, () => {
      expect(resolveVanityAction(path, xratedbelts, false)).toEqual({ kind: "passthrough" });
    });
  }
});

describe("resolveVanityAction · root rewrites to shop home", () => {
  it("/ → /nex-native/x-rated-tool-belts", () => {
    expect(resolveVanityAction("/", xratedbelts, false)).toEqual({
      kind: "rewrite",
      internalPath: "/nex-native/x-rated-tool-belts",
    });
  });
});

describe("resolveVanityAction · shop-subpath rewrites", () => {
  const cases: ReadonlyArray<[string, string]> = [
    ["/our-story", "/nex-native/x-rated-tool-belts/our-story"],
    ["/our-story/", "/nex-native/x-rated-tool-belts/our-story/"],
    ["/chat", "/nex-native/x-rated-tool-belts/chat"],
    ["/wholesale", "/nex-native/x-rated-tool-belts/wholesale"],
    ["/wholesale/catalogue", "/nex-native/x-rated-tool-belts/wholesale/catalogue"],
  ];
  for (const [input, expected] of cases) {
    it(`${input} → ${expected}`, () => {
      expect(resolveVanityAction(input, xratedbelts, false)).toEqual({
        kind: "rewrite",
        internalPath: expected,
      });
    });
  }
});

describe("resolveVanityAction · NEX top-level alias rewrites", () => {
  const cases: ReadonlyArray<[string, string]> = [
    ["/product/7fe7b701-11b3-4949-a43a-47c7570998f7", "/nex-native/product/7fe7b701-11b3-4949-a43a-47c7570998f7"],
    ["/cart", "/nex-native/cart"],
    ["/sign-in", "/nex-native/sign-in"],
    ["/sign-in/forgot", "/nex-native/sign-in/forgot"],
    ["/contacts", "/nex-native/contacts"],
    ["/account", "/nex-native/account"],
    ["/chat-themes-library", "/nex-native/chat-themes-library"],
  ];
  for (const [input, expected] of cases) {
    it(`${input} → ${expected}`, () => {
      expect(resolveVanityAction(input, xratedbelts, false)).toEqual({
        kind: "rewrite",
        internalPath: expected,
      });
    });
  }
});

describe("resolveVanityAction · unknown paths pass through (permissive)", () => {
  // Owner can tighten these later to redirect off-shop traffic back to
  // the shop home · for now the behaviour is deliberately permissive.
  const cases = ["/directory", "/nexcorner", "/pricing", "/for-sellers", "/some-random"];
  for (const path of cases) {
    it(`passthrough · ${path}`, () => {
      expect(resolveVanityAction(path, xratedbelts, false)).toEqual({ kind: "passthrough" });
    });
  }
});
