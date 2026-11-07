// src/lib/nex-native/commercial/regional-pricing.ts
//
// Regional pricing registry · owner-approved 2026-11-07.
// -----------------------------------------------------------------------------
// Reference-only. This file defines the agreed regional prices for NEX
// Shop Professional + Professional Plus + Chat Themes. It does NOT:
//   · create Stripe products or prices
//   · drive live checkout sessions
//   · perform region detection at runtime (viewer-region resolver is a
//     separate concern · see resolver-plan comments below)
//
// Ireland (EUR) is the live launch market. Every other region's price
// row is marked `active: false` until the owner authorises that market.

export type SupportedRegion =
  | "IE" // Ireland · EUR · LAUNCH
  | "GB" // United Kingdom · GBP · planned
  | "US" // United States · USD · planned
  | "AU" // Australia · AUD · planned
  | "CA" // Canada · CAD · planned
  | "JP" // Japan · JPY · planned
  | "ID" // Indonesia · IDR · planned
  | "IN" // India · INR · planned
  | "PH"; // Philippines · PHP · planned

export type SupportedCurrency =
  | "EUR"
  | "GBP"
  | "USD"
  | "AUD"
  | "CAD"
  | "JPY"
  | "IDR"
  | "INR"
  | "PHP";

export type ShopTier = "professional" | "professional_plus";
export type BillingInterval = "month" | "year";

export interface RegionalPrice {
  readonly region: SupportedRegion;
  readonly currency: SupportedCurrency;
  /** Minor unit (e.g. cents) · 999 = €9.99 · 9900 = €99.00 · for
   *  zero-decimal currencies (JPY, IDR) the amount is the full
   *  value (e.g. 1290 JPY = ¥1,290). */
  readonly amountMinor: number;
  readonly active: boolean;
}

export interface TierPricing {
  readonly tier: ShopTier;
  readonly interval: BillingInterval;
  readonly prices: ReadonlyArray<RegionalPrice>;
}

// ─── NEX Shop Professional ──────────────────────────────────────────
export const PROFESSIONAL_MONTHLY: TierPricing = {
  tier: "professional",
  interval: "month",
  prices: [
    { region: "IE", currency: "EUR", amountMinor: 999, active: true },
    { region: "GB", currency: "GBP", amountMinor: 799, active: false },
    { region: "US", currency: "USD", amountMinor: 999, active: false },
    { region: "AU", currency: "AUD", amountMinor: 1499, active: false },
    { region: "CA", currency: "CAD", amountMinor: 1299, active: false },
    { region: "JP", currency: "JPY", amountMinor: 1290, active: false },
    { region: "ID", currency: "IDR", amountMinor: 49000, active: false },
    { region: "IN", currency: "INR", amountMinor: 299, active: false },
    { region: "PH", currency: "PHP", amountMinor: 199, active: false },
  ],
};

export const PROFESSIONAL_ANNUAL: TierPricing = {
  tier: "professional",
  interval: "year",
  prices: [
    { region: "IE", currency: "EUR", amountMinor: 9900, active: true },
    { region: "GB", currency: "GBP", amountMinor: 7900, active: false },
    { region: "US", currency: "USD", amountMinor: 9900, active: false },
    { region: "AU", currency: "AUD", amountMinor: 14900, active: false },
    { region: "CA", currency: "CAD", amountMinor: 12900, active: false },
    { region: "JP", currency: "JPY", amountMinor: 12900, active: false },
    { region: "ID", currency: "IDR", amountMinor: 490000, active: false },
    { region: "IN", currency: "INR", amountMinor: 2990, active: false },
    { region: "PH", currency: "PHP", amountMinor: 1990, active: false },
  ],
};

