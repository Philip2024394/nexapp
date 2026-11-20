// src/lib/nex-native/delivery/__tests__/export-shipping-quote.test.ts
//
// Authored 2026-11-18 · Phase Delivery · D2
//
// Pure-library coverage for export-shipping-quote.ts.

import { describe, expect, it } from "vitest";
import type { ExportCountryEntryT } from "@/lib/nex-native/catalogue/delivery-spec";
import {
  quoteExportShipping,
  isExportQuoteValidForQuantity,
  isSubmittedExportQuoteAuthentic,
} from "../export-shipping-quote";

const COUNTRIES: ExportCountryEntryT[] = [
  { iso: "GB", price_pence: 2500, currency: "GBP", delivery_days: 7 },
  { iso: "US", price_pence: 3200, currency: "USD", delivery_days: 10 },
  { iso: "AU", price_pence: 5800, currency: "AUD" }, // no delivery_days
];

describe("quoteExportShipping · failure reasons", () => {
  it("returns no_countries_configured when seller has none", () => {
    const r = quoteExportShipping({ countries: [], destinationIso: "GB" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_countries_configured");
  });

  it("returns missing_destination when ISO is null", () => {
    const r = quoteExportShipping({ countries: COUNTRIES, destinationIso: null });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("missing_destination");
      expect(r.supportedCountries).toEqual(["GB", "US", "AU"]);
    }
  });

  it("returns missing_destination when ISO is a non-ISO string", () => {
    const r = quoteExportShipping({ countries: COUNTRIES, destinationIso: "United Kingdom" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_destination");
  });

  it("returns destination_not_supported when the country is not in the list", () => {
    const r = quoteExportShipping({ countries: COUNTRIES, destinationIso: "DE" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("destination_not_supported");
      expect(r.supportedCountries).toEqual(["GB", "US", "AU"]);
    }
  });
});

describe("quoteExportShipping · happy paths", () => {
  it("returns the exact seller rate for a supported country", () => {
    const r = quoteExportShipping({ countries: COUNTRIES, destinationIso: "GB" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.countryIso).toBe("GB");
      expect(r.fareMinor).toBe(2500);
      expect(r.currency).toBe("GBP");
      expect(r.deliveryDays).toBe(7);
    }
  });

  it("handles lowercase destination ISO by upper-casing", () => {
    const r = quoteExportShipping({ countries: COUNTRIES, destinationIso: "us" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.countryIso).toBe("US");
  });

  it("omits deliveryDays when the seller did not set it", () => {
    const r = quoteExportShipping({ countries: COUNTRIES, destinationIso: "AU" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.deliveryDays).toBeUndefined();
  });
});

describe("quoteExportShipping · schema sanitisation", () => {
  it("drops malformed country rows", () => {
    const r = quoteExportShipping({
      countries: [
        { iso: "GB", price_pence: 2500, currency: "GBP" },
        // invalid · ISO must be 2 chars upper-case per the schema
        ({ iso: "gbr", price_pence: 3000, currency: "GBP" } as unknown as ExportCountryEntryT),
      ],
      destinationIso: "GB",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fareMinor).toBe(2500);
  });
});

describe("isExportQuoteValidForQuantity · multi-unit guard", () => {
  const ok = quoteExportShipping({ countries: COUNTRIES, destinationIso: "GB" });

  it("accepts quantity 1 on a valid quote", () => {
    expect(ok.ok).toBe(true);
    expect(isExportQuoteValidForQuantity(ok, 1)).toBe(true);
  });

  it("refuses any quantity > 1 while the sealed shape has no per-item rule", () => {
    expect(isExportQuoteValidForQuantity(ok, 2)).toBe(false);
    expect(isExportQuoteValidForQuantity(ok, 5)).toBe(false);
  });

  it("refuses zero and non-finite quantities", () => {
    expect(isExportQuoteValidForQuantity(ok, 0)).toBe(false);
    expect(isExportQuoteValidForQuantity(ok, Number.NaN)).toBe(false);
    expect(isExportQuoteValidForQuantity(ok, -1)).toBe(false);
  });
});

describe("isSubmittedExportQuoteAuthentic · tamper rejection", () => {
  const authoritative = quoteExportShipping({ countries: COUNTRIES, destinationIso: "US" });

  it("accepts a matching submitted quote", () => {
    expect(authoritative.ok).toBe(true);
    if (!authoritative.ok) return;
    expect(
      isSubmittedExportQuoteAuthentic(
        {
          countryIso: authoritative.countryIso,
          fareMinor: authoritative.fareMinor,
          currency: authoritative.currency,
        },
        authoritative,
      ),
    ).toBe(true);
  });

  it("rejects a lower fare", () => {
    expect(authoritative.ok).toBe(true);
    if (!authoritative.ok) return;
    expect(
      isSubmittedExportQuoteAuthentic(
        { countryIso: "US", fareMinor: 1, currency: "USD" },
        authoritative,
      ),
    ).toBe(false);
  });

  it("rejects a currency mismatch", () => {
    expect(authoritative.ok).toBe(true);
    if (!authoritative.ok) return;
    expect(
      isSubmittedExportQuoteAuthentic(
        { countryIso: "US", fareMinor: 3200, currency: "IDR" },
        authoritative,
      ),
    ).toBe(false);
  });

  it("rejects a country mismatch", () => {
    expect(authoritative.ok).toBe(true);
    if (!authoritative.ok) return;
    expect(
      isSubmittedExportQuoteAuthentic(
        { countryIso: "GB", fareMinor: 3200, currency: "USD" },
        authoritative,
      ),
    ).toBe(false);
  });

  it("rejects everything when the authoritative resolver failed", () => {
    const fail = quoteExportShipping({ countries: [], destinationIso: "US" });
    expect(fail.ok).toBe(false);
    expect(
      isSubmittedExportQuoteAuthentic(
        { countryIso: "US", fareMinor: 3200, currency: "USD" },
        fail,
      ),
    ).toBe(false);
  });
});
