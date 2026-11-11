// src/app/nex-native/_silent-loading.tsx
//
// Owner directive 2026-11-11 · remove all loading animations from
// /nex-native/*. Every route-level loading.tsx now re-exports this
// single component: a static solid-ivory panel with zero animation.
//
// Rationale:
//   · The View Transitions slide IS the loading affordance.
//   · A pulsing skeleton + a sliding page competes visually and
//     reads as "double loading". Owner wants a single clean slide
//     with no spinner / pulse / shimmer anywhere.
//   · When the destination is slow, the user sees a flat Pale Ivory
//     surface matching the app canvas — reads as "page is already
//     here, just hasn't filled in yet" rather than "still loading".
//
// Preserves the Next.js streaming boundary (page.tsx still streams
// in as its awaits resolve) · just replaces the visible fallback.

import type * as React from "react";

export function SilentLoading(): React.JSX.Element {
  return (
    <div
      data-nex-silent-loading
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--nex-world-background-base, #F5EDD3)",
      }}
    />
  );
}
