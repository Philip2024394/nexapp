"use client";

// src/app/nex-native/call/dial/_dial-pad-client.tsx
//
// NEX Ireland · Dial pad · client interactivity (number entry · delete ·
// call). Owner-authorised 2026-11-04 later-same-day · full rewrite to
// the sealed Ireland world palette.
// -----------------------------------------------------------------------------
// Visual-only prototype. Tapping Call toasts honestly · it does NOT
// place a real call (no SIP / WebRTC wiring on this surface yet).

import * as React from "react";

const IRELAND = {
  text: "#F2F5F8",
  textDim: "#CFDCD3",
  textMute: "rgba(175, 197, 181, 0.72)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  secondarySoft: "color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 35%, transparent)",
  secondaryFaint: "color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 18%, transparent)",
  heatRim: "var(--nex-kp-accent, #FF7200)",
  heatRimSoft: "rgba(255, 114, 0, 0.42)",
  panel: "rgba(27, 81, 56, 0.55)",
  panelDeep: "rgba(10, 31, 21, 0.75)",
  panelBorder: "rgba(198, 161, 91, 0.3)",
};

const KEYS: readonly { digit: string; sub: string }[] = [
  { digit: "1", sub: "" },
  { digit: "2", sub: "ABC" },
  { digit: "3", sub: "DEF" },
  { digit: "4", sub: "GHI" },
  { digit: "5", sub: "JKL" },
  { digit: "6", sub: "MNO" },
  { digit: "7", sub: "PQRS" },
  { digit: "8", sub: "TUV" },
  { digit: "9", sub: "WXYZ" },
  { digit: "*", sub: "" },
  { digit: "0", sub: "+" },
  { digit: "#", sub: "" },
];

