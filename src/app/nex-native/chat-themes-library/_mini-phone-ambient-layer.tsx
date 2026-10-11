// src/app/nex-native/chat-themes-library/_mini-phone-ambient-layer.tsx
//
// Mini-Phone Ambient Layer · Final Parity Pass · sealed 2026-10-11.
// -----------------------------------------------------------------
// Renders the STATIC ambient specs the shared helper
// `miniPhoneAmbient(…)` produces. Every preview surface (gallery
// phone tiles · category phone grid · free NEX mini-phones) mounts
// this one component so there is a SINGLE source of truth for how
// mini-phone ambient paints.
//
// Design rules:
//   · Static-only · no requestAnimationFrame · no CSS keyframes ·
//     mini-phones must stay cheap at tile scale. The user directive
//     explicitly forbids "expensive animation into every grid tile".
//   · One element = one <span> with absolute positioning + inline
//     style. React re-renders are free because the parent tile uses
//     the IntersectionObserver + content-visibility gating that
//     already exists in `_phone-tile.tsx`.
//   · The layer sits at z-index 2 inside the parent · behind chat
//     bubbles (z-index 3) · above wallpaper (z-index 0-1). Same
//     stacking contract as the live StandardAmbientLayer.
//
// Family coverage: every family listed in `MiniPhoneAmbientFamilyKind`
// is represented. The regression test `_mini-phone-ambient.test.ts`
// enforces coverage.

import * as React from "react";
import type {
  MiniPhoneAmbientElement,
  MiniPhoneAmbientSpec,
} from "../chat-standard/_engine/preview-mini-phone";

export interface MiniPhoneAmbientLayerProps {
  specs: readonly MiniPhoneAmbientSpec[];
  /** z-index assigned to the ambient wrapper · defaults to 2 (behind
   *  bubbles at z-index 3, above wallpaper at 0-1). */
  zIndex?: number;
}

export function MiniPhoneAmbientLayer({
  specs,
  zIndex = 2,
}: MiniPhoneAmbientLayerProps): React.JSX.Element | null {
  if (specs.length === 0) return null;
  return (
    <span
      aria-hidden
      data-nex-mini-ambient-layer
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex,
      }}
    >
      {specs.map((spec) => (
        <React.Fragment key={spec.family}>
          {spec.elements.map((el, i) => (
            <MiniAmbientElement
              key={`${spec.family}-${i}`}
              family={spec.family}
              element={el}
            />
          ))}
        </React.Fragment>
      ))}
    </span>
  );
}

function MiniAmbientElement({
  family,
  element,
}: {
  family: string;
  element: MiniPhoneAmbientElement;
}): React.JSX.Element {
  const common: React.CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    opacity: element.opacity,
  };
  switch (element.kind) {
    case "dot":
      return (
        <span
          data-nex-mini-ambient-family={family}
          data-nex-mini-ambient-kind="dot"
          style={{
            ...common,
            left: element.left,
            top: element.top,
            width: element.size,
            height: element.size,
            borderRadius: 999,
            background: element.color,
            boxShadow: element.shadow,
          }}
        />
      );
    case "streak":
      return (
        <span
          data-nex-mini-ambient-family={family}
          data-nex-mini-ambient-kind="streak"
          style={{
            ...common,
            left: element.left,
            top: element.top,
            width: element.length ?? 32,
            height: element.size,
            background: `linear-gradient(90deg, transparent 0%, ${element.color} 50%, transparent 100%)`,
            transform: `rotate(${element.rotateDeg ?? 0}deg)`,
            transformOrigin: "0 50%",
            borderRadius: 999,
          }}
        />
      );
    case "glow":
      return (
        <span
          data-nex-mini-ambient-family={family}
          data-nex-mini-ambient-kind="glow"
          style={{
            ...common,
            left: element.left,
            top: element.top,
            width: element.size,
            height: element.size,
            borderRadius: 999,
            background: `radial-gradient(circle, ${element.color} 0%, transparent 70%)`,
            boxShadow: element.shadow,
            transform: "translate(-50%, -50%)",
          }}
        />
      );
    case "band":
      return (
        <span
          data-nex-mini-ambient-family={family}
          data-nex-mini-ambient-kind="band"
          style={{
            ...common,
            left: 0,
            right: 0,
            top: element.top,
            height: element.size,
            background: `linear-gradient(180deg, transparent 0%, ${element.color} 50%, transparent 100%)`,
          }}
        />
      );
  }
}
