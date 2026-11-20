// src/lib/nex-native/translation/supported-languages.ts
//
// Pilot-scope language allowlist · owner-authorised 2026-11-17.
// Expand later via owner decision, not via code discovery.

export type PilotLanguageCode = "en" | "id";

export const PILOT_LANGUAGES: ReadonlyArray<{
  code: PilotLanguageCode;
  labelEn: string;
  labelId: string;
}> = [
  { code: "en", labelEn: "English", labelId: "Inggris" },
  { code: "id", labelEn: "Indonesian", labelId: "Indonesia" },
];

export function isPilotLanguage(code: string | null | undefined): code is PilotLanguageCode {
  return code === "en" || code === "id";
}

/** Minimum text length required for a confident auto-translation.
 *  Short strings are ambiguous (e.g. "ok" is valid English AND
 *  recognised Indonesian). Below this threshold, auto-translation is
 *  skipped; manual translate action is still offered. */
export const MIN_CONFIDENT_AUTO_TRANSLATE_CHARS = 8;

/** Hard upper bound on input length per request. Protects both the
 *  provider quota and the F0 cost envelope. Longer messages are
 *  rejected with a typed error; the UI shows the original + manual-only. */
export const MAX_INPUT_CHARS = 2000;
