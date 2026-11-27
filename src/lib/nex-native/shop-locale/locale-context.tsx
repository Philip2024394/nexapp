"use client";

// src/lib/nex-native/shop-locale/locale-context.tsx
//
// Owner directive 2026-11-28 (fourth pass) · shop locale provider.
// -------------------------------------------------------------------
// Client-side React context that holds the buyer's active currency
// and language for a shop surface. Mounted inside LayoutProductHero-
// Landscape so only Template 15 reads from it today · wider adoption
// is a future pass once owner signs off on the UX.
//
// Initialisation order (first match wins):
//   1. localStorage key "nex-shop-locale" from a prior session.
//   2. Server-side suggestion from /api/nex-native/ip-locale (reads
//      the `cf-ipcountry` header on Cloudflare Workers; falls back
//      to null on local dev).
//   3. Browser Accept-Language (navigator.language) + that language
//      mapped to a currency via COUNTRY_TO_CURRENCY when possible.
//   4. USD / English default.
//
// Honest-null handling: if the IP endpoint fails or returns null,
// the switch still renders · the buyer simply sees the product's
// native currency until they pick another one.

import * as React from "react";
import {
  convertAndFormatMoney,
  defaultCurrencyForCountry,
  isSupportedCurrency,
  SUPPORTED_CURRENCIES,
  translateShopLabel,
  type ShopCurrencyCode,
  type ShopLanguageCode,
} from "./data";

const STORAGE_KEY = "nex-shop-locale";

interface ShopLocaleState {
  readonly currency: ShopCurrencyCode;
  readonly language: ShopLanguageCode;
  /** True once the initial handshake (storage → IP → nav.language)
   *  has resolved · consumers can skip skeletons once this is true. */
  readonly ready: boolean;
}

interface ShopLocaleApi extends ShopLocaleState {
  setCurrency(code: ShopCurrencyCode): void;
  formatPrice(minor: number, from: ShopCurrencyCode): {
    display: string;
    approximate: boolean;
  };
  t(key: string): string;
}

const DEFAULT_STATE: ShopLocaleState = {
  currency: "USD",
  language: "en",
  ready: false,
};

const ShopLocaleContext = React.createContext<ShopLocaleApi | null>(null);

function pickLanguageFor(currency: ShopCurrencyCode): ShopLanguageCode {
  const entry = SUPPORTED_CURRENCIES.find((c) => c.code === currency);
  return entry?.language ?? "en";
}

function readStoredLocale(): ShopCurrencyCode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const code = (parsed as { currency?: unknown }).currency;
      if (typeof code === "string" && isSupportedCurrency(code)) {
        return code;
      }
    }
  } catch {
    /* fall through */
  }
  return null;
}

function writeStoredLocale(currency: ShopCurrencyCode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ currency }),
    );
  } catch {
    /* localStorage can be blocked · ignore quietly */
  }
}

function pickFromNavigatorLanguage(): ShopCurrencyCode | null {
  if (typeof navigator === "undefined") return null;
  const lang = (navigator.language || "").toLowerCase();
  // Pull the region hint (e.g. "en-GB" → "GB").
  const parts = lang.split("-");
  const region = parts[1]?.toUpperCase() ?? null;
  const primary = parts[0] ?? null;
  const viaRegion = defaultCurrencyForCountry(region);
  if (viaRegion) return viaRegion;
  if (primary === "id") return "IDR";
  if (primary === "ja") return "JPY";
  if (primary === "ko") return "KRW";
  return null;
}

export function ShopLocaleProvider({
  children,
  initialCurrency = null,
}: {
  children: React.ReactNode;
  /** Server can pass an already-resolved currency (e.g. derived from
   *  the shop's own country row) so the first paint isn't USD. Null
   *  falls through to the client-side handshake. */
  initialCurrency?: ShopCurrencyCode | null;
}): React.JSX.Element {
  const [state, setState] = React.useState<ShopLocaleState>(() => {
    const base = initialCurrency ?? "USD";
    return {
      currency: base,
      language: pickLanguageFor(base),
      ready: initialCurrency !== null,
    };
  });

  React.useEffect(() => {
    let cancelled = false;

    // 1. storage wins.
    const stored = readStoredLocale();
    if (stored) {
      if (!cancelled) {
        setState({
          currency: stored,
          language: pickLanguageFor(stored),
          ready: true,
        });
      }
      return () => {
        cancelled = true;
      };
    }

    // 2. ask the server for the IP-derived suggestion.
    (async () => {
      try {
        const res = await fetch("/api/nex-native/ip-locale", {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("ip-locale non-ok");
        const data = (await res.json()) as {
          currency?: string | null;
          country?: string | null;
        };
        const code = isSupportedCurrency(data.currency)
          ? (data.currency as ShopCurrencyCode)
          : defaultCurrencyForCountry(data.country ?? null);
        if (code && !cancelled) {
          setState({
            currency: code,
            language: pickLanguageFor(code),
            ready: true,
          });
          return;
        }
      } catch {
        /* fall through to navigator fallback */
      }

      // 3. navigator.language fallback.
      const navCode = pickFromNavigatorLanguage();
      if (navCode && !cancelled) {
        setState({
          currency: navCode,
          language: pickLanguageFor(navCode),
          ready: true,
        });
        return;
      }

      // 4. final default · still mark ready so consumers stop waiting.
      if (!cancelled) {
        setState((prev) => ({ ...prev, ready: true }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setCurrency = React.useCallback((code: ShopCurrencyCode) => {
    writeStoredLocale(code);
    setState({
      currency: code,
      language: pickLanguageFor(code),
      ready: true,
    });
  }, []);

  const api = React.useMemo<ShopLocaleApi>(
    () => ({
      ...state,
      setCurrency,
      formatPrice: (minor, from) =>
        convertAndFormatMoney(minor, from, state.currency),
      t: (key: string) => translateShopLabel(key, state.language),
    }),
    [state, setCurrency],
  );

  return (
    <ShopLocaleContext.Provider value={api}>
      {children}
    </ShopLocaleContext.Provider>
  );
}

/** Returns the full locale API when inside a ShopLocaleProvider,
 *  or null when outside · consumers can check the null and fall
 *  back to the original formatMoney/English labels. */
export function useShopLocale(): ShopLocaleApi | null {
  return React.useContext(ShopLocaleContext);
}
