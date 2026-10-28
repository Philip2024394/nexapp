// src/lib/nex-native/nex-keyboard/is-nex-keypad-supported.ts
//
// Owner-authorised 2026-10-24 · Phase 0.2 · script-aware activation
// helper for the shared NEX keyboard rollout. Determines whether the
// JokerKeypad should REPLACE the native OS keyboard on a given input,
// or whether the OS keyboard should be allowed through unchanged.
//
// Decision matrix (sealed by Phase 0 approval 2026-10-24 ·
// Phase 0 corrective patch B 2026-10-24 renamed env var to a
// NEXT_PUBLIC_ prefix so Next.js inlines it into the client bundle):
//
//   NEXT_PUBLIC_NEX_KEYPAD_GLOBAL_OFF env flag  →  always false  (hard rollback)
//   Explicit per-user preference                 →  honours "nex" / "os" / "auto"
//   Viewport >= 500px                             →  false  (desktop preserves physical
//                                                           keyboard · F2 mobile cutoff)
//   Non-Latin-script locale                       →  false  (SAFEGUARD A · users typing
//                                                           Arabic / CJK / Thai / Hindi /
//                                                           Cyrillic keep OS keyboard
//                                                           until per-script layouts ship)
//   Else                                          →  true
//
// Runtime availability note (Phase 0 corrective patch B):
//   · The `NEXT_PUBLIC_` prefix is REQUIRED · without it Next.js does
//     NOT inline the value into the client bundle and the rollback is
//     dead on arrival (that was the Phase 0 defect this patch fixes).
//   · Toggling the flag STILL requires a redeploy because Next.js
//     inlines NEXT_PUBLIC_ values at build time. For an in-session
//     rollback without redeploy, the operator uses the per-user
//     localStorage preference (`setNexKeypadPreference("os")`) which
//     is read on every call.
//
// Pure helper · no React hooks · no DOM observers. Call-sites invoke
// this at render time + at focus time; a thin React hook that returns
// a live-updating boolean can be added later if needed, but Phase 0 does
// NOT include a live-reactive subscription (keeps blast radius small).

/* Latin-script locales where JokerKeypad's QWERTY layout gives the user
 * a usable typing experience out of the box. Keep this list ALIGNED
 * with the approved plan · do NOT add non-Latin locales here without
 * owner approval (SAFEGUARD A). */
const LATIN_SCRIPT_LOCALE_PREFIXES: ReadonlyArray<string> = [
  "en", // English
  "id", // Indonesian · base market
  "ms", // Malay
  "vi", // Vietnamese
  "tl", // Tagalog / Filipino
  "pt", // Portuguese
  "es", // Spanish
  "fr", // French
  "de", // German
  "it", // Italian
  "nl", // Dutch
  "pl", // Polish
  "tr", // Turkish
  "sv", // Swedish
  "nb", // Norwegian Bokmål
  "da", // Danish
  "fi", // Finnish
  "cs", // Czech
  "sk", // Slovak
  "hu", // Hungarian
  "ro", // Romanian
  "hr", // Croatian
  "sl", // Slovenian
  "et", // Estonian
  "lv", // Latvian
  "lt", // Lithuanian
  "ga", // Irish
  "cy", // Welsh
  "is", // Icelandic
  "af", // Afrikaans
  "sw", // Swahili
];

/* Non-Latin-script locale prefixes · documented explicitly so the
 * SAFEGUARD A posture is enforceable in tests. If a user's
 * navigator.language starts with any of these prefixes the JokerKeypad
 * is NEVER activated and the OS keyboard surfaces unchanged. These
 * users regain NEX keypad once per-script layouts are shipped (not in
 * Phase 0). */
const NON_LATIN_SCRIPT_LOCALE_PREFIXES: ReadonlyArray<string> = [
  "ar", // Arabic
  "zh", // Chinese
  "ja", // Japanese
  "ko", // Korean
  "th", // Thai
  "hi", // Hindi
  "bn", // Bengali
  "pa", // Punjabi
  "ta", // Tamil
  "te", // Telugu
  "ur", // Urdu
  "fa", // Persian / Farsi
  "he", // Hebrew
  "ru", // Russian
  "uk", // Ukrainian
  "bg", // Bulgarian
  "sr", // Serbian (Cyrillic script)
  "el", // Greek
  "my", // Burmese
  "km", // Khmer
  "lo", // Lao
  "si", // Sinhala
  "am", // Amharic
  "ka", // Georgian
  "hy", // Armenian
];

/** Mobile-first viewport breakpoint · matches `.nex-native-frame` CSS
 *  cutoff at `nex-native.css:214` where the phone silhouette shrinks
 *  to full-width on screens narrower than 500px. */
export const NEX_KEYPAD_MOBILE_BREAKPOINT_PX = 500;

/** Localstorage key for the per-user preference override. Values:
 *  "nex" · force JokerKeypad regardless of locale/viewport
 *  "os"  · force OS keyboard regardless
 *  "auto" (or missing) · follow the default decision matrix
 *  When the real `nex_account.keypad_pref` column lands this helper
 *  will fall through to the server-side value; today the mock lives
 *  in localStorage. */
export const NEX_KEYPAD_PREFERENCE_STORAGE_KEY = "nex-keypad-preference";

export type NexKeypadPreference = "nex" | "os" | "auto";

