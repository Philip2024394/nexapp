// src/app/nex-native/contacts/_contacts-header.tsx
//
// NEX Contacts header row.
//   · Left   · NexPingBadge · canonical in-header size from shared
//               design tokens (sealed 2026-10-17 · one size app-wide)
//   · Centre · "NEX CONTACTS" title + "Your World Closer" subtitle
//   · Right  · ControlDrawer three-dots trigger (same drawer used
//               on Welcome + /directory/landing · one drawer across
//               the app · the Discover entry point is a drawer row,
//               not a header icon)
//
// Owner directives sealed in this header (chronological, latest first):
//   · 2026-10-17 · remove the magnifying glass from the header ·
//     Directory landing is now reachable via the "NEX Directory"
//     row inside the ControlDrawer, not via a header icon.
//   · 2026-10-17 · consume shared design tokens for font + badge
//     size · see `src/lib/nex-native/design-tokens.ts` and the
//     sealed feedback memory.
//   · 2026-10-17 · "NEX CONTACTS font same font as welcome page
//     header font" · the Inter SANS stack from the design tokens
//     is now the canonical font (same stack Welcome's h1 uses).
//   · 2026-10-17 · "nex contacts should be standard font" · weight
//     500 (not 800), letter-spacing normal.
//   · 2026-10-17 · subtitle shortened to "Your World Closer".
//   · 2026-10-17 · remove the Plus (+) add-contact icon · gone.
//   · 2026-10-17 · ControlDrawer mounted (replaces any earlier
//     bespoke per-page drawer · one drawer across the app).
//
// Server Component · identity primitives are client-safe · the
// ControlDrawer is a client component but imports cleanly from the
// server boundary.

import type * as React from "react";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";
// Shared design tokens · sealed 2026-10-17 · all nex-native surfaces
// consume these for font + ping-badge size · no local redeclaration.
import {
  NEX_FONT_SANS,
  NEX_PING_BADGE_HEADER_SIZE,
} from "@/lib/nex-native/design-tokens";

const NEX = {
  cyan: "#00AFFF",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
};

export interface ContactsHeaderProps {
  readonly drawerSession: ControlDrawerSession | null;
}

export function ContactsHeader({ drawerSession }: ContactsHeaderProps) {
  return (
    <header
      data-nex-contacts-header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <NexPingBadge
        size={NEX_PING_BADGE_HEADER_SIZE}
        accent={NEX.cyan}
        dataTestId="contacts-nex"
      />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: NEX_FONT_SANS,
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: "normal",
            color: NEX.textPrimary,
            lineHeight: 1.1,
            textShadow: "0 2px 10px rgba(0,0,0,0.6)",
            whiteSpace: "nowrap",
          }}
        >
          NEX CONTACTS
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            lineHeight: 1.3,
            color: NEX.textSecondary,
          }}
        >
          Your World Closer
        </p>
      </div>
      <div
        data-nex-contacts-header-actions
        style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}
      >
        {/* The magnifying glass was removed on 2026-10-17 · the
            Directory landing is reachable from the "NEX Directory"
            row inside the ControlDrawer. The three-dots drawer is
            the sole right-side header action. */}
        <ControlDrawer session={drawerSession} />
      </div>
    </header>
  );
}
