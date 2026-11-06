"use client";

// src/app/nex-native/hq/_hq-nav.tsx
//
// Owner-authorised 2026-10-31 · NEX HQ permanent desktop sidebar.
// 260px fixed left-rail · navigation only · active route indicator.
// Shared across all /nex-native/hq/* routes via hq/layout.tsx.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "#07152A";
const SURFACE_HI = "#0A1B36";
const ACCENT = "#00AFFF";
const BORDER = "rgba(0,175,255,0.14)";
const BORDER_HI = "rgba(0,175,255,0.42)";

const NAV_ITEMS: ReadonlyArray<{
  readonly href: string;
  readonly label: string;
  readonly glyph: string;
  readonly match: (pathname: string) => boolean;
}> = [
  {
    href: "/nex-native/hq",
    label: "HQ Home",
    glyph: "⌂",
    match: (p) => p === "/nex-native/hq",
  },
  // Owner directive 2026-11-03 · Ireland-first phase · the Worlds
  // switcher is retained at /nex-native/hq/worlds (reachable by direct
  // URL) but hidden from the HQ sidebar so everyday development stops
  // switching between Ireland, Worldwide and Indonesia. Re-enable this
  // entry when inactive worlds become active again.
  // {
  //   href: "/nex-native/hq/worlds",
  //   label: "Worlds",
  //   glyph: "◉",
  //   match: (p) => p.startsWith("/nex-native/hq/worlds"),
  // },
  {
    href: "/nex-native/hq/harvest",
    label: "Harvest",
    glyph: "⚙",
    match: (p) => p.startsWith("/nex-native/hq/harvest"),
  },
  // Owner directive 2026-11-03 · "we need 1 side menu for communities
  // in hq where admin can add a community or delete a community".
  {
    href: "/nex-native/hq/communities",
    label: "Communities",
    glyph: "☘",
    match: (p) => p.startsWith("/nex-native/hq/communities"),
  },
  // Owner directive 2026-11-03 · "yes add menu link to page where
  // owner can rename each theme".
  {
    href: "/nex-native/hq/chat-themes",
    label: "Chat Themes",
    glyph: "🎨",
    match: (p) => p.startsWith("/nex-native/hq/chat-themes"),
  },
  // Owner directive 2026-11-06 · quick jump to the Free Chat preview
  // surface from HQ so admins can inspect the user-facing experience
  // without typing the URL.
  {
    href: "/nex-native/free-chat",
    label: "Free Chat",
    glyph: "💬",
    match: (p) => p.startsWith("/nex-native/free-chat"),
  },
  // Owner directive 2026-11-06 · Contacts preview from HQ · the
  // ?dev=1 query enables the dev-impersonation / preview flag so the
  // seeded contacts render for the admin viewer.
  {
    href: "/nex-native/contacts?dev=1",
    label: "Contacts",
    glyph: "👥",
    match: (p) => p.startsWith("/nex-native/contacts"),
  },
  // Owner directive 2026-11-06 · direct jump into the seeded peer
  // chat with Aoife (UUID matches the mock notifications feed), so
  // admins can inspect the peer-chat chrome from HQ without routing
  // through contacts.
  {
    href: "/nex-native/chat/peer/11111111-aaaa-4aaa-8aaa-111111111112",
    label: "Peer Chat · Aoife",
    glyph: "🗨",
    match: (p) => p.startsWith("/nex-native/chat/peer/"),
  },
];

export function HqNav(): React.JSX.Element {
  const pathname = usePathname() ?? "";
  return (
    <aside
      aria-label="NEX HQ navigation"
      style={{
        width: 260,
        minHeight: "100dvh",
        background: SURFACE,
        borderRight: `1px solid ${BORDER}`,
        padding: "20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        position: "sticky",
        top: 0,
        flexShrink: 0,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <header style={{ padding: "4px 10px 10px", borderBottom: `1px solid ${BORDER}` }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: INK_MUTED,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
          }}
        >
          NEX
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: INK,
            letterSpacing: "0.02em",
            marginTop: 2,
          }}
        >
          HEADQUARTERS
        </div>
        <div style={{ fontSize: 11, color: INK_MUTED, marginTop: 4 }}>
          Platform admin · desktop-only
        </div>
      </header>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                textDecoration: "none",
                color: active ? INK : INK_DIM,
                background: active ? SURFACE_HI : "transparent",
                border: active ? `1px solid ${BORDER_HI}` : `1px solid transparent`,
                fontSize: 13.5,
                fontWeight: active ? 800 : 600,
                transition: "background 120ms ease, border-color 120ms ease",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 20,
                  textAlign: "center",
                  fontSize: 15,
                  color: active ? ACCENT : INK_MUTED,
                }}
              >
                {item.glyph}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {active ? (
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: ACCENT,
                    boxShadow: `0 0 10px ${ACCENT}`,
                  }}
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          marginTop: "auto",
          padding: "10px 12px",
          borderTop: `1px solid ${BORDER}`,
          fontSize: 10.5,
          color: INK_MUTED,
          lineHeight: 1.55,
        }}
      >
        Changes made in HQ affect the platform. Use preview before activate.
        <br />
        No production migration · no deployment from this surface.
      </div>
    </aside>
  );
}
