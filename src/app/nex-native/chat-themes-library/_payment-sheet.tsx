// src/app/nex-native/chat-themes-library/_payment-sheet.tsx
//
// NEX Chat Themes Library · placeholder payment sheet.
// Owner-authorised 2026-11-02.
// -----------------------------------------------------------------------------
// Shared "Payment coming soon" sheet mounted by the entry carousel +
// the full library grid. Prices are visible but no Stripe calls fire.

"use client";

import * as React from "react";

const NEX_ACCENT = "var(--nex-world-secondary, #C6A15B)";
const NEX_INK = "#F2F5F8";
const NEX_INK_DIM = "#B5C3D6";
const NEX_INK_MUTE = "#7D9BC0";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface PaymentPlaceholderSheetProps {
  readonly title: string;
  readonly description: string;
  readonly onClose: () => void;
}

export function PaymentPlaceholderSheet({
  title,
  description,
  onClose,
}: PaymentPlaceholderSheetProps): React.JSX.Element {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-nex-library-payment-placeholder
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, rgba(2, 9, 20, 0.72) 0%, rgba(2, 9, 20, 0.92) 100%)",
          backdropFilter: "blur(24px) saturate(140%)",
          WebkitBackdropFilter: "blur(24px) saturate(140%)",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      />
      <article
        style={{
          position: "relative",
          maxWidth: 420,
          width: "min(92vw, 420px)",
          padding: 20,
          borderRadius: 18,
          background: "rgba(6, 15, 28, 0.92)",
          border: `1px solid ${NEX_ACCENT}`,
          color: NEX_INK,
          fontFamily: SANS,
          textAlign: "center",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: NEX_INK_MUTE,
          }}
        >
          Payment coming soon
        </p>
        <h2
          style={{
            margin: "8px 0 0",
            fontSize: 20,
            fontWeight: 700,
            color: NEX_INK,
          }}
        >
          {title}
        </h2>
        <p style={{ margin: "10px 0 0", fontSize: 14, color: NEX_INK_DIM }}>
          {description}
        </p>
        <p style={{ margin: "14px 0 0", fontSize: 12, color: NEX_INK_MUTE }}>
          Stripe checkout is being wired. Prices and ownership flow
          will go live once the integration is approved.
        </p>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 18,
            minHeight: 44,
            width: "100%",
            padding: "0 20px",
            borderRadius: 999,
            background: NEX_ACCENT,
            color: "#0a1a0a",
            border: `1px solid ${NEX_ACCENT}`,
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Got it
        </button>
      </article>
    </div>
  );
}
