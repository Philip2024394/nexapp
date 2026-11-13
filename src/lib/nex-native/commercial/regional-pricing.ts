// src/lib/nex-native/commercial/regional-pricing.ts
//
// Regional pricing registry · owner-authorised 2026-11-08 (round 29).
// -----------------------------------------------------------------------------
// Single Shop package model · supersedes the earlier 3-tier
// (entry/professional/professional_plus) structure. Reflects the
// commercial model agreed 2026-11-08:
//
//   · NEX Shop · €4.99 / £4.99 / $4.99 / Rp 89,000 per month
//   · Chat Themes · one-time per theme (per-region pricing preserved)
//   · Storage packs · sold separately (+5 / +10 / +25 GB)
//   · Bandwidth packs · sold separately (+30 / +100 / +300 GB)
//   · Vault bundled inside Shop subscription
//   · 0% commission on sales
//
// Reference-only. This file DOES NOT:
//   · create Stripe products or prices
//   · drive live checkout sessions
//   · perform region detection at runtime (viewer-region resolver is a
//     separate concern · see resolver-plan comments below)
//
// Launch markets (IE / GB / US / ID) are flagged `active: true`.
// Indonesia pack upgrade prices are deliberately held at `active: false`
// pending pilot usage data · owner directive 2026-11-08.

export type SupportedRegion =
  | "IE" // Ireland · EUR · LAUNCH
  | "GB" // United Kingdom · GBP · LAUNCH
  | "US" // United States · USD · LAUNCH
  | "ID" // Indonesia · IDR · LAUNCH base package · upgrade prices deferred
  | "AU" // Australia · AUD · planned
  | "CA" // Canada · CAD · planned
  | "JP" // Japan · JPY · planned
  | "IN" // India · INR · planned
  | "PH"; // Philippines · PHP · planned

export type SupportedCurrency =
  | "EUR"
  | "GBP"
  | "USD"
  | "IDR"
  | "AUD"
  | "CAD"
  | "JPY"
  | "INR"
  | "PHP";

/** The sealed NEX Shop tier set. Single paid tier · supersedes the
 *  three-tier spec that pre-dated the 2026-11-08 commercial seal.
 *  'entry' remains the signed-in-but-unpaid trial surface. */
export type ShopTier = "entry" | "shop";
export type BillingInterval = "month" | "year";

export interface RegionalPrice {
  readonly region: SupportedRegion;
  readonly currency: SupportedCurrency;
  /** Minor unit (e.g. cents) · 499 = €4.99 · 4900 = €49.00 · for
   *  zero-decimal currencies (JPY, IDR) the amount is the full
   *  value (e.g. 89000 IDR = Rp 89,000). */
  readonly amountMinor: number;
  readonly active: boolean;
}

export interface TierPricing {
  readonly tier: ShopTier;
  readonly interval: BillingInterval;
  readonly prices: ReadonlyArray<RegionalPrice>;
}

// ─── NEX Shop · single paid package ─────────────────────────────────
// €4.99 / £4.99 / $4.99 / Rp 89,000 per month. Annual option retained
// at ~17% discount (standard SaaS convention) · not sealed by owner ·
// SUPPORTED-defaults-only · annual rows remain `active: false` until
// owner authorises annual billing separately.
export const SHOP_MONTHLY: TierPricing = {
  tier: "shop",
  interval: "month",
  prices: [
    { region: "IE", currency: "EUR", amountMinor: 499, active: true },
    { region: "GB", currency: "GBP", amountMinor: 499, active: true },
    { region: "US", currency: "USD", amountMinor: 499, active: true },
    { region: "ID", currency: "IDR", amountMinor: 89000, active: true },
    { region: "AU", currency: "AUD", amountMinor: 799, active: false },
    { region: "CA", currency: "CAD", amountMinor: 699, active: false },
    { region: "JP", currency: "JPY", amountMinor: 790, active: false },
    { region: "IN", currency: "INR", amountMinor: 199, active: false },
    { region: "PH", currency: "PHP", amountMinor: 99, active: false },
  ],
};