// ─── NEX Shop Professional Plus ────────────────────────────────────
export const PROFESSIONAL_PLUS_MONTHLY: TierPricing = {
  tier: "professional_plus",
  interval: "month",
  prices: [
    { region: "IE", currency: "EUR", amountMinor: 1999, active: true },
    { region: "GB", currency: "GBP", amountMinor: 1599, active: false },
    { region: "US", currency: "USD", amountMinor: 1999, active: false },
    { region: "AU", currency: "AUD", amountMinor: 2999, active: false },
    { region: "CA", currency: "CAD", amountMinor: 2599, active: false },
    { region: "JP", currency: "JPY", amountMinor: 2580, active: false },
    { region: "ID", currency: "IDR", amountMinor: 99000, active: false },
    { region: "IN", currency: "INR", amountMinor: 599, active: false },
    { region: "PH", currency: "PHP", amountMinor: 399, active: false },
  ],
};

export const PROFESSIONAL_PLUS_ANNUAL: TierPricing = {
  tier: "professional_plus",
  interval: "year",
  prices: [
    { region: "IE", currency: "EUR", amountMinor: 19900, active: true },
    { region: "GB", currency: "GBP", amountMinor: 15900, active: false },
    { region: "US", currency: "USD", amountMinor: 19900, active: false },
    { region: "AU", currency: "AUD", amountMinor: 29900, active: false },
    { region: "CA", currency: "CAD", amountMinor: 25900, active: false },
    { region: "JP", currency: "JPY", amountMinor: 25800, active: false },
    { region: "ID", currency: "IDR", amountMinor: 990000, active: false },
    { region: "IN", currency: "INR", amountMinor: 5990, active: false },
    { region: "PH", currency: "PHP", amountMinor: 3990, active: false },
  ],
};

// ─── Chat Themes (one-time, per theme) ──────────────────────────────
export const CHAT_THEME_PRICING: ReadonlyArray<RegionalPrice> = [
  { region: "IE", currency: "EUR", amountMinor: 349, active: true },
  { region: "GB", currency: "GBP", amountMinor: 299, active: false },
  { region: "US", currency: "USD", amountMinor: 399, active: false },
  { region: "AU", currency: "AUD", amountMinor: 599, active: false },
  { region: "CA", currency: "CAD", amountMinor: 499, active: false },
  { region: "JP", currency: "JPY", amountMinor: 490, active: false },
  { region: "ID", currency: "IDR", amountMinor: 29000, active: false },
  { region: "IN", currency: "INR", amountMinor: 149, active: false },
  { region: "PH", currency: "PHP", amountMinor: 79, active: false },
];

// ─── Formatter · for display only ───────────────────────────────────
export function formatPrice(price: RegionalPrice): string {
  // Zero-decimal currencies (JPY, IDR) · amountMinor is already the full value.
  const zeroDecimal = price.currency === "JPY" || price.currency === "IDR";
  const value = zeroDecimal ? price.amountMinor : price.amountMinor / 100;
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: price.currency,
      maximumFractionDigits: zeroDecimal ? 0 : 2,
    }).format(value);
  } catch {
    return `${price.currency} ${value}`;
  }
}

// ─── Lookup helpers · pure, no I/O ──────────────────────────────────
export function findPrice(
  pricing: TierPricing,
  region: SupportedRegion,
): RegionalPrice | null {
  return pricing.prices.find((p) => p.region === region) ?? null;
}

export function getActivePrice(
  pricing: TierPricing,
  region: SupportedRegion,
): RegionalPrice | null {
  const row = findPrice(pricing, region);
  return row && row.active ? row : null;
}

// ─── Viewer region resolver · plan ──────────────────────────────────
// NOT IMPLEMENTED in this file. The real resolver should live in
// src/lib/nex-native/commercial/region-resolver.ts and should read, in
// order:
//   1. Account-stored preference (new nex_account.region_pref column, nullable)
//   2. Accept-Language header country hint
//   3. Vercel/Cloudflare IP country header
//   4. NEX_APP_COUNTRY env fallback
// This file does not add that resolver · it provides the data the
// resolver would read.
