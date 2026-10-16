// src/app/nex-native/dev/layout.tsx
//
// NEX /dev desktop opt-out layout · sealed 2026-10-16.
// --------------------------------------------------------------------
// Owner directive 2026-10-16 · developer / internal prototype routes
// under /nex-native/dev/* must NOT inherit the consumer desktop
// phone-frame · side-by-side prototype reviews, hotel-flow tests
// and other dev surfaces need the available desktop width.
//
// Opt-out mechanism: `nex-admin-root` marker div · `nex-native.css`
// uses `:has()` to lift the frame clamp on desktop viewports. Mobile
// viewports stay unaffected.
//
// Parent providers stay mounted via the shared nex-native layout
// chain · no duplication.

import type * as React from "react";

export default function DevLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return <div className="nex-admin-root">{children}</div>;
}
