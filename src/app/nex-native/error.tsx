"use client";

// src/app/nex-native/error.tsx
//
// NEX app-wide error boundary · owner-sealed 2026-11-08 (round 3).
// -----------------------------------------------------------------------------
// Doctrine
//   · Next.js App Router error.tsx · catches any uncaught render error
//     thrown anywhere under /nex-native/*. This is the LAST LINE OF
//     DEFENCE after SectionBoundary · if a section boundary is missing
//     or itself throws, this file fires instead of Next's default
//     stack-trace page.
//   · Owner directive 2026-11-08 (round 3) · "NEX always keeps any
//     issue from users seeing on live app." → end-users see a
//     friendly fallback card · never a stack trace, never a raw
//     Postgres error, never a "server error" barn-door.
//   · Content safety · we never render error.message or error.stack.
//     The digest (Next.js correlation id) IS shown in a muted strip
//     so a user reporting the issue can point us at it. Digests are
//     opaque · not a security leak.
//   · Reporting · the sealed incident surface already receives
//     reports from <SectionBoundary>. This file does NOT re-report
//     because the section boundary that owned the failing subtree
//     will usually catch first. If section boundaries miss, we still
//     want this file to STAY silent on the wire · fewer moving parts.

import * as React from "react";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const ACCENT_EMERALD = "#16D66B";
const BORDER = "rgba(22,214,107,0.2)";

export default function NexNativeError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        minHeight: "100dvh",
        background:
          "radial-gradient(900px 600px at 50% 0%, rgba(22,214,107,0.08), rgba(22,214,107,0) 60%), #040E09",
        color: INK,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ fontSize: 56, lineHeight: 1 }} aria-hidden>
        🌿
      </div>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 900,
          margin: "16px 0 6px",
          textAlign: "center",
        }}
      >
        Something went wrong on this screen.
      </h1>
      <p
        style={{
          fontSize: 14,
          color: INK_DIM,
          margin: 0,
          maxWidth: 420,
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        You can keep using NEX · the rest of the app is unaffected.
        Try again, or go back to the home surface. If this keeps
        happening, let us know.
      </p>

      <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "10px 22px",
            borderRadius: 8,
            border: `1px solid ${ACCENT_EMERALD}`,
            background: "rgba(22,214,107,0.12)",
            color: ACCENT_EMERALD,
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Try again
        </button>
        <a
          href="/nex-native"
          style={{
            padding: "10px 22px",
            borderRadius: 8,
            border: `1px solid ${BORDER}`,
            background: "transparent",
            color: INK_DIM,
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

      {error.digest ? (
        <div
          style={{
            marginTop: 28,
            fontSize: 10.5,
            color: INK_MUTED,
            letterSpacing: "0.08em",
          }}
        >
          Reference · <code>{error.digest}</code>
        </div>
      ) : null}
    </div>
  );
}
