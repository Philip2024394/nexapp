"use client";

// src/app/nex-native/directory/_currency-picker-client.tsx
//
// NEX Directory · "Currency ID" picker.
// Owner-authorised 2026-10-18 · Slice 1 (UI only · no live FX).
// -----------------------------------------------------------------------------
// Small chip-style button that opens an inline list of currencies.
// Tapping a currency submits a hidden form to the sealed
// `setPreferredCurrencyAction` server action which writes the
// `nex_preferred_currency` cookie and revalidates the directory page.
//
// Phase A limitation to flag honestly: the cookie writes do not yet
// change the prices shown on cards. Cards still render in the
// seller's currency only. The sealed `buyerLocalPrice` slot on the
// view model stays null until a Frankfurter / ECB FX source is
// authorised (Slice 2). The picker exists so the UI + persistence
// layer are ready when the FX pipeline is ready.
//
// Keyboard access:
//   · Tab reaches the trigger · Enter / Space toggles the menu.
//   · Escape closes the menu.
//   · Each currency row is a submit button inside its own <form>,
//     so Tab + Enter picks a currency without a mouse.

import * as React from "react";
import {
  NEX_CURRENCIES,
  type NexCurrency,
} from "@/lib/nex-native/currencies";
import { setPreferredCurrencyAction } from "./_set-currency-action";

const NEX = {
  text: "#F2F5F8",
  textDim: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  panel: "rgba(3, 16, 29, 0.95)",
  panelBorder: "rgba(0, 175, 255, 0.25)",
  bg: "var(--nex-world-background-base, #020914)",
};

interface Props {
  readonly currentCode: string;
}

export function CurrencyPickerClient({ currentCode }: Props) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Click-outside + Escape close.
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      data-nex-currency-picker
      style={containerStyle}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-nex-currency-picker-trigger
        style={triggerStyle}
      >
        <span style={triggerPrefixStyle}>Currency</span>
        <span style={triggerCodeStyle}>{currentCode}</span>
        <span aria-hidden style={triggerChevronStyle}>
          ⌄
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Select display currency"
          data-nex-currency-picker-menu
          style={menuStyle}
        >
          {NEX_CURRENCIES.map((c: NexCurrency) => {
            const isActive = c.code === currentCode;
            return (
              <form
                key={c.code}
                action={setPreferredCurrencyAction}
                onSubmit={() => setOpen(false)}
                style={{ margin: 0, padding: 0 }}
              >
                <input type="hidden" name="code" value={c.code} />
                <button
                  type="submit"
                  role="option"
                  aria-selected={isActive}
                  data-nex-currency-picker-option={c.code}
                  style={isActive ? optionActiveStyle : optionStyle}
                >
                  <span style={optionSymbolStyle}>{c.symbol}</span>
                  <span style={optionLabelStyle}>{c.label}</span>
                  {isActive ? (
                    <span aria-hidden style={optionCheckStyle}>
                      ✓
                    </span>
                  ) : null}
                </button>
              </form>
            );
          })}
          {/* Honest footer · tells the user what the cookie actually
              does today vs what it will do in Slice 2. */}
          <p style={menuFootnoteStyle}>
            Prices still shown in seller's currency. Buyer-currency
            estimates land when FX conversion is enabled.
          </p>
        </div>
      ) : null}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
};
const triggerStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  minHeight: 30,
  borderRadius: 999,
  background: "rgba(2,9,20,0.72)",
  color: NEX.cyan,
  border: `1px solid ${NEX.cyanSoft}`,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.3,
  WebkitTapHighlightColor: "transparent",
};
const triggerPrefixStyle: React.CSSProperties = {
  color: NEX.textDim,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.3,
};
const triggerCodeStyle: React.CSSProperties = {
  color: NEX.cyan,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.4,
};
const triggerChevronStyle: React.CSSProperties = {
  color: NEX.cyan,
  fontSize: 12,
  lineHeight: 1,
  marginLeft: 2,
};

const menuStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  zIndex: 50,
  minWidth: 240,
  maxHeight: 340,
  overflowY: "auto",
  background: NEX.panel,
  border: `1px solid ${NEX.panelBorder}`,
  borderRadius: 12,
  padding: 6,
  boxShadow: "0 16px 32px rgba(0,0,0,0.55)",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};
const optionBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  minHeight: 36,
  padding: "6px 10px",
  background: "transparent",
  border: "none",
  color: NEX.text,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "left",
  borderRadius: 8,
};
const optionStyle: React.CSSProperties = { ...optionBase };
const optionActiveStyle: React.CSSProperties = {
  ...optionBase,
  background: "rgba(0,175,255,0.12)",
  color: NEX.cyan,
};
const optionSymbolStyle: React.CSSProperties = {
  width: 22,
  textAlign: "center",
  color: NEX.cyan,
  fontWeight: 700,
};
const optionLabelStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const optionCheckStyle: React.CSSProperties = {
  color: NEX.cyan,
  fontWeight: 800,
  marginLeft: 6,
};

const menuFootnoteStyle: React.CSSProperties = {
  margin: "6px 10px 2px",
  color: NEX.textDim,
  fontSize: 10,
  lineHeight: 1.4,
  fontStyle: "italic",
};
