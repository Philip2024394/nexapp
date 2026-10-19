// src/app/nex-native/profile/[handle]/_safe-trade-hero-icon.tsx
//
// NEX canonical profile · Safe Trade hero icon · sealed 2026-10-17.
// -------------------------------------------------------------------
// Owner directive 2026-10-17 · "safe trade icon button we can
// displaying the icon on the hero image top right side". A round
// icon-only trigger that lives on the top-right of the cover photo
// (visible to all viewers + the owner). Tapping it opens the sealed
// 4-state SafeTradeSheet with the same props passed to the bottom
// SafeTradeCard · same resolver · same honest-null disclosure · no
// fabricated trust claims.
//
// The icon mounts its own SafeTradeSheet instance (identical to the
// one in the bottom card) because the sheet state is client-local
// and lifting it to page level would require promoting the page to
// a client component. The small cost of two mounted sheets is
// acceptable · they share props + only one can be open at a time
// (both anchor to body-scroll-lock + a role=dialog modal).
//
// Position: top: 70, LEFT: 12 (owner directive 2026-10-17 revised ·
// "move the safe trade button to the left side on image and edit
// on the right side image"). Edit pill returns to top: 70 right: 12.
// Chrome bar spans y=0..57 so y=70 lands flush on the cover below.
//
// Client Component.

"use client";

import * as React from "react";
import type { SafeTradeSnapshot } from "@/lib/nex-native/safe-trade-status";
import { SafeTradeSheet, type SafeTradeSheetProps } from "./_safe-trade-sheet";

const NEX = {
  bg: "#020914",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
};

export interface SafeTradeHeroIconProps {
  readonly snapshot: SafeTradeSnapshot | null;
  readonly business: {
    readonly id: string;
    readonly slug: string | null;
    readonly displayName: string;
  } | null;
  readonly profileDisplayName: string;
  readonly chatHref: string;
  /** Pass-through to the sheet · see SafeTradeSheetProps.trust. */
  readonly trust?: SafeTradeSheetProps["trust"];
  /** Owner-authorised 2026-10-20 · Phase 1 Verified-Directory wedge ·
   *  pass-through to the sheet's EvidencePanel. */
  readonly trustScore?: SafeTradeSheetProps["trustScore"];
  readonly ownerClaimedAtIso?: SafeTradeSheetProps["ownerClaimedAtIso"];
}

export function SafeTradeHeroIcon(props: SafeTradeHeroIconProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Safe Trade"
        data-nex-profile-safe-trade-hero-icon
        style={{
          all: "unset",
          cursor: "pointer",
          position: "absolute",
          top: 70,
          left: 12,
          display: "grid",
          placeItems: "center",
          // Owner directive 2026-10-17 (revised twice) · "button
          // revert size" · back to 48px round · keeps the blue 3D
          // shield visible but at a smaller footprint matching the
          // original compact-button scale.
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "rgba(2, 9, 20, 0.72)",
          border: `1px solid ${NEX.cyanSoft}`,
          zIndex: 10,
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      >
        <img
          src="/nex-native/safe-trade/shield-icon.png"
          alt=""
          aria-hidden
          style={{
            width: 36,
            height: 36,
            objectFit: "contain",
            userSelect: "none",
          }}
        />
      </button>
      <SafeTradeSheet
        open={open}
        onClose={() => setOpen(false)}
        snapshot={props.snapshot}
        business={props.business}
        profileDisplayName={props.profileDisplayName}
        chatHref={props.chatHref}
        trust={props.trust}
        trustScore={props.trustScore}
        ownerClaimedAtIso={props.ownerClaimedAtIso}
      />
    </>
  );
}
