// src/app/nex-native/contacts/_community-card.tsx
//
// Owner directive 2026-10-17 · replaces the Invite Friends banner
// at the top of /nex-native/contacts with the NEX Community card.
//
// Visual language matches the existing NEX Community action card on
// the home page's First Contact panel at
// `src/app/nex-native/home/_first-contact-panel.tsx:273-280` so the
// surface reads as the same product entry point across every
// touchpoint (home + contacts).
//
// Links to `/nex-native/community` · route verified active
// (returns 307 → sign-in for anonymous visitors, which is the sealed
// authenticated gate behaviour · signed-in viewers see the Community
// surface directly). No new backend wiring · pure UI card.
//
// Server Component · no state · no interactions beyond the Link.

import type * as React from "react";
import Link from "next/link";

const NEX = {
  orange: "#FF7200",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
};

export function CommunityCard(): React.ReactElement {
  const accent = NEX.orange;
  return (
    <Link
      href="/nex-native/community"
      aria-label="NEX Community · Discover what's happening in your area."
      data-nex-contacts-community-card
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(2, 9, 20, 0.5)",
        border: `1px solid ${accent}33`,
        textDecoration: "none",
        color: NEX.textPrimary,
        position: "relative",
        overflow: "hidden",
        minHeight: 92,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Radial-gradient orb · matches the home-page NEX Community
          action card so the surface reads as the same product
          regardless of where the user tapped in from. */}
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${accent}cc 0%, ${accent}33 60%, transparent 100%)`,
          border: `1px solid ${accent}66`,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 9.5,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: accent,
            fontWeight: 700,
            marginBottom: 3,
          }}
        >
          Explore
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: NEX.textPrimary,
            fontFamily: "'Cormorant Garamond', 'EB Garamond', Georgia, serif",
            letterSpacing: "-0.005em",
            lineHeight: 1.2,
          }}
        >
          NEX Community
        </div>
        <p
          style={{
            margin: "2px 0 0",
            fontSize: 12,
            color: NEX.textSecondary,
            lineHeight: 1.4,
          }}
        >
          Discover what&apos;s happening in your area.
        </p>
      </div>
      <ArrowRight accent={accent} />
    </Link>
  );
}

function ArrowRight({ accent }: { readonly accent: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={accent}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
