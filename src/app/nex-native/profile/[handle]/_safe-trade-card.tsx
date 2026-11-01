// src/app/nex-native/profile/[handle]/_safe-trade-card.tsx
//
// NEX canonical profile · Safe Trade bottom card · sealed 2026-10-17.
// -------------------------------------------------------------------
// Owner-sealed per the Emma Wilson reference: Safe Trade appears as a
// distinct bottom card (not as a pill in the action-buttons row). The
// card is a thin trigger · tapping it opens the sealed
// `_safe-trade-sheet.tsx` 4-state bottom sheet.
//
// Rendered on every viewer-mode profile regardless of eligibility ·
// the sheet itself handles all 4 states (A eligible seller · B not a
// seller · C ineligible shop · D unknown). The card copy stays
// neutral · "Explore safer transactions" · never promises protection
// before the sheet discloses eligibility.
//
// Client Component (because the sheet is client state) · the card
// mounts the sheet trigger inline so profile-page composition stays
// server-side wherever possible.

"use client";

import * as React from "react";
import type { SafeTradeSnapshot } from "@/lib/nex-native/safe-trade-status";
import { SafeTradeSheet } from "./_safe-trade-sheet";

const NEX = {
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  orange: "#FF7200",
  orangeSoft: "rgba(255, 114, 0, 0.35)",
  orangeFaint: "rgba(255, 114, 0, 0.14)",
  text: "#F2F5F8",
  textMuted: "#7D9BC0",
  panel: "rgba(3, 16, 29, 0.72)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface SafeTradeCardProps {
  readonly snapshot: SafeTradeSnapshot | null;
  readonly business: {
    readonly id: string;
    readonly slug: string | null;
    readonly displayName: string;
  } | null;
  readonly profileDisplayName: string;
  readonly chatHref: string;
}

export function SafeTradeCard(props: SafeTradeCardProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <section
        data-nex-profile-safe-trade-card
        style={{
          padding: "0 14px",
          fontFamily: SANS,
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Safe Trade"
          data-nex-profile-safe-trade-trigger
          style={{
            all: "unset",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
            padding: "14px 14px",
            borderRadius: 14,
            background: NEX.panel,
            border: `1px solid ${NEX.cyanSoft}`,
            color: NEX.text,
            boxSizing: "border-box",
          }}
        >
          {/* Owner-supplied Safe Trade shield · sealed 2026-10-17 ·
              glowing cyan shield with padlock + handshake · replaces
              the generic orange SVG shield. Rendered as a plain
              <img> so the colour profile + glow stay owner-authored. */}
          <img
            src="/nex-native/safe-trade/shield-icon.png"
            alt=""
            aria-hidden
            data-nex-profile-safe-trade-shield
            style={{
              // Owner directive 2026-10-17 · "safe trade icon
              // enlarge" · 44 → 64 so the glowing shield reads as
              // the hero symbol on the card (bigger than the row
              // avatar · dominates the trigger visually).
              flexShrink: 0,
              width: 64,
              height: 64,
              objectFit: "contain",
              userSelect: "none",
            }}
          />
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: NEX.text,
                lineHeight: 1.2,
              }}
            >
              Safe Trade
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 12,
                color: NEX.textMuted,
                lineHeight: 1.35,
              }}
            >
              Explore safer transactions · For eligible transactions
            </div>
          </div>
          <ChevronRight color={NEX.textMuted} />
        </button>
      </section>
      <SafeTradeSheet
        open={open}
        onClose={() => setOpen(false)}
        snapshot={props.snapshot}
        business={props.business}
        profileDisplayName={props.profileDisplayName}
        chatHref={props.chatHref}
      />
    </>
  );
}

// ShieldIcon retired · replaced by the owner-supplied PNG at
// /nex-native/safe-trade/shield-icon.png (sealed 2026-10-17).

function ChevronRight({ color }: { readonly color: string }): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
