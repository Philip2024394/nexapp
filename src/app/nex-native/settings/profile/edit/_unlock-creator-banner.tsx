"use client";

// src/app/nex-native/settings/profile/edit/_unlock-creator-banner.tsx
//
// Inline "Unlock Shop and Vault" promo card on the profile edit page.
// Owner directive 2026-11-04 · Phase U Option A · revised 2026-11-12.
//
// Two variants:
//   · locked=true (create-profile signup flow) · tease only · no link
//     out · copy reads "Unlocks after setup". Keeps the user focused
//     on finishing the profile without losing in-flight form state.
//   · locked=false (edit-mode) · live CTA that routes to /creator/join.

import Link from "next/link";

const BLACK = "#000000";
const INK = "#1A1512";
const INK_MUTED = "#5A4F42";
const PANEL = "#E8E6E3";
const BORDER_SOFT = "rgba(26, 21, 18, 0.14)";

interface Props {
  readonly locked?: boolean;
}

export function UnlockCreatorBanner({ locked = false }: Props): React.ReactElement {
  return (
    <section
      data-nex-unlock-creator-banner
      style={{
        position: "relative",
        overflow: "hidden",
        margin: "6px 0",
        padding: "14px 16px",
        borderRadius: 14,
        background: PANEL,
        border: `1px solid ${BORDER_SOFT}`,
        boxShadow: "0 2px 8px rgba(26, 21, 18, 0.06)",
      }}
    >
      {/* Owner directive 2026-11-12 · leaf icon removed · copy swapped
          from "Unlock Creator tools / Turn your presence into income"
          to "Unlock Shop and Vault" + the premium-features value line.
          Container repainted to gray with dark ink · primary CTA now
          solid black. Sealed gold-coin treasure PNG anchored to the
          bottom-right corner as a small decorative emblem. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/nex-profile/coin-treasure-pile.png"
        alt=""
        aria-hidden
        draggable={false}
        style={{
          position: "absolute",
          right: -20,
          bottom: -14,
          width: 140,
          height: 140,
          objectFit: "contain",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: INK }}>
            Unlock Shop and Vault
          </span>
          <span style={{ fontSize: 12, color: INK_MUTED, lineHeight: 1.45, whiteSpace: "nowrap" }}>
            €4.99/month · 0% Commission
          </span>
        </div>
      </div>
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {locked ? (
          <span
            style={{
              padding: "9px 14px",
              borderRadius: 999,
              background: "rgba(26, 21, 18, 0.08)",
              color: INK_MUTED,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Unlocks after setup
          </span>
        ) : (
          <Link
            href="/nex-native/creator/join"
            style={{
              padding: "9px 14px",
              borderRadius: 999,
              background: BLACK,
              color: "#FFFFFF",
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Learn more →
          </Link>
        )}
      </div>
    </section>
  );
}
