// src/app/nex-native/dev/live-persona/[handle]/layout.tsx
//
// Shares the same mobile-first phone-frame as /dev/live-seller +
// /dev/live-viewer so the persona preview matches those surfaces
// visually on desktop.

import type * as React from "react";
import { DevLivePhoneFrame } from "../../_dev-live-phone-frame";
import { LiveWelcomePrefill } from "./_welcome-prefill";

export default function DevLivePersonaLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <DevLivePhoneFrame>
      {/* Owner directive 2026-10-26 · dev-persona = seeded broadcaster
          · pre-flip the Live-Welcome localStorage flag so Live routes
          skip the agreement page. */}
      <LiveWelcomePrefill />
      {children}
    </DevLivePhoneFrame>
  );
}
