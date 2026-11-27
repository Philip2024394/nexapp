"use client";

// src/app/nex-native/cover/_shop-currency-switch.tsx
//
// Owner directive 2026-11-28 (fourth pass) · small currency pill
// rendered to the right of the "Products" header on Template 15
// (product_hero_landscape). Picking a currency does three things
// via ShopLocaleProvider:
//
//   1. Converts product prices to the picked currency using the
//      static APPROX_RATES_VS_USD table · displayed values carry
//      a leading "~" so the buyer sees the conversion is approximate.
//   2. Switches the shop UI chrome ("Products", "All categories",
//      "online now", etc.) to the language mapped to that currency
//      (e.g. IDR → id, JPY → ja). Seller-authored content (product
//      names, descriptions, about us) stays in its original language
//      because NEX has no authorised translation provider.
//   3. Persists the choice to localStorage so return visits restore
//      the same locale without re-asking.

import * as React from "react";
import {
  SUPPORTED_CURRENCIES,
  type ShopCurrencyCode,
} from "@/lib/nex-native/shop-locale/data";
import { useShopLocale } from "@/lib/nex-native/shop-locale/locale-context";

// Owner directive 2026-11-28 (thirteenth pass) · cream currency pill
// with a round flag beside the currency code and black label text.
// Windows/Chromium has no country-flag emoji glyphs (falls back to
// the ISO letters "EU", "US", etc.), so we fetch an actual PNG per
// currency from flagcdn.com (public, no API key) and clip it inside
// a circular wrapper so it reads as a round flag badge on every OS.
// ISO 3166-1 alpha-2 country codes per currency · EUR → "eu"
// (flagcdn serves the EU flag at that slug).
const CURRENCY_FLAG_ISO: Readonly<Record<ShopCurrencyCode, string>> = {
  USD: "us",
  GBP: "gb",
  EUR: "eu",
  IDR: "id",
  JPY: "jp",
  KRW: "kr",
  AUD: "au",
  SGD: "sg",
};

function flagUrl(iso: string): string {
  // 40px wide PNG · fits inside a 20x20 circular chip at 2x density.
  return `https://flagcdn.com/w40/${iso}.png`;
}

export function ShopCurrencySwitch({
  accentHex: _accentHex,
}: {
  /** Retained for API compatibility · the cream pill no longer tints
   *  itself from the shop accent (owner direction 2026-11-28). */
  accentHex?: string | null;
}): React.JSX.Element | null {
  const locale = useShopLocale();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape so the popover behaves like a
  // native select even without native element semantics.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!locale) return null;
  // Owner directive 2026-11-28 (twenty-sixth pass) · custom popover
  // replaces the native <select> so each currency row can render its
  // real flag PNG · native <option> elements can't contain images on
  // any mainstream browser. Flag chip + "Currency" label stay in the
  // trigger · the panel below lists one row per supported currency.
  const activeIso = CURRENCY_FLAG_ISO[locale.currency] ?? "us";
  const label = locale.t("select_currency");
  return (
    <div
      ref={wrapRef}
      data-nex-shop-currency-switch
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        height: 40,
        fontFamily: "inherit",
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: 0,
          border: "none",
          background: "transparent",
          color: "#000000",
          fontSize: 14,
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: "pointer",
          height: 40,
        }}
      >
        {/* Owner directive 2026-11-28 (thirty-third pass) · currency
            code label ("EUR", "USD"…) dropped from the trigger · the
            round flag alone now represents the active currency. Flag
            sits on the right so it aligns with the header cart/burger
            cluster at the right edge of the row. */}
        {/* Owner directive 2026-11-28 (thirty-fourth pass) · currency
            flag chip enlarged from 20→28 so it matches the burger +
            cart circular buttons at the right edge of the header row. */}
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: "50%",
            overflow: "hidden",
            background: "#FFFFFF",
            flexShrink: 0,
            marginLeft: "auto",
          }}
        >
          <img
            src={flagUrl(activeIso)}
            alt=""
            width={28}
            height={28}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 60,
            margin: 0,
            padding: 6,
            listStyle: "none",
            minWidth: 140,
            background: "#111111",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
            fontFamily: "inherit",
          }}
        >
          {SUPPORTED_CURRENCIES.map((c) => {
            const iso = CURRENCY_FLAG_ISO[c.code] ?? "us";
            const active = c.code === locale.currency;
            return (
              <li key={c.code} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    locale.setCurrency(c.code);
                    setOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "8px 10px",
                    border: "none",
                    borderRadius: 8,
                    background: active
                      ? "rgba(249,115,22,0.18)"
                      : "transparent",
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: "#FFFFFF",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={flagUrl(iso)}
                      alt=""
                      width={20}
                      height={20}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </span>
                  <span>{c.code}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
