"use client";

// src/components/nex-native/live-commerce/BuyNowButton.tsx
//
// Owner directive 2026-10-26 (Round 3f) · floating yellow Buy Now
// pill positioned under the broadcaster header text. Renders only
// when the current manifest entry carries `buyNowPriceIdr`.
//
// On tap · opens a confirm sheet that records a Buy-Now INTENT (per
// Amendment 2 §7 · "a single tap does not commit a sale"). Dev mock
// · the real wire-up is the Live Message Container (blocked on
// multiple Round 2 decisions). Flagged in-sheet so the behaviour is
// honest.
//
// Hidden automatically when the product panel is expanded via the
// sealed body[data-nex-watch-expanded="true"] CSS rule in
// WatchOverlayCaption.

import * as React from "react";

const NEX = {
  text: "#0A1526",
  textDim: "#4A5F7C",
  cyan: "#00AFFF",
  yellow: "#FFC24B",
  yellowStrong: "#F0A800",
  yellowDark: "#1A1200",
  panelBg: "rgba(255, 255, 255, 0.78)",
  panelBorder: "rgba(0, 175, 255, 0.42)",
  shadow: "0 20px 50px -16px rgba(0, 20, 60, 0.5)",
  shadowSoft: "0 8px 20px -8px rgba(0, 20, 60, 0.3)",
  frostBorder: "rgba(0, 175, 255, 0.42)",
} as const;

/** Format integer rupiah → Indonesian locale string, prefixed "Rp".
 *  Full form · example: 450_000_000 → "Rp 450.000.000". Used inside
 *  the confirm sheet where the full amount matters. Pure utility. */
function formatRupiah(amountIdr: number): string {
  const safe = Math.max(0, Math.trunc(amountIdr));
  return `Rp ${safe.toLocaleString("id-ID")}`;
}

/** Owner directive 2026-10-27 · "when have rp - i suggest for
 *  300.000 we show like Rp 300.000 and when millio we can 1Jt 270
 *  or find way that works better". Indonesian compact rupiah for
 *  tight UI slots (the floating pill, directory tiles, etc).
 *
 *  Scale (standard Indonesian ·  Jt = Juta, M = Miliar, T = Triliun):
 *    · < 1.000.000           → "Rp 300.000"       (full · 3 digits saved vs 7)
 *    · ≥ 1.000.000           → "Rp 1,27 Jt"       (2 dp when < 10 Jt)
 *    · ≥ 10.000.000          → "Rp 45 Jt"         (0 dp when ≥ 10 Jt)
 *    · ≥ 1.000.000.000       → "Rp 1,5 M"         (2 dp when < 10 M)
 *    · ≥ 10.000.000.000      → "Rp 45 M"
 *    · ≥ 1.000.000.000.000   → "Rp 1,5 T"
 *
 *  Uses the id-ID locale so the thousands separator is "." and the
 *  decimal separator is "," · never fabricates precision beyond the
 *  input integer. Pure. */
function formatRupiahCompact(amountIdr: number): string {
  const safe = Math.max(0, Math.trunc(amountIdr));
  if (safe < 1_000_000) {
    return `Rp ${safe.toLocaleString("id-ID")}`;
  }
  if (safe < 1_000_000_000) {
    const jt = safe / 1_000_000;
    const dp = jt < 10 ? 2 : 0;
    return `Rp ${jt.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: dp })} Jt`;
  }
  if (safe < 1_000_000_000_000) {
    const m = safe / 1_000_000_000;
    const dp = m < 10 ? 2 : 0;
    return `Rp ${m.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: dp })} M`;
  }
  const t = safe / 1_000_000_000_000;
  const dp = t < 10 ? 2 : 0;
  return `Rp ${t.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: dp })} T`;
}

export interface BuyNowButtonProps {
  readonly priceIdr?: number;
  readonly productLabel: string;
  readonly sellerLabel?: string;
  readonly topOffsetPx?: number;
}

