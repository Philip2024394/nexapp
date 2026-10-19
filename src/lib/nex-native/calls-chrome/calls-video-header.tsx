// src/lib/nex-native/calls-chrome/calls-video-header.tsx
//
// NEX Calls Chrome · master header for the Calls & Video surface.
// Owner-authorised 2026-10-19 (Phase 1 UI shell).
// -----------------------------------------------------------------------------
// Composition from the sealed concept image:
//   · Left   · NexPingBadge (cyan ring · "NEX" text · pulsing)
//   · Centre · "NEX" (bold, large) / "CALLS & VIDEO" (eyebrow)
//   · Right  · cosmic Earth globe + green CONNECTED dot + call timer
//
// Server Component · zero client state. The timer value is a STRING
// passed in by the caller (preview page uses "04:32"; the real
// group-call-client will pass a tick-driven value when the chrome is
// promoted). This keeps the chrome rendering honest · it NEVER
// invents its own elapsed time.

import type { CSSProperties } from "react";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import type { CallsSessionStatus, CallsThemeSkin } from "./types";

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanBright: "#5CC9FF",
  cyanSoft: "rgba(0, 175, 255, 0.42)",
  green: "#2ED37A",
  greenGlow: "rgba(46, 211, 122, 0.45)",
};

export interface CallsVideoHeaderProps extends CallsThemeSkin {
  /** The session status drives the status pill colour + label. */
  readonly status: CallsSessionStatus;
  /** Pre-formatted elapsed time (e.g. "04:32") · caller owns the
   *  tick · chrome never invents its own clock. Null hides the
   *  timer slot. */
  readonly elapsed: string | null;
  /** Owner directive 2026-10-19 (hub-landing authorisation) ·
   *  mode="landing" hides the status pill + timer entirely. The
   *  idle Calls hub uses this · displaying a live CONNECTED pill
   *  or a 04:32 timer when no call is active would be a dishonest
   *  signal. mode="active" (default) renders the pill + timer as
   *  before · the live group-call surface uses this. */
  readonly mode?: "active" | "landing";
}

export function CallsVideoHeader({
  status,
  elapsed,
  themeAccent,
  mode = "active",
}: CallsVideoHeaderProps) {
  const accent = themeAccent ?? NEX.cyan;
  const statusLabel = labelForStatus(status);
  const statusColour =
    status === "connected"
      ? NEX.green
      : status === "ended"
        ? "#B5C3D6"
        : accent;
  const isLanding = mode === "landing";
  return (
    <header
      style={headerStyle}
      data-nex-calls-video-header
      data-nex-calls-video-header-mode={mode}
    >
      {/* Left · NEX brand mark */}
      <div style={brandSlotStyle}>
        <NexPingBadge size={44} accent={accent} dataTestId="calls-video-nex" />
      </div>

      {/* Centre · wordmark + eyebrow · owner directive 2026-10-19 ·
          eyebrow label changed from "Calls & Video" to "Call Center". */}
      <div style={wordmarkColumnStyle}>
        <span style={wordmarkStyle}>NEX</span>
        <span style={eyebrowStyle}>Call Center</span>
      </div>

      {/* Right · status + timer · owner directive 2026-10-19 · the
          cosmic Earth-globe graphic that previously sat to the left
          of the green CONNECTED dot has been retired. Right cluster
          now carries only the status pill + timer, flush against
          the eyebrow column.
          Landing mode (mode="landing") skips the right cluster
          entirely · the idle hub must not imply a call is active. */}
      {isLanding ? null : (
        <div style={rightClusterStyle}>
          <div style={statusColumnStyle}>
            <div style={statusPillStyle}>
              <span
                aria-hidden
                style={{
                  ...statusDotStyle,
                  background: statusColour,
                  boxShadow: `0 0 8px ${statusColour}`,
                }}
              />
              <span
                style={{
                  ...statusLabelStyle,
                  color: statusColour,
                }}
              >
                {statusLabel}
              </span>
            </div>
            {elapsed ? <span style={timerStyle}>{elapsed}</span> : null}
          </div>
        </div>
      )}
    </header>
  );
}

function labelForStatus(status: CallsSessionStatus): string {
  switch (status) {
    case "connecting":
      return "Connecting";
    case "connected":
      return "Connected";
    case "reconnecting":
      return "Reconnecting";
    case "ended":
      return "Ended";
    default:
      return status;
  }
}

// GlobeGlyph retired 2026-10-19 along with its mount to the left of
// the green CONNECTED dot · owner directive · see the main render
// comment for context.

// ─── Styles ─────────────────────────────────────────────────────────

// Owner directive 2026-10-19 · shade retired from the header. The
// linear-gradient fade that darkened the top of the viewport is
// gone · header renders transparent now so the Call Center chrome
// sits cleanly against the sealed directory-bg layer or whatever
// background a theme passes behind it.
const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding:
    "calc(env(safe-area-inset-top, 0px) + 10px) 14px 12px",
  background: "transparent",
  flexShrink: 0,
};
const brandSlotStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
};
const wordmarkColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 1,
  flex: 1,
  minWidth: 0,
};
const wordmarkStyle: CSSProperties = {
  color: NEX.text,
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: "-0.01em",
  lineHeight: 1,
};
const eyebrowStyle: CSSProperties = {
  color: NEX.cyan,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  lineHeight: 1.1,
};
const rightClusterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
};
const statusColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 2,
};
const statusPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
};
const statusDotStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  flexShrink: 0,
};
const statusLabelStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  lineHeight: 1,
};
const timerStyle: CSSProperties = {
  color: NEX.text,
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "ui-monospace, 'SF Mono', monospace",
  lineHeight: 1,
};
