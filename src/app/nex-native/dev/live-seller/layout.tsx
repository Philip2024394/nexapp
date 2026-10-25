// src/app/nex-native/dev/live-seller/layout.tsx
//
// Owner directive 2026-10-25 · "seller and user pages must be mobile
// first screen size on desktop". The parent `/dev/*` layout opts
// OUT of the mobile phone-frame clamp (desktop-wide for prototype
// reviews). This nested layout re-adds a mobile-sized frame
// specifically for the dev Live preview routes so the Live surface
// is viewed at the dimensions a real phone would show it on.
//
// Mobile viewports (≤500 px) render edge-to-edge · no extra chrome.
// Desktop viewports render the viewer inside a 390 × ~845 phone
// frame centred on a dark backdrop.

import type * as React from "react";
import { DevLivePhoneFrame } from "../_dev-live-phone-frame";

export default function DevLiveSellerLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return <DevLivePhoneFrame>{children}</DevLivePhoneFrame>;
}
