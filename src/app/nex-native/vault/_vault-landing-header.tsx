"use client";

// src/app/nex-native/vault/_vault-landing-header.tsx
//
// Owner directive 2026-11-09 · lightweight header for the vault
// landing surface. Replaces VaultShellHeader (NEX VAULT brand chip +
// 3 cyan-outlined Home/Lock/Gear icon buttons) with:
//   · NOTHING on the left (image already carries brand)
//   · The sealed UnifiedDrawer (one app-wide side drawer) on the right
//
// Mounted by vault/page.tsx for both the shop-required (guest / non-
// entitled) and PIN-entry (entitled, configured) surfaces. Session is
// optional · UnifiedDrawer handles the guest state gracefully.

import * as React from "react";
import { UnifiedDrawer } from "@/components/nex-native/drawer/UnifiedDrawer";
import type { ControlDrawerSession } from "@/components/nex-native/control-drawer/control-drawer-client";

interface VaultLandingHeaderProps {
  readonly drawerSession: ControlDrawerSession | null;
}

export function VaultLandingHeader({
  drawerSession,
}: VaultLandingHeaderProps): React.ReactElement {
  return (
    <header
      data-nex-vault-landing-header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        // Owner directive 2026-11-09 · header is positioned absolute
        // by the parent to float over the landing image · zero padding
        // on the sides so the drawer button sits tight in the top-right
        // corner with just enough breathing room from the safe-area.
        padding:
          "calc(env(safe-area-inset-top, 0px) + 8px) 10px 0 10px",
        gap: 8,
      }}
    >
      {/* Owner directive 2026-11-09 · drawer trigger wrapped in a solid
          theme-gold circle. Owner directive 2026-11-27 · GLOBAL side-
          drawer button size = 36×36 across every nexapp header (was
          44×44 locally). The nested CSS forces the inner drawer
          button's SVG + text colours to the dark-emerald vault bg so
          the glyph reads against the gold fill regardless of
          UnifiedDrawer's default stroke colour. */}
      <style>{`
        [data-nex-vault-landing-drawer-chip] button,
        [data-nex-vault-landing-drawer-chip] svg {
          color: #061710 !important;
          stroke: #061710 !important;
        }
        [data-nex-vault-landing-drawer-chip] svg * {
          stroke: #061710 !important;
        }
      `}</style>
      <span
        data-nex-vault-landing-drawer-chip
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "#C6A15B",
          border: "1.5px solid #8B6A32",
          boxShadow:
            "0 6px 14px rgba(0, 0, 0, 0.55), 0 0 0 2px rgba(0, 0, 0, 0.2)",
        }}
      >
        <UnifiedDrawer session={drawerSession} />
      </span>
    </header>
  );
}
