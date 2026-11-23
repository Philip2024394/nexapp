// src/app/nex-native/switch/_calc-helpers.ts
//
// Pure helpers for the switch cost calculator.
//
// Kept side-effect-free + framework-free so they can be tested without
// rendering React. The calculator client composes these with React state;
// the server page uses `extractNumericAmount` to derive the initial NEX
// monthly amount from the display-price string.

/**
 * Pull the numeric amount out of a short display price like "€4.99",
 * "Rp 89,000", "AU$7.99", "¥799", "₫149,000", "CHF 4.99".
 * Returns 0 for anything unparseable. The form always lets the user
 * override, so a zero fallback is safe.
 */
export function extractNumericAmount(priceShort: string): number {
  const cleaned = priceShort
    .replace(/[^\d.,-]/g, "")
    .replace(/,/g, "")
    .trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

/** Clamp to non-negative finite numbers. 0 for NaN/Infinity/negative. */
export function clampNonNegative(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * Compute the full comparison from inputs. Pure. Single currency
 * throughout — caller is responsible for not mixing currencies.
 *
 * Owner-sealed honesty rules applied here:
 *   · hasAnySales=false → caller shows "nothing to compare"
 *   · monthlySavings<0 → caller shows "NEX costs more at this volume"
 *   · annualSavingsProjected is 12× — the word "projected" MUST appear
 *     in any surface rendering this number
 */
export interface SwitchInputs {
  readonly monthlyGmv: number;
  readonly orderCount: number;
  readonly commissionPercent: number;
  readonly fixedPerOrder: number;
  readonly nexMonthly: number;
}

export interface SwitchResult {
  readonly hasAnySales: boolean;
  readonly currentPlatformMonthlyCost: number;
  readonly nexMonthlyCost: number;
  readonly monthlySavings: number;
  readonly annualSavingsProjected: number;
  readonly nexCostsMore: boolean;
  readonly effectiveTakeRatePercent: number;
  readonly nexTakeRatePercent: number;
}

export function computeSwitchComparison(i: SwitchInputs): SwitchResult {
  const gmv = clampNonNegative(i.monthlyGmv);
  const orders = clampNonNegative(i.orderCount);
  const commission = clampNonNegative(i.commissionPercent);
  const fixed = clampNonNegative(i.fixedPerOrder);
  const nex = clampNonNegative(i.nexMonthly);

  const hasAnySales = gmv > 0 || orders > 0;
  const currentPlatformMonthlyCost = gmv * (commission / 100) + orders * fixed;
  const monthlySavings = currentPlatformMonthlyCost - nex;

  return {
    hasAnySales,
    currentPlatformMonthlyCost,
    nexMonthlyCost: nex,
    monthlySavings,
    annualSavingsProjected: monthlySavings * 12,
    nexCostsMore: monthlySavings < 0,
    effectiveTakeRatePercent: gmv > 0 ? (currentPlatformMonthlyCost / gmv) * 100 : 0,
    nexTakeRatePercent: gmv > 0 ? (nex / gmv) * 100 : 0,
  };
}

// -----------------------------------------------------------------------------
// Preset registry · dated · user-selectable · not universal truth
// -----------------------------------------------------------------------------

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly commissionPercent: number;
  readonly fixedPerOrder: number;
  readonly currency: string;
  readonly sourceCitation: string;
  readonly lastVerified: string;
  readonly note: string;
}

export const PRESETS: ReadonlyArray<Preset> = [
  {
    id: "lazada-regular-my-2025",
    label: "Lazada Malaysia · regular seller",
    commissionPercent: 22.5,
    fixedPerOrder: 0,
    currency: "MYR",
    sourceCitation: "The Star · 3 Nov 2025 · effective 1 Nov 2025",
    lastVerified: "2026-11-23",
    note:
      "Reported combined commission for non-LazMall sellers. Your exact contract may differ.",
  },
  {
    id: "lazada-lazmall-my-2025",
    label: "Lazada Malaysia · LazMall",
    commissionPercent: 21.0,
    fixedPerOrder: 0,
    currency: "MYR",
    sourceCitation: "Lowyat.NET · 18 Jul 2025 effective-date notice",
    lastVerified: "2026-11-23",
    note: "LazMall sellers only. Confirm with your Lazada account manager.",
  },
  {
    id: "shopee-id-stacked-2025",
    label: "Shopee Indonesia · stacked example",
    commissionPercent: 17.4,
    fixedPerOrder: 1250,
    currency: "IDR",
    sourceCitation: "Katadata Databoks · Jun 2025",
    lastVerified: "2026-11-23",
    note:
      "Stacked commission + Free Shipping XTRA + per-order fee example. Actual stacking varies by category and programme enrolment.",
  },
  {
    id: "tiktok-shop-example",
    label: "TikTok Shop · example",
    commissionPercent: 8.0,
    fixedPerOrder: 0,
    currency: "",
    sourceCitation: "seller-us.tiktok.com commission schedule · 2025",
    lastVerified: "2026-11-23",
    note:
      "Varies widely by category and market. Enter your actual category rate.",
  },
  {
    id: "manual",
    label: "Manual · enter your own",
    commissionPercent: 0,
    fixedPerOrder: 0,
    currency: "",
    sourceCitation: "Your real contract",
    lastVerified: "today",
    note: "Always trumps any preset above.",
  },
];
