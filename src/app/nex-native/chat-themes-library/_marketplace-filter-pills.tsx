// src/app/nex-native/chat-themes-library/_marketplace-filter-pills.tsx
//
// NEX Themes · 3 filter pills (All Themes · Free · Premium) · sealed
// 2026-10-18.
// -------------------------------------------------------------------
// Each pill is a Link that updates the URL ?filter= query string ·
// the server-rendered page then re-filters the catalogue accordingly.
// No client-side state · no JS rehydration · pure URL-driven.
//
// Server Component.

import type * as React from "react";
import Link from "next/link";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

export type MarketplaceFilter = "all" | "free" | "premium";

const NEX = {
  text: "#F2F5F8",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  gold: "#FFC24A",
  goldSoft: "rgba(255, 194, 74, 0.35)",
  goldFaint: "rgba(255, 194, 74, 0.14)",
};

interface MarketplaceFilterPillsProps {
  readonly active: MarketplaceFilter;
}

export function MarketplaceFilterPills(
  props: MarketplaceFilterPillsProps,
): React.JSX.Element {
  return (
    <nav
      data-nex-themes-filter-pills
      aria-label="Theme catalogue filter"
      style={{
        display: "flex",
        gap: 10,
        padding: "0 14px",
        fontFamily: NEX_FONT_SANS,
      }}
    >
      <Pill
        label="All Themes"
        icon={<GiftIcon />}
        href={pillHref("all")}
        active={props.active === "all"}
        accent={NEX.cyan}
        accentSoft={NEX.cyanSoft}
        accentFaint={NEX.cyanFaint}
      />
      <Pill
        label="Free"
        icon={<GiftIcon />}
        href={pillHref("free")}
        active={props.active === "free"}
        accent={NEX.cyan}
        accentSoft={NEX.cyanSoft}
        accentFaint={NEX.cyanFaint}
      />
      <Pill
        label="Premium"
        icon={<CrownIcon />}
        href={pillHref("premium")}
        active={props.active === "premium"}
        accent={NEX.gold}
        accentSoft={NEX.goldSoft}
        accentFaint={NEX.goldFaint}
      />
    </nav>
  );
}

function pillHref(f: MarketplaceFilter): string {
  if (f === "all") return "/nex-native/chat-themes-library";
  return `/nex-native/chat-themes-library?filter=${f}`;
}

interface PillProps {
  readonly label: string;
  readonly icon: React.ReactElement;
  readonly href: string;
  readonly active: boolean;
  readonly accent: string;
  readonly accentSoft: string;
  readonly accentFaint: string;
}

function Pill(p: PillProps): React.JSX.Element {
  return (
    <Link
      href={p.href}
      data-nex-themes-filter-pill
      data-active={p.active ? "true" : "false"}
      style={{
        flex: 1,
        minWidth: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        minHeight: 44,
        padding: "0 14px",
        borderRadius: 999,
        background: p.active ? p.accentFaint : "rgba(3, 16, 29, 0.72)",
        border: `1px solid ${p.active ? p.accent : p.accentSoft}`,
        color: p.active ? p.accent : NEX.textMuted,
        fontSize: 13,
        fontWeight: 700,
        textDecoration: "none",
        fontFamily: NEX_FONT_SANS,
      }}
    >
      {p.icon}
      {p.label}
    </Link>
  );
}

function GiftIcon(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function CrownIcon(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 7l5 4 5-7 5 7 5-4-2 13H4L2 7z" />
    </svg>
  );
}
