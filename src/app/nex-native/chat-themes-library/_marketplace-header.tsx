// src/app/nex-native/chat-themes-library/_marketplace-header.tsx
//
// NEX Themes Neon Marketplace · header · sealed 2026-10-18.
// -------------------------------------------------------------------
// Owner-sealed design (NEX Themes Neon Marketplace reference):
//   · Left   · NexPingBadge + "NEX THEMES" title ("THEMES" cyan)
//   · Right  · 3-dots (kebab) button · opens the side drawer
//              (replaces the earlier magnifying-glass search button ·
//              2026-10-18 owner directive)
//   · Below  · tagline "Personalise your chat. Make it yours."
//
// Server Component · identity primitives + drawer trigger are client-safe.

import type * as React from "react";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import {
  NEX_FONT_SANS,
  NEX_PING_BADGE_HEADER_SIZE,
} from "@/lib/nex-native/design-tokens";
import { MarketplaceSideDrawer } from "./_marketplace-side-drawer";

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
};

export function MarketplaceHeader(): React.JSX.Element {
  return (
    <header
      data-nex-themes-header
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 14px 6px",
        fontFamily: NEX_FONT_SANS,
      }}
    >
      <NexPingBadge
        size={NEX_PING_BADGE_HEADER_SIZE}
        accent={NEX.cyan}
        dataTestId="themes-nex"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 0.3,
            color: NEX.text,
            lineHeight: 1.1,
          }}
        >
          NEX <span style={{ color: NEX.cyan }}>THEMES</span>
        </h1>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 12,
            lineHeight: 1.35,
            color: NEX.textMuted,
          }}
        >
          Personalise your chat. Make it yours.
        </p>
      </div>
      <MarketplaceSideDrawer />
    </header>
  );
}
