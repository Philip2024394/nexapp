// src/lib/nex-native/__tests__/default-currency-from-business-row.test.ts
//
// defaultCurrencyFromBusinessRow · unit tests.
// Owner-sealed 2026-11-07. Exercises the per-shop currency fallback
// chain (operating_country_code → NEX_APP_CURRENCY env → NEX_APP_COUNTRY
// env → "EUR") without touching Supabase.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock "server-only" so importing business-service doesn't fail under vitest.
vi.mock("server-only", () => ({}));
// Mock supabase-admin so the top-level import doesn't try to hit the network.
vi.mock("../supabase-admin", () => ({ nexSupabaseAdmin: null }));

import { defaultCurrencyFromBusinessRow } from "../business-service";
import type { NexBusinessRow } from "../types";

function buildRow(partial: Partial<NexBusinessRow> = {}): NexBusinessRow {
  // Only the field we actually read matters here; everything else is
  // cast through `as NexBusinessRow` because the resolver ignores it.
  return { operating_country_code: null, ...partial } as NexBusinessRow;
}

describe("defaultCurrencyFromBusinessRow", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.NEX_APP_CURRENCY;
    delete process.env.NEX_APP_COUNTRY;
    delete process.env.NEXT_PUBLIC_NEX_APP_COUNTRY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("rank 1 · reads operating_country_code when present", () => {
    expect(defaultCurrencyFromBusinessRow(buildRow({ operating_country_code: "IE" }))).toBe("EUR");
    expect(defaultCurrencyFromBusinessRow(buildRow({ operating_country_code: "GB" }))).toBe("GBP");
    expect(defaultCurrencyFromBusinessRow(buildRow({ operating_country_code: "US" }))).toBe("USD");
    expect(defaultCurrencyFromBusinessRow(buildRow({ operating_country_code: "ID" }))).toBe("IDR");
    expect(defaultCurrencyFromBusinessRow(buildRow({ operating_country_code: "AU" }))).toBe("AUD");
  });

  it("rank 1 · unknown country on the row falls through (not a hard failure)", () => {
    // Unknown country on the row shouldn't crash · the row got past the
    // CHECK constraint somehow (e.g. a future ISO2 the catalogue
    // hasn't been updated to carry yet) · fall through to env → EUR.
    expect(defaultCurrencyFromBusinessRow(buildRow({ operating_country_code: "ZZ" }))).toBe("EUR");
  });

  it("rank 2 · uses NEX_APP_CURRENCY when the business has no country", () => {
    process.env.NEX_APP_CURRENCY = "GBP";
    expect(defaultCurrencyFromBusinessRow(buildRow())).toBe("GBP");
  });

  it("rank 2 · ignores malformed NEX_APP_CURRENCY and continues", () => {
    process.env.NEX_APP_CURRENCY = "gbp"; // wrong case
    process.env.NEX_APP_COUNTRY = "US";
    expect(defaultCurrencyFromBusinessRow(buildRow())).toBe("USD");
  });

  it("rank 3 · derives currency from NEX_APP_COUNTRY when NEX_APP_CURRENCY unset", () => {
    process.env.NEX_APP_COUNTRY = "IE";
    expect(defaultCurrencyFromBusinessRow(buildRow())).toBe("EUR");
  });

  it("rank 3 · uses NEXT_PUBLIC_NEX_APP_COUNTRY as an alternate env", () => {
    process.env.NEXT_PUBLIC_NEX_APP_COUNTRY = "AU";
    expect(defaultCurrencyFromBusinessRow(buildRow())).toBe("AUD");
  });

  it("rank 4 · falls back to EUR when every source is unset/unknown", () => {
    expect(defaultCurrencyFromBusinessRow(buildRow())).toBe("EUR");
    expect(defaultCurrencyFromBusinessRow(null)).toBe("EUR");
  });

  it("prefers the row over env when both are set (rank 1 wins)", () => {
    process.env.NEX_APP_CURRENCY = "GBP";
    process.env.NEX_APP_COUNTRY = "GB";
    expect(defaultCurrencyFromBusinessRow(buildRow({ operating_country_code: "ID" }))).toBe("IDR");
  });
});
