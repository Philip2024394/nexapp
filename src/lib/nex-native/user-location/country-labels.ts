// src/lib/nex-native/user-location/country-labels.ts
//
// Pure helpers: ISO 3166-1 alpha-2 → flag emoji + human name.
// Importable from both server and client code. No DB, no network.

/** Convert an ISO 3166-1 alpha-2 country code into the matching flag
 *  emoji (two regional-indicator symbols). Returns null when the
 *  input is not a valid 2-letter code. Pure. */
export function flagEmojiForIso(iso: string | null | undefined): string | null {
  if (typeof iso !== "string" || !/^[a-zA-Z]{2}$/.test(iso)) return null;
  const base = 0x1f1e6; // regional indicator A
  const upper = iso.toUpperCase();
  const a = base + (upper.charCodeAt(0) - 65);
  const b = base + (upper.charCodeAt(1) - 65);
  return String.fromCodePoint(a) + String.fromCodePoint(b);
}

/** Human-readable country name for a small set NEX actually operates
 *  in. Falls back to the ISO code uppercased when unknown · the UI
 *  can still render the flag emoji + ISO safely. */
export function countryNameForIso(iso: string | null | undefined): string | null {
  if (typeof iso !== "string" || !/^[a-zA-Z]{2}$/.test(iso)) return null;
  const upper = iso.toUpperCase();
  const names: Record<string, string> = {
    ID: "Indonesia",
    SG: "Singapore",
    MY: "Malaysia",
    TH: "Thailand",
    VN: "Vietnam",
    PH: "Philippines",
    GB: "United Kingdom",
    US: "United States",
    AU: "Australia",
    NZ: "New Zealand",
    JP: "Japan",
    KR: "South Korea",
    IN: "India",
    AE: "United Arab Emirates",
    DE: "Germany",
    FR: "France",
    ES: "Spain",
    IT: "Italy",
    NL: "Netherlands",
    CA: "Canada",
  };
  return names[upper] ?? upper;
}