export const SHOP_ANNUAL: TierPricing = {
  tier: "shop",
  interval: "year",
  prices: [
    // Annual discount convention · owner has not sealed annual billing ·
    // rows kept `active: false` until authorised.
    { region: "IE", currency: "EUR", amountMinor: 4990, active: false },
    { region: "GB", currency: "GBP", amountMinor: 4990, active: false },
    { region: "US", currency: "USD", amountMinor: 4990, active: false },
    { region: "ID", currency: "IDR", amountMinor: 890000, active: false },
    { region: "AU", currency: "AUD", amountMinor: 7990, active: false },
    { region: "CA", currency: "CAD", amountMinor: 6990, active: false },
    { region: "JP", currency: "JPY", amountMinor: 7900, active: false },
    { region: "IN", currency: "INR", amountMinor: 1990, active: false },
    { region: "PH", currency: "PHP", amountMinor: 990, active: false },
  ],
};

// ─── Chat Themes (one-time, per theme) · RETIRED for new customers ──
// Owner directive 2026-11-13 (restating 2026-11-11) · the per-theme
// one-time purchase model is replaced by the Themes+ monthly
// subscription below. Pricing table kept in code so legacy
// `nex_theme_ownership` rows with `source='stripe_one_time'` still
// resolve · UI must NOT offer this as a purchase option for new
// customers. New entitlement flows go through Themes+ OR the
// first-free grant.
export const CHAT_THEME_PRICING: ReadonlyArray<RegionalPrice> = [
  { region: "IE", currency: "EUR", amountMinor: 349, active: true },
  { region: "GB", currency: "GBP", amountMinor: 299, active: true },
  { region: "US", currency: "USD", amountMinor: 399, active: true },
  { region: "ID", currency: "IDR", amountMinor: 29000, active: true },
  { region: "AU", currency: "AUD", amountMinor: 599, active: false },
  { region: "CA", currency: "CAD", amountMinor: 499, active: false },
  { region: "JP", currency: "JPY", amountMinor: 490, active: false },
  { region: "IN", currency: "INR", amountMinor: 149, active: false },
  { region: "PH", currency: "PHP", amountMinor: 79, active: false },
];

// ─── Themes+ · monthly subscription · SEALED 2026-11-13 ─────────────
// Single subscription unlocks ALL paid chat themes. Every user keeps
// their first paid theme free permanently via a `source='first_free'`
// row in `nex_theme_ownership`. NO free trial at launch.
// Supersedes CHAT_THEME_PRICING as the default offer for new customers.
//
// Launch markets (IE / GB / US / ID / AU) are `active: true`. Every
// other region row MUST stay `active: false` so UI renders a WAITLIST
// card · owner directive: "Unsupported regions must show a waitlist.
// Do not fall back to USD."
export const THEMES_PLUS_MONTHLY: TierPricing = {
  tier: "shop", // reuse enum · ShopTier currently has no "themes_plus" member · acceptable because this constant is market-gated by name
  interval: "month",
  prices: [
    { region: "IE", currency: "EUR", amountMinor: 249, active: true },
    { region: "GB", currency: "GBP", amountMinor: 199, active: true },
    { region: "US", currency: "USD", amountMinor: 249, active: true },
    { region: "ID", currency: "IDR", amountMinor: 19000, active: true },
    { region: "AU", currency: "AUD", amountMinor: 399, active: true },
    { region: "CA", currency: "CAD", amountMinor: 0, active: false },
    { region: "JP", currency: "JPY", amountMinor: 0, active: false },
    { region: "IN", currency: "INR", amountMinor: 0, active: false },
    { region: "PH", currency: "PHP", amountMinor: 0, active: false },
  ],
};

// ─── Capacity add-on packs ──────────────────────────────────────────
// Sold separately from storage so a busy shop is priced correctly on
// delivery cost · sealed owner directive 2026-11-08. All packs are
// recurring monthly subscription line items · never one-time Stripe
// Checkouts (the fixed Stripe fee would eat the small-pack margin per
// the 2026-11-08 evidence pack). Indonesia upgrade prices DEFERRED
// until pilot data lands · owner directive.

export type StoragePackSize = "pack_5gb" | "pack_10gb" | "pack_25gb";
export type BandwidthPackSize =
  | "pack_30gb"
  | "pack_100gb"
  | "pack_300gb";

