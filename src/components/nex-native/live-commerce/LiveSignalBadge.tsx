// src/components/nex-native/live-commerce/LiveSignalBadge.tsx
//
// Header-right signal badge · white satellite pole icon with
// organic scanning-dish rotation. Reusable chrome for Live and
// recorded video surfaces.
// -----------------------------------------------------------------------------
// Owner directive 2026-10-24 · "live icon small is spin around and
// then spin 80% then spin other way we need randomy and some times
// stop". The dish now scans like a real tracking antenna · it
// rotates, pauses, partially reverses, holds, then resumes · never
// strictly repeating. Driven by requestAnimationFrame with
// randomised state transitions so each session reads differently.
//
// Doctrine (sealed · never drifted):
//   · "Keep active broadcasts distinguishable from recordings ·
//     Never label non-live content as currently Live."
//
// Accessibility:
//   · aria-label describes the signal state honestly to screen
//     readers.
//   · prefers-reduced-motion freezes the dish rotation.

"use client";

import * as React from "react";

export interface LiveSignalBadgeProps {
  /** Optional label text displayed to the right of the icon.
   *  Omit for recorded content · present only for real Live. */
  readonly label?: string;
  /** Accent colour for the label text + icon. Defaults to white. */
  readonly accentColor?: string;
  /** Full aria-label for screen readers. Mandatory · owner must
   *  describe the state honestly (e.g. "Live broadcast on air",
   *  "Signal strong, playing recorded video"). */
  readonly ariaLabel: string;
}

export function LiveSignalBadge(
  props: LiveSignalBadgeProps,
): React.JSX.Element {
  const accent = props.accentColor ?? "#FFFFFF";
  const hasLabel = typeof props.label === "string" && props.label.length > 0;
  return (
    <div
      data-nex-live-signal-badge
      data-nex-live-signal-badge-has-label={hasLabel ? "true" : "false"}
      role="img"
      aria-label={props.ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: hasLabel ? "6px 12px 6px 8px" : "6px",
        borderRadius: 999,
        background: "rgba(2, 9, 20, 0.56)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: `1px solid ${accent === "#FFFFFF" ? "rgba(255,255,255,0.18)" : accent}`,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <SatelliteIconWithPing accentColor={accent} />
      {hasLabel && (
        <span
          data-nex-live-signal-badge-label
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: accent,
            lineHeight: 1,
          }}
        >
          {props.label}
        </span>
      )}
    </div>
  );
}

/**
 * The icon · a satellite pole (fixed mast + base) with a scanning
 * dish that rotates in an organic non-repeating pattern:
 *   · spins full round, sometimes 80% then reverses
 *   · pauses at random intervals (as if locked on a signal)
 *   · reverses direction, resumes
 * Driven by rAF with randomised state transitions.
 */
/** Exported for callers that want the icon ONLY (no badge pill),
 *  e.g. inline next to a header title. Owner directive 2026-10-24 ·
 *  simplified from the earlier scanning-dish shape to a cleaner
 *  "tower with ball-dot at top" per owner feedback. The dish-rotation
 *  animation is retired · the icon is now static geometry with the
 *  ping-wave halo radiating from the tower top. */
export function SatelliteIconWithPing({
  accentColor,
}: {
  readonly accentColor: string;
}): React.JSX.Element {

  return (
    <span
      aria-hidden
      data-nex-live-signal-icon
      style={{
        position: "relative",
        width: 20,
        height: 20,
        display: "inline-block",
        flexShrink: 0,
      }}
    >
      {/* Owner directive 2026-10-24 · "the rotating pole must have
          ping lines". Concentric wave arcs ping outward from the
          pole centre · they do NOT rotate (they're a signal emanation,
          not part of the structure). Staggered 600ms delay for the
          classic radar-sweep feel. */}
      <style>{`
        @keyframes nexLiveSignalPing {
          0%   { transform: scale(0.4); opacity: 0.9; }
          60%  { opacity: 0.4; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-live-signal-wave] { animation: none !important; opacity: 0.5 !important; }
        }
      `}</style>
      <span
        data-nex-live-signal-wave
        style={{
          position: "absolute",
          inset: 0,
          border: `1.4px solid ${accentColor}`,
          borderRadius: "50%",
          animation: "nexLiveSignalPing 1800ms ease-out infinite",
          animationDelay: "0ms",
          opacity: 0.9,
        }}
      />
      <span
        data-nex-live-signal-wave
        style={{
          position: "absolute",
          inset: 0,
          border: `1.4px solid ${accentColor}`,
          borderRadius: "50%",
          animation: "nexLiveSignalPing 1800ms ease-out infinite",
          animationDelay: "600ms",
          opacity: 0.9,
        }}
      />
      <span
        data-nex-live-signal-wave
        style={{
          position: "absolute",
          inset: 0,
          border: `1.4px solid ${accentColor}`,
          borderRadius: "50%",
          animation: "nexLiveSignalPing 1800ms ease-out infinite",
          animationDelay: "1200ms",
          opacity: 0.9,
        }}
      />
      <svg
        viewBox="0 0 20 20"
        width={20}
        height={20}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
        }}
      >
        {/* Owner directive 2026-10-24 · "icon tower with ball dot at
            top". Static geometry · the pole no longer spins. Reads
            like a slim radio tower with a prominent emitter sphere
            at the apex; the ping-wave ring (above this SVG, as DOM
            siblings) radiates outward from the ball. */}
        <g data-nex-live-signal-pole>
          {/* Vertical tower · from just below the ball down to the
              base plate. */}
          <line
            x1="10"
            y1="7"
            x2="10"
            y2="17"
            stroke={accentColor}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Horizontal base plate. */}
          <line
            x1="6"
            y1="17"
            x2="14"
            y2="17"
            stroke={accentColor}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Owner directive 2026-10-24 · prominent ball-dot at top ·
              the signal emitter · the ping-wave ring radiates from
              here visually. */}
          <circle
            data-nex-live-signal-top-dot
            cx="10"
            cy="4.2"
            r="2.4"
            fill={accentColor}
          />
        </g>
      </svg>
    </span>
  );
}