export function BuyNowButton(props: BuyNowButtonProps): React.JSX.Element | null {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [toast, setToast] = React.useState(false);

  React.useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(false), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!props.priceIdr || props.priceIdr <= 0) return null;

  // Compact label for the floating pill · full label for the confirm
  // sheet (where the exact amount matters to the viewer committing
  // the Buy-Now intent). Owner directive 2026-10-27 · "we need new
  // design thats smaller" + Indonesian compact-rupiah formatting.
  const compactLabel = formatRupiahCompact(props.priceIdr);
  const fullLabel = formatRupiah(props.priceIdr);
  const topOffset = props.topOffsetPx ?? 92;
  const seller = props.sellerLabel ?? "the seller";

  const onConfirm = (): void => {
    setSheetOpen(false);
    setToast(true);
  };

  return (
    <>
      {/* Owner directive 2026-10-27 · smaller design + compact IDR.
          Previous pill: 36 px min-height · "⚡ Buy Now Rp
          450.000.000 →" (fat). New pill: 28 px min-height · more
          compact 10-11 px label + compact-formatted amount (e.g.
          "Rp 450 Jt" instead of "Rp 450.000.000") so it fits the
          phone frame on narrower viewports without wrapping. The ⚡
          glyph + Buy-Now intent label are gone from the pill · the
          action is self-evident once the compact amount is visible,
          and the → arrow is retained to signal tap-forward. */}
      <button
        type="button"
        data-nex-live-buy-now
        onClick={() => setSheetOpen(true)}
        aria-label={`Buy Now · ${fullLabel}`}
        style={{
          position: "fixed",
          left: "50%",
          top: topOffset,
          transform: "translateX(-50%)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px 4px 8px",
          minHeight: 26,
          borderRadius: 999,
          background: `linear-gradient(135deg, ${NEX.yellow} 0%, ${NEX.yellowStrong} 100%)`,
          border: "1px solid rgba(255,255,255,0.9)",
          color: NEX.yellowDark,
          fontFamily: "inherit",
          fontSize: 11.5,
          fontWeight: 800,
          letterSpacing: "0.02em",
          cursor: "pointer",
          zIndex: 55,
          boxShadow: NEX.shadowSoft,
          WebkitTapHighlightColor: "transparent",
          whiteSpace: "nowrap",
        }}
      >
        <span aria-hidden style={{ fontSize: 11, lineHeight: 1 }}>⚡</span>
        <span style={{ color: "#4A2E00", fontWeight: 900 }}>{compactLabel}</span>
        <span aria-hidden style={{ fontSize: 11, lineHeight: 1, opacity: 0.7 }}>→</span>
      </button>

      {sheetOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Buy Now"
          data-nex-live-buy-now-sheet
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            pointerEvents: "auto",
            zIndex: 80,
            animation: "nexBuyNowFadeIn 160ms ease-out",
          }}
          onClick={() => setSheetOpen(false)}
        >
          <div
            onClick={(ev) => ev.stopPropagation()}
            style={{
              background: NEX.panelBg,
              backdropFilter: "blur(14px) saturate(1.4)",
              WebkitBackdropFilter: "blur(14px) saturate(1.4)",
              border: `1.5px solid ${NEX.panelBorder}`,
              borderRadius: 16,
              padding: 20,
              maxWidth: 340,
              width: "100%",
              color: NEX.text,
              boxShadow: NEX.shadow,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX.yellowStrong,
                marginBottom: 6,
              }}
            >
              Buy Now · confirm
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>
              {props.productLabel}
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: NEX.text,
                marginBottom: 4,
                letterSpacing: "0.01em",
              }}
            >
              {fullLabel}
            </div>
            {/* Compact echo · reassures the viewer the small pill
                they tapped and the big amount here are the same.
                Only shown when the compact label actually differs
                from the full label (i.e., amount ≥ 1 Jt). */}
            {compactLabel !== fullLabel ? (
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: NEX.textDim,
                  marginBottom: 14,
                  letterSpacing: "0.02em",
                }}
              >
                {compactLabel}
              </div>
            ) : (
              <div style={{ marginBottom: 10 }} />
            )}
            <div
              style={{
                fontSize: 11.5,
                lineHeight: 1.5,
                color: NEX.textDim,
                marginBottom: 14,
                background: "rgba(0,175,255,0.08)",
                border: "1px dashed rgba(0,175,255,0.35)",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              This records your Buy Now request at this price. It is not a
              payment and is not a confirmed sale. NEX does not process
              payments; {seller} will reply here to arrange payment and
              delivery.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                style={{
                  flex: "1 1 40%",
                  minHeight: 44,
                  borderRadius: 10,
                  background: "transparent",
                  border: "1px solid rgba(10,21,38,0.14)",
                  color: NEX.textDim,
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                style={{
                  flex: "1 1 60%",
                  minHeight: 44,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${NEX.yellow} 0%, ${NEX.yellowStrong} 100%)`,
                  border: "none",
                  color: NEX.yellowDark,
                  fontSize: 13.5,
                  fontWeight: 900,
                  letterSpacing: "0.03em",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Confirm Buy Now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          data-nex-live-buy-now-toast
          style={{
            position: "fixed",
            left: "50%",
            bottom: 120,
            transform: "translateX(-50%)",
            background: "rgba(6,16,30,0.96)",
            border: `1px solid ${NEX.cyan}`,
            color: "#FFFFFF",
            padding: "12px 18px",
            borderRadius: 12,
            fontSize: 13.5,
            fontWeight: 700,
            boxShadow: NEX.shadow,
            pointerEvents: "auto",
            zIndex: 60,
            maxWidth: 320,
          }}
        >
          ⚡ Buy Now request sent to {seller}.
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.65)", marginTop: 4, fontWeight: 600 }}>
            Dev preview · production wire-up pending Live Message Container.
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes nexBuyNowFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
}
