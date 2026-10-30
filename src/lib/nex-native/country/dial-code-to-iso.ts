// src/lib/nex-native/country/dial-code-to-iso.ts
//
// Owner-authorised 2026-10-30 · maps a nex_account.phone_country_code
// value (e.g., "+62", "+353") to the matching ISO 3166-1 alpha-2
// country code (e.g., "ID", "IE"). Used by the music feed to render
// the "Live {country}" header line from the broadcaster's phone
// country code · ties into the sealed memory
// `project_nex_country_scope_from_phone_country_code_2026_08_22`.
//
// Honest limitation: dial codes are not 1:1 with countries. +1 is
// North America (US, CA, and 20+ Caribbean nations); +44 is GB (also
// shared with Jersey/Guernsey/Isle of Man); several others are
// shared regionally. This helper picks the primary assignment that
// matches NEX's rendering intent (the most-populous or canonical
// country for each ambiguous code). If NEX needs sub-region
// resolution later, a longest-prefix match with national-destination
// codes becomes necessary · that is a separate build.
//
// Return value is a 2-letter uppercase ISO 3166-1 alpha-2 code, or
// null if the dial code is unknown / malformed. The caller passes
// the result to Intl.DisplayNames for localisation.

/** Maps E.164 country-calling-code → ISO 3166-1 alpha-2.
 *  Keys are the full prefixed form stored on nex_account.phone_country_code
 *  (e.g., "+62"). Values are 2-letter uppercase country codes. */
