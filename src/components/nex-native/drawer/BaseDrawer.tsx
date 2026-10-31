"use client";

// src/components/nex-native/drawer/BaseDrawer.tsx
//
// NEX unified drawer · chrome primitive · owner directive 2026-11-01.
// --------------------------------------------------------------------
// Shared skeleton behind every NEX drawer. Owns ONLY the chrome:
//   · portal into `.nex-native-frame` (with override for full-viewport
//     surfaces like chat-theme previews).
//   · open → visible → close choreography · 20 ms render gap · 200 ms
//     slide · 220 ms unmount tail (sealed timing · matches sealed
//     ControlDrawer so migrated surfaces feel identical).
//   · Escape-closes · backdrop-tap-closes · pointer-event guarded.
//   · Focus flow · on open, focus moves to the caller-supplied
//     `initialFocusRef` (typically the ✕ close icon); on close, focus
//     returns to the caller-supplied `triggerRef`. If the viewer never
//     opened the drawer with keyboard, the focus call is a safe no-op.
//
// Does NOT own: trigger button rendering, header content, body
// content, close-affordance icon. The caller composes those · this
// primitive just hosts them.
//
// Global architecture note (owner directive 2026-11-01 §1 · §2):
//   This is ONE drawer skeleton for EVERY country app. Country-specific
//   visual identity is applied by caller-supplied `background`,
//   `edgeLight`, etc. · all of which should read from world CSS vars
//   so the deployment's active-world configuration (not user profile /
//   phone / IP) drives the chrome. See `_world-stylesheet.tsx` for the
//   per-world var emission pattern.
//
// Reversibility (Batch B · Batch B+C+D commits):
//   This file is new · zero existing surfaces consume it yet. Deleting
//   the file would restore the previous state with zero behavioural
//   change elsewhere. BaseDrawer becomes active only when UnifiedDrawer
//   begins composing with a ContextStrip (Batch E).

import * as React from "react";
import { createPortal } from "react-dom";

// ─── Public types ──────────────────────────────────────────────────

export interface BaseDrawerProps {
  /** Open state owned by the caller — BaseDrawer is purely controlled. */
  readonly isOpen: boolean;
  /** Called when the drawer wants to close (Escape · backdrop tap). */
  readonly onClose: () => void;
  /** Ref to the trigger button that opened the drawer · focus returns
   *  here on close. Must be stable across re-renders (useRef). */
  readonly triggerRef: React.RefObject<HTMLButtonElement | null>;
  /** Element that should receive focus when the drawer opens. Typically
   *  the ✕ close icon. If omitted, the drawer still opens; focus just
   *  stays wherever it was. */
  readonly initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Override the portal target. Defaults to `.nex-native-frame`
   *  nearest the trigger. Falls back to `document.body`. */
  readonly portalTarget?: HTMLElement;
  /** Caller content · typically the header row + body sections. */
  readonly children: React.ReactNode;
  /** aria-label for the dialog landmark. Should name the drawer
   *  (e.g. "NEX menu"). */
  readonly ariaLabel: string;
  /** Chrome background. Normally resolved from a world CSS var so the
   *  deployment's active-world configuration drives it. Caller is
   *  responsible for selecting the right var chain. */
  readonly background: string;
  /** Panel width · defaults to `min(320px, 85%)` which matches the
   *  sealed ControlDrawer + LiveSideDrawer. */
  readonly width?: string;
  /** Hard max width in px. Defaults to 360. */
  readonly maxWidth?: number;
  /** Stacking context for both backdrop and panel. Defaults to 60/61.
   *  The frame-anchored portal usually makes z-index moot. */
  readonly zIndex?: number;
  /** Optional running-edge-light overlay. When supplied, rendered
   *  inside the drawer at the left seam; display gated by the
   *  owner-sealed `--nex-world-live-drawer-edge-light-display` var so
   *  Ireland's Gold accent never leaks into Indonesia / Worldwide. */
  readonly edgeLight?: React.ReactNode;
  /** Border on the left seam · defaults to a 1px hairline. Caller can
   *  override for stronger per-world rims. */
  readonly leftSeam?: string;
}

// ─── Component ─────────────────────────────────────────────────────

export function BaseDrawer(props: BaseDrawerProps): React.JSX.Element | null {
  const {
    isOpen,
    onClose,
    triggerRef,
    initialFocusRef,
    portalTarget,
    children,
    ariaLabel,
    background,
    width = "min(320px, 85%)",
    maxWidth = 360,
    zIndex = 61,
    edgeLight,
    leftSeam = "1px solid rgba(255,255,255,0.08)",
  } = props;

  const [rendered, setRendered] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [frameNode, setFrameNode] = React.useState<HTMLElement | null>(null);

  // Resolve the portal target. Caller override wins; otherwise find the
  // nearest .nex-native-frame ancestor to keep the drawer inside the
  // phone frame on desktop. Last-resort fallback: document.body.
  React.useEffect(() => {
    if (portalTarget) {
      setFrameNode(portalTarget);
      return;
    }
    if (typeof document === "undefined") return;
    const el = triggerRef.current?.closest(
      ".nex-native-frame",
    ) as HTMLElement | null;
    setFrameNode(el ?? document.body);
  }, [portalTarget, triggerRef]);

  // Render → visible choreography. 20 ms render-paint gap gives the
  // browser one tick before the transform transitions in; 220 ms
  // unmount delay matches the slide-out tail.
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isOpen) {
      setRendered(true);
      timer = setTimeout(() => setVisible(true), 20);
    } else {
      setVisible(false);
      timer = setTimeout(() => setRendered(false), 220);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen]);

  // Focus flow · on open, send focus to initialFocusRef (typically ✕).
  // On close, return focus to the trigger. Both calls are null-safe.
  React.useEffect(() => {
    if (visible) {
      initialFocusRef?.current?.focus({ preventScroll: true });
    } else if (!isOpen) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [visible, isOpen, initialFocusRef, triggerRef]);

  // Escape closes.
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!rendered || !frameNode) return null;

  return createPortal(
    <>
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: visible ? "rgba(2, 7, 20, 0.42)" : "transparent",
          transition: "background 180ms ease-out",
          zIndex: zIndex - 1,
          pointerEvents: visible ? "auto" : "none",
        }}
      />
      <aside
        role="dialog"
        aria-label={ariaLabel}
        aria-modal="true"
        data-nex-base-drawer
        data-nex-base-drawer-visible={visible ? "true" : "false"}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          height: "100%",
          maxHeight: "100%",
          width,
          maxWidth,
          background,
          borderLeft: leftSeam,
          boxShadow: "-8px 0 32px rgba(0,0,0,0.6)",
          zIndex,
          display: "flex",
          flexDirection: "column",
          overflowX: "hidden",
          overflowY: "auto",
          color: "#F2F5F8",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 200ms ease-out",
          willChange: "transform",
        }}
      >
        {edgeLight}
        {children}
      </aside>
    </>,
    frameNode,
  );
}
