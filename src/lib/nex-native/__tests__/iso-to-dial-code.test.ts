// src/lib/nex-native/__tests__/iso-to-dial-code.test.ts
//
// Owner-directed 2026-11-28 (third-pass second-step) · phone ↔ country
// prefix match. Pins the reverse map + helpers.

import { describe, expect, it } from "vitest";

import { COUNTRY_CATALOGUE } from "../country-catalogue";
import {
  isoToDialCode,
  stripPhone,
  phoneStartsWithDialCodeForIso,
  stripKnownDialCodePrefix,
  ALL_DIAL_CODES_LONGEST_FIRST,
} from "../country/iso-to-dial-code";

describe("isoToDialCode · coverage", () => {
  it("has a dial code for every catalogue country", () => {
    const missing = COUNTRY_CATALOGUE
      .map((c) => c.code)
      .filter((code) => isoToDialCode(code) === null);
    expect(missing).toEqual([]);
  });

  it("returns the owner-sealed launch-market prefixes", () => {
    expect(isoToDialCode("IE")).toBe("+353");
    expect(isoToDialCode("GB")).toBe("+44");
    expect(isoToDialCode("US")).toBe("+1");
    expect(isoToDialCode("ID")).toBe("+62");
    expect(isoToDialCode("AU")).toBe("+61");
  });

  it("is case-insensitive on input", () => {
    expect(isoToDialCode("ie")).toBe("+353");
    expect(isoToDialCode(" gb ")).toBe("+44");
  });

  it("returns null for unknown / malformed codes", () => {
    expect(isoToDialCode("XX")).toBeNull();
    expect(isoToDialCode(null)).toBeNull();
    expect(isoToDialCode(undefined)).toBeNull();
    expect(isoToDialCode("")).toBeNull();
    expect(isoToDialCode("I")).toBeNull();
  });
});

describe("stripPhone", () => {
  it("removes spaces, dashes, parens · preserves plus and digits", () => {
    expect(stripPhone("+353 87 123-4567")).toBe("+353871234567");
    expect(stripPhone("(044) 7700 900000")).toBe("0447700900000");
    expect(stripPhone("+1-212-555-0100")).toBe("+12125550100");
  });
});

describe("phoneStartsWithDialCodeForIso", () => {
  it("accepts a phone whose prefix matches the country's dial code", () => {
    expect(phoneStartsWithDialCodeForIso("+353 87 123 4567", "IE")).toBe(true);
    expect(phoneStartsWithDialCodeForIso("+447700900000", "GB")).toBe(true);
    expect(phoneStartsWithDialCodeForIso("+1 212 555 0100", "US")).toBe(true);
    expect(phoneStartsWithDialCodeForIso("+1 416 555 0100", "CA")).toBe(true);
    expect(phoneStartsWithDialCodeForIso("+62 812 3456 7890", "ID")).toBe(true);
  });

  it("rejects a phone whose prefix does not match", () => {
    expect(phoneStartsWithDialCodeForIso("+353 87 123 4567", "GB")).toBe(false);
    expect(phoneStartsWithDialCodeForIso("+44 7700 900000", "US")).toBe(false);
    expect(phoneStartsWithDialCodeForIso("+62 812 3456 7890", "AU")).toBe(false);
  });

  it("rejects when the iso is not in the map", () => {
    expect(phoneStartsWithDialCodeForIso("+1 212 555 0100", "XX")).toBe(false);
  });

  it("tolerates the user's spacing and punctuation", () => {
    expect(phoneStartsWithDialCodeForIso("+353-87-1234567", "IE")).toBe(true);
    expect(phoneStartsWithDialCodeForIso("+44(7700)900000", "GB")).toBe(true);
  });
});

describe("ALL_DIAL_CODES_LONGEST_FIRST", () => {
  it("is sorted longest first · so prefix matching picks +353 before +3 (if +3 existed) etc.", () => {
    for (let i = 1; i < ALL_DIAL_CODES_LONGEST_FIRST.length; i++) {
      expect(
        ALL_DIAL_CODES_LONGEST_FIRST[i - 1]!.length,
      ).toBeGreaterThanOrEqual(ALL_DIAL_CODES_LONGEST_FIRST[i]!.length);
    }
  });

  it("contains every unique dial code once", () => {
    const set = new Set(ALL_DIAL_CODES_LONGEST_FIRST);
    expect(set.size).toBe(ALL_DIAL_CODES_LONGEST_FIRST.length);
  });
});

describe("stripKnownDialCodePrefix", () => {
  it("strips a known dial code from the head of the phone", () => {
    expect(stripKnownDialCodePrefix("+353871234567")).toBe("871234567");
    expect(stripKnownDialCodePrefix("+447700900000")).toBe("7700900000");
    expect(stripKnownDialCodePrefix("+1 212 555 0100")).toBe("2125550100");
  });

  it("leaves the input unchanged (after stripPhone) when no known prefix is present", () => {
    expect(stripKnownDialCodePrefix("871234567")).toBe("871234567");
    // +999 is not in the catalogue map · remainder is the full stripped
    // input · user's typed digits stay intact.
    expect(stripKnownDialCodePrefix("+999 123 4567")).toBe("+9991234567");
  });

  it("handles the empty string", () => {
    expect(stripKnownDialCodePrefix("")).toBe("");
  });
});
