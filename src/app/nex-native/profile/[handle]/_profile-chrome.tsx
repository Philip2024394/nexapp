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
  // Owner directive 2026-11-01 · "profile header no nex profile change
  // to Nex" · uppercase "NEX-" prefix was reading as hard-brand chrome;
  // owner wants a softer "Nex-" title-case for the viewer identifier
  // in the profile chrome left-column.
  const viewerNexId = props.viewerNexHandle
    ? props.viewerNexHandle.replace(/^nex-/i, "Nex-")
    : null;
  const viewerInitials = initialsFromName(props.viewerDisplayName ?? "N");
  const isSignedIn = props.drawerSession !== null;

  return (
    <header
      data-nex-profile-chrome
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 12px",
        background: NEX.bgTint,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: `1px solid ${ACCENT_SOFT}`,
        fontFamily: SANS,
      }}
    >
      {/* Owner directive 2026-10-17 · "if i am online should my
          profile image in header ping · yes" · CSS pulse ring around
          the viewer's own avatar when signed in. Pure CSS keyframe ·
          zero JS state · battery-friendly. Honest signal · the
          viewer IS online while viewing the page. Prefers-reduced-
          motion override honoured below. */}
      <style>{`
        @keyframes nex-profile-chrome-ping {
          0%   { box-shadow: 0 0 0 0 rgba(0, 175, 255, 0.55); }
          70%  { box-shadow: 0 0 0 10px rgba(0, 175, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 175, 255, 0); }
        }
        [data-nex-profile-chrome-ping] {
          animation: nex-profile-chrome-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
          will-change: box-shadow;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-profile-chrome-ping] { animation: none; }
        }
      `}</style>

      {/* LEFT · viewer avatar + NEX ID. */}
      {isSignedIn && viewerNexId ? (
        <Link
          href="/nex-native/profile/me"
          data-nex-profile-chrome-identity
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          {props.viewerAvatarUrl ? (
            <img
              src={props.viewerAvatarUrl}
              alt=""
              aria-hidden
              data-nex-profile-chrome-ping
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                objectFit: "cover",
                border: `2px solid ${ACCENT}`,
                background: ACCENT_FAINT,
              }}
            />
          ) : (
            <div
              aria-hidden
              data-nex-profile-chrome-ping
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                border: `2px solid ${ACCENT}`,
                background: ACCENT_FAINT,
                color: ACCENT,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {viewerInitials}
            </div>
          )}
          <span
            style={{
              // Owner directive 2026-10-17 (revised) · "nex in header
              // should be white color · the NEX standard font rule" ·
              // white text + NEX_FONT_SANS stack (Inter) · drops the
              // monospace treatment. Still 18px/800 so the identifier
              // reads strong in the chrome.
              fontSize: 18,
              fontWeight: 800,
              color: NEX.text,
              letterSpacing: 0.4,
              fontFamily: NEX_FONT_SANS,
            }}
          >
            {viewerNexId}
          </span>
        </Link>
      ) : (
        // Anonymous · show generic NEX ping-badge + Sign-in link.
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

      {/* RIGHT · ControlDrawer three-dots trigger (sealed shared drawer). */}
      <ControlDrawer session={props.drawerSession} />
    </header>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
