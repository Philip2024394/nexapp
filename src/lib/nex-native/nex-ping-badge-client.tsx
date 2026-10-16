"use client";

// src/lib/nex-native/nex-ping-badge-client.tsx
//
// NEX ping badge · owner-approved 2026-10-15.
// -----------------------------------------------------------------------------
// Blue-ringed circular NEX badge with a pulsing "ping" halo and
// "NE" lettering inside. Used in the landing + welcome page top-left
// headers so both surfaces share the same brand mark.
//
// Pure CSS · no external assets · scales via the `size` prop. Ping
// animation respects `prefers-reduced-motion` (set via a keyframe
// media query so no JS listener is needed).

import * as React from "react";

export interface NexPingBadgeProps {
  /** Outer diameter in CSS pixels. Default 56. */
  readonly size?: number;
  /** Primary ring + text colour. Default NEX cyan #00AFFF. */
  readonly accent?: string;
  /** Hide the pulsing halo (keep the ring + text only). Default false. */
  readonly disablePing?: boolean;
  /** Optional data-attribute hook for tests/e2e. */
  readonly dataTestId?: string;
}

export function NexPingBadge({
  size = 56,
  accent = "#00AFFF",
  disablePing = false,
  dataTestId,
}: NexPingBadgeProps): React.ReactElement {
  // Core measurements · derived once per render so a bigger badge
  // scales ring thickness, inner text, and ping diameter together.
  // "NEX" (3 chars) needs a smaller font-size ratio than "NE" (2
  // chars) did so the word fits inside the circle without clipping ·
  // owner directive 2026-10-15.
  const ringThickness = Math.max(2, Math.round(size * 0.055));
  const textSize = Math.round(size * 0.26);

  // Static keyframe name + class · same for every badge instance.
  // Multiple badges on one page share the keyframe and the reduced-
  // motion rule, which is the correct universal behaviour. React
  // rejects uppercase letters in data-* attribute names, which was
  // the cause of the earlier `useId`-based prop warning.

  return (
    <>
      <style>{`
        @keyframes nex-ping-pulse {
          0%   { transform: scale(1);   opacity: 0.85; }
          80%  { transform: scale(1.6); opacity: 0;    }
          100% { transform: scale(1.6); opacity: 0;    }
        }
        .nex-ping-badge-ring {
          animation: nex-ping-pulse 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .nex-ping-badge-ring { animation: none !important; }
        }
      `}</style>
      <div
        data-nex-ping-badge
        data-nex-ping-badge-id={dataTestId}
        style={{
          position: "relative",
          width: size,
          height: size,
          flexShrink: 0,
        }}
      >
        {/* Pulsing halo · absolute underneath the solid ring so the
            ping expands outward and fades without affecting layout. */}
        {!disablePing && (
          <span
            aria-hidden
            className="nex-ping-badge-ring"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: `${ringThickness}px solid ${accent}`,
              opacity: 0.85,
              pointerEvents: "none",
            }}
          />
        )}
        {/* Solid outer ring + inner "NE" lettering. The outer rim
            uses two layers (border + inner box-shadow) for a crisp
            neon look without extra DOM. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `${ringThickness}px solid ${accent}`,
            background: "rgba(2, 9, 20, 0.55)",
            boxShadow: `
              0 0 ${Math.round(size * 0.14)}px ${accent}88,
              inset 0 0 ${Math.round(size * 0.08)}px ${accent}55
            `,
            display: "grid",
            placeItems: "center",
            color: accent,
            fontSize: textSize,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
            textShadow: `0 0 ${Math.round(size * 0.1)}px ${accent}aa`,
            lineHeight: 1,
          }}
        >
          NEX
        </div>
      </div>
    </>
  );
}
