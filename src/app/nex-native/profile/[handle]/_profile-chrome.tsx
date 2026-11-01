// src/app/nex-native/profile/[handle]/_profile-chrome.tsx
//
// NEX canonical profile · top chrome bar · sealed 2026-10-17.
// -------------------------------------------------------------------
// Owner-sealed Emma Wilson reference. Thin bar at the top of every
// profile page that shows the VIEWER's own identity (not the
// profile being viewed) + the shared ControlDrawer three-dots on
// the right. Same identity convention as the "NEX · ID 5345" bar
// in the owner's reference screenshot.
//
// Layout:
//   LEFT  · viewer's circular avatar (32px · cyan ring) + viewer's
//           NEX ID (uppercase monospace cyan)
//   RIGHT · ControlDrawer trigger (sealed shared drawer)
//
// Anonymous viewer (no session): LEFT shows the generic NEX ping
// badge + "Sign in" link · RIGHT still mounts the drawer which
// gracefully renders a Sign-in prompt when session=null.
//
// Server Component · ControlDrawer client component hydrates inside.

import type * as React from "react";
import Link from "next/link";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";
// Owner-sealed design token · the single NEX font stack across all
// nex-native surfaces (Inter + fallbacks).
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  bgTint: "rgba(2, 9, 20, 0.72)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  text: "#F2F5F8",
  textMuted: "#7D9BC0",
};

/* Owner directive 2026-10-18 · profile chrome retinting · reads the
 * --nex-profile-accent CSS custom property set by the profile root
 * (sourced from ?themeAccent in the URL when the viewer arrived from
 * a chat theme preview). Falls back to the sealed NEX cyan for every
 * route that does NOT carry a themeAccent so direct profile visits
 * stay byte-identical to the sealed canonical design. */
const ACCENT = `var(--nex-profile-accent, ${NEX.cyan})`;
const ACCENT_SOFT = `color-mix(in srgb, var(--nex-profile-accent, ${NEX.cyan}) 35%, transparent)`;
const ACCENT_FAINT = `color-mix(in srgb, var(--nex-profile-accent, ${NEX.cyan}) 14%, transparent)`;

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface ProfileChromeProps {
  readonly viewerAvatarUrl: string | null;
  readonly viewerDisplayName: string | null;
  readonly viewerNexHandle: string | null;
  readonly drawerSession: ControlDrawerSession | null;
}

export function ProfileChrome(props: ProfileChromeProps): React.JSX.Element {
  // Owner directive 2026-11-01 (revised) · "remove from user profile
  // page the header top left profile with ha in it" · the signed-in
  // viewer's own avatar + Nex-xxxxx badge is retired from the profile
  // chrome. Anonymous viewers still see a Sign-in link so they have
  // an entry path. ControlDrawer on the right is unchanged.
  // Earlier "NEX- → Nex-" rename (b7af5ee) is superseded · the badge
  // itself no longer renders. viewerDisplayName / viewerNexHandle /
  // viewerAvatarUrl props stay in the ProfileChromeProps interface
  // to avoid rippling a type change through callers · they're just
  // no longer consumed here.
  const isSignedIn = props.drawerSession !== null;

  // Owner directive 2026-11-02 (follow-up · hero-image fills to top) ·
  // the gray header strip is removed (051f210) AND the container is
  // now floated out of flow (position: absolute). This lets the
  // profile cover image start at the very top of the viewport under
  // the safe-area notch, while the ControlDrawer three-dots and the
  // anonymous Sign-in link stay in their top-right / top-left
  // positions floating directly over the cover. The sticky behaviour
  // is retired · scrolling past the hero removes the chrome from
  // view, which matches other NEX player surfaces (video/music post
  // chrome also floats over the surface, not stuck to viewport).
  return (
    <header
      data-nex-profile-chrome
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        // Owner directive 2026-11-01 · left viewer-identity badge
        // removed · header now right-aligns the ControlDrawer when
        // the viewer is signed in · falls back to space-between for
        // the anonymous Sign-in link path.
        justifyContent: isSignedIn ? "flex-end" : "space-between",
        gap: 10,
        // Owner directive 2026-11-02 · chrome now floats over the
        // cover · give it a safe-area-aware top offset so the three-
        // dots trigger stays below the notch on devices that have
        // one, and the standard 10px gutter on everything else.
        padding:
          "max(env(safe-area-inset-top, 0px), 10px) 12px 10px 12px",
        background: "transparent",
        borderBottom: "none",
        fontFamily: SANS,
      }}
    >
      {/* Owner directive 2026-11-01 · left viewer-identity badge
          (avatar + Nex-xxxxx) removed. Anonymous viewers still see
          the NEX ping badge + Sign-in link so they have a route in.
          Signed-in viewers: the left column is intentionally empty
          and the header right-aligns the ControlDrawer trigger. */}
      {!isSignedIn && (
        <Link
          href="/nex-native/sign-in"
          data-nex-profile-chrome-signin
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <NexPingBadge size={32} accent={NEX.cyan} dataTestId="profile-chrome-nex" />
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: ACCENT,
              fontFamily: SANS,
            }}
          >
            Sign in
          </span>
        </Link>
      )}

      {/* RIGHT · ControlDrawer three-dots trigger (sealed shared drawer).
          Owner directive 2026-11-02 · on the profile page the trigger
          sits over the cover image · pass a solid black circular
          backdrop so the three-dots reads clearly against any photo.
          44x44 round, pure black, white dots. Other surfaces that
          mount ControlDrawer without triggerStyle keep the sealed
          transparent trigger. */}
      <ControlDrawer
        session={props.drawerSession}
        triggerStyle={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#000000",
          color: "#FFFFFF",
        }}
      />
    </header>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
