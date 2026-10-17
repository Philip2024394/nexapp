// src/app/nex-native/chat-themes-library/_marketplace-header.tsx
//
// NEX Themes Neon Marketplace · header · sealed 2026-10-18.
// -------------------------------------------------------------------
// Owner-sealed design (NEX Themes Neon Marketplace reference):
//   · Left   · NexPingBadge + "NEX THEMES" title ("THEMES" cyan)
//   · Right  · circular search-icon button
//   · Below  · tagline "Personalise your chat. Make it yours."
//
// Server Component · identity primitives are client-safe.

import type * as React from "react";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import {
  NEX_FONT_SANS,
  NEX_PING_BADGE_HEADER_SIZE,
} from "@/lib/nex-native/design-tokens";

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
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
      <button
        type="button"
        aria-label="Search themes"
        data-nex-themes-search-trigger
        style={{
          all: "unset",
          cursor: "pointer",
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: `1px solid ${NEX.cyanSoft}`,
          background: NEX.cyanFaint,
          color: NEX.cyan,
        }}
      >
        <SearchIcon />
      </button>
    </header>
  );
}

function SearchIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
