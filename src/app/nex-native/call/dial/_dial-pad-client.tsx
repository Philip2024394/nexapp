"use client";

// src/app/nex-native/call/dial/_dial-pad-client.tsx
//
// NEX · Dial pad · client interactivity (number entry · delete · call).
// Owner-authorised 2026-10-21 (iteration 40).
// -----------------------------------------------------------------------------
// Visual-only prototype. Tapping Call opens a toast · it does NOT
// actually place a call (no SIP / WebRTC wiring on this surface yet).

import * as React from "react";

const C = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  green: "#16D66B",
  danger: "#FF4D5E",
  panel: "rgba(5, 15, 28, 0.55)",
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
        padding: "16px 14px calc(env(safe-area-inset-bottom, 0px) + 20px)",
        gap: 10,
        position: "relative",
      }}
    >
      {/* Display */}
      <div
        data-nex-call-dial-display
        style={{
          minHeight: 56,
          padding: "10px 14px",
          background: C.panel,
          border: `1px solid ${C.cyanSoft}`,
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: digits.length === 0 ? C.textMute : C.text,
          fontVariantNumeric: "tabular-nums",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        }}
      >
        {digits.length === 0 ? "Enter a number" : digits}
      </div>

      {/* 3×4 keypad · flex-grows to fill */}
      <div
        data-nex-call-dial-keypad
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(4, 1fr)",
          gap: 10,
        }}
      >
        {KEYS.map((k) => (
          <button
            key={k.digit}
            type="button"
            onClick={() => press(k.digit)}
            data-nex-call-dial-key={k.digit}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(5, 15, 28, 0.72)",
              border: `1px solid rgba(0, 175, 255, 0.14)`,
              borderRadius: 999,
              color: C.text,
              cursor: "pointer",
              fontFamily: "inherit",
              padding: 0,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                lineHeight: 1,
              }}
            >
              {k.digit}
            </div>
            {k.sub && (
              <div
                style={{
                  marginTop: 2,
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  color: C.textMute,
                  fontWeight: 700,
                }}
              >
                {k.sub}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Call row · green call button + backspace */}
      <div
        data-nex-call-dial-call-row
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          marginTop: 4,
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
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: digits.length > 0 ? C.green : "rgba(22, 214, 107, 0.3)",
            color: "#042416",
            border: "none",
            fontSize: 22,
            cursor: digits.length > 0 ? "pointer" : "default",
            boxShadow:
              digits.length > 0
                ? `0 10px 24px -8px ${C.green}`
                : "none",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          📞
        </button>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {digits.length > 0 && (
            <button
              type="button"
              onClick={backspace}
              aria-label="Delete last digit"
              data-nex-call-dial-backspace
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "transparent",
                border: "none",
                color: C.textDim,
                fontSize: 20,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              ⌫
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
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)",
            padding: "10px 14px",
            background: "rgba(2, 9, 20, 0.95)",
            border: `1px solid ${C.cyanSoft}`,
            borderRadius: 12,
            color: C.text,
            fontSize: 12,
            textAlign: "center",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