export interface CapacityPackSpec {
  readonly size: StoragePackSize | BandwidthPackSize;
  readonly displayName: string;
  readonly bytes: number;
  readonly prices: ReadonlyArray<RegionalPrice>;
}

const GB = 1_000_000_000;

export const STORAGE_PACKS: ReadonlyArray<CapacityPackSpec> = [
  {
    size: "pack_5gb",
    displayName: "+5 GB storage",
    bytes: 5 * GB,
    prices: [
      { region: "IE", currency: "EUR", amountMinor: 180, active: true },
      { region: "GB", currency: "GBP", amountMinor: 150, active: true },
      { region: "US", currency: "USD", amountMinor: 200, active: true },
      // Indonesia storage pack price deferred · pilot pending
      { region: "ID", currency: "IDR", amountMinor: 0, active: false },
    ],
  },
  {
    size: "pack_10gb",
    displayName: "+10 GB storage",
    bytes: 10 * GB,
    prices: [
      { region: "IE", currency: "EUR", amountMinor: 359, active: true },
      { region: "GB", currency: "GBP", amountMinor: 300, active: true },
      { region: "US", currency: "USD", amountMinor: 400, active: true },
      { region: "ID", currency: "IDR", amountMinor: 0, active: false },
    ],
  },
  {
    size: "pack_25gb",
    displayName: "+25 GB storage",
    bytes: 25 * GB,
    prices: [
      { region: "IE", currency: "EUR", amountMinor: 897, active: true },
      { region: "GB", currency: "GBP", amountMinor: 749, active: true },
      { region: "US", currency: "USD", amountMinor: 1000, active: true },
      { region: "ID", currency: "IDR", amountMinor: 0, active: false },
    ],
  },
];

export const BANDWIDTH_PACKS: ReadonlyArray<CapacityPackSpec> = [
  {
    size: "pack_30gb",
    displayName: "+30 GB bandwidth",
    bytes: 30 * GB,
    prices: [
      { region: "IE", currency: "EUR", amountMinor: 269, active: true },
      { region: "GB", currency: "GBP", amountMinor: 225, active: true },
      { region: "US", currency: "USD", amountMinor: 300, active: true },
      { region: "ID", currency: "IDR", amountMinor: 0, active: false },
    ],
  },
  {
    size: "pack_100gb",
    displayName: "+100 GB bandwidth",
    bytes: 100 * GB,
    prices: [
      { region: "IE", currency: "EUR", amountMinor: 897, active: true },
      { region: "GB", currency: "GBP", amountMinor: 749, active: true },
      { region: "US", currency: "USD", amountMinor: 1000, active: true },
      { region: "ID", currency: "IDR", amountMinor: 0, active: false },
    ],
  },
  {
    size: "pack_300gb",
    displayName: "+300 GB bandwidth",
    bytes: 300 * GB,
    prices: [
      { region: "IE", currency: "EUR", amountMinor: 2691, active: true },
      { region: "GB", currency: "GBP", amountMinor: 2247, active: true },
      { region: "US", currency: "USD", amountMinor: 3000, active: true },
      { region: "ID", currency: "IDR", amountMinor: 0, active: false },
    ],
  },
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

export function findPackPrice(
  pack: CapacityPackSpec,
  region: SupportedRegion,
): RegionalPrice | null {
  return pack.prices.find((p) => p.region === region) ?? null;
}

export function getActivePackPrice(
  pack: CapacityPackSpec,
  region: SupportedRegion,
): RegionalPrice | null {
  const row = findPackPrice(pack, region);
  return row && row.active && row.amountMinor > 0 ? row : null;
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

// ─── Legacy alias · deprecated 2026-11-08 ───────────────────────────
// The earlier 3-tier structure (professional/professional_plus) was
// superseded by the single `shop` tier. Preserved aliases keep any
// transient callers compiling · remove after a sweep.
export const PROFESSIONAL_MONTHLY = SHOP_MONTHLY;
export const PROFESSIONAL_ANNUAL = SHOP_ANNUAL;
export const PROFESSIONAL_PLUS_MONTHLY = SHOP_MONTHLY;
export const PROFESSIONAL_PLUS_ANNUAL = SHOP_ANNUAL;
