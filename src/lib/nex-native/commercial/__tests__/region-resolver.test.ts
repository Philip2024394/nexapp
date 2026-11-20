// A10 · 2026-11-18 · unit coverage for the viewer-region resolver.
//
// Owner-sealed priority (regional-pricing.ts lines 298-307):
//   1. account preference · 2. Accept-Language · 3. edge geo ·
//   4. env fallback · 5. hard default.
//
// The resolver returns one of the four active CheckoutRegions
// (IE / GB / US / ID) · never a planned-but-inactive region (AU /
// CA / JP / IN / PH) because the checkout endpoint has no Stripe
// price ID for those yet.

import { describe, it, expect } from "vitest";
import {
  countryFromAcceptLanguage,
  normaliseToCheckoutRegion,
  resolveViewerRegion,
  DEFAULT_CHECKOUT_REGION,
} from "../region-resolver";

function headerBag(h: Record<string, string>) {
  const lower = Object.fromEntries(
    Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return (name: string) => lower[name.toLowerCase()] ?? null;
}

describe("countryFromAcceptLanguage", () => {
  it("returns null for empty/undefined/null", () => {
    expect(countryFromAcceptLanguage(null)).toBeNull();
    expect(countryFromAcceptLanguage(undefined)).toBeNull();
    expect(countryFromAcceptLanguage("")).toBeNull();
  });

  it("extracts country code from a single tag", () => {
    expect(countryFromAcceptLanguage("en-GB")).toBe("GB");
    expect(countryFromAcceptLanguage("es-ES")).toBe("ES");
    expect(countryFromAcceptLanguage("id-ID")).toBe("ID");
  });

  it("extracts first country-tagged entry from a q-value list", () => {
    expect(countryFromAcceptLanguage("en-US,en;q=0.9,fr;q=0.8")).toBe("US");
    expect(
      countryFromAcceptLanguage("fr,en-GB;q=0.9,en;q=0.8"),
    ).toBe("GB");
  });

  it("returns null for a language-only list", () => {
    expect(countryFromAcceptLanguage("en;q=1.0,fr;q=0.9")).toBeNull();
  });

  it("is case-insensitive and tolerates whitespace", () => {
    expect(countryFromAcceptLanguage("  EN-gb , fr ")).toBe("GB");
  });

  it("rejects malformed tags", () => {
    expect(countryFromAcceptLanguage("en-123")).toBeNull();
    expect(countryFromAcceptLanguage("--")).toBeNull();
  });
});

describe("normaliseToCheckoutRegion", () => {
  it("passes CheckoutRegions through unchanged", () => {
    for (const r of ["IE", "GB", "US", "ID"] as const) {
      expect(normaliseToCheckoutRegion(r)).toBe(r);
    }
  });

  it("maps UK to GB", () => {
    expect(normaliseToCheckoutRegion("UK")).toBe("GB");
    expect(normaliseToCheckoutRegion("uk")).toBe("GB");
  });

  it("maps EU/EEA codes to IE (EUR representative)", () => {
    expect(normaliseToCheckoutRegion("FR")).toBe("IE");
    expect(normaliseToCheckoutRegion("DE")).toBe("IE");
    expect(normaliseToCheckoutRegion("NO")).toBe("IE");
    expect(normaliseToCheckoutRegion("IS")).toBe("IE");
  });

  it("returns null for unsupported countries (no USD fallback)", () => {
    // Per sealed Themes+ rule 2026-11-13, unsupported region must not
    // silently fall back to USD at the data layer. The resolver pins
    // to IE at the hard-default rung ONLY when no earlier signal
    // resolved · an unsupported country cannot resolve.
    expect(normaliseToCheckoutRegion("AU")).toBeNull();
    expect(normaliseToCheckoutRegion("CA")).toBeNull();
    expect(normaliseToCheckoutRegion("JP")).toBeNull();
    expect(normaliseToCheckoutRegion("BR")).toBeNull();
    expect(normaliseToCheckoutRegion("ZA")).toBeNull();
  });

  it("returns null for empty/malformed", () => {
    expect(normaliseToCheckoutRegion(null)).toBeNull();
    expect(normaliseToCheckoutRegion(undefined)).toBeNull();
    expect(normaliseToCheckoutRegion("")).toBeNull();
    expect(normaliseToCheckoutRegion("   ")).toBeNull();
    expect(normaliseToCheckoutRegion("XX")).toBeNull();
  });
});

describe("resolveViewerRegion · priority order", () => {
  it("1 · account preference wins over every other signal", () => {
    const got = resolveViewerRegion({
      accountRegionPref: "ID",
      getHeader: headerBag({
        "accept-language": "en-US",
        "x-vercel-ip-country": "GB",
        "cf-ipcountry": "FR",
      }),
      envFallback: "IE",
    });
    expect(got).toEqual({ region: "ID", source: "account_pref" });
  });

  it("2 · Accept-Language wins when no account pref", () => {
    const got = resolveViewerRegion({
      accountRegionPref: null,
      getHeader: headerBag({
        "accept-language": "en-GB,en;q=0.9",
        "x-vercel-ip-country": "US",
      }),
    });
    expect(got).toEqual({ region: "GB", source: "accept_language" });
  });

  it("2b · Accept-Language falls through when country is unsupported", () => {
    // 'ja-JP' isn't in the active four · must skip to the next signal.
    const got = resolveViewerRegion({
      accountRegionPref: null,
      getHeader: headerBag({
        "accept-language": "ja-JP,en;q=0.9",
        "x-vercel-ip-country": "US",
      }),
    });
    expect(got).toEqual({ region: "US", source: "edge_geo" });
  });

  it("3 · edge geo (Vercel) wins when only edge signal present", () => {
    const got = resolveViewerRegion({
      getHeader: headerBag({ "x-vercel-ip-country": "ID" }),
    });
    expect(got).toEqual({ region: "ID", source: "edge_geo" });
  });

  it("3b · Cloudflare header used when Vercel absent", () => {
    const got = resolveViewerRegion({
      getHeader: headerBag({ "cf-ipcountry": "IE" }),
    });
    expect(got).toEqual({ region: "IE", source: "edge_geo" });
  });

  it("3c · EU/EEA edge country maps to IE", () => {
    const got = resolveViewerRegion({
      getHeader: headerBag({ "x-vercel-ip-country": "DE" }),
    });
    expect(got).toEqual({ region: "IE", source: "edge_geo" });
  });

  it("4 · env fallback honoured when no other signal", () => {
    const got = resolveViewerRegion({
      getHeader: () => null,
      envFallback: "US",
    });
    expect(got).toEqual({ region: "US", source: "env_fallback" });
  });

  it("5 · hard default IE when everything is missing", () => {
    const got = resolveViewerRegion({
      getHeader: () => null,
      envFallback: null,
    });
    expect(got).toEqual({
      region: DEFAULT_CHECKOUT_REGION,
      source: "hard_default",
    });
  });

  it("ignores an unsupported account preference and falls through", () => {
    const got = resolveViewerRegion({
      accountRegionPref: "BR", // Brazil · not supported today
      getHeader: headerBag({ "x-vercel-ip-country": "US" }),
    });
    expect(got).toEqual({ region: "US", source: "edge_geo" });
  });

  it("treats empty-string account pref as unset", () => {
    const got = resolveViewerRegion({
      accountRegionPref: "   ",
      getHeader: headerBag({ "x-vercel-ip-country": "GB" }),
    });
    expect(got).toEqual({ region: "GB", source: "edge_geo" });
  });
});
