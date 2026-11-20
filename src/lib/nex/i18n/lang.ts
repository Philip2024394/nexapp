// src/lib/nex/i18n/lang.ts
//
// NEX client-side language resolver.
//
// Phase B.7 universal-foundation update (founder-sealed 2026-10-07):
//   · The `Lang` union and `DEFAULT_LANG` fallback now come from the
//     data-driven supported-locale registry at `./supported-locales`.
//     Previously they were hard-coded here, and the client fallback
//     disagreed with the server fallback (`"en"` client vs `"id"`
//     server). The two paths now share one authoritative value.
//   · The resolver recognises any locale in the registry · adding a
//     new NEX language becomes a single registry edit, not a change
//     here.
//
// Historical doctrine (Stage 3.33 · Phase 26 · 2026-08-31):
//   · No external i18n library (react-intl / next-intl / i18next are
//     overkill for a typed key registry + a handful of packs).
//   · Resolver scope is CLIENT-SIDE app chrome (button labels, nav,
//     static microcopy). Not for AI-generated content, not for user-
//     to-user chat translation.
//
// Storage model:
//   · When signed-in, `nex_account.locale` (migration 071) is the
//     durable source of truth and is persisted via the sealed
//     updateAccountLocaleAction server action.
//   · `localStorage.nex_user_lang` carries the signed-out preference
//     and the initial hint on page load before the server session
//     round-trip.
//   · URL query `?lang=` is a request-time override · never
//     persisted.

import {
  DEFAULT_LANG as REGISTRY_DEFAULT,
  SUPPORTED_LOCALES,
  narrowToSupportedLang,
  type Lang,
} from "./supported-locales";

/** Re-export so existing call-sites that already import from
 *  `./lang` keep working. The source of truth is the registry. */
export type { Lang };

/** Codes of every supported locale · derived from the registry so
 *  the two cannot drift. Preserved as a readonly tuple for callers
 *  that expect the historical signature. */
export const SUPPORTED_LANGS: readonly Lang[] = SUPPORTED_LOCALES.map(
  (l) => l.code,
);

/** The single authoritative fallback shared by every resolver. */
export const DEFAULT_LANG: Lang = REGISTRY_DEFAULT;

/**
 * Read the user's preferred language on the client. Safe to call
 * during SSR — returns DEFAULT_LANG when window is undefined.
 *
 * Precedence (highest wins):
 *   1. URL query `?lang=<code>` (only when the code is in the
 *      supported-locale registry)
 *   2. localStorage `nex_user_lang`
 *   3. `navigator.language` / `navigator.languages[]` primary subtag
 *      (added 2026-11-18 · owner-directed browser-preference init)
 *   4. DEFAULT_LANG (`"id"`)
 *
 * Country is NOT consulted here · country and language are separate
 * axes (sealed 2026-10-07). A user in Indonesia preferring English is
 * a legitimate configuration and is honoured.
 */
export function resolveClientLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const url = new URL(window.location.href);
    const q = narrowToSupportedLang(url.searchParams.get("lang"));
    if (q) return q;
    const stored = narrowToSupportedLang(
      window.localStorage.getItem("nex_user_lang"),
    );
    if (stored) return stored;
    const nav = narrowBrowserPreference();
    if (nav) return nav;
  } catch {
    // Private-mode / cross-origin frame — fall through.
  }
  return DEFAULT_LANG;
}

/**
 * Walk `navigator.languages` (ordered by user preference) and the
 * single-value `navigator.language` fallback, extract the primary
 * subtag, and return the first one that matches the supported-locale
 * registry. Exported for the client-side `I18nProvider` and settings
 * page to render a browser-preferred hint. Pure · returns null when
 * nothing matches or `navigator` is unavailable.
 */
export function narrowBrowserPreference(): Lang | null {
  if (typeof navigator === "undefined") return null;
  const candidates: string[] = [];
  try {
    const list = (navigator as Navigator & { languages?: readonly string[] })
      .languages;
    if (Array.isArray(list)) {
      for (const tag of list) {
        if (typeof tag === "string") candidates.push(tag);
      }
    }
  } catch {
    /* noop */
  }
  try {
    const single = (navigator as Navigator & { language?: string }).language;
    if (typeof single === "string") candidates.push(single);
  } catch {
    /* noop */
  }
  for (const tag of candidates) {
    const primary = tag.split(/[-_]/)[0];
    const narrowed = narrowToSupportedLang(primary);
    if (narrowed) return narrowed;
  }
  return null;
}

/**
 * Persist the user's language choice. Called by the sign-on prefix
 * picker, the language settings page, and any future language-toggle
 * UI. Silent on failure.
 */
export function writeClientLang(lang: Lang): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("nex_user_lang", lang);
  } catch {
    /* noop */
  }
}
