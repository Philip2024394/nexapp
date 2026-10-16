// src/app/nex-native/dev/hotel-flow/layout.tsx
// Shared layout for the complete NEX mobile hotel experience prototype.
// Each page controls its own top bar + whether to render the bottom nav.

import type * as React from "react";

export const dynamic = "force-static";

export default function HotelFlowLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return <>{children}</>;
}
