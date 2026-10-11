// src/app/nex-native/dev/animation-dots-combo/page.tsx
//
// Prototype · 3-dot combo reveal · dev-only · 2026-10-11.
// -------------------------------------------------------
// Explores the "one toggle, two directions" pattern: the sealed
// lower-right 3-dot button stays as the single gesture entry point ·
// tapping it reveals the existing CALL-ACTION row (horizontal, left)
// AND a new ANIMATION column (vertical, up). Tap again · both
// collapse. Chat canvas is clutter-free by default.

import { notFound } from "next/navigation";
import * as React from "react";
import { AnimationDotsComboPrototype } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AnimationDotsComboPage(): Promise<React.JSX.Element> {
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
      <AnimationDotsComboPrototype />
    </>
  );
}
