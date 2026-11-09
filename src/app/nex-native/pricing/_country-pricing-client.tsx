"use client";

// src/app/nex-native/pricing/_country-pricing-client.tsx
//
// Owner-sealed 2026-11-09 revision 3 · one-price-at-a-time pricing with
// inline currency chip.
//
// Initial currency resolution priority:
//   1. Signed-in account country (from nex_account · passed via props)
//   2. IP-detected country (from request headers · passed via props)
//   3. localStorage override (previous user selection · wins on client)
//   4. Default IE / EUR
//
// Chip: small gold-rimmed currency button rendered to the right of the
// "NEX Shop" heading. Tapping opens a popover list of ~30 Stripe-
// supported currencies. The sealed 4 launch markets appear first;
// additional display-only currencies follow with an "approximate"
// marker. Billing at checkout is still in one of the 4 launch currencies.

import * as React from "react";
import {
  COUNTRY_SPECS,
  EXTRA_COUNTRY_LIST,
  LAUNCH_COUNTRY_LIST,
  PRICING_STORAGE_KEY,
  SHOP_FEATURES as SHARED_SHOP_FEATURES,
  resolveSpec,
  type PricingCountry,
} from "./_pricing-data";

export type { PricingCountry } from "./_pricing-data";
export { COUNTRY_SPECS } from "./_pricing-data";

const PALETTE = {
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
  cardBorderStrong: "rgba(198, 161, 91, 0.6)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  accent: "#C6A15B",
  cta: "#FF7200",
  tickBg: "rgba(31, 138, 80, 0.18)",
  tick: "#16D66B",
};

const SHOP_FEATURES = SHARED_SHOP_FEATURES;

interface Props {
  readonly initialCountry: PricingCountry;
  readonly detectedCountry: PricingCountry;
  /** If the visitor is signed in and their nex_account carries a
   *  known country ISO, it's passed here so the FIRST paint uses the
   *  account's country rather than the raw IP detection. `null` for
   *  guests or accounts without a country on file. */
  readonly accountCountry: PricingCountry | null;
}

export function CountryPricingClient({
  initialCountry,
  detectedCountry,
  accountCountry,
}: Props): React.ReactElement {
  const [country, setCountry] = React.useState<PricingCountry>(initialCountry);
  const [hydrated, setHydrated] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  // On mount, load the saved preference if any. This runs client-only
  // so SSR renders with `initialCountry` (either the IP-detected one or
  // the IE default) to avoid a hydration flash.
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PRICING_STORAGE_KEY);
      if (saved && COUNTRY_SPECS[saved]) {
        setCountry(saved);
      }
    } catch {
      /* silent · localStorage may be unavailable */
    }
    setHydrated(true);
  }, []);

  // Close the picker if the user taps anywhere outside the popover.
  const pickerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!pickerOpen) return undefined;
    const onDocClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    window.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  const onCountryChange = React.useCallback((next: PricingCountry) => {
    setCountry(next);
    setPickerOpen(false);
    try {
      window.localStorage.setItem(PRICING_STORAGE_KEY, next);
    } catch {
      /* silent */
    }
  }, []);

  const spec = resolveSpec(country);
  // Note · hydrated/accountCountry/detectedCountry are kept for the
  // chip + initial-paint logic even though the trailing caption no
  // longer narrates them.
  void hydrated;
  void accountCountry;
  void detectedCountry;

  return (
    <section
      data-nex-pricing-shop-card
      data-nex-pricing-country={country}
      style={{
        padding: 20,
        borderRadius: 16,
        background: PALETTE.cardBg,
        border: `1.5px solid ${PALETTE.cardBorderStrong}`,
        boxShadow: "0 12px 30px rgba(198, 161, 91, 0.12)",
      }}
    >
      {/* NEX Shop heading + inline currency chip on the right. Owner
          directive 2026-11-09 revision 3 · chip is the primary way to
          switch currency now; the dashed-card selector below is
          retired. Chip opens a popover with ~30 Stripe currencies. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          margin: "0 0 6px",
          position: "relative",
        }}
        ref={pickerRef}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 900,
            color: PALETTE.text,
            letterSpacing: "-0.01em",
          }}
        >
          NEX Shop
        </h2>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
          aria-haspopup="listbox"
          aria-label="Change display currency"
          data-nex-pricing-currency-chip
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 999,
            background: "transparent",
            border: `1.5px solid ${PALETTE.accent}`,
            color: PALETTE.accent,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.04em",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>{spec.flag}</span>
          <span>{spec.currency}</span>
          <span aria-hidden style={{ fontSize: 9, marginLeft: 1 }}>
            {pickerOpen ? "▴" : "▾"}
          </span>
        </button>
        {pickerOpen ? (
          <CurrencyPickerPopover
            selected={country}
            onPick={onCountryChange}
          />
        ) : null}
      </div>

      {/* Single detected price · currency amount big, "/ month" smaller
          beside it per owner directive 2026-11-09. */}
      <div
        data-nex-pricing-shop-price
        style={{
          marginTop: 10,
          color: PALETTE.accent,
          letterSpacing: "-0.015em",
          lineHeight: 1.1,
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 34,
            fontWeight: 900,
          }}
        >
          {spec.priceShort}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: PALETTE.textMuted,
            letterSpacing: "normal",
          }}
        >
          / month
        </span>
      </div>
      <p
        style={{
          margin: "4px 0 0",
          fontSize: 11,
          color: PALETTE.textDim,
          fontStyle: "italic",
        }}
      >
        Shown in {spec.currency}
      </p>

      {/* Features */}
      <ul
        data-nex-pricing-shop-features
        style={{
          listStyle: "none",
          padding: 0,
          margin: "16px 0 0",
          display: "flex",
          flexDirection: "column",
          gap: 7,
        }}
      >
        {SHOP_FEATURES.map((it) => (
          <li
            key={it}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              fontSize: 12.5,
              lineHeight: 1.45,
              color: PALETTE.text,
            }}
          >
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                marginTop: 1,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: PALETTE.tickBg,
                color: PALETTE.tick,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              ✓
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>

      {/* Trial disclosure · uses the selected country's short price. */}
      <div
        style={{
          marginTop: 18,
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.3)",
          border: `1px solid ${PALETTE.cardBorder}`,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: PALETTE.text,
            letterSpacing: "0.02em",
          }}
        >
          7 days free
        </div>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 11.5,
            color: PALETTE.textMuted,
            lineHeight: 1.5,
          }}
        >
          Cancel any time within 7 days.
        </p>
      </div>

      {/* Owner-authored sell line 2026-11-09. See note at the end of
          this file re: substantiating the 80% claim before public
          launch. */}
      <p
        style={{
          margin: "10px 2px 0",
          fontSize: 11,
          color: PALETTE.text,
          lineHeight: 1.5,
          fontWeight: 600,
        }}
      >
        Do business faster with NEX — 80% of customers prefer in-chat
        checkout to waiting for email replies.
      </p>

      {/* Trial CTA. Links into the shop setup flow · Stripe wiring is a
          separate owner authorisation. */}
      <a
        href="/nex-native/manage/shop/start"
        data-nex-pricing-trial-cta
        style={{
          display: "block",
          marginTop: 16,
          padding: "14px 24px",
          borderRadius: 999,
          background: PALETTE.cta,
          color: "#FFF",
          textDecoration: "none",
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: "0.03em",
          textAlign: "center",
          boxShadow: "0 8px 20px rgba(255,114,0,0.42)",
        }}
      >
        FREE 7 Days Trial
      </a>
    </section>
  );
}

