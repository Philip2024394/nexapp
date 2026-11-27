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
  /** Owner directive 2026-10-20 · when supplied, the badge renders
   *  the viewer's profile photo INSIDE the ring instead of the "NEX"
   *  letters. The pulsing halo + ring + glow are preserved so every
   *  NEX identity surface still reads as the same primitive. Null /
   *  undefined falls back to the sealed "NEX" wordmark. */
  readonly avatarUrl?: string | null;
  /** Owner directive 2026-11-27 · when the viewer HAS NOT created an
   *  account yet (guest), the badge paints a WHITE inner circle and
   *  renders the sealed NEX guest wordmark logo instead of the dark
   *  navy + "NEX" text. Applied only when `avatarUrl` is null · a
   *  signed-in viewer with a real avatar always wins. */
  readonly guestLogoUrl?: string | null;
}

export function NexPingBadge({
  size = 56,
  accent = "#00AFFF",
  disablePing = false,
  dataTestId,
  avatarUrl,
  guestLogoUrl,
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
        {/* Solid outer ring + inner content. The outer rim uses two
            layers (border + inner box-shadow) for a crisp neon look
            without extra DOM. Owner directive 2026-11-27 · when
            `guestLogoUrl` is supplied and no avatar is present, the
            inner circle paints WHITE (brand request · guest profile
            slot) and hosts the NEX logo image instead of the dark
            navy + "NEX" text. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `${ringThickness}px solid ${accent}`,
            background:
              !avatarUrl && guestLogoUrl
                ? "#FFFFFF"
                : "rgba(2, 9, 20, 0.55)",
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
            overflow: "hidden",
          }}
        >
          {/* Priority:
              1. Real profile photo (signed-in viewer) · cover-cropped
                 so the face fills the circle.
              2. Guest logo (viewer has not created an account yet) ·
                 contain-fit with a small padding so the full NEX
                 wordmark reads inside the circle without clipping.
              3. Sealed "NEX" text (legacy fallback · no logo URL + no
                 photo · preserves pre-2026-11-27 behaviour at every
                 call site that has not opted in). */}
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "50%",
                display: "block",
              }}
            />
          ) : guestLogoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={guestLogoUrl}
              alt="NEX"
              style={{
                width: "88%",
                height: "88%",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            "NEX"
          )}
        </div>
      </div>
    </>
  );
}
