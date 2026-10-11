// src/app/nex-native/dev/animation-controls-owner/page.tsx
//
// Prototype · Owner-level animation controls · dev-only · 2026-10-11.
// ------------------------------------------------------------------
// Visual exploration of a dedicated per-theme animation-settings
// surface. The owner picks which ambient families fire on their
// chat theme · changes update a live preview on the left · zero
// in-chat UI chrome · zero per-user state.
//
// NOT production. Dev-fixture-gated. Shows the proposed UX pattern
// so the founder can judge the pattern before investing in build.
//
// How to view: npm run dev → open /nex-native/dev/animation-controls-owner

import { notFound } from "next/navigation";
import * as React from "react";
import { OwnerAnimationControlsPrototype } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AnimationControlsOwnerPage(): Promise<React.JSX.Element> {
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
      <OwnerAnimationControlsPrototype />
    </>
  );
}
