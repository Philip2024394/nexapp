// src/app/nex-native/dev/animation-rail/page.tsx
//
// Prototype · TikTok-style floating animation rail · dev-only · 2026-10-11.
// -----------------------------------------------------------------------
// Explores the user's actual proposal: a vertical floating control
// stack pinned to the RIGHT edge of the chat canvas, same pattern as
// TikTok's like/comment/share column. Each button toggles one ambient
// family on/off. The rail is ABSOLUTELY POSITIONED on top of the
// chat · zero flex-width cost · chat bubbles flow underneath.
//
// Shown over the NEX Orange Centre theme so you can see how the
// floating orange rail reads over a navy chat with rising orange
// particles. Toggle any button to watch that family appear/disappear
// in real time.

import { notFound } from "next/navigation";
import * as React from "react";
import { AnimationRailPrototype } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AnimationRailPage(): Promise<React.JSX.Element> {
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
      <AnimationRailPrototype />
    </>
  );
}
