// src/app/nex-native/hq/layout.tsx
//
// NEX HQ parent layout · sealed 2026-10-16 · amended 2026-10-31.
// --------------------------------------------------------------------
// Owner directive 2026-10-16 · HQ operational dashboards under
// /nex-native/hq/* MAY opt out of the consumer desktop phone-frame
// when they need the full desktop workspace (harvest dashboard,
// outreach-queue monitor, tabular ops data).
//
// Owner directive 2026-10-31 · the opt-out is now PER-ROUTE instead
// of HQ-wide. /hq/worlds/* needs the phone frame visible alongside
// its left-docked controls (so the owner can see what a previewed
// world looks like in the app simultaneously). Routes that still
// need the full desktop workspace (harvest etc.) apply the
// `nex-admin-root` marker themselves in their page.tsx.
//
// Parent providers stay mounted via the shared nex-native layout
// chain · no duplication.

import type * as React from "react";

export default function HqLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  // Pass-through · each HQ sub-route decides whether it needs the
  // `nex-admin-root` desktop-workspace opt-out marker.
  return <>{children}</>;
}
