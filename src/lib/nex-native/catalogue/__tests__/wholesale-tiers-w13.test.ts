// src/lib/nex-native/catalogue/__tests__/wholesale-tiers-w13.test.ts
//
// W13 extension coverage · dispatch lead-time range + branding /
// custom-spec capabilities. Authored 2026-11-18.

import { describe, expect, it } from "vitest";
import {
  WholesaleSpecWithTiers,
  WholesaleTier,
  validateTiers,
  readCapabilitiesFromSpec,
  readDispatchRangeForTier,
} from "../wholesale-tiers";

// ─── Schema · dispatch + capabilities are optional ────────────────────────

describe("WholesaleTier · dispatch range optional", () => {
  it("parses a tier without any dispatch range", () => {
    const r = WholesaleTier.safeParse({
      min_qty: 10,
      price_per_piece_pence: 1200,
    });
    expect(r.success).toBe(true);
  });

  it("parses a tier with a complete dispatch range", () => {
    const r = WholesaleTier.safeParse({
      min_qty: 50,
      price_per_piece_pence: 1000,
      dispatch_lead_days_min: 14,
      dispatch_lead_days_max: 21,
    });
    expect(r.success).toBe(true);
  });

  it("rejects negative dispatch_lead_days_min", () => {
    const r = WholesaleTier.safeParse({
      min_qty: 10,
      price_per_piece_pence: 1200,
      dispatch_lead_days_min: -1,
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-integer dispatch_lead_days_max", () => {
    const r = WholesaleTier.safeParse({
      min_qty: 10,
      price_per_piece_pence: 1200,
      dispatch_lead_days_max: 7.5,
    });
    expect(r.success).toBe(false);
  });
});

describe("WholesaleSpecWithTiers · capabilities + dispatch", () => {
  it("parses a spec with all W13 fields", () => {
    const r = WholesaleSpecWithTiers.safeParse({
      offered: true,
      tiers: [{ min_qty: 10, price_per_piece_pence: 500 }],
      dispatch_lead_days_min: 14,
      dispatch_lead_days_max: 28,
      branding_available: true,
      branding_terms: "£0.50/pc extra, 200+ MOQ for branded runs",
      custom_spec_available: true,
      custom_spec_terms: "Tooling from £800; 6-week lead; MOQ 500+",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.branding_available).toBe(true);
    expect(r.data.custom_spec_available).toBe(true);
  });

  it("allows branding without custom-spec and vice versa (no OEM compound)", () => {
    const brandingOnly = WholesaleSpecWithTiers.safeParse({
      offered: true,
      tiers: [{ min_qty: 10, price_per_piece_pence: 500 }],
      branding_available: true,
      custom_spec_available: false,
    });
    const customOnly = WholesaleSpecWithTiers.safeParse({
      offered: true,
      tiers: [{ min_qty: 10, price_per_piece_pence: 500 }],
      branding_available: false,
      custom_spec_available: true,
    });
    expect(brandingOnly.success).toBe(true);
    expect(customOnly.success).toBe(true);
  });

  it("rejects branding_terms longer than 400 chars", () => {
    const r = WholesaleSpecWithTiers.safeParse({
      offered: true,
      branding_terms: "x".repeat(401),
    });
    expect(r.success).toBe(false);
  });

  it("preserves legacy shape with no W13 additions", () => {
    const r = WholesaleSpecWithTiers.safeParse({
      offered: true,
      min_qty: 10,
      price_per_piece_pence: 1200,
    });
    expect(r.success).toBe(true);
  });
});

// ─── validateTiers · dispatch-range enforcement ────────────────────────────

describe("validateTiers · dispatch range inverted", () => {
  it("rejects a tier whose dispatch_lead_days_min > _max", () => {
    const r = validateTiers([
      {
        min_qty: 10,
        price_per_piece_pence: 1200,
        dispatch_lead_days_min: 21,
        dispatch_lead_days_max: 14,
      },
    ]);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toEqual({ code: "dispatch_range_inverted", index: 0 });
  });

  it("accepts a tier whose min === max (single-day commitment)", () => {
    const r = validateTiers([
      {
        min_qty: 10,
        price_per_piece_pence: 1200,
        dispatch_lead_days_min: 7,
        dispatch_lead_days_max: 7,
      },
    ]);
    expect(r.ok).toBe(true);
  });

  it("accepts a tier with only one end of the range set", () => {
    const r = validateTiers([
      {
        min_qty: 10,
        price_per_piece_pence: 1200,
        dispatch_lead_days_min: 7,
      },
    ]);
    expect(r.ok).toBe(true);
  });
});

// ─── readCapabilitiesFromSpec ──────────────────────────────────────────────

describe("readCapabilitiesFromSpec", () => {
  it("returns all-false defaults for null/undefined", () => {
    expect(readCapabilitiesFromSpec(null)).toEqual({
      branding_available: false,
      branding_terms: null,
      custom_spec_available: false,
      custom_spec_terms: null,
    });
    expect(readCapabilitiesFromSpec(undefined)).toEqual({
      branding_available: false,
      branding_terms: null,
      custom_spec_available: false,
      custom_spec_terms: null,
    });
  });

  it("reflects exact flags when present", () => {
    const r = readCapabilitiesFromSpec({
      branding_available: true,
      branding_terms: "£0.50/pc extra",
      custom_spec_available: false,
      custom_spec_terms: "",
    });
    expect(r.branding_available).toBe(true);
    expect(r.branding_terms).toBe("£0.50/pc extra");
    expect(r.custom_spec_available).toBe(false);
    expect(r.custom_spec_terms).toBeNull();
  });

  it("treats branding_available as false if non-boolean", () => {
    const r = readCapabilitiesFromSpec({
      branding_available: "true", // string not boolean
      branding_terms: "irrelevant",
    });
    expect(r.branding_available).toBe(false);
  });

  it("trims whitespace-only terms down to null", () => {
    const r = readCapabilitiesFromSpec({
      branding_available: true,
      branding_terms: "   ",
    });
    expect(r.branding_terms).toBeNull();
  });
});

// ─── readDispatchRangeForTier ──────────────────────────────────────────────

describe("readDispatchRangeForTier · precedence", () => {
  it("prefers tier-level range when well-formed", () => {
    const r = readDispatchRangeForTier(
      { dispatch_lead_days_min: 7, dispatch_lead_days_max: 14 },
      {
        min_qty: 10,
        price_per_piece_pence: 500,
        dispatch_lead_days_min: 21,
        dispatch_lead_days_max: 28,
      },
    );
    expect(r).toEqual({ min_days: 21, max_days: 28 });
  });

  it("falls back to spec-level range when tier omits range", () => {
    const r = readDispatchRangeForTier(
      { dispatch_lead_days_min: 7, dispatch_lead_days_max: 14 },
      { min_qty: 10, price_per_piece_pence: 500 },
    );
    expect(r).toEqual({ min_days: 7, max_days: 14 });
  });

  it("returns null when neither tier nor spec declare a range", () => {
    const r = readDispatchRangeForTier(
      { offered: true },
      { min_qty: 10, price_per_piece_pence: 500 },
    );
    expect(r).toBeNull();
  });

  it("ignores inverted spec-level range", () => {
    const r = readDispatchRangeForTier(
      { dispatch_lead_days_min: 20, dispatch_lead_days_max: 10 },
      null,
    );
    expect(r).toBeNull();
  });

  it("ignores partial tier range (only min) and falls back to spec", () => {
    const r = readDispatchRangeForTier(
      { dispatch_lead_days_min: 7, dispatch_lead_days_max: 14 },
      {
        min_qty: 10,
        price_per_piece_pence: 500,
        dispatch_lead_days_min: 21,
      },
    );
    // Tier is incomplete · defer to spec default.
    expect(r).toEqual({ min_days: 7, max_days: 14 });
  });
});
