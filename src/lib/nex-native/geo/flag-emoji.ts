// src/lib/nex-native/geo/flag-emoji.ts
//
// Pure helper that converts an ISO 3166-1 alpha-2 country code into
// the corresponding regional-indicator flag emoji (🇮🇩 for "ID", etc.).
//
// Zero data table · the mapping is defined by Unicode: each upper-case
// letter A–Z maps to a Regional Indicator Symbol (U+1F1E6 .. U+1F1FF).
// Two consecutive regional indicators are rendered as a flag by the OS.
//
// Returns null when the input is not a well-formed alpha-2 code · the
// caller must handle the absence (we never fabricate a flag).

const BASE = 0x1f1e6 - "A".charCodeAt(0);

/** "ID" → "🇮🇩" · null when the input is not two uppercase ASCII letters. */
export function flagEmojiForIso(isoAlpha2: string | null | undefined): string | null {
  if (typeof isoAlpha2 !== "string") return null;
  if (!/^[A-Z]{2}$/.test(isoAlpha2)) return null;
  const a = isoAlpha2.charCodeAt(0) + BASE;
  const b = isoAlpha2.charCodeAt(1) + BASE;
  return String.fromCodePoint(a) + String.fromCodePoint(b);
}
