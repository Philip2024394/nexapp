"use client";

// src/app/nex-native/contacts/_create-group-footer.tsx
//
// Owner-authorised 2026-10-23 · targeted Create Group footer
// correction. Owner follow-up 2026-10-24 · "mobile first screen
// width" · portal target changed from document.body to the sealed
// `.nex-native-frame` so the footer respects the phone silhouette
// on desktop (420×909) and spans the actual mobile viewport on
// real phones. Position changed from `fixed` → `absolute` because
// the frame is the containing block.
//
// The portal still ESCAPES the hero's 3D-transform containing
// block (the hero is a sibling of the frame's immediate children,
// not an ancestor of the frame). This matches the sealed pattern
// used by `_contact-picker-sheet.tsx` and other nex-native sheets.
//
// Visibility is driven by the shared Create Group flip singleton:
//   · getCreateGroupFlipped() seeds the initial state
//   · subscribeCreateGroupFlipped() wires reactive updates
//   · useEffect cleanup unsubscribes on unmount
//
// Height observation:
//   · A ResizeObserver on the footer measures its true rendered
//     height (buttons + padding + safe-area inset) and publishes
//     it to the module-level `createGroupFooterHeight` singleton.
//     The hero's back face subscribes and reserves exactly that
//     clearance via `paddingBottom` so the form's scrollable
//     contacts list never scrolls under the fixed footer.
//   · When the footer unmounts (flip returns to the + chip face),
//     the height resets to 0 so the hero reclaims the clearance.
//
// Submit flow is preserved via the HTML `form="<id>"` association:
//   · The Create button lives OUTSIDE the <form> element in the
//     DOM (because it's inside the fixed portal), but it still
//     submits the form by referencing its id. Pressing Enter in
//     any input inside the form also submits (default browser
//     behaviour · not routed through this button).
//   · The disabled visual is driven by the `canSubmit` prop
//     computed by the parent from the form's state.

import * as React from "react";
import { createPortal } from "react-dom";
import {
  getCreateGroupFlipped,
  subscribeCreateGroupFlipped,
} from "./_create-group-flip-state";

const NEX = {
  bgPanel: "rgba(2,9,20,0.96)",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  cyan: "var(--nex-world-secondary, #00AFFF)",
};

/* ─── Footer-height singleton ──────────────────────────────────── */

type HeightListener = (px: number) => void;

let footerHeightPx = 0;
const heightListeners = new Set<HeightListener>();

export function getCreateGroupFooterHeight(): number {
  return footerHeightPx;
}

export function subscribeCreateGroupFooterHeight(l: HeightListener): () => void {
  heightListeners.add(l);
  return () => {
    heightListeners.delete(l);
  };
}

function setCreateGroupFooterHeight(px: number): void {
  if (px === footerHeightPx) return;
  footerHeightPx = px;
  for (const l of heightListeners) {
    try {
      l(px);
    } catch {
      /* ignore · don't poison fan-out */
    }
  }
}

/* ─── Component ────────────────────────────────────────────────── */

interface CreateGroupFooterProps {
  readonly canSubmit: boolean;
  readonly onCancel: () => void;
  readonly formId: string;
}

export function CreateGroupFooter({
  canSubmit,
  onCancel,
  formId,
}: CreateGroupFooterProps): React.ReactElement | null {
  // Reactive subscription to the flip singleton · initial state is
  // read synchronously so first paint matches the current flipped
  // value (no flash). Effect cleanup unsubscribes on unmount.
  const [flipped, setFlipped] = React.useState<boolean>(getCreateGroupFlipped);
  React.useEffect(() => subscribeCreateGroupFlipped(setFlipped), []);

  // Portal target · resolve the sealed `.nex-native-frame` element
  // on mount so the footer anchors to the phone silhouette on
  // desktop (420×909 frame) and spans the full viewport on phones
  // (where the frame IS the viewport). Fallback to document.body
  // keeps the component resilient on surfaces that don't render
  // the frame wrapper. Same resolution pattern the sealed contact-
  // picker sheet uses.
  const [portalTarget, setPortalTarget] = React.useState<HTMLElement | null>(
    null,
  );
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const frame = document.querySelector<HTMLElement>(".nex-native-frame");
    setPortalTarget(frame ?? document.body);
  }, []);

  const ref = React.useRef<HTMLDivElement | null>(null);

  // Measure + publish footer height · ResizeObserver tracks dynamic
  // changes (e.g. iOS keyboard open shrinking the viewport). Reset
  // to 0 when the footer is hidden so the hero reclaims the clearance.
  React.useEffect(() => {
    if (!flipped) {
      setCreateGroupFooterHeight(0);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const sync = (): void => {
      setCreateGroupFooterHeight(el.offsetHeight);
    };
    sync();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(sync);
      ro.observe(el);
    }
    return () => {
      ro?.disconnect();
      setCreateGroupFooterHeight(0);
    };
  }, [flipped]);

  if (!flipped || !portalTarget) return null;

  const footerNode = (
    <div
      ref={ref}
      data-nex-create-group-fixed-footer
      role="group"
      aria-label="Create group actions"
      style={{
        /* Owner directive 2026-10-24 · mobile-first screen width ·
           anchored to the sealed `.nex-native-frame` (the phone
           silhouette on desktop, the full viewport on phones).
           `position: absolute` + `left/right: 0` makes the footer
           span exactly the frame width — no 480-centred-on-desktop
           edge trim. Padding adds the safe-area inset so iOS home-
           indicator never overlaps. */
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        boxSizing: "border-box",
        padding:
          "10px 14px calc(10px + env(safe-area-inset-bottom, 0px))",
        background: NEX.bgPanel,
        display: "flex",
        /* Owner directive 2026-10-24 · "cancel and create button is
           not center width on mobile screen desktop view" · the two
           buttons were defaulting to flex-start (left-aligned) · they
           now centre horizontally inside the frame-width footer bar
           on both desktop phone silhouette (420px) and real phones. */
        justifyContent: "center",
        gap: 8,
        zIndex: 500,
      }}
    >
      <button
        type="button"
        onClick={onCancel}
        data-nex-create-group-cancel
        style={{
          height: 32,
          padding: "0 16px",
          borderRadius: 999,
          background: "transparent",
          border: `1px solid ${NEX.textMute}66`,
          color: NEX.text,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        Cancel
      </button>
      <button
        type="submit"
        form={formId}
        disabled={!canSubmit}
        data-nex-create-group-submit
        style={{
          height: 32,
          padding: "0 20px",
          borderRadius: 999,
          background: canSubmit
            ? `linear-gradient(135deg, ${NEX.cyan}, ${NEX.cyan}cc)`
            : "rgba(0,175,255,0.18)",
          border: `1px solid ${NEX.cyan}`,
          color: canSubmit ? "#07140A" : NEX.textMute,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          cursor: canSubmit ? "pointer" : "not-allowed",
          boxShadow: canSubmit ? `0 2px 8px ${NEX.cyan}44` : "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        Create
      </button>
    </div>
  );

  return createPortal(footerNode, portalTarget);
}
