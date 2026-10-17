"use client";

// src/app/nex-native/themes/[id]/_theme-preview-drawer.tsx
//
// NEX Chat Theme Preview · drawer trigger overlay · owner-sealed
// 2026-10-18.
// --------------------------------------------------------------------
// Replaces the Home button on every chat-theme preview surface with
// the same ControlDrawer the owner approved for /welcome +
// /directory/landing + the broader consumer-hub pattern. One drawer
// across the app · the chat-theme preview is the newest member of
// the pattern.
//
// Behaviour:
//
//   1. Injects a scoped <style> block that hides BOTH native Home
//      buttons:
//        · Standard Experience  · [data-nex-se-header-action="home"]
//        · Viewer path (PortraitBloomShell / HeaderRightCluster) ·
//          `[data-nex-native-r1-cluster] a[title="Home"]`
//      Scoping sits inside this file so turning the drawer off
//      instantly restores Home · no leftover CSS debt elsewhere.
//
//   2. Mounts the sealed `ControlDrawer` with its own 3-dot trigger
//      · the trigger lives inside this component so its position can
//      be absolute (top-right of the frame · aligned with the sealed
//      R1 cluster's safe-area inset). Portals to the surrounding
//      `.nex-native-frame` natively · no portalTarget hack needed
//      because the preview routes now respect the phone frame on
//      desktop (owner directive 2026-10-18 · see
//      `_standard-experience-live-client.tsx` + `_portrait-bloom-shell.tsx`
//      scope === "theme-preview" branch).
//
// Session is server-resolved in `themes/[id]/page.tsx` and passed
// in. Null = guest · the drawer renders a Sign-In prompt.
//
// Client Component · owns the trigger button's absolute positioning
// + the hide-Home style injection · the drawer itself is the sealed
// primitive.

import * as React from "react";
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";

interface ThemePreviewDrawerProps {
  readonly session: ControlDrawerSession | null;
}

export function ThemePreviewDrawer({
  session,
}: ThemePreviewDrawerProps): React.JSX.Element {
  return (
    <>
      {/* Hide the sealed Home button on both preview chrome paths.
          Narrow selectors · only Home · Cart + Shop stay in the
          cluster. Owner directive 2026-10-18. */}
      <style>{`
        [data-nex-se-header-action="home"] { display: none !important; }
        [data-nex-native-r1-cluster] a[title="Home"] { display: none !important; }
      `}</style>

      {/* Trigger + drawer wrapper · absolute-positioned so it sits in
          the top-right corner of the phone frame alongside the
          [Cart][Shop] cluster. z-index 7 clears the StandardHeader
          (zIndex 5) but stays below the ControlDrawer backdrop
          (zIndex high). */}
      <div
        data-nex-theme-preview-drawer-slot
        style={{
          /* Positioned at the Home-slot coordinates · once the native
             Home button is hidden the [Cart][Shop] cluster shrinks and
             our 36px kebab fills the vacated slot. Math: cluster is
             right-aligned at right:12 · 2 buttons × 36 + 6px gap = 78 ·
             drawer trigger sits at 12 + 78 + 6 = 96px from the right
             edge of the frame. Same top offset as the native cluster. */
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0) + 14px)",
          right: 96,
          zIndex: 7,
          width: 36,
          height: 36,
          display: "grid",
          placeItems: "center",
          borderRadius: 999,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "#F2F5F8",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      >
        <ControlDrawer session={session} />
      </div>
    </>
  );
}
