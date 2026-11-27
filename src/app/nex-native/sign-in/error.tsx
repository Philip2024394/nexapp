"use client";

// src/app/nex-native/sign-in/error.tsx
//
// Auth-surface error boundary · owner directive 2026-11-27.
// -----------------------------------------------------------------
// Previously delegated to the shared <SegmentErrorBoundary> which
// renders a dark-emerald fallback. Sign-in now uses the NEX cream
// theme (page.tsx palette), and the error fallback must match the
// page it belongs to — a dark card on a cream surface looked like a
// different app error.
//
// This file is intentionally self-contained · we do NOT modify the
// shared SegmentErrorBoundary because it is still correct for all
// other segments (chat, shops, feed, live, directory, hq, ...) which
// remain dark-themed.
//
// Preserved behaviour (parity with SegmentErrorBoundary):
//   · Fire-and-forget POST to /api/nex-native/incident/section-error
//     with section="auth", so observability is NOT lost.
//   · Opaque digest shown in the UI, nothing else from the error.
//   · reset() wired to re-mount the sign-in segment without a page
//     reload.

import * as React from "react";

// Cream palette · mirrors sign-in/page.tsx NEX const. Kept inline
// (not imported) because page.tsx's NEX object is a module-local
// constant · duplicating 8 colour tokens is cheaper than exporting
// a shared palette module for one caller.
const NEX = {
  bg: "#FBF5E9",
  panel: "#FFFFFF",
  textPrimary: "#1A1512",
  textSecondary: "#4A4038",
  textMuted: "#6B6256",
  cyan: "#C6A15B",
  cyanFaint: "rgba(26, 21, 18, 0.12)",
  orange: "#C04A15",
  orangeStroke: "#D65A0A",
  borderSoft: "rgba(26, 21, 18, 0.18)",
};

const MESSAGE_SHORT_MAX = 120;

function clipMessage(raw: unknown): string {
  if (typeof raw !== "string") return "unknown";
  return raw
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, MESSAGE_SHORT_MAX);
}

function reportSegmentError(messageShort: string): void {
  try {
    void fetch("/api/nex-native/incident/section-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section: "auth", message_short: messageShort }),
      keepalive: true,
      cache: "no-store",
    }).catch(() => undefined);
  } catch {
    /* defensive · never throw */
  }
}

export default function SignInError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    reportSegmentError(clipMessage(error?.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="polite"
      data-nex-segment-error="auth"
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.textPrimary,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: NEX.panel,
          borderRadius: 20,
          border: `1px solid ${NEX.borderSoft}`,
          padding: "36px 28px",
          textAlign: "center",
          boxShadow: "0 24px 60px -24px rgba(26, 21, 18, 0.18)",
        }}
      >
        <div
          style={{
            fontSize: 44,
            lineHeight: 1,
            fontFamily:
              '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
          }}
          aria-hidden
        >
          🌾
        </div>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 900,
            margin: "14px 0 6px",
            color: NEX.textPrimary,
          }}
        >
          Sign in couldn&rsquo;t load right now.
        </h2>
        <p
          style={{
            fontSize: 13.5,
            color: NEX.textSecondary,
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          You can keep using the rest of NEX · other surfaces are
          unaffected. Try again, or come back in a moment.
        </p>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 22,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "10px 22px",
              borderRadius: 999,
              border: "none",
              background:
                "linear-gradient(180deg, #FF8A1F 0%, #D65A0A 100%)",
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              boxShadow:
                "0 12px 32px -6px rgba(214, 90, 10, 0.45), 0 1px 0 rgba(255, 255, 255, 0.25) inset",
            }}
          >
            Try again
          </button>
          <a
            href="/nex-native"
            style={{
              padding: "10px 22px",
              borderRadius: 999,
              border: `1px solid ${NEX.borderSoft}`,
              background: "transparent",
              color: NEX.textSecondary,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Go home
          </a>
        </div>

        {error?.digest ? (
          <div
            style={{
              marginTop: 22,
              fontSize: 10.5,
              color: NEX.textMuted,
              letterSpacing: "0.08em",
            }}
          >
            Reference · <code>{error.digest}</code>
          </div>
        ) : null}
      </div>
    </div>
  );
}
