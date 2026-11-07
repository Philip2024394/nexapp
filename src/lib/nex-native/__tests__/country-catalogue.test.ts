// src/lib/nex-native/__tests__/country-catalogue.test.ts
//
// Country catalogue helpers · unit tests.
// Owner-sealed 2026-11-07. Covers: ISO2 narrowing, phone-code fallback,
// env fallback, resolver rank order, launch-market ordering in the
// sorted catalogue, and default-currency resolution.

import { describe, it, expect } from "vitest";
import {
  COUNTRY_CATALOGUE,
  COUNTRY_CATALOGUE_SORTED,
  defaultCurrencyForCountry,
  iso2FromEnv,
  iso2FromPhoneCountryCode,
  lookupCountry,
  narrowCountryCode,
  resolveDefaultOperatingCountry,
} from "../country-catalogue";

describe("narrowCountryCode", () => {
  it("accepts a known uppercase ISO2", () => {
    expect(narrowCountryCode("IE")).toBe("IE");
    expect(narrowCountryCode("GB")).toBe("GB");
  });

  it("uppercases a lowercase input before matching", () => {
    expect(narrowCountryCode("ie")).toBe("IE");
    expect(narrowCountryCode(" us ")).toBe("US");
  });

  it("rejects unknown codes", () => {
    expect(narrowCountryCode("XX")).toBeNull();
    expect(narrowCountryCode("ZZ")).toBeNull();
  });

  it("rejects malformed input (digits, length, symbols)", () => {
    expect(narrowCountryCode("I1")).toBeNull();
    expect(narrowCountryCode("IRL")).toBeNull();
    expect(narrowCountryCode("I")).toBeNull();
    expect(narrowCountryCode("")).toBeNull();
    expect(narrowCountryCode("I-E")).toBeNull();
  });

  it("rejects null / undefined", () => {
    expect(narrowCountryCode(null)).toBeNull();
    expect(narrowCountryCode(undefined)).toBeNull();
  });
});

describe("lookupCountry", () => {
  it("returns the full catalogue entry for a known code", () => {
    const ie = lookupCountry("IE");
    expect(ie?.code).toBe("IE");
    expect(ie?.currency).toBe("EUR");
    expect(ie?.flag).toBe("🇮🇪");
  });

  it("returns null for unknown codes", () => {
    expect(lookupCountry("XX")).toBeNull();
  });
});

describe("COUNTRY_CATALOGUE_SORTED", () => {
  it("places the 5 launch markets at the front in sealed order", () => {
    const firstFive = COUNTRY_CATALOGUE_SORTED.slice(0, 5).map((c) => c.code);
    expect(firstFive).toEqual(["IE", "GB", "US", "ID", "AU"]);
  });

  it("sorts the rest alphabetically by label", () => {
    const rest = COUNTRY_CATALOGUE_SORTED.slice(5).map((c) => c.label);
    const sorted = [...rest].sort((a, b) => a.localeCompare(b));
    expect(rest).toEqual(sorted);
  });

  it("contains every entry from COUNTRY_CATALOGUE exactly once", () => {
    expect(COUNTRY_CATALOGUE_SORTED.length).toBe(COUNTRY_CATALOGUE.length);
    const codes = new Set(COUNTRY_CATALOGUE_SORTED.map((c) => c.code));
    expect(codes.size).toBe(COUNTRY_CATALOGUE.length);
  });
});

describe("defaultCurrencyForCountry", () => {
  it("returns the catalogue currency for a known country", () => {
    expect(defaultCurrencyForCountry("IE")).toBe("EUR");
    expect(defaultCurrencyForCountry("GB")).toBe("GBP");
    expect(defaultCurrencyForCountry("US")).toBe("USD");
    expect(defaultCurrencyForCountry("ID")).toBe("IDR");
    expect(defaultCurrencyForCountry("AU")).toBe("AUD");
  });

  it("falls back to EUR by default when the country is unknown", () => {
    expect(defaultCurrencyForCountry("XX")).toBe("EUR");
    expect(defaultCurrencyForCountry(null)).toBe("EUR");
    expect(defaultCurrencyForCountry(undefined)).toBe("EUR");
  });

  it("honours a caller-provided fallback", () => {
    expect(defaultCurrencyForCountry(null, "GBP")).toBe("GBP");
    expect(defaultCurrencyForCountry("XX", "USD")).toBe("USD");
  });
});

