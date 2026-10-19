// src/app/nex-native/cover-themes-library/_mini-phone-frame.tsx
//
// Chassis-free scaled preview used in the Cover Themes Library grid.
// Owner directive 2026-10-18 · no phone frame · each theme fills the
// tile edge-to-edge, full height and width. The tile shows a LIVE
// iframe of /nex-native/cover/preview/{layoutId}?theme=…&embed=1
// rendered at native phone size (390 × 844) and scaled down with
// CSS container queries so it fits whatever width the grid cell
// gives it on the current viewport.
// -------------------------------------------------------------------
// Server-safe · no "use client" · pure HTML + CSS.
// Clicks on the parent Link navigate to the full preview ·
// pointer-events: none on the iframe keeps the card tappable.

import * as React from "react";

const NATIVE_PHONE_WIDTH = 390;
const NATIVE_PHONE_HEIGHT = 844;

export function MiniPhoneFrame({
  previewHref,
  frameWidth = 240,
  label,
}: {
  readonly previewHref: string;
  /** On-screen rendered width of the mini phone · the iframe is
   *  scaled from NATIVE_PHONE_WIDTH down to this. Height follows
   *  automatically via the native phone aspect ratio. */
  readonly frameWidth?: number;
  /** Accessible label for the embedded preview · screen readers only. */
  readonly label: string;
}): React.JSX.Element {
  // Owner directive 2026-10-18 · deterministic fixed-math scaling
  // instead of CSS container queries. The container-query path
  // (transform: scale(calc(100cqi / 390))) had edge cases on some
  // mobile browsers where the iframe content did not fill the
  // frame · passing an explicit frameWidth from the page makes the
  // scale a known number computed at render-time, no CSS runtime
  // resolution required.
  const scale = frameWidth / NATIVE_PHONE_WIDTH;
  const frameHeight = Math.round(NATIVE_PHONE_HEIGHT * scale);

  return (
    <div
      data-nex-cover-mini-phone
      style={{
        position: "relative",
        width: frameWidth,
        height: frameHeight,
        borderRadius: 14,
        background: "#000",
        boxShadow: "0 10px 24px rgba(0,0,0,0.45)",
        overflow: "hidden",
        pointerEvents: "none", // outer Link captures taps
      }}
    >
      <iframe
        src={previewHref}
        title={label}
        loading="lazy"
        aria-hidden
        tabIndex={-1}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          // Native phone viewport inside the iframe · the sealed
          // CoverThemeSkin + layouts are designed for this exact box.
          width: NATIVE_PHONE_WIDTH,
          height: NATIVE_PHONE_HEIGHT,
          border: "none",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
          backgroundColor: "#000",
        }}
      />
    </div>
  );
}
