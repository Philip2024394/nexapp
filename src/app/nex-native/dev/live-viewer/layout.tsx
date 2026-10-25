// src/app/nex-native/dev/live-viewer/layout.tsx
//
// Owner directive 2026-10-25 · "seller and user pages must be mobile
// first screen size on desktop". Companion to live-seller/layout.tsx
// · reuses the shared `DevLivePhoneFrame` wrapper.

import type * as React from "react";
import { DevLivePhoneFrame } from "../_dev-live-phone-frame";

export default function DevLiveViewerLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return <DevLivePhoneFrame>{children}</DevLivePhoneFrame>;
}
