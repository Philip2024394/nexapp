// src/lib/nex-native/calls/__tests__/invite-service.test.ts
//
// Owner-authorised 2026-11-08 (rounds 22-25) · targeted unit tests
// for the Call Center invite service helpers. Covers:
//   · iso2ToCallCountry mapping + unknown fallback
//   · isCrossCountry decision rules (same-country + worldwide +
//     cross-country)
//   · preserves owner principle #3 · unknown-country MUST NOT block

import { describe, expect, it, vi } from "vitest";

// Harness · same discipline as the other nex-native service tests ·
// stub server-only + env + the supabase-admin client so the pure
// helper functions can be exercised without a live DB.
vi.mock("server-only", () => ({}));
vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");
vi.mock("../../supabase-admin", () => ({
  nexSupabaseAdmin: { from: () => ({}) },
}));
vi.mock("../../security-rate-limit", () => ({
  accountRateLimitKey: (id: string) => `acct:${id}`,
  isSecurityRateLimitError: () => false,
  recordIfAllowed: () => Promise.resolve(),
}));

import {
  iso2ToCallCountry,
  isCrossCountry,
} from "../invite-service";

describe("iso2ToCallCountry", () => {
  it("IE → ireland", () => {
    expect(iso2ToCallCountry("IE")).toBe("ireland");
    expect(iso2ToCallCountry("ie")).toBe("ireland");
  });
  it("ID → indonesia", () => {
    expect(iso2ToCallCountry("ID")).toBe("indonesia");
    expect(iso2ToCallCountry("id")).toBe("indonesia");
  });
  it("other ISO2 → worldwide", () => {
    expect(iso2ToCallCountry("US")).toBe("worldwide");
    expect(iso2ToCallCountry("GB")).toBe("worldwide");
    expect(iso2ToCallCountry("AU")).toBe("worldwide");
  });
  it("null · undefined · empty → worldwide (honest unknown)", () => {
    expect(iso2ToCallCountry(null)).toBe("worldwide");
    expect(iso2ToCallCountry(undefined)).toBe("worldwide");
    expect(iso2ToCallCountry("")).toBe("worldwide");
  });
});

describe("isCrossCountry · Option C hybrid rules", () => {
  it("same-country · NOT cross-country (principle 1)", () => {
    expect(isCrossCountry("ireland", "ireland")).toBe(false);
    expect(isCrossCountry("indonesia", "indonesia")).toBe(false);
    expect(isCrossCountry("worldwide", "worldwide")).toBe(false);
  });
  it("different named countries · IS cross-country (principle 2)", () => {
    expect(isCrossCountry("ireland", "indonesia")).toBe(true);
    expect(isCrossCountry("indonesia", "ireland")).toBe(true);
  });
  it("worldwide on either side · NOT cross-country (principle 3 · unknown must not block)", () => {
    expect(isCrossCountry("ireland", "worldwide")).toBe(false);
    expect(isCrossCountry("worldwide", "indonesia")).toBe(false);
  });
  it("global on either side · NOT cross-country (same reasoning)", () => {
    expect(isCrossCountry("global", "ireland")).toBe(false);
    expect(isCrossCountry("indonesia", "global")).toBe(false);
  });
});
