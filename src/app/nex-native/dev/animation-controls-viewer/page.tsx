// src/app/nex-native/dev/animation-controls-viewer/page.tsx
//
// Prototype · Viewer-level animation controls · dev-only · 2026-10-11.
// -------------------------------------------------------------------
// Visual exploration of a NEX-wide per-user motion setting that
// applies across EVERY chat theme the viewer sees. Three levels:
// Full / Reduced / Off. Zero theme-aware code · a single CSS class
// on the chat root switches rendering.
//
// NOT production. Dev-fixture-gated. Shows the proposed UX pattern
// so the founder can judge the pattern before investing in build.
//
// How to view: npm run dev → open /nex-native/dev/animation-controls-viewer

import { notFound } from "next/navigation";
import * as React from "react";
import { ViewerAnimationControlsPrototype } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AnimationControlsViewerPage(): Promise<React.JSX.Element> {
  const isDev = process.env.NODE_ENV !== "production";
  const prodOverride = process.env.NEX_DEV_ROUTES === "1";
  if (!isDev && !prodOverride) notFound();

  return (
    <>
      <style>{`
        html, body {
          background: #020914 !important;
          color: #F4F7FC;
          margin: 0;
          font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        }
      `}</style>
      <meta name="robots" content="noindex, nofollow" />
      <ViewerAnimationControlsPrototype />
    </>
  );
}
