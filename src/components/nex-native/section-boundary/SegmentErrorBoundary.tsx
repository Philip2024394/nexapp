"use client";

// src/components/nex-native/section-boundary/SegmentErrorBoundary.tsx
//
// NEX segment-level error boundary · owner-sealed 2026-11-08 (round 6).
// -----------------------------------------------------------------------------
// Partner for per-segment `error.tsx` files. Next 16 App Router renders
// an `error.tsx` when any component in the segment's tree throws · this
// component is the SHARED client UI for those error.tsx files so every
// segment shows the same branded NEX fallback and the same redacted
// incident-report POST.
//
// Doctrine
//   · "use client" · receives Next's reset() callback.
//   · One fallback per segment · a crash in /chat does NOT render the
//     /shops fallback. Sibling segments stay interactive.
//   · Incident report is fire-and-forget · endpoint always 200.
//   · Content safety · we only ever forward error.message (clipped to
//     120 chars + newline-flattened). NEVER error.stack · NEVER
//     error.digest beyond showing the opaque reference in the UI.
//   · Reset re-mounts the segment WITHOUT a full page reload.

import * as React from "react";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const ACCENT_EMERALD = "#16D66B";
const BORDER = "rgba(22,214,107,0.2)";

const MESSAGE_SHORT_MAX = 120;

/** Section scope · must match a value the sealed incident endpoint
 *  accepts (LEGAL_SECTIONS in /api/nex-native/incident/section-error).
 *  Phase 1 maps settings + community to "infra" until migration 304
 *  expands the DB CHECK. */
export type SegmentScope =
  | "chat"
  | "shops"
  | "feed"
  | "live"
  | "directory"
  | "food"
  | "fashion"
  | "accommodation"
  | "property"
  | "hq"
  | "infra"
  | "auth"
  | "storage"
  | "db"
  | "cron"
  // Owner-authorised 2026-11-08 (round 8) Priority 2 · migration 304.
  | "settings"
  | "community";

export interface SegmentErrorBoundaryProps {
  /** Scope tag sent to the incident endpoint. */
  readonly section: SegmentScope;
  /** Short human-friendly segment name shown in the fallback card. */
  readonly label: string;
  /** Next's error object. */
  readonly error: Error & { digest?: string };
  /** Next's re-render callback. */
  readonly reset: () => void;
}

function clipMessage(raw: unknown): string {
  if (typeof raw !== "string") return "unknown";
  return raw
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, MESSAGE_SHORT_MAX);
}

function reportSegmentError(section: SegmentScope, messageShort: string): void {
  // Fire-and-forget. keepalive helps when the user navigates away mid-
  // request. Error swallowed · the boundary must never destabilise.
  try {
    void fetch("/api/nex-native/incident/section-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section, message_short: messageShort }),
      keepalive: true,
      cache: "no-store",
    }).catch(() => undefined);
  } catch {
    /* defensive · never throw */
  }
}

export function SegmentErrorBoundary({
  section,
  label,
  error,
  reset,
}: SegmentErrorBoundaryProps): React.JSX.Element {
  React.useEffect(() => {
    const messageShort = clipMessage(error?.message);
    reportSegmentError(section, messageShort);
    // Intentionally omit `section` from deps · it's set once per
    // segment and is a compile-time constant at each callsite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="polite"
      data-nex-segment-error={section}
      style={{
        minHeight: "60vh",
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
      <div style={{ fontSize: 48, lineHeight: 1 }} aria-hidden>
        🌿
      </div>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 900,
          margin: "14px 0 6px",
          textAlign: "center",
        }}
      >
        {label} couldn&rsquo;t load right now.
      </h2>
      <p
        style={{
          fontSize: 13.5,
          color: INK_DIM,
          margin: 0,
          maxWidth: 420,
          textAlign: "center",
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

      {error?.digest ? (
        <div
          style={{
            marginTop: 22,
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
