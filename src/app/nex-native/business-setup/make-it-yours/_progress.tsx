// src/app/nex-native/business-setup/make-it-yours/_progress.tsx
//
// Shared 2-step progress indicator for the first-time Bisnis setup.
// Server-render-safe (no "use client") so the parent RSC pages can
// mount it directly.
//
// Phase 2 · NEX Bisnis first-entry · 2026-10-14. Owner-authorised
// 1B + 2C. See:
//   docs/doctrine/nex-bisnis-first-entry-phase-2-plan-2026-10-14.md
//
// Shape:
//   · "STEP X OF 2" eyebrow in NEX cyan
//   · Two-segment progress bar · filled portion matches step
//   · Back-link beneath · configurable href + label
//
// Mobile-first · 44px tap target on the back-link · no horizontal
// overflow at narrow widths.

import type * as React from "react";
import Link from "next/link";

const NEX_CYAN = "#00AFFF";
const NEX_TEXT_DIM = "#8BA9D1";
const NEX_TEXT_MUTED = "#526B89";
const NEX_BORDER_SOFT = "rgba(139, 169, 209, 0.14)";

export interface MakeItYoursProgressProps {
  /** Current step · 1 (theme) or 2 (cover). */
  readonly step: 1 | 2;
  /** Href the back-link targets. Step 1 points at the shop slug;
   *  step 2 points at step 1. Owner-controlled via caller. */
  readonly backHref: string;
  /** Short label shown next to the "←" glyph. */
  readonly backLabel: string;
  /** Theme accent · defaults to NEX cyan. */
  readonly accentHex?: string;
}

export function MakeItYoursProgress(
  props: MakeItYoursProgressProps,
): React.ReactElement {
  const { step, backHref, backLabel, accentHex = NEX_CYAN } = props;
  const segmentFilled: 1 | 2 = step;

  return (
    <div
      data-nex-make-it-yours-progress
      data-step={step}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "12px 0 14px",
        borderBottom: `1px solid ${NEX_BORDER_SOFT}`,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: accentHex,
            fontWeight: 700,
          }}
        >
          Step {step} of 2
        </span>
        <span
          style={{
            fontSize: 10.5,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: NEX_TEXT_MUTED,
            fontWeight: 700,
          }}
        >
          Make NEX yours
        </span>
      </div>
      <div
        aria-hidden
        style={{
          display: "flex",
          gap: 6,
          height: 4,
        }}
      >
        <div
          data-nex-make-it-yours-progress-segment="1"
          data-nex-filled={segmentFilled >= 1 ? "true" : "false"}
          style={{
            flex: 1,
            borderRadius: 999,
            background: accentHex,
            opacity: segmentFilled >= 1 ? 1 : 0.2,
          }}
        />
        <div
          data-nex-make-it-yours-progress-segment="2"
          data-nex-filled={segmentFilled >= 2 ? "true" : "false"}
          style={{
            flex: 1,
            borderRadius: 999,
            background: accentHex,
            opacity: segmentFilled >= 2 ? 1 : 0.2,
          }}
        />
      </div>
      <Link
        href={backHref}
        data-nex-make-it-yours-back
        aria-label={`Back · ${backLabel}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginTop: 4,
          padding: "6px 2px",
          minHeight: 32,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: NEX_TEXT_DIM,
          textDecoration: "none",
        }}
      >
        <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
          ←
        </span>
        <span>{backLabel}</span>
      </Link>
    </div>
  );
}