describe("iso2FromPhoneCountryCode", () => {
  it("maps common launch-market dial codes", () => {
    expect(iso2FromPhoneCountryCode("+353")).toBe("IE");
    expect(iso2FromPhoneCountryCode("+44")).toBe("GB");
    expect(iso2FromPhoneCountryCode("+1")).toBe("US");
    expect(iso2FromPhoneCountryCode("+62")).toBe("ID");
    expect(iso2FromPhoneCountryCode("+61")).toBe("AU");
  });

  it("returns null for malformed dial codes", () => {
    expect(iso2FromPhoneCountryCode("353")).toBeNull();
    expect(iso2FromPhoneCountryCode("+")).toBeNull();
    expect(iso2FromPhoneCountryCode("+++353")).toBeNull();
    expect(iso2FromPhoneCountryCode("abc")).toBeNull();
    expect(iso2FromPhoneCountryCode("")).toBeNull();
    expect(iso2FromPhoneCountryCode(null)).toBeNull();
    expect(iso2FromPhoneCountryCode(undefined)).toBeNull();
  });

  it("returns null when the sealed dial-code map points at a country outside the NEX catalogue", () => {
    // +679 → FJ (Fiji) in the sealed dial-code map, but Fiji isn't
    // in the catalogue, so the narrowing stage drops it to null.
    expect(iso2FromPhoneCountryCode("+679")).toBeNull();
  });
});

describe("iso2FromEnv", () => {
  it("narrows a known ISO2", () => {
    expect(iso2FromEnv("IE")).toBe("IE");
    expect(iso2FromEnv("gb")).toBe("GB");
  });

  it("returns null for unknown/malformed env values", () => {
    expect(iso2FromEnv("ireland")).toBeNull();
    expect(iso2FromEnv("")).toBeNull();
    expect(iso2FromEnv(null)).toBeNull();
    expect(iso2FromEnv(undefined)).toBeNull();
  });
});

describe("resolveDefaultOperatingCountry", () => {
  it("rank 1 · prefers the explicit profile country_code", () => {
    const got = resolveDefaultOperatingCountry({
      profileCountryCode: "GB",
      phoneCountryCode: "+353", // would resolve to IE
      envCountry: "US",
    });
    expect(got).toBe("GB");
  });

  it("rank 2 · falls through to phone_country_code when profile is null", () => {
    const got = resolveDefaultOperatingCountry({
      profileCountryCode: null,
      phoneCountryCode: "+353",
      envCountry: "US",
    });
    expect(got).toBe("IE");
  });

  it("rank 3 · falls through to env when profile + phone are null/unknown", () => {
    const got = resolveDefaultOperatingCountry({
      profileCountryCode: null,
      phoneCountryCode: null,
      envCountry: "US",
    });
    expect(got).toBe("US");
  });

  it("rank 4 · returns null when every source is null/unknown", () => {
    const got = resolveDefaultOperatingCountry({
      profileCountryCode: null,
      phoneCountryCode: "+999", // unknown dial code
      envCountry: "wonderland", // unknown env
    });
    expect(got).toBeNull();
  });

  it("skips an invalid profile country and advances to phone", () => {
    const got = resolveDefaultOperatingCountry({
      profileCountryCode: "ZZ", // unknown · treated as missing
      phoneCountryCode: "+44",
      envCountry: null,
    });
    expect(got).toBe("GB");
  });

  it("never throws for pathological input", () => {
    expect(() =>
      resolveDefaultOperatingCountry({
        profileCountryCode: "",
        phoneCountryCode: "",
        envCountry: "",
      }),
    ).not.toThrow();
  });
});
