// src/components/nex-native/badge/NexYellowChip.tsx
//
// Owner-authorised 2026-10-31 · yellow NEX chip for the new Creator
// badge. Owner directive · verbatim: "i didient say lift the user or
// owner badge i said i want same style and size color yellow for
// creator added."
//
// This primitive uses the SAME visual tokens as the existing
// DevViewerBadge (yellow #FFD700, 10px / weight 900 / uppercase /
// 4px·8px padding / radius 999 / 1.5px dark border / drop shadow)
// but it is a NEW independent component. DevViewerBadge is NOT
// modified. The two can evolve independently if ever needed.
//
// Visual tokens (match DevViewerBadge · do not drift):
//   · Background  #FFD700
//   · Ink         #1A1200
//   · Padding     4px 8px
//   · Radius      999 (pill)
//   · Font size   10px, weight 900, uppercase, letter-spacing 0.08em
//   · Border      1.5px solid rgba(0, 0, 0, 0.2)
//   · Shadow      0 2px 6px rgba(0, 0, 0, 0.4)
//
// New yellow NEX chips (Creator badges, future section badges) MUST
// consume this primitive so they stay consistent with each other.

import * as React from "react";

const NEX_YELLOW_BG = "#FFD700";
const NEX_YELLOW_INK = "#1A1200";

export interface NexYellowChipProps {
  readonly label: string;
  /** Position mode. `fixed-top-left` matches the sealed DevViewerBadge
   *  (viewport-pinned dev chip). `inline` places the chip in normal
   *  document flow — this is what the profile header Creator badges
   *  use. */
  readonly position?: "fixed-top-left" | "inline";
  /** For a11y. "status" for the dev chip; omit for inline chips so
   *  screen readers don't announce each badge in a list as a status. */
  readonly role?: "status";
  readonly ariaLabel?: string;
  readonly dataAttrs?: Readonly<Record<string, string>>;
}

export function NexYellowChip(props: NexYellowChipProps): React.JSX.Element {
  const positionStyle: React.CSSProperties =
    props.position === "fixed-top-left"
      ? {
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 6px)",
          left: 6,
          zIndex: 40,
          pointerEvents: "none",
        }
      : {
          display: "inline-flex",
          alignItems: "center",
        };

  return (
    <div
      role={props.role}
      aria-label={props.ariaLabel}
      {...(props.dataAttrs ?? {})}
      style={{
        ...positionStyle,
        padding: "4px 8px",
        borderRadius: 999,
        background: NEX_YELLOW_BG,
        color: NEX_YELLOW_INK,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.4)",
        border: "1.5px solid rgba(0, 0, 0, 0.2)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        whiteSpace: "nowrap",
      }}
    >
      {props.label}
    </div>
  );
}
