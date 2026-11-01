"use client";

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
// Client Component (2026-10-23) · the header title swaps between
// "Contacts" and "Create Group" based on the Create Group flip
// singleton · so the whole component needs client-side state.

import * as React from "react";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
// Owner directive 2026-11-01 (unified-drawer architecture · Batch D) ·
// Contacts is the first surface to adopt UnifiedDrawer. Contacts has
// no ContextStrip (per the sealed per-surface mapping), so
// UnifiedDrawer delegates to the sealed ControlDrawer and this
// migration is a one-line import swap with zero visible change.
// The ControlDrawerSession type keeps its name to avoid rippling
// renames across the contacts page's drawerSession resolver.
import { UnifiedDrawer } from "@/components/nex-native/drawer/UnifiedDrawer";
import { type ControlDrawerSession } from "@/components/nex-native/control-drawer/control-drawer-client";
// Shared design tokens · sealed 2026-10-17 · all nex-native surfaces
// consume these for font + ping-badge size · no local redeclaration.
import {
  NEX_FONT_SANS,
  NEX_PING_BADGE_HEADER_SIZE,
} from "@/lib/nex-native/design-tokens";
import {
  getCreateGroupFlipped,
  subscribeCreateGroupFlipped,
} from "./_create-group-flip-state";

const NEX = {
  cyan: "var(--nex-world-secondary, #00AFFF)",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
};

export interface ContactsHeaderProps {
  readonly drawerSession: ControlDrawerSession | null;
  // Owner directive 2026-11-01 · Batch D+ · Creator Support auto-gate.
  // Resolved server-side in contacts/page.tsx and forwarded through
  // the header to the UnifiedDrawer mount below.
  readonly viewerEarnedCreatorBadges?: readonly import("@/lib/nex-native/creator/creator-badges-common").SectionProgress[];
  readonly viewerCreatorSupportConfigured?: boolean;
  // Owner directive 2026-11-01 · Batch D++ · the full support-settings
  // object (QR, PayPal, external links, suggested amounts, thank-you
  // message) so the drawer-mounted CreatorSupportSheet can render the
  // viewer's own preview on tap. Null = never configured / disabled;
  // the sheet renders its sealed empty state.
  readonly viewerSupportSettings?: import("@/lib/nex-native/creator/creator-support-service").CreatorSupportSettings | null;
}

export function ContactsHeader({
  drawerSession,
  viewerEarnedCreatorBadges,
  viewerCreatorSupportConfigured,
  viewerSupportSettings,
}: ContactsHeaderProps) {
  // Owner directive 2026-10-23 · header title swaps to "Create
  // Group" while the hero is flipped so the user sees a context-
  // appropriate heading. Subscribes to the same singleton the pills
  // + list + search bar use.
  const [flipped, setFlipped] = React.useState<boolean>(getCreateGroupFlipped);
  React.useEffect(() => subscribeCreateGroupFlipped(setFlipped), []);
  const title = flipped ? "Create Group" : "Contacts";
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
          {title}
        </h1>
        {/* Owner directive 2026-10-23 · "Your World Closer" subtitle
            retired for the signed-in surface · adds no navigational
            value once a user is inside the app. The main `Contacts`
            h1 is the sole header text now · tighter + more neutral. */}
      </div>
      <div
        data-nex-contacts-header-actions
        style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}
      >
        {/* The magnifying glass was removed on 2026-10-17 · the
            Directory landing is reachable from the "NEX Directory"
            row inside the ControlDrawer. The three-dots drawer is
            the sole right-side header action. */}
        <UnifiedDrawer
          session={drawerSession}
          viewerEarnedCreatorBadges={viewerEarnedCreatorBadges}
          viewerCreatorSupportConfigured={viewerCreatorSupportConfigured}
          viewerSupportSettings={viewerSupportSettings}
        />
      </div>
    </header>
  );
}
