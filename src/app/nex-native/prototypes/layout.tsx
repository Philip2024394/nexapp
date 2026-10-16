// src/app/nex-native/prototypes/layout.tsx
//
// Production containment layout · B9/B10 · 2026-10-14.
//
// Every page under /nex-native/prototypes/* is a design-exploration
// prototype (call-buttons, call-center, system-rollout). None of them
// has a server action, writes any data, calls any API route, or is
// linked from production code (verified by grep · zero cross-boundary
// hrefs).
//
// This layout refuses the entire /nex-native/prototypes/* subtree in
// production by throwing Next.js's notFound() from the RSC server
// pass. In development the subtree remains fully browsable so the
// design-exploration workflow is preserved.
//
// Server-side containment: notFound() is executed inside the RSC
// render path, so no client bundle for this subtree is reachable in a
// production response. The 404 is returned before any child component
// renders.
//
// See docs/doctrine/nex-production-route-containment-review-2026-10-14.md.

import type * as React from "react";
import { notFound } from "next/navigation";

export default function PrototypesContainment({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  // Owner directive 2026-10-16 · opt out of the desktop phone-frame
  // so design-exploration prototypes use the available desktop width.
  return <div className="nex-admin-root">{children}</div>;
}
