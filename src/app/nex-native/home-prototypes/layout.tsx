// src/app/nex-native/home-prototypes/layout.tsx
//
// Production containment layout · B9/B10 · 2026-10-14.
//
// Pages under /nex-native/home-prototypes/* are home-screen design
// prototypes (variants 1..4 plus the index listing). None has a
// server action, API dependency, or data mutation path. Grep confirms
// zero production hrefs point into this subtree from outside it ·
// internal links (prototype → prototype) stay confined.
//
// This layout gates the whole subtree with notFound() when
// NODE_ENV === "production". Development remains fully browsable so
// the home-prototype review workflow is preserved.
//
// See docs/doctrine/nex-production-route-containment-review-2026-10-14.md.

import type * as React from "react";
import { notFound } from "next/navigation";

export default function HomePrototypesContainment({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  // Owner directive 2026-10-16 · opt out of the desktop phone-frame
  // so design-prototype reviews use the available desktop width.
  return <div className="nex-admin-root">{children}</div>;
}
