// src/lib/nex-native/country-catalogue.ts
//
// NEX · country catalogue + ISO2 narrowing + default-currency + pre-fill
// resolver. Owner-sealed 2026-11-07.
// -----------------------------------------------------------------------------
// Single source of truth for:
//   · The country dropdown shown in Shop Setup → Location
//   · ISO 3166-1 alpha-2 narrowing at the service boundary
//   · Default currency per operating country (consumed by
//     product-create / theme picker / price surfaces)
//   · The pre-fill order the location step uses
//
// Launch markets (owner-sealed · scope-reduction 2026-11-06 doctrine):
//   · Core four · IE · GB · US · ID · plus AU as an active-currency
//     presence. These float to the TOP of the dropdown · rest follow
//     alphabetical.

export type Iso2 = string; // narrowed via NARROWING_PATTERN below

export const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

export interface CountryCatalogueEntry {
  readonly code: Iso2;
  readonly label: string;
  readonly flag: string;
  readonly currency: string; // ISO 4217 alpha-3
  readonly launchMarket: boolean;
}

// Not every country on the planet · just the ones we're willing to
// display today. Extend as new markets open · changes here surface
// immediately in the dropdown via COUNTRY_CATALOGUE_SORTED.
export const COUNTRY_CATALOGUE: ReadonlyArray<CountryCatalogueEntry> = [
  // ─── Launch markets (top of list) ────────────────────────────────
  { code: "IE", label: "Ireland",         flag: "🇮🇪", currency: "EUR", launchMarket: true },
  { code: "GB", label: "United Kingdom",  flag: "🇬🇧", currency: "GBP", launchMarket: true },
  { code: "US", label: "United States",   flag: "🇺🇸", currency: "USD", launchMarket: true },
  { code: "ID", label: "Indonesia",       flag: "🇮🇩", currency: "IDR", launchMarket: true },
  { code: "AU", label: "Australia",       flag: "🇦🇺", currency: "AUD", launchMarket: true },

  // ─── Rest (alphabetical by label) ────────────────────────────────
  { code: "AT", label: "Austria",         flag: "🇦🇹", currency: "EUR", launchMarket: false },
  { code: "BE", label: "Belgium",         flag: "🇧🇪", currency: "EUR", launchMarket: false },
  { code: "BR", label: "Brazil",          flag: "🇧🇷", currency: "BRL", launchMarket: false },
  { code: "CA", label: "Canada",          flag: "🇨🇦", currency: "CAD", launchMarket: false },
  { code: "CH", label: "Switzerland",     flag: "🇨🇭", currency: "CHF", launchMarket: false },
  { code: "CZ", label: "Czechia",         flag: "🇨🇿", currency: "CZK", launchMarket: false },
  { code: "DE", label: "Germany",         flag: "🇩🇪", currency: "EUR", launchMarket: false },
  { code: "DK", label: "Denmark",         flag: "🇩🇰", currency: "DKK", launchMarket: false },
  { code: "ES", label: "Spain",           flag: "🇪🇸", currency: "EUR", launchMarket: false },
  { code: "FI", label: "Finland",         flag: "🇫🇮", currency: "EUR", launchMarket: false },
  { code: "FR", label: "France",          flag: "🇫🇷", currency: "EUR", launchMarket: false },
  { code: "GR", label: "Greece",          flag: "🇬🇷", currency: "EUR", launchMarket: false },
  { code: "HK", label: "Hong Kong SAR",   flag: "🇭🇰", currency: "HKD", launchMarket: false },
  { code: "IN", label: "India",           flag: "🇮🇳", currency: "INR", launchMarket: false },
  { code: "IT", label: "Italy",           flag: "🇮🇹", currency: "EUR", launchMarket: false },
  { code: "JP", label: "Japan",           flag: "🇯🇵", currency: "JPY", launchMarket: false },
  { code: "KR", label: "South Korea",     flag: "🇰🇷", currency: "KRW", launchMarket: false },
  { code: "MX", label: "Mexico",          flag: "🇲🇽", currency: "MXN", launchMarket: false },
  { code: "MY", label: "Malaysia",        flag: "🇲🇾", currency: "MYR", launchMarket: false },
  { code: "NL", label: "Netherlands",     flag: "🇳🇱", currency: "EUR", launchMarket: false },
  { code: "NO", label: "Norway",          flag: "🇳🇴", currency: "NOK", launchMarket: false },
  { code: "NZ", label: "New Zealand",     flag: "🇳🇿", currency: "NZD", launchMarket: false },
  { code: "PH", label: "Philippines",     flag: "🇵🇭", currency: "PHP", launchMarket: false },
  { code: "PL", label: "Poland",          flag: "🇵🇱", currency: "PLN", launchMarket: false },
  { code: "PT", label: "Portugal",        flag: "🇵🇹", currency: "EUR", launchMarket: false },
  { code: "RO", label: "Romania",         flag: "🇷🇴", currency: "RON", launchMarket: false },
  { code: "SE", label: "Sweden",          flag: "🇸🇪", currency: "SEK", launchMarket: false },
  { code: "SG", label: "Singapore",       flag: "🇸🇬", currency: "SGD", launchMarket: false },
  { code: "TH", label: "Thailand",        flag: "🇹🇭", currency: "THB", launchMarket: false },
  { code: "TR", label: "Türkiye",         flag: "🇹🇷", currency: "TRY", launchMarket: false },
  { code: "VN", label: "Vietnam",         flag: "🇻🇳", currency: "VND", launchMarket: false },
  { code: "ZA", label: "South Africa",    flag: "🇿🇦", currency: "ZAR", launchMarket: false },
];

