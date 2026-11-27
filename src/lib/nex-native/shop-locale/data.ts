// src/lib/nex-native/shop-locale/data.ts
//
// Owner directive 2026-11-28 (fourth pass) · shop locale stack.
// -------------------------------------------------------------------
// Static data for the shop-header currency switch. Three concerns:
//
//   1. SUPPORTED_CURRENCIES
//      The pills the buyer can pick from in ShopCurrencySwitch. Keep
//      this list short enough that the dropdown stays scannable on
//      a phone (~8 rows). Each entry carries the ISO 4217 code, the
//      symbol used by formatMoneyFor, and the language the shop UI
//      chrome should swap to when the currency is selected (owner
//      directive: picking a non-English currency translates the
//      shop UI copy to that currency's primary language).
//
//   2. APPROX_RATES_VS_USD
//      Hardcoded ballpark rates relative to 1 USD. Marked clearly as
//      APPROXIMATE · displayed values always carry a leading "~"
//      when the buyer's picked currency differs from the product's
//      native currency so no one reads a converted price as exact.
//      When NEX gains an authorised FX provider, swap this table
//      for a dated server-fetched rate map · the data shape here
//      is small on purpose so that swap is a single-file change.
//
//   3. UI_TRANSLATIONS
//      Dictionary for the shop UI chrome (headings, dropdown labels,
//      "online now" banner, etc.). Only the strings the shop surface
//      ITSELF owns are translated · seller-authored product names,
//      descriptions, and about-us copy stay in their original
//      language because NEX has no authorised translation provider
//      for user-generated content. The translateShopLabel helper
//      returns the English string unchanged whenever a key or a
//      language is missing so the surface degrades gracefully
//      instead of showing "undefined".

export type ShopCurrencyCode =
  | "USD"
  | "GBP"
  | "EUR"
  | "IDR"
  | "JPY"
  | "KRW"
  | "AUD"
  | "SGD";

export type ShopLanguageCode =
  | "en"
  | "id"
  | "ja"
  | "ko"
  | "es"
  | "fr"
  | "de";

export interface ShopCurrencyEntry {
  readonly code: ShopCurrencyCode;
  readonly symbol: string;
  readonly label: string;
  /** Language the shop UI chrome switches to when this currency is
   *  picked. English stays as default where the country speaks
   *  English natively (USD/GBP/AUD/SGD). */
  readonly language: ShopLanguageCode;
}

export const SUPPORTED_CURRENCIES: readonly ShopCurrencyEntry[] = [
  { code: "USD", symbol: "$", label: "USD", language: "en" },
  { code: "GBP", symbol: "£", label: "GBP", language: "en" },
  { code: "EUR", symbol: "€", label: "EUR", language: "en" },
  { code: "IDR", symbol: "Rp", label: "IDR", language: "id" },
  { code: "JPY", symbol: "¥", label: "JPY", language: "ja" },
  { code: "KRW", symbol: "₩", label: "KRW", language: "ko" },
  { code: "AUD", symbol: "A$", label: "AUD", language: "en" },
  { code: "SGD", symbol: "S$", label: "SGD", language: "en" },
];

/**
 * APPROXIMATE exchange rates relative to 1 USD · owner directive
 * acknowledged "approx" · every converted display carries a leading
 * "~" so buyers see the conversion is an estimate. When NEX wires an
 * authorised FX provider, replace this map with a dated server fetch.
 */
export const APPROX_RATES_VS_USD: Readonly<Record<ShopCurrencyCode, number>> = {
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
  IDR: 15_800,
  JPY: 150,
  KRW: 1_350,
  AUD: 1.5,
  SGD: 1.34,
};

/** Map an ISO 3166-1 alpha-2 country code to a sensible default
 *  shop currency. Used by the IP-locale handshake so visitors from
 *  Indonesia see IDR pre-selected without touching the dropdown. */
export const COUNTRY_TO_CURRENCY: Readonly<Record<string, ShopCurrencyCode>> = {
  US: "USD",
  CA: "USD",
  GB: "GBP",
  IE: "EUR",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  ID: "IDR",
  MY: "SGD",
  SG: "SGD",
  TH: "SGD",
  AU: "AUD",
  NZ: "AUD",
  JP: "JPY",
  KR: "KRW",
};

type Dict = Readonly<Record<string, string>>;

