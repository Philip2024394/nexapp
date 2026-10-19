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
  /** Theme accent hex · threaded to ControlDrawer so the drawer panel
   *  picks up the theme colour on the left border, section dividers,
   *  and the top-of-panel accent glow. Owner directive 2026-10-18 ·
   *  "side drawer on each theme must pick up the theme color for
   *  background and line or container". */
  readonly themeAccent?: string;
  /** Owner directive 2026-10-19 · "side menu should be the same name
   *  in chat header as on the side drawer" · theme-preview surfaces
   *  pass the theme name (e.g. "Crispy Chicken") so the drawer's
   *  identity row matches the chat header's title line. */
  readonly themeName?: string;
}

export function ThemePreviewDrawer({
  session,
  themeAccent,
  themeName,
}: ThemePreviewDrawerProps): React.JSX.Element {
  return (
    <>
      {/* Hide the sealed Home button on both preview chrome paths ·
          and push the surviving Cart+Shop cluster left by 42px (36px
          kebab + 6px gap) so the kebab can sit at the far-right edge
          of the header without overlapping. Owner directive
          2026-10-18 · "3 dots in header on the right side". */}
      <style>{`
        [data-nex-se-header-action="home"] { display: none !important; }
        [data-nex-native-r1-cluster] a[title="Home"] { display: none !important; }
        [data-nex-standard-experience-live] [data-nex-se-header-action="cart"],
        [data-nex-standard-experience-live] [data-nex-se-header-action="shop"] {
          /* No shift needed · the flex row shrinks naturally when
             Home is hidden. Kebab lives OUTSIDE the cluster at
             right: 12 (frame edge) · cluster right-edge still ends
             at right: 12 under its old origin, but with Home gone
             the cluster width shrinks so Cart+Shop sit further
             right. Push the cluster LEFT by 42px via margin-right
             so the kebab's 42px slot at the far right stays clear. */
        }
        [data-nex-standard-experience-live] [data-nex-se-header-action="cart"] {
          margin-right: 0;
        }
        /* Push the Standard Experience cluster LEFT via the parent
           flex row's natural right-anchor. Simplest: set a right
           padding equivalent on the cluster parent via a known
           selector. The cluster is wrapped in a flex row inside the
           StandardHeader · we target the flex row directly. */
        [data-nex-standard-experience-live] [data-nex-se-header-action="shop"] {
          margin-right: 42px;
        }
        /* Viewer path · HeaderRightCluster lives in a position:
           absolute wrapper. Shift it left so the far-right slot
           belongs to the kebab. */
        [data-nex-native-r1-cluster] {
          right: 54px !important;
        }
      `}</style>

      {/* Trigger + drawer wrapper · absolute-positioned so it sits in
          the top-right corner of the phone frame alongside the
          [Cart][Shop] cluster. z-index 7 clears the StandardHeader
          (zIndex 5) but stays below the ControlDrawer backdrop
          (zIndex high). */}
      <div
        data-nex-theme-preview-drawer-slot
        style={{
          /* Owner directive 2026-10-18 · "3 dots in header on the
             right side". Kebab lives at the far-right edge (right:
             12 · same as the original cluster edge) · Cart + Shop
             pushed left by 42px via the <style> block above so the
             kebab's slot stays clear. Same top offset as the native
             cluster. */
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0) + 14px)",
          right: 12,
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
        <ControlDrawer
          session={session}
          themeAccent={themeAccent}
          identityNameOverride={themeName}
        />
      </div>
    </>
  );
}
