// src/app/nex-native/admin/layout.tsx
//
// NEX Admin desktop opt-out layout · sealed 2026-10-16.
// --------------------------------------------------------------------
// Owner directive 2026-10-16 · administrative routes under
// /nex-native/admin/* must NOT inherit the consumer desktop
// phone-frame · they need the full desktop workspace.
//
// The opt-out mechanism is CSS-only · this layout wraps children in
// a `nex-admin-root` marker div · `nex-native.css` uses `:has()` to
// lift the frame clamp on desktop viewports when the marker is
// present. Mobile viewports stay unaffected (phone-sized is still
// correct for an admin on their phone).
//
// Parent providers (I18nProvider · SwCacheRegister · IncomingCallHub)
// stay mounted via the shared `src/app/nex-native/layout.tsx` chain ·
// no duplication of application infrastructure.

import type * as React from "react";

export default function AdminLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return <div className="nex-admin-root">{children}</div>;
}