export const UI_TRANSLATIONS: Readonly<Record<ShopLanguageCode, Dict>> = {
  en: {
    products: "Products",
    all_categories: "All categories",
    select_category: "Select category",
    select_currency: "Currency",
    online_now: "online now",
    open_cart: "Open cart",
  },
  id: {
    products: "Produk",
    all_categories: "Semua kategori",
    select_category: "Pilih kategori",
    select_currency: "Mata uang",
    online_now: "sedang online",
    open_cart: "Buka keranjang",
  },
  ja: {
    products: "商品",
    all_categories: "すべてのカテゴリ",
    select_category: "カテゴリを選択",
    select_currency: "通貨",
    online_now: "オンライン",
    open_cart: "カートを開く",
  },
  ko: {
    products: "상품",
    all_categories: "모든 카테고리",
    select_category: "카테고리 선택",
    select_currency: "통화",
    online_now: "온라인",
    open_cart: "장바구니 열기",
  },
  es: {
    products: "Productos",
    all_categories: "Todas las categorías",
    select_category: "Elegir categoría",
    select_currency: "Moneda",
    online_now: "en línea",
    open_cart: "Abrir carrito",
  },
  fr: {
    products: "Produits",
    all_categories: "Toutes les catégories",
    select_category: "Choisir une catégorie",
    select_currency: "Devise",
    online_now: "en ligne",
    open_cart: "Ouvrir le panier",
  },
  de: {
    products: "Produkte",
    all_categories: "Alle Kategorien",
    select_category: "Kategorie wählen",
    select_currency: "Währung",
    online_now: "jetzt online",
    open_cart: "Warenkorb öffnen",
  },
};

/** Return the UI chrome string for a key in the given language, with
 *  a graceful English fallback so a missing key never blanks out
 *  the surface. */
export function translateShopLabel(
  key: string,
  language: ShopLanguageCode,
): string {
  const dict = UI_TRANSLATIONS[language] ?? UI_TRANSLATIONS.en;
  return dict[key] ?? UI_TRANSLATIONS.en[key] ?? key;
}

/**
 * Convert a minor-unit price (e.g. pence for GBP, cents for USD, full
 * rupiah for IDR because IDR carries no subunit under NEX's schema)
 * from its source currency into the target currency and format it.
 *
 * Returns both the converted number of minor units (for sorting /
 * downstream math) and a display string. The display carries a
 * leading "~" when source ≠ target so the buyer can see the price
 * is approximate.
 */
export function convertAndFormatMoney(
  minor: number,
  from: ShopCurrencyCode,
  to: ShopCurrencyCode,
): { display: string; approximate: boolean } {
  const approximate = from !== to;
  // Convert: minor units of `from` → minor units of `to`. We go via
  // USD using the approximate table so every pair works without an
  // N×N matrix. IDR is special-cased · its "minor" column in NEX's
  // product table is already stored in whole rupiah * 100 so the
  // divide-by-100 still produces the integer rupiah count.
  const fromRate = APPROX_RATES_VS_USD[from] ?? 1;
  const toRate = APPROX_RATES_VS_USD[to] ?? 1;
  const inUsdMinor = minor / fromRate;
  const converted = inUsdMinor * toRate;
  const prefix = approximate ? "~" : "";
  if (to === "IDR") {
    const whole = Math.round(converted / 100);
    return {
      display: `${prefix}Rp ${whole.toLocaleString("id-ID")}`,
      approximate,
    };
  }
  if (to === "JPY" || to === "KRW") {
    const whole = Math.round(converted / 100);
    const sym = to === "JPY" ? "¥" : "₩";
    return {
      display: `${prefix}${sym}${whole.toLocaleString("en-US")}`,
      approximate,
    };
  }
  const entry = SUPPORTED_CURRENCIES.find((c) => c.code === to);
  const sym = entry?.symbol ?? `${to} `;
  return {
    display: `${prefix}${sym}${(converted / 100).toFixed(2)}`,
    approximate,
  };
}

export function isSupportedCurrency(
  code: string | null | undefined,
): code is ShopCurrencyCode {
  if (!code) return false;
  const upper = code.toUpperCase();
  return SUPPORTED_CURRENCIES.some((c) => c.code === upper);
}

export function defaultCurrencyForCountry(
  country: string | null | undefined,
): ShopCurrencyCode | null {
  if (!country) return null;
  const upper = country.trim().toUpperCase();
  return COUNTRY_TO_CURRENCY[upper] ?? null;
}
