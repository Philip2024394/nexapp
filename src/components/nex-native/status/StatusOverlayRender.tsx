"use client";

// src/components/nex-native/status/StatusOverlayRender.tsx
//
// Shared overlay renderer used by both the owner's local viewer
// (`/nex-native/status/[statusId]`) and the peer P2P viewer
// (`/nex-native/status/peer/[ownerAccountId]`). Any copy drift between
// those surfaces should route through this single component so themes
// / fonts / anchors stay consistent.
//
// Load-bearing: do NOT inline this logic into another viewer surface
// without justification · the Status Composer DRAFT keeps the overlay
// schema narrow precisely so one renderer suffices.

import * as React from "react";
import type { StatusOverlay } from "@/lib/nex-native/status-storage/types";

const FONT_MAP: Record<StatusOverlay["fontId"], string> = {
  sans: "Inter, system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  display: "'Bebas Neue', Impact, sans-serif",
  handwriting: "'Caveat', 'Comic Sans MS', cursive",
};

const SIZE_MAP = { s: 18, m: 26, l: 38 } as const;

export function StatusOverlayRender({
  overlay,
}: {
  readonly overlay: StatusOverlay;
}): React.JSX.Element {
  const anchor =
    overlay.position === "top"
      ? { top: "max(env(safe-area-inset-top, 0px) + 60px, 60px)" }
      : overlay.position === "middle"
        ? { top: "50%", transform: "translateY(-50%)" }
        : { bottom: "max(env(safe-area-inset-bottom, 0px) + 70px, 70px)" };
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: 20,
        right: 20,
        textAlign: overlay.align,
        pointerEvents: "none",
        zIndex: 5,
        ...anchor,
      }}
    >
      <span
        style={{
          display: "inline-block",
          padding: overlay.backgroundTreatment === "none" ? "0" : "6px 12px",
          borderRadius: overlay.backgroundTreatment === "none" ? 0 : 10,
          background:
            overlay.backgroundTreatment === "scrim"
              ? "rgba(2, 9, 20, 0.55)"
              : overlay.backgroundTreatment === "solid"
                ? "rgba(2, 9, 20, 0.9)"
                : "transparent",
          color: overlay.colorHex,
          fontFamily: FONT_MAP[overlay.fontId],
          fontSize: SIZE_MAP[overlay.sizeId],
          fontWeight: overlay.weight === "bold" ? 800 : 500,
          lineHeight: 1.2,
          textShadow: overlay.shadow ? "0 2px 10px rgba(0, 0, 0, 0.7)" : "none",
          wordBreak: "break-word",
        }}
      >
        {overlay.text}
      </span>
    </div>
  );
}
