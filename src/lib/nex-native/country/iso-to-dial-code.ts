// src/lib/nex-native/country/iso-to-dial-code.ts
//
// Owner-directed 2026-11-28 (third-pass, same-day-second-step).
// ---------------------------------------------------------------------------
// Reverse map · ISO 3166-1 alpha-2 → primary E.164 country-calling code.
// Covers every country that appears in COUNTRY_CATALOGUE (35 markets).
//
// Honest limitation (symmetric to dial-code-to-iso.ts): dial codes are
// not 1:1 with countries. +1 is shared by US/CA + Caribbean; +44 is GB +
// Jersey/Guernsey/Isle of Man; +7 is RU + KZ. For validation inside the
// guest-shop-enquiry popup we allow a phone whose prefix is the PRIMARY
// dial code assigned to the catalogue country · we do NOT try to
// disambiguate CA vs US from the prefix alone (both legitimately start
// with +1). This matches the "primary assignment" convention in
// dial-code-to-iso.ts.
//
// Return value is the full prefixed form (e.g. "+353", "+1") or null if
// the catalogue country has no primary dial code defined here.

const ISO_TO_DIAL: Readonly<Record<string, string>> = {
  // ─── Launch markets ──────────────────────────────────────────────
  IE: "+353", // Ireland
  GB: "+44",  // United Kingdom
  US: "+1",   // United States (also CA)
  ID: "+62",  // Indonesia
  AU: "+61",  // Australia

  // ─── Rest of catalogue (alphabetical by ISO2) ────────────────────
  AT: "+43",  // Austria
  BE: "+32",  // Belgium
  BR: "+55",  // Brazil
  CA: "+1",   // Canada (shares +1 with US)
  CH: "+41",  // Switzerland
  CZ: "+420", // Czechia
  DE: "+49",  // Germany
  DK: "+45",  // Denmark
  ES: "+34",  // Spain
  FI: "+358", // Finland
  FR: "+33",  // France
  GR: "+30",  // Greece
  HK: "+852", // Hong Kong SAR
  IN: "+91",  // India
  IT: "+39",  // Italy
  JP: "+81",  // Japan
  KR: "+82",  // South Korea
  MX: "+52",  // Mexico
  MY: "+60",  // Malaysia
  NL: "+31",  // Netherlands
  NO: "+47",  // Norway
  NZ: "+64",  // New Zealand
  PH: "+63",  // Philippines
  PL: "+48",  // Poland
  PT: "+351", // Portugal
  RO: "+40",  // Romania
  SE: "+46",  // Sweden
  SG: "+65",  // Singapore
  TH: "+66",  // Thailand
  TR: "+90",  // Türkiye
  VN: "+84",  // Vietnam
  ZA: "+27",  // South Africa
};

/** Look up the primary E.164 dial code for an ISO2 catalogue country.
 *  Returns the prefixed form (e.g. "+353"). Null if the ISO2 is not
 *  known to this map (shouldn't happen for catalogue countries · the
 *  catalogue test pins that every entry has a dial code). */
export function isoToDialCode(iso: string | null | undefined): string | null {
  if (!iso || typeof iso !== "string") return null;
  const up = iso.trim().toUpperCase();
  return ISO_TO_DIAL[up] ?? null;
}

/** Normalise "+353 87 123 4567" → "+353871234567" for prefix checks.
 *  Strips spaces, dashes, and parentheses. Does NOT validate shape. */
export function stripPhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, "");
}

/** True iff `phone` (after stripPhone) starts with the dial code for
 *  `iso`. False if either is missing or iso is not in the map. */
export function phoneStartsWithDialCodeForIso(
  phone: string,
  iso: string,
): boolean {
  const dial = isoToDialCode(iso);
  if (!dial) return false;
  return stripPhone(phone).startsWith(dial);
}

/** All dial-code prefixes known to the catalogue, longest first. Used
 *  to detect whether a phone input already begins with ANY known dial
 *  code (so we can replace it when the user switches country). */
export const ALL_DIAL_CODES_LONGEST_FIRST: ReadonlyArray<string> = (() => {
  const unique = Array.from(new Set(Object.values(ISO_TO_DIAL)));
  return unique.sort((a, b) => b.length - a.length);
})();

/** Strip whichever known dial code the phone currently starts with ·
 *  returns the remainder (sans known prefix). If no known prefix is
 *  present, returns the input unchanged. Does NOT trim · caller
 *  decides spacing. */
export function stripKnownDialCodePrefix(phone: string): string {
  const stripped = stripPhone(phone);
  for (const code of ALL_DIAL_CODES_LONGEST_FIRST) {
    if (stripped.startsWith(code)) return stripped.slice(code.length);
  }
  return stripped;
}