function PillLabel({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        background: "rgba(198, 161, 91, 0.14)",
        border: `1px solid ${PALETTE.cardBorder}`,
        color: PALETTE.accent,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Currency picker popover · listbox of launch currencies + extras
// -----------------------------------------------------------------------------

function CurrencyPickerPopover({
  selected,
  onPick,
}: {
  readonly selected: PricingCountry;
  readonly onPick: (iso: PricingCountry) => void;
}): React.ReactElement {
  return (
    <div
      role="listbox"
      aria-label="Display currency"
      data-nex-pricing-currency-popover
      style={{
        // Owner directive 2026-11-09 · stretch between the parent's
        // left and right edges rather than anchoring only to the right
        // with a fixed 260px width · the fixed width was overflowing
        // the phone-frame on the LEFT. `left:0 + right:0` makes the
        // popover exactly the width of the pickerRef container (which
        // spans the full inner-card width).
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        right: 0,
        zIndex: 50,
        maxHeight: 340,
        overflowY: "auto",
        padding: 6,
        borderRadius: 12,
        background: "#0A1C14",
        border: `1.5px solid ${PALETTE.cardBorderStrong}`,
        boxShadow:
          "0 20px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,0,0,0.3)",
      }}
    >
      <PickerSection
        title="Launch currencies"
        isos={LAUNCH_COUNTRY_LIST}
        selected={selected}
        onPick={onPick}
      />
      <PickerSection
        title="More currencies · approximate display"
        isos={EXTRA_COUNTRY_LIST}
        selected={selected}
        onPick={onPick}
      />
      <p
        style={{
          margin: "8px 6px 4px",
          fontSize: 10,
          color: PALETTE.textDim,
          lineHeight: 1.45,
          fontStyle: "italic",
        }}
      >
        Launch currencies are exact. Other currencies are approximate
        display amounts · billing happens in EUR / GBP / USD / IDR
        at checkout.
      </p>
    </div>
  );
}

function PickerSection({
  title,
  isos,
  selected,
  onPick,
}: {
  readonly title: string;
  readonly isos: ReadonlyArray<string>;
  readonly selected: PricingCountry;
  readonly onPick: (iso: PricingCountry) => void;
}): React.ReactElement {
  return (
    <div style={{ padding: "6px 0" }}>
      <div
        style={{
          padding: "4px 10px 6px",
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: PALETTE.accent,
        }}
      >
        {title}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {isos.map((iso) => {
          const s = COUNTRY_SPECS[iso];
          const isSelected = iso === selected;
          return (
            <li key={iso} style={{ margin: 0 }}>
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onPick(iso)}
                data-nex-pricing-currency-option={iso}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: isSelected
                    ? "rgba(198, 161, 91, 0.18)"
                    : "transparent",
                  border: isSelected
                    ? `1px solid ${PALETTE.accent}`
                    : "1px solid transparent",
                  color: PALETTE.text,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>{s.flag}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 800,
                      color: PALETTE.text,
                    }}
                  >
                    {s.currency} · {s.label}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 10.5,
                      color: PALETTE.textMuted,
                    }}
                  >
                    {s.priceShort} / month
                  </span>
                </span>
                {isSelected ? (
                  <span
                    aria-hidden
                    style={{
                      color: PALETTE.accent,
                      fontSize: 14,
                      fontWeight: 900,
                    }}
                  >
                    ✓
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
