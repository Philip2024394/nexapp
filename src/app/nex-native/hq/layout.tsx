// src/app/nex-native/hq/layout.tsx
//
// NEX HQ desktop opt-out layout · sealed 2026-10-16.
// --------------------------------------------------------------------
// Owner directive 2026-10-16 · HQ operational dashboards under
// /nex-native/hq/* must NOT inherit the consumer desktop phone-frame.
// The HQ harvest dashboard, outreach-queue monitor, and other ops
// panels need the full desktop workspace to show tabular data.
//
// Opt-out mechanism: `nex-admin-root` marker div · `nex-native.css`
// uses `:has()` to lift the frame clamp on desktop viewports. Mobile
// viewports stay unaffected · ops teams on a phone still get the
// mobile-first experience of the HQ panels.
//
// Parent providers stay mounted via the shared nex-native layout
// chain · no duplication.

import type * as React from "react";

export default function HqLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return <div className="nex-admin-root">{children}</div>;
}
