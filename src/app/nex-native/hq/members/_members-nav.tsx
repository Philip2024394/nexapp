"use client";

// src/app/nex-native/hq/members/_members-nav.tsx
//
// NEX HQ · Members sub-section navigation.
// -------------------------------------------------------------------
// Owner-authorised 2026-11-08 · side-menu for the HQ Members area.
// Renders four sub-section links (New Members · Shops · Chats · Vault)
// inside the HQ workspace. Clean separation from the sealed primary
// sidebar at `src/app/nex-native/hq/_hq-nav.tsx` · this nav lives
// INSIDE the workspace and highlights the active members-area tab.
//
// Doctrine
//   · Desktop-only (parent HQ layout already clamps < 900px to a
//     desktop-only fallback · no extra guard needed).
//   · Pathname-based match · query strings don't affect activation.
//   · Pure navigation · no data fetches · no server dependencies.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const ACCENT = "#00AFFF";
const BORDER = "rgba(0,175,255,0.14)";
const CARD_BG = "#07152A";

type NavItem = {
  readonly href: string;
  readonly label: string;
  readonly glyph: string;
  readonly match: (p: string) => boolean;
};

const ITEMS: readonly NavItem[] = [
  {
    href: "/nex-native/hq/members",
    label: "New Members",
    glyph: "✦",
    match: (p) => p === "/nex-native/hq/members",
  },
  {
    href: "/nex-native/hq/members/shops",
    label: "Shops",
    glyph: "🏪",
    match: (p) => p.startsWith("/nex-native/hq/members/shops"),
  },
  {
    href: "/nex-native/hq/members/chats",
    label: "Chats",
    glyph: "💬",
    match: (p) => p.startsWith("/nex-native/hq/members/chats"),
  },
  {
    href: "/nex-native/hq/members/vault",
    label: "Vault",
    glyph: "🔒",
    match: (p) => p.startsWith("/nex-native/hq/members/vault"),
  },
];

export function MembersNav(): React.JSX.Element {
  const pathname = usePathname() ?? "";
  return (
    <nav
      aria-label="HQ Members navigation"
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 18,
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        background: CARD_BG,
        flexWrap: "wrap",
      }}
    >
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 8,
              textDecoration: "none",
              color: active ? ACCENT : INK_DIM,
              background: active ? "rgba(0,175,255,0.08)" : "transparent",
              border: `1px solid ${active ? ACCENT : BORDER}`,
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              transition: "background 120ms ease, border-color 120ms ease",
            }}
          >
            <span
              aria-hidden
              style={{
                fontSize: 13,
                color: active ? ACCENT : INK_MUTED,
              }}
            >
              {item.glyph}
            </span>
            <span style={{ color: active ? INK : INK_DIM }}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
