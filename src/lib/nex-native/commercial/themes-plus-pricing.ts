// src/lib/nex-native/commercial/themes-plus-pricing.ts
//
// NEX Themes+ · pricing helper · owner-sealed 2026-11-13.
// -----------------------------------------------------------------------------
// Thin reader over THEMES_PLUS_MONTHLY in regional-pricing.ts. Lets UI
// decide between "show price CTA" and "show waitlist CTA" for the
// viewer's region without duplicating the market rules.
//
// Pure derivations · no network · no account reads · safe to import
// from client and server modules alike.

import {
  THEMES_PLUS_MONTHLY,
  type SupportedRegion,
  type SupportedCurrency,
} from "./regional-pricing";

export interface ThemesPlusMonthlyPrice {
  readonly region: SupportedRegion;
  readonly currency: SupportedCurrency;
  readonly amountMinor: number;
  /** Pre-formatted display label · e.g. "£1.99", "€2.49", "Rp 19,000",
   *  "A$3.99". UI should prefer this over hand-formatting so the symbol
   *  + grouping stays consistent with the sealed decision. */
  readonly label: string;
}

/** Launch markets sealed 2026-11-13. Keep in sync with the
 *  `active: true` rows in THEMES_PLUS_MONTHLY · the gate function
 *  below derives from that so there is only one source of truth. */
export function isThemesPlusLaunchMarket(region: SupportedRegion): boolean {
  const row = THEMES_PLUS_MONTHLY.prices.find((p) => p.region === region);
  return !!row?.active;
}

/** Returns the monthly price for the viewer's region when the market
 *  is live, else `null`. `null` means "show the waitlist CTA" · UI
 *  must NOT substitute USD or any other displayed price. */
export function getThemesPlusMonthlyForMarket(
  region: SupportedRegion,
): ThemesPlusMonthlyPrice | null {
  const row = THEMES_PLUS_MONTHLY.prices.find((p) => p.region === region);
  if (!row || !row.active) return null;
  return {
    region: row.region,
    currency: row.currency,
    amountMinor: row.amountMinor,
    label: formatMonthlyLabel(row.currency, row.amountMinor),
  };
}

/** Enumerate the launch-market rows for use by the pricing page. */
export function listThemesPlusLaunchPrices(): ReadonlyArray<ThemesPlusMonthlyPrice> {
  return THEMES_PLUS_MONTHLY.prices
    .filter((p) => p.active)
    .map((p) => ({
      region: p.region,
      currency: p.currency,
      amountMinor: p.amountMinor,
      label: formatMonthlyLabel(p.currency, p.amountMinor),
    }));
}

/** Currency-aware label formatter. Zero-decimal currencies (IDR, JPY)
 *  format the raw amount without a decimal separator. Other currencies
 *  divide by 100 and keep two decimals. */
function formatMonthlyLabel(
  currency: SupportedCurrency,
  amountMinor: number,
): string {
  const zeroDecimal = currency === "IDR" || currency === "JPY";
  const value = zeroDecimal ? amountMinor : amountMinor / 100;
  switch (currency) {
    case "EUR":
      return `€${value.toFixed(2)}`;
    case "GBP":
      return `£${value.toFixed(2)}`;
    case "USD":
      return `$${value.toFixed(2)}`;
    case "AUD":
      return `A$${value.toFixed(2)}`;
    case "CAD":
      return `C$${value.toFixed(2)}`;
    case "IDR":
      return `Rp ${value.toLocaleString("en-US")}`;
    case "JPY":
      return `¥${value.toLocaleString("en-US")}`;
    case "INR":
      return `₹${value.toFixed(2)}`;
    case "PHP":
      return `₱${value.toFixed(2)}`;
  }
}