/** Dropdown-ordered · launch markets first (in sealed order) · then
 *  everything else alphabetical by label. */
export const COUNTRY_CATALOGUE_SORTED: ReadonlyArray<CountryCatalogueEntry> = (() => {
  const launch = COUNTRY_CATALOGUE.filter((c) => c.launchMarket);
  const rest = COUNTRY_CATALOGUE
    .filter((c) => !c.launchMarket)
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...launch, ...rest];
})();

const CODE_INDEX = new Map(COUNTRY_CATALOGUE.map((c) => [c.code, c]));

/** Returns the catalogue entry for an ISO2 code · null if unknown
 *  OR malformed. Case-insensitive on input · entries are uppercase. */
export function lookupCountry(code: string | null | undefined): CountryCatalogueEntry | null {
  if (typeof code !== "string") return null;
  const up = code.trim().toUpperCase();
  if (!COUNTRY_CODE_PATTERN.test(up)) return null;
  return CODE_INDEX.get(up) ?? null;
}

/** Narrow a string to a known ISO2 code · returns null if unknown. */
export function narrowCountryCode(raw: string | null | undefined): Iso2 | null {
  const entry = lookupCountry(raw);
  return entry ? entry.code : null;
}

/** Default currency for an operating-country code · falls back to
 *  the `fallback` argument (caller decides · "EUR" is the sensible
 *  worldwide-neutral default · callers in Ireland may pass "EUR"
 *  already). */
export function defaultCurrencyForCountry(
  code: string | null | undefined,
  fallback: string = "EUR",
): string {
  const entry = lookupCountry(code);
  return entry ? entry.currency : fallback;
}

// ─── Phone-country-code → ISO2 best-effort fallback ──────────────────
// Delegates to the sealed `dialCodeToIsoCountry` map (country/dial-
// code-to-iso.ts · owner-authorised 2026-10-30) so the dial-code
// table has ONE source of truth across NEX. We then narrow through
// the local catalogue so only countries NEX is willing to display
// come back · e.g. dialCodeToIsoCountry("+679") returns "FJ" but
// Fiji isn't in the dropdown yet so we return null and the resolver
// moves on to the env fallback.

import { dialCodeToIsoCountry } from "./country/dial-code-to-iso";

/** Best-effort phone-country-code → ISO2. Null if unknown dial code
 *  OR shape is wrong OR the mapped country isn't in the NEX catalogue.
 *  Used as a second-rank pre-fill source after the account profile's
 *  explicit country_code. */
export function iso2FromPhoneCountryCode(cc: string | null | undefined): Iso2 | null {
  const iso = dialCodeToIsoCountry(cc);
  return narrowCountryCode(iso);
}

/** Normalise an arbitrary env string (e.g. "IE", "ie", "ireland") to
 *  a known ISO2 if possible. Used for NEX_APP_COUNTRY resolution. */
export function iso2FromEnv(envValue: string | null | undefined): Iso2 | null {
  const narrowed = narrowCountryCode(envValue);
  return narrowed;
}

/** Multi-source pre-fill resolver · the location step uses this to
 *  decide the dropdown's initial selection.
 *
 *  Rank:
 *    1 · owner's explicit account-profile country_code
 *    2 · owner's phone_country_code mapped to ISO2
 *    3 · NEX_APP_COUNTRY env var
 *    4 · null (user picks manually)
 *
 *  Always returns either a known ISO2 OR null. Never throws. */
export function resolveDefaultOperatingCountry(sources: {
  readonly profileCountryCode?: string | null;
  readonly phoneCountryCode?: string | null;
  readonly envCountry?: string | null;
}): Iso2 | null {
  const fromProfile = narrowCountryCode(sources.profileCountryCode);
  if (fromProfile) return fromProfile;
  const fromPhone = iso2FromPhoneCountryCode(sources.phoneCountryCode);
  if (fromPhone) return fromPhone;
  const fromEnv = iso2FromEnv(sources.envCountry);
  if (fromEnv) return fromEnv;
  return null;
}