const DIAL_CODE_TO_ISO: Readonly<Record<string, string>> = {
  // Africa
  "+20": "EG",   // Egypt
  "+212": "MA",  // Morocco
  "+213": "DZ",  // Algeria
  "+216": "TN",  // Tunisia
  "+218": "LY",  // Libya
  "+220": "GM",  // Gambia
  "+221": "SN",  // Senegal
  "+223": "ML",  // Mali
  "+225": "CI",  // Côte d'Ivoire
  "+227": "NE",  // Niger
  "+228": "TG",  // Togo
  "+229": "BJ",  // Benin
  "+230": "MU",  // Mauritius
  "+233": "GH",  // Ghana
  "+234": "NG",  // Nigeria
  "+235": "TD",  // Chad
  "+237": "CM",  // Cameroon
  "+243": "CD",  // DR Congo
  "+244": "AO",  // Angola
  "+249": "SD",  // Sudan
  "+251": "ET",  // Ethiopia
  "+254": "KE",  // Kenya
  "+255": "TZ",  // Tanzania
  "+256": "UG",  // Uganda
  "+260": "ZM",  // Zambia
  "+263": "ZW",  // Zimbabwe
  "+27":  "ZA",  // South Africa

  // Americas
  "+1":   "US",  // United States (primary) · also CA + Caribbean · see honest-limitation note
  "+52":  "MX",  // Mexico
  "+53":  "CU",  // Cuba
  "+54":  "AR",  // Argentina
  "+55":  "BR",  // Brazil
  "+56":  "CL",  // Chile
  "+57":  "CO",  // Colombia
  "+58":  "VE",  // Venezuela
  "+591": "BO",  // Bolivia
  "+593": "EC",  // Ecuador
  "+595": "PY",  // Paraguay
  "+598": "UY",  // Uruguay
  "+502": "GT",  // Guatemala
  "+503": "SV",  // El Salvador
  "+504": "HN",  // Honduras
  "+505": "NI",  // Nicaragua
  "+506": "CR",  // Costa Rica
  "+507": "PA",  // Panama
  "+51":  "PE",  // Peru

  // Asia
  "+60":  "MY",  // Malaysia
  "+62":  "ID",  // Indonesia
  "+63":  "PH",  // Philippines
  "+65":  "SG",  // Singapore
  "+66":  "TH",  // Thailand
  "+673": "BN",  // Brunei
  "+81":  "JP",  // Japan
  "+82":  "KR",  // South Korea
  "+84":  "VN",  // Vietnam
  "+850": "KP",  // North Korea
  "+852": "HK",  // Hong Kong
  "+853": "MO",  // Macau
  "+855": "KH",  // Cambodia
  "+856": "LA",  // Laos
  "+86":  "CN",  // China
  "+880": "BD",  // Bangladesh
  "+886": "TW",  // Taiwan
  "+90":  "TR",  // Turkey
  "+91":  "IN",  // India
  "+92":  "PK",  // Pakistan
  "+93":  "AF",  // Afghanistan
  "+94":  "LK",  // Sri Lanka
  "+95":  "MM",  // Myanmar
  "+960": "MV",  // Maldives
  "+964": "IQ",  // Iraq
  "+965": "KW",  // Kuwait
  "+966": "SA",  // Saudi Arabia
  "+967": "YE",  // Yemen
  "+968": "OM",  // Oman
  "+970": "PS",  // Palestine
  "+971": "AE",  // United Arab Emirates
  "+972": "IL",  // Israel
  "+973": "BH",  // Bahrain
  "+974": "QA",  // Qatar
  "+975": "BT",  // Bhutan
  "+976": "MN",  // Mongolia
  "+977": "NP",  // Nepal
  "+98":  "IR",  // Iran

  // Europe
  "+30":  "GR",  // Greece
  "+31":  "NL",  // Netherlands
  "+32":  "BE",  // Belgium
  "+33":  "FR",  // France
  "+34":  "ES",  // Spain
  "+351": "PT",  // Portugal
  "+352": "LU",  // Luxembourg
  "+353": "IE",  // Ireland
  "+354": "IS",  // Iceland
  "+355": "AL",  // Albania
  "+356": "MT",  // Malta
  "+357": "CY",  // Cyprus
  "+358": "FI",  // Finland
  "+359": "BG",  // Bulgaria
  "+36":  "HU",  // Hungary
  "+370": "LT",  // Lithuania
  "+371": "LV",  // Latvia
  "+372": "EE",  // Estonia
  "+373": "MD",  // Moldova
  "+374": "AM",  // Armenia
  "+375": "BY",  // Belarus
  "+376": "AD",  // Andorra
  "+377": "MC",  // Monaco
  "+378": "SM",  // San Marino
  "+380": "UA",  // Ukraine
  "+381": "RS",  // Serbia
  "+382": "ME",  // Montenegro
  "+385": "HR",  // Croatia
  "+386": "SI",  // Slovenia
  "+387": "BA",  // Bosnia and Herzegovina
  "+389": "MK",  // North Macedonia
  "+39":  "IT",  // Italy
  "+40":  "RO",  // Romania
  "+41":  "CH",  // Switzerland
  "+420": "CZ",  // Czech Republic
  "+421": "SK",  // Slovakia
  "+423": "LI",  // Liechtenstein
  "+43":  "AT",  // Austria
  "+44":  "GB",  // United Kingdom
  "+45":  "DK",  // Denmark
  "+46":  "SE",  // Sweden
  "+47":  "NO",  // Norway
  "+48":  "PL",  // Poland
  "+49":  "DE",  // Germany
  "+7":   "RU",  // Russia (also KZ, but RU is primary assignment)

  // Oceania
  "+61":  "AU",  // Australia
  "+64":  "NZ",  // New Zealand
  "+679": "FJ",  // Fiji
  "+685": "WS",  // Samoa
  "+687": "NC",  // New Caledonia
  "+689": "PF",  // French Polynesia
};

/** Resolve a nex_account.phone_country_code to its primary ISO
 *  3166-1 alpha-2 country code. Returns `null` when the input is
 *  null, undefined, empty, malformed, or an unknown dial code. */
export function dialCodeToIsoCountry(
  dialCode: string | null | undefined,
): string | null {
  if (!dialCode) return null;
  if (typeof dialCode !== "string") return null;
  const trimmed = dialCode.trim();
  if (trimmed.length === 0) return null;
  // Normalise: expect leading '+' and digits only.
  if (!/^\+[0-9]{1,4}$/.test(trimmed)) return null;
  return DIAL_CODE_TO_ISO[trimmed] ?? null;
}
