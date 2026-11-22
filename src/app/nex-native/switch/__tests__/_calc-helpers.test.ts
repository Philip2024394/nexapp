// src/app/nex-native/switch/__tests__/_calc-helpers.test.ts
//
// Regression tests for the switch calculator's pure helpers.
//
// Covers owner directive 2026-11-23 honesty rules:
//   · dated-citation invariant on every preset
//   · zero-sales → nothing to compare
//   · negative savings → honest flag (NEX costs more at this volume)
//   · currency parsing covers launch markets + broader display currencies
//   · monthly × 12 relationship held for "Projected annual" label

import { describe, it, expect } from "vitest";
import {
  PRESETS,
  extractNumericAmount,
  clampNonNegative,
  computeSwitchComparison,
} from "../_calc-helpers";

describe("extractNumericAmount", () => {
  it.each([
    ["€4.99", 4.99],
    ["£4.99", 4.99],
    ["US$4.99", 4.99],
    ["Rp 89,000", 89000],
    ["AU$7.99", 7.99],
    ["¥799", 799],
    ["₫149,000", 149000],
    ["CHF 4.99", 4.99],
    ["SEK 59.99", 59.99],
    ["₹449", 449],
  ])("parses %s → %s", (input, expected) => {
    expect(extractNumericAmount(input)).toBe(expected);
  });

  it("returns 0 for unparseable input", () => {
    expect(extractNumericAmount("")).toBe(0);
    expect(extractNumericAmount("no price")).toBe(0);
    expect(extractNumericAmount("abc")).toBe(0);
  });

  it("returns 0 for non-positive numbers", () => {
    expect(extractNumericAmount("0")).toBe(0);
    expect(extractNumericAmount("-5")).toBe(0);
  });
});

describe("clampNonNegative", () => {
  it("passes non-negative finite numbers through", () => {
    expect(clampNonNegative(0)).toBe(0);
    expect(clampNonNegative(4.99)).toBe(4.99);
    expect(clampNonNegative(1_000_000)).toBe(1_000_000);
  });

  it("clamps negatives to 0", () => {
    expect(clampNonNegative(-1)).toBe(0);
    expect(clampNonNegative(-0.01)).toBe(0);
  });

  it("clamps NaN / Infinity to 0", () => {
    expect(clampNonNegative(NaN)).toBe(0);
    expect(clampNonNegative(Infinity)).toBe(0);
    expect(clampNonNegative(-Infinity)).toBe(0);
  });
});

describe("PRESETS registry · honesty invariants", () => {
  it("includes the Manual option so the user can always override presets", () => {
    const manual = PRESETS.find((p) => p.id === "manual");
    expect(manual).toBeDefined();
    expect(manual?.label.toLowerCase()).toContain("manual");
  });

  it("every preset carries a source citation and last-verified date", () => {
    for (const p of PRESETS) {
      expect(p.sourceCitation.length, `preset ${p.id} missing sourceCitation`).toBeGreaterThan(0);
      expect(p.lastVerified.length, `preset ${p.id} missing lastVerified`).toBeGreaterThan(0);
    }
  });

  it("every preset has a non-empty label and id", () => {
    for (const p of PRESETS) {
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  it("the famous 22.5% Lazada example is present and dated", () => {
    const lz = PRESETS.find((p) => p.id === "lazada-regular-my-2025");
    expect(lz).toBeDefined();
    expect(lz?.commissionPercent).toBe(22.5);
    expect(lz?.sourceCitation).toMatch(/2025/);
    expect(lz?.lastVerified).toMatch(/^2026-/);
  });

  it("the 17.4% Shopee ID example is present and dated", () => {
    const sh = PRESETS.find((p) => p.id === "shopee-id-stacked-2025");
    expect(sh).toBeDefined();
    expect(sh?.commissionPercent).toBe(17.4);
    expect(sh?.fixedPerOrder).toBe(1250);
    expect(sh?.currency).toBe("IDR");
  });
});

describe("computeSwitchComparison · honesty rules", () => {
  it("zero sales → hasAnySales is false (caller shows 'nothing to compare')", () => {
    const r = computeSwitchComparison({
      monthlyGmv: 0,
      orderCount: 0,
      commissionPercent: 22.5,
      fixedPerOrder: 0,
      nexMonthly: 4.99,
    });
    expect(r.hasAnySales).toBe(false);
    expect(r.currentPlatformMonthlyCost).toBe(0);
    // NEX cost still evaluated — caller decides whether to surface it
    expect(r.nexMonthlyCost).toBe(4.99);
  });

  it("low volume → monthlySavings negative → nexCostsMore flag (honest)", () => {
    const r = computeSwitchComparison({
      monthlyGmv: 10,
      orderCount: 1,
      commissionPercent: 10,
      fixedPerOrder: 0,
      nexMonthly: 4.99,
    });
    // Current cost = 10 * 0.10 + 1 * 0 = 1.00
    // Savings = 1.00 - 4.99 = -3.99 → NEX costs more at this volume
    expect(r.currentPlatformMonthlyCost).toBeCloseTo(1.0);
    expect(r.monthlySavings).toBeCloseTo(-3.99);
    expect(r.nexCostsMore).toBe(true);
    expect(r.hasAnySales).toBe(true);
  });

  it("high volume at 22.5% → monthlySavings positive, nexCostsMore false", () => {
    // Shop doing MYR 5,000/mo on Lazada regular: 5000 * 0.225 = 1125.
    // NEX at MYR hypothetical 20 → savings = 1105.
    const r = computeSwitchComparison({
      monthlyGmv: 5000,
      orderCount: 100,
      commissionPercent: 22.5,
      fixedPerOrder: 0,
      nexMonthly: 20,
    });
    expect(r.currentPlatformMonthlyCost).toBeCloseTo(1125);
    expect(r.monthlySavings).toBeCloseTo(1105);
    expect(r.nexCostsMore).toBe(false);
  });

  it("annual projected is exactly 12× the monthly (label 'Projected' required at render)", () => {
    const r = computeSwitchComparison({
      monthlyGmv: 1000,
      orderCount: 10,
      commissionPercent: 10,
      fixedPerOrder: 1,
      nexMonthly: 5,
    });
    expect(r.annualSavingsProjected).toBeCloseTo(r.monthlySavings * 12);
  });

  it("negative/NaN inputs are clamped to 0 (no silent mis-calc)", () => {
    const r = computeSwitchComparison({
      monthlyGmv: NaN,
      orderCount: -5,
      commissionPercent: -10,
      fixedPerOrder: NaN,
      nexMonthly: -2,
    });
    expect(r.currentPlatformMonthlyCost).toBe(0);
    expect(r.nexMonthlyCost).toBe(0);
    expect(r.hasAnySales).toBe(false);
  });

  it("per-order fixed fees stack on top of commission (Shopee-style stacking)", () => {
    // Shopee ID example: 17.4% + Rp 1,250 per order
    const r = computeSwitchComparison({
      monthlyGmv: 10_000_000, // Rp 10M GMV
      orderCount: 100,
      commissionPercent: 17.4,
      fixedPerOrder: 1250,
      nexMonthly: 89_000,
    });
    // = 10_000_000 * 0.174 + 100 * 1250 = 1_740_000 + 125_000 = 1_865_000
    expect(r.currentPlatformMonthlyCost).toBeCloseTo(1_865_000);
    expect(r.effectiveTakeRatePercent).toBeCloseTo(18.65);
    expect(r.monthlySavings).toBeCloseTo(1_776_000);
    expect(r.nexCostsMore).toBe(false);
  });
});