export function DialPadClient(): React.JSX.Element {
  const [digits, setDigits] = React.useState("");
  const [toast, setToast] = React.useState<string | null>(null);

  const press = React.useCallback((d: string) => {
    setDigits((prev) => (prev + d).slice(0, 20));
  }, []);
  const backspace = React.useCallback(() => {
    setDigits((prev) => prev.slice(0, -1));
  }, []);
  const call = React.useCallback(() => {
    if (digits.length === 0) return;
    setToast(`Dialling ${digits}… (preview · no outbound call wired)`);
    window.setTimeout(() => setToast(null), 2200);
  }, [digits]);

  return (
    <div
      data-nex-call-dial-body
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        padding: "14px 18px calc(env(safe-area-inset-bottom, 0px) + 20px)",
        gap: 12,
        position: "relative",
      }}
    >
      {/* Display · tabular monospace keeps the digits aligned ·
          gold border so it reads as the primary focus area · subtle
          shadow for depth. */}
      <div
        data-nex-call-dial-display
        style={{
          minHeight: 64,
          padding: "12px 16px",
          background: IRELAND.panelDeep,
          border: `1.5px solid ${IRELAND.panelBorder}`,
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: digits.length === 0 ? IRELAND.textMute : IRELAND.text,
          fontVariantNumeric: "tabular-nums",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          boxShadow:
            "0 6px 20px -12px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
        }}
      >
        {digits.length === 0 ? "Enter a number" : digits}
      </div>

      {/* 3×4 keypad · gold-rimmed round keys · dark panel fill ·
          subtle highlight on hover/press · proportions grow to fill. */}
      <div
        data-nex-call-dial-keypad
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        {/* Owner directive 2026-11-04 later-same-day · "ui is very
            plain for buttons should we also have orange color" ·
            every dial key renders as an orange radial-gradient
            capsule matching the hero call-button vocabulary. White
            digits · cream sub-letters at reduced opacity so the
            digit remains the primary focal point. */}
        {KEYS.map((k) => (
          <button
            key={k.digit}
            type="button"
            onClick={() => press(k.digit)}
            data-nex-call-dial-key={k.digit}
            aria-label={`Dial ${k.digit}${k.sub ? ` · ${k.sub}` : ""}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: `radial-gradient(circle at 32% 28%, ${IRELAND.heatRim} 0%, color-mix(in srgb, ${IRELAND.heatRim} 68%, #1A0808) 100%)`,
              border: "none",
              borderRadius: 999,
              color: "#FFFFFF",
              cursor: "pointer",
              fontFamily: "inherit",
              padding: 0,
              WebkitTapHighlightColor: "transparent",
              transition: "transform 140ms ease, box-shadow 140ms ease",
              boxShadow: `0 10px 22px -10px ${IRELAND.heatRimSoft}, inset 0 2px 6px rgba(255, 255, 255, 0.25)`,
            }}
          >
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                lineHeight: 1,
                color: "#FFFFFF",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.35)",
              }}
            >
              {k.digit}
            </div>
            {k.sub && (
              <div
                style={{
                  marginTop: 3,
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  color: "rgba(255, 255, 255, 0.78)",
                  fontWeight: 800,
                }}
              >
                {k.sub}
              </div>
            )}
          </button>
        ))}
      </div>

      <style>{`
        [data-nex-call-dial-key]:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 26px -10px ${IRELAND.heatRimSoft},
                      inset 0 2px 8px rgba(255, 255, 255, 0.3);
          filter: brightness(1.08);
        }
        [data-nex-call-dial-key]:active {
          transform: translateY(0);
          filter: brightness(0.95);
          box-shadow: 0 6px 16px -10px ${IRELAND.heatRimSoft},
                      inset 0 2px 8px rgba(0, 0, 0, 0.25);
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-call-dial-key] { transition: none !important; }
          [data-nex-call-dial-key]:hover { transform: none; filter: none; }
        }
      `}</style>

      {/* Call row · orange call button (NEX heat accent) · gold
          backspace on the right · empty cell on the left so the
          call button stays mathematically centred. */}
      <div
        data-nex-call-dial-call-row
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          marginTop: 2,
        }}
      >
        <span />
        <button
          type="button"
          onClick={call}
          disabled={digits.length === 0}
          aria-label="Call"
          data-nex-call-dial-call
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background:
              digits.length > 0
                ? `radial-gradient(circle at 32% 28%, ${IRELAND.heatRim} 0%, color-mix(in srgb, ${IRELAND.heatRim} 68%, #1A0808) 100%)`
                : "rgba(255, 114, 0, 0.18)",
            color: "#FFFFFF",
            border: "none",
            fontSize: 24,
            cursor: digits.length > 0 ? "pointer" : "not-allowed",
            boxShadow:
              digits.length > 0
                ? `0 12px 28px -10px ${IRELAND.heatRimSoft}, inset 0 2px 6px rgba(255, 255, 255, 0.28)`
                : "none",
            WebkitTapHighlightColor: "transparent",
            opacity: digits.length > 0 ? 1 : 0.6,
            transition: "transform 140ms ease, box-shadow 140ms ease",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1 1 0 0 0-1.02.24l-2.2 2.2a15.15 15.15 0 0 1-6.59-6.59l2.2-2.2a1 1 0 0 0 .24-1.02A11.7 11.7 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z" />
          </svg>
        </button>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {digits.length > 0 && (
            <button
              type="button"
              onClick={backspace}
              aria-label="Delete last digit"
              data-nex-call-dial-backspace
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "transparent",
                border: `1px solid ${IRELAND.panelBorder}`,
                color: IRELAND.secondary,
                fontSize: 20,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M22 5H8.5c-.58 0-1.13.25-1.51.68L2 12l4.99 6.32c.38.43.93.68 1.51.68H22c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-3.17 10.41L17.41 17 14 13.59 10.59 17 9.17 15.41 12.59 12 9.17 8.59 10.59 7 14 10.41 17.41 7l1.42 1.59L15.41 12z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div
          role="status"
          data-nex-call-dial-toast
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)",
            padding: "10px 14px",
            background: "rgba(10, 31, 21, 0.95)",
            border: `1px solid ${IRELAND.panelBorder}`,
            borderRadius: 12,
            color: IRELAND.text,
            fontSize: 12,
            textAlign: "center",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "0 8px 24px -8px rgba(0, 0, 0, 0.6)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
