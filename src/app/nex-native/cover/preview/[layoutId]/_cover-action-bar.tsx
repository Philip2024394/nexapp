// src/app/nex-native/cover/preview/[layoutId]/_cover-action-bar.tsx
//
// NEX · S7 · discreet cover-preview action bar.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Mounted ONLY when the cover preview is loaded in full-page mode
// (i.e. NOT `?embed=1`). The sealed embed-mode strips all chrome so
// the mini-phone iframes inside `/cover-themes-library` keep their
// clean theme-only tile · no bar renders inside those iframes.
//
// Visual contract:
//   · Thin bottom-anchored bar · outside the sealed `PhoneFrame`
//     silhouette so the frame's `max-width: 767px` mobile-collapse
//     CSS does not hide it on narrow viewports.
//   · Two chip-style controls: `[← Back to shop themes]` (secondary,
//     muted) and `[Use this cover →]` (primary, orange).
//   · Backdrop blur + translucent navy so the live cover remains
//     visible through the bar · consistent with the sealed
//     2026-10-11 "overlay too intrusive, use discreet affordances"
//     directive. This is NOT a modal · it never blocks the preview.
//
// Server component · the Use button posts to the sealed
// `useCoverAction` which validates server-side.

import type * as React from "react";
import Link from "next/link";
import { useCoverAction } from "./_use-cover-action";
import { COVER_LAYOUT_LABELS, type CoverLayoutId } from "../../layout-ids";

const BACK_HREF = "/nex-native/cover-themes-library";

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.42)",
  orange: "#FF7200",
  orangeSoft: "rgba(255, 114, 0, 0.14)",
  barBg: "rgba(2, 9, 20, 0.78)",
  borderSoft: "rgba(255, 255, 255, 0.08)",
};

export interface CoverActionBarProps {
  readonly layoutId: CoverLayoutId;
}

export function CoverActionBar({
  layoutId,
}: CoverActionBarProps): React.JSX.Element {
  const label = COVER_LAYOUT_LABELS[layoutId];

  return (
    <nav
      aria-label={`${label} preview actions`}
      data-nex-cover-action-bar
      data-nex-cover-action-bar-layout={layoutId}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 400,
        padding:
          "12px 14px calc(env(safe-area-inset-bottom, 0px) + 12px)",
        background: NEX.barBg,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderTop: `1px solid ${NEX.borderSoft}`,
        // Owner directive 2026-10-18 · two long buttons stacked
        // vertically · Back on top, Use below.
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <Link
        href={BACK_HREF}
        data-nex-cover-action-bar-back
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          padding: "12px 16px",
          borderRadius: 12,
          background: "rgba(255, 255, 255, 0.04)",
          border: `1px solid ${NEX.borderSoft}`,
          color: NEX.textDim,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.03em",
          textDecoration: "none",
          boxSizing: "border-box",
        }}
      >
        ← Back to shop themes
      </Link>

      <form
        action={useCoverAction}
        data-nex-cover-action-bar-use-form
        style={{ margin: 0, padding: 0, width: "100%" }}
      >
        <input type="hidden" name="layout_id" value={layoutId} />
        <button
          type="submit"
          data-nex-cover-action-bar-use
          aria-label={`Use ${label} cover`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            background: NEX.orange,
            color: "#0B0F1A",
            border: "none",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "inherit",
            boxSizing: "border-box",
            boxShadow: `0 10px 24px -8px ${NEX.orange}80`,
          }}
        >
          Use this cover →
        </button>
      </form>
    </nav>
  );
}
