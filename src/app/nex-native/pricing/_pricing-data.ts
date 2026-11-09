// src/app/nex-native/pricing/_pricing-data.ts
//
// Shared pricing data · no "use client" marker so both the server page
// and the client country selector can import from the same source. The
// previous co-location of COUNTRY_SPECS inside the client file caused
// an import-boundary issue where the server page saw undefined for the
// spec lookup (Next.js 16.3 Turbopack · client-module data exports are
// not always available server-side).

// Currency identifiers used internally. Keeping the key named
// `PricingCountry` for back-compat with existing data-attributes and
// localStorage key · the value is actually the ISO 4217 currency code
// for the expanded set; legacy 2-letter country codes (IE/GB/US/ID)
// stay as the launch-market aliases that resolve to their native
// currency below.
export type PricingCountry = string;

export interface CountrySpec {
  readonly iso: string;
  /** Friendly region / market label (e.g. "Europe", "Australia"). */
  readonly label: string;
  /** ISO 4217 currency code (e.g. "EUR", "AUD"). */
  readonly currency: string;
  /** Full price string (e.g. "€4.99 / month"). */
  readonly price: string;
  /** Just the amount with symbol (e.g. "€4.99"). */
  readonly priceShort: string;
  /** Flag emoji for display. */
  readonly flag: string;
  /** True for the 4 sealed launch markets · false for the broader
   *  "approximate display · billing in launch currency" tier. */
  readonly launch: boolean;
}

// -----------------------------------------------------------------------------
// Launch markets · sealed 2026-11-06 Scope Reduction · EXACT display prices
// -----------------------------------------------------------------------------

const LAUNCH_SPECS: ReadonlyArray<CountrySpec> = [
  { iso: "IE", label: "Europe",         currency: "EUR", price: "€4.99 / month",        priceShort: "€4.99",       flag: "🇪🇺", launch: true },
  { iso: "GB", label: "United Kingdom", currency: "GBP", price: "£4.99 / month",        priceShort: "£4.99",       flag: "🇬🇧", launch: true },
  { iso: "US", label: "United States",  currency: "USD", price: "US$4.99 / month",      priceShort: "US$4.99",     flag: "🇺🇸", launch: true },
  { iso: "ID", label: "Indonesia",      currency: "IDR", price: "Rp 89,000 / month",    priceShort: "Rp 89,000",   flag: "🇮🇩", launch: true },
];

// -----------------------------------------------------------------------------
// Broader display currencies · owner-sealed 2026-11-09 revision 3 · common
// Stripe-supported currencies. Prices are locked "nice" display amounts,
// NOT live FX conversion. Billing at checkout still happens in one of the
// 4 launch currencies above. Add more on request · Stripe supports 135+ ·
// this is a hand-picked shipping set that covers major regions.
// -----------------------------------------------------------------------------