export interface IsNexKeypadSupportedOptions {
  /** Viewport width in px. If omitted, the helper reads
   *  `window.innerWidth` when running in a browser context, else
   *  returns false (SSR-safe · the server never activates the
   *  keypad; the client re-evaluates on mount). */
  readonly viewportWidthPx?: number;
  /** ISO-639 (or BCP-47 like `en-US`) locale string. If omitted,
   *  reads `navigator.language` in the browser; falls back to "en"
   *  on the server. */
  readonly locale?: string;
  /** Explicit preference override. If omitted, reads the sealed
   *  localStorage key. Pass "auto" to force the default matrix. */
  readonly preference?: NexKeypadPreference;
  /** Hard rollback flag (same as the NEX_KEYPAD_GLOBAL_OFF env var).
   *  When true the helper returns false unconditionally · identical
   *  behaviour to the env flag so callers can test the rollback
   *  without touching process.env. */
  readonly globalOff?: boolean;
}

/**
 * Returns true when the shared NEX keyboard (JokerKeypad) SHOULD
 * replace the native OS keyboard on a given input. See the decision
 * matrix in the module header.
 *
 * Pure · no side effects · SSR-safe (returns false when
 * `typeof window === "undefined"` AND no explicit opts override).
 */
export function isNexKeypadSupported(
  opts: IsNexKeypadSupportedOptions = {},
): boolean {
  /* 1 · Hard rollback has highest priority · lets Phase 0 ship with a
     flip-the-switch escape hatch if a device-matrix regression surfaces
     mid-rollout.
     Phase 0 corrective patch B 2026-10-24 · env var renamed to
     NEXT_PUBLIC_NEX_KEYPAD_GLOBAL_OFF so Next.js INLINES the value into
     the client bundle at build time. Without the NEXT_PUBLIC_ prefix
     the previous `NEX_KEYPAD_GLOBAL_OFF` check always resolved to
     undefined in the client runtime (that was the Phase 0 closure
     defect). The `globalOff` opt stays as a programmatic test override
     that doesn't touch process.env. */
  const globalOff =
    opts.globalOff === true ||
    (typeof process !== "undefined" &&
      process?.env?.NEXT_PUBLIC_NEX_KEYPAD_GLOBAL_OFF === "1");
  if (globalOff) return false;

  /* 2 · Explicit preference wins over automatic detection. */
  const pref = opts.preference ?? readPreferenceFromStorage();
  if (pref === "os") return false;
  if (pref === "nex") return true;

  /* 3 · Resolve the viewport width · SSR-safe default. */
  const vw =
    opts.viewportWidthPx ??
    (typeof window === "undefined" ? Number.POSITIVE_INFINITY : window.innerWidth);
  if (vw >= NEX_KEYPAD_MOBILE_BREAKPOINT_PX) return false;

  /* 4 · Resolve the locale · SSR-safe default of "en". */
  const localeRaw =
    opts.locale ??
    (typeof navigator === "undefined" ? "en" : navigator.language);
  const prefix = normaliseLocalePrefix(localeRaw);

  /* 5 · SAFEGUARD A · non-Latin-script locales keep the OS keyboard. */
  if (NON_LATIN_SCRIPT_LOCALE_PREFIXES.includes(prefix)) return false;

  /* 6 · Latin-script allow-list · users on an unlisted locale (e.g. a
     brand-new ISO we haven't categorised) fall through to the OS
     keyboard · fail-closed is safer than fail-open when the user's
     language is unknown. */
  if (LATIN_SCRIPT_LOCALE_PREFIXES.includes(prefix)) return true;
  return false;
}

/** Normalise a BCP-47 locale ("en-US", "pt-BR", "zh-Hant-TW") to its
 *  ISO-639-1 prefix in lowercase ("en", "pt", "zh"). */
function normaliseLocalePrefix(locale: string): string {
  const raw = (locale || "").toLowerCase().trim();
  const dash = raw.indexOf("-");
  const underscore = raw.indexOf("_");
  const cut =
    dash === -1 && underscore === -1
      ? raw.length
      : dash === -1
        ? underscore
        : underscore === -1
          ? dash
          : Math.min(dash, underscore);
  return raw.slice(0, cut);
}

/** Read the per-user preference from localStorage · returns "auto" on
 *  SSR, missing storage, or any invalid value. Pure defence against
 *  localStorage quota / disabled-storage browsers. */
function readPreferenceFromStorage(): NexKeypadPreference {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = window.localStorage.getItem(NEX_KEYPAD_PREFERENCE_STORAGE_KEY);
    if (raw === "nex" || raw === "os" || raw === "auto") return raw;
    return "auto";
  } catch {
    return "auto";
  }
}

/** Convenience for tests + sandbox · writes the preference back to
 *  localStorage. Pure defence against quota failures. */
export function setNexKeypadPreference(pref: NexKeypadPreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NEX_KEYPAD_PREFERENCE_STORAGE_KEY, pref);
  } catch {
    /* storage disabled · caller sees the pref not persist · acceptable */
  }
}

/* Exported for tests + future contributors who need to inspect which
 * locales are considered Latin / non-Latin. Treat as internal · the
 * public API for app code is `isNexKeypadSupported()` only. */
export const _internal_LATIN_PREFIXES = LATIN_SCRIPT_LOCALE_PREFIXES;
export const _internal_NON_LATIN_PREFIXES = NON_LATIN_SCRIPT_LOCALE_PREFIXES;