const EXTRA_SPECS: ReadonlyArray<CountrySpec> = [
  { iso: "AU", label: "Australia",     currency: "AUD", price: "AU$7.99 / month",     priceShort: "AU$7.99",    flag: "🇦🇺", launch: false },
  { iso: "CA", label: "Canada",        currency: "CAD", price: "CA$6.99 / month",     priceShort: "CA$6.99",    flag: "🇨🇦", launch: false },
  { iso: "NZ", label: "New Zealand",   currency: "NZD", price: "NZ$8.99 / month",     priceShort: "NZ$8.99",    flag: "🇳🇿", launch: false },
  { iso: "JP", label: "Japan",         currency: "JPY", price: "¥799 / month",        priceShort: "¥799",       flag: "🇯🇵", launch: false },
  { iso: "CH", label: "Switzerland",   currency: "CHF", price: "CHF 4.99 / month",    priceShort: "CHF 4.99",   flag: "🇨🇭", launch: false },
  { iso: "SE", label: "Sweden",        currency: "SEK", price: "SEK 59.99 / month",   priceShort: "SEK 59.99",  flag: "🇸🇪", launch: false },
  { iso: "NO", label: "Norway",        currency: "NOK", price: "NOK 59.99 / month",   priceShort: "NOK 59.99",  flag: "🇳🇴", launch: false },
  { iso: "DK", label: "Denmark",       currency: "DKK", price: "DKK 39.99 / month",   priceShort: "DKK 39.99",  flag: "🇩🇰", launch: false },
  { iso: "PL", label: "Poland",        currency: "PLN", price: "PLN 24.99 / month",   priceShort: "PLN 24.99",  flag: "🇵🇱", launch: false },
  { iso: "CZ", label: "Czechia",       currency: "CZK", price: "CZK 119 / month",     priceShort: "CZK 119",    flag: "🇨🇿", launch: false },
  { iso: "HU", label: "Hungary",       currency: "HUF", price: "HUF 1,990 / month",   priceShort: "HUF 1,990",  flag: "🇭🇺", launch: false },
  { iso: "RO", label: "Romania",       currency: "RON", price: "RON 24.99 / month",   priceShort: "RON 24.99",  flag: "🇷🇴", launch: false },
  { iso: "TR", label: "Türkiye",       currency: "TRY", price: "TRY 199 / month",     priceShort: "TRY 199",    flag: "🇹🇷", launch: false },
  { iso: "AE", label: "UAE",           currency: "AED", price: "AED 19.99 / month",   priceShort: "AED 19.99",  flag: "🇦🇪", launch: false },
  { iso: "SA", label: "Saudi Arabia",  currency: "SAR", price: "SAR 19.99 / month",   priceShort: "SAR 19.99",  flag: "🇸🇦", launch: false },
  { iso: "IL", label: "Israel",        currency: "ILS", price: "₪19.99 / month",      priceShort: "₪19.99",     flag: "🇮🇱", launch: false },
  { iso: "IN", label: "India",         currency: "INR", price: "₹449 / month",        priceShort: "₹449",       flag: "🇮🇳", launch: false },
  { iso: "SG", label: "Singapore",     currency: "SGD", price: "S$6.99 / month",      priceShort: "S$6.99",     flag: "🇸🇬", launch: false },
  { iso: "HK", label: "Hong Kong",     currency: "HKD", price: "HK$39.99 / month",    priceShort: "HK$39.99",   flag: "🇭🇰", launch: false },
  { iso: "MY", label: "Malaysia",      currency: "MYR", price: "RM 24.99 / month",    priceShort: "RM 24.99",   flag: "🇲🇾", launch: false },
  { iso: "TH", label: "Thailand",      currency: "THB", price: "฿199 / month",        priceShort: "฿199",       flag: "🇹🇭", launch: false },
  { iso: "PH", label: "Philippines",   currency: "PHP", price: "₱299 / month",        priceShort: "₱299",       flag: "🇵🇭", launch: false },
  { iso: "VN", label: "Vietnam",       currency: "VND", price: "₫149,000 / month",    priceShort: "₫149,000",   flag: "🇻🇳", launch: false },
  { iso: "KR", label: "South Korea",   currency: "KRW", price: "₩6,900 / month",      priceShort: "₩6,900",     flag: "🇰🇷", launch: false },
  { iso: "TW", label: "Taiwan",        currency: "TWD", price: "NT$149 / month",      priceShort: "NT$149",     flag: "🇹🇼", launch: false },
  { iso: "ZA", label: "South Africa",  currency: "ZAR", price: "R 99 / month",        priceShort: "R 99",       flag: "🇿🇦", launch: false },
  { iso: "NG", label: "Nigeria",       currency: "NGN", price: "₦7,900 / month",      priceShort: "₦7,900",     flag: "🇳🇬", launch: false },
  { iso: "MX", label: "Mexico",        currency: "MXN", price: "MX$99 / month",       priceShort: "MX$99",      flag: "🇲🇽", launch: false },
  { iso: "BR", label: "Brazil",        currency: "BRL", price: "R$29.99 / month",     priceShort: "R$29.99",    flag: "🇧🇷", launch: false },
];

const ALL_SPECS = [...LAUNCH_SPECS, ...EXTRA_SPECS];

export const COUNTRY_SPECS: Readonly<Record<string, CountrySpec>> = Object.freeze(
  ALL_SPECS.reduce((acc, s) => {
    acc[s.iso] = s;
    return acc;
  }, {} as Record<string, CountrySpec>),
);

export const COUNTRY_LIST: ReadonlyArray<string> = ALL_SPECS.map((s) => s.iso);
export const LAUNCH_COUNTRY_LIST: ReadonlyArray<string> = LAUNCH_SPECS.map((s) => s.iso);
export const EXTRA_COUNTRY_LIST: ReadonlyArray<string> = EXTRA_SPECS.map((s) => s.iso);

export const PRICING_STORAGE_KEY = "nex-pricing-country-preference";

// Owner directive 2026-11-09 · expanded NEX Shop feature set to
// reflect the full one-package offering. "Chat Themes included" and
// "Shop Themes included" were upgraded to "Unlimited" since both are
// bundled without per-item purchase in the single package.
export const SHOP_FEATURES: ReadonlyArray<string> = [
  "10 shop products",
  "3 shop videos (up to 30 seconds each)",
  "11 shop templates",
  "Unlimited chat themes",
  "Unlimited shop themes",
  "SEO · Google shop back-end",
  "Stripe + PayPal gateways",
  "In-chat checkout",
  "1 GB storage",
  "30 GB monthly delivery",
  "Vault included",
  "0% commission on sales",
];

/** Safe lookup · falls back to Europe if an unexpected value lands. */
export function resolveSpec(iso: string | null | undefined): CountrySpec {
  const key = (iso ?? "").toUpperCase();
  const spec = COUNTRY_SPECS[key];
  return spec ?? COUNTRY_SPECS.IE;
}

/** Map a 2-letter country ISO to one of our pricing keys. Covers EU
 *  member states (all → IE/EUR), extra-country keys that match our set,
 *  and falls back to IE for anything unknown. Owner-sealed 2026-11-09. */
export function countryToPricingKey(countryIso: string | null | undefined): string {
  const raw = (countryIso ?? "").toUpperCase();
  if (raw === "UK") return "GB";

  // Known direct match in the expanded list.
  if (COUNTRY_SPECS[raw]) return raw;

  // Euro-zone + EU bucket → IE/EUR.
  const europeIsos = new Set([
    "IE","FR","DE","ES","IT","PT","NL","BE","LU","AT","FI","GR","CY","MT",
    "SK","SI","EE","LV","LT","HR","BG",
  ]);
  if (europeIsos.has(raw)) return "IE";

  return "IE";
}
