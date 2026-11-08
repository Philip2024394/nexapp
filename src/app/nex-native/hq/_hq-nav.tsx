"use client";

// src/app/nex-native/hq/_hq-nav.tsx
//
// Owner directive 2026-11-08 (round 2) · HQ sidebar overhaul.
//   · Palette · emerald green (NEX #16D66B) · replaces cyan #00AFFF.
//   · Structure · main links that have sub-pages render as collapsible
//     drop-down sections (accordion). Clicking the row header toggles
//     the drawer open/closed · the section auto-expands when the
//     current pathname is inside it.
//   · Completeness · every /nex-native/hq/* route page.tsx has an
//     entry below (static routes only · [params] dynamic routes are
//     reached via the relevant list page).
//   · Shared chrome · mounted once by hq/layout.tsx · persists across
//     every HQ sub-route.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "#071A12";
const SURFACE_HI = "#0B2A1C";
const ACCENT = "#16D66B";
const ACCENT_SOFT = "rgba(22,214,107,0.12)";
const BORDER = "rgba(22,214,107,0.18)";
const BORDER_HI = "rgba(22,214,107,0.48)";

interface NavLeaf {
  readonly kind: "leaf";
  readonly href: string;
  readonly label: string;
  readonly glyph?: string;
  readonly match: (pathname: string) => boolean;
}

interface NavSection {
  readonly kind: "section";
  readonly key: string;
  readonly label: string;
  readonly glyph: string;
  /** Optional landing page for the section header itself. If absent
   *  clicking the header only toggles the drawer. */
  readonly homeHref?: string;
  readonly children: readonly NavLeaf[];
  readonly match: (pathname: string) => boolean;
}

type NavItem = NavLeaf | NavSection;

const NAV: readonly NavItem[] = [
  {
    kind: "leaf",
    href: "/nex-native/hq",
    label: "HQ Home",
    glyph: "⌂",
    match: (p) => p === "/nex-native/hq",
  },
  {
    kind: "leaf",
    href: "/nex-native/hq/harvest",
    label: "Harvest",
    glyph: "⚙",
    match: (p) => p.startsWith("/nex-native/hq/harvest"),
  },
  {
    kind: "leaf",
    href: "/nex-native/hq/pages",
    label: "Pages",
    glyph: "📋",
    match: (p) => p.startsWith("/nex-native/hq/pages"),
  },
  {
    kind: "section",
    key: "members",
    label: "Members",
    glyph: "👤",
    homeHref: "/nex-native/hq/members",
    match: (p) => p.startsWith("/nex-native/hq/members"),
    children: [
      {
        kind: "leaf",
        href: "/nex-native/hq/members",
        label: "Overview",
        match: (p) => p === "/nex-native/hq/members",
      },
      {
        kind: "leaf",
        href: "/nex-native/hq/members/shops",
        label: "Shops",
        match: (p) => p.startsWith("/nex-native/hq/members/shops"),
      },
      {
        kind: "leaf",
        href: "/nex-native/hq/members/chats",
        label: "Chats",
        match: (p) => p.startsWith("/nex-native/hq/members/chats"),
      },
      {
        kind: "leaf",
        href: "/nex-native/hq/members/vault",
        label: "Vault",
        match: (p) => p.startsWith("/nex-native/hq/members/vault"),
      },
    ],
  },
  {
    kind: "leaf",
    href: "/nex-native/hq/communities",
    label: "Communities",
    glyph: "☘",
    match: (p) => p.startsWith("/nex-native/hq/communities"),
  },
  {
    kind: "leaf",
    href: "/nex-native/hq/chat-themes",
    label: "Chat Themes",
    glyph: "🎨",
    match: (p) => p.startsWith("/nex-native/hq/chat-themes"),
  },
  {
    kind: "section",
    key: "security-audit",
    label: "Security Audit",
    glyph: "📜",
    homeHref: "/nex-native/hq/security-audit",
    match: (p) => p.startsWith("/nex-native/hq/security-audit"),
    children: [
      {
        kind: "leaf",
        href: "/nex-native/hq/security-audit",
        label: "Log",
        match: (p) =>
          p === "/nex-native/hq/security-audit" ||
          p === "/nex-native/hq/security-audit/",
      },
      {
        kind: "leaf",
        href: "/nex-native/hq/security-audit?view=unresolved",
        label: "Unresolved",
        match: () => false,
      },
      {
        kind: "leaf",
        href: "/nex-native/hq/security-audit/retention",
        label: "Retention",
        match: (p) => p.startsWith("/nex-native/hq/security-audit/retention"),
      },
      {
        kind: "leaf",
        href: "/nex-native/hq/security-audit/deletion-recovery",
        label: "Deletion recovery",
        match: (p) =>
          p.startsWith("/nex-native/hq/security-audit/deletion-recovery"),
      },
    ],
  },
  {
    kind: "leaf",
    href: "/nex-native/hq/security-recovery",
    label: "Security & Recovery",
    glyph: "🛡",
    match: (p) => p.startsWith("/nex-native/hq/security-recovery"),
  },
  {
    kind: "section",
    key: "dev-previews",
    label: "Dev previews",
    glyph: "👀",
    match: () => false,
    children: [
      {
        kind: "leaf",
        href: "/nex-native/free-chat",
        label: "Free Chat",
        match: () => false,
      },
      {
        kind: "leaf",
        href: "/nex-native/free-chat?show-themes=1&preview=1",
        label: "Free Chat · Themes",
        match: () => false,
      },
      {
        kind: "leaf",
        href: "/nex-native/contacts?dev=1",
        label: "Contacts",
        match: () => false,
      },
      {
        kind: "leaf",
        href: "/nex-native/chat/peer/11111111-aaaa-4aaa-8aaa-111111111112",
        label: "Peer Chat · Aoife",
        match: () => false,
      },
      {
        kind: "leaf",
        href: "/nex-native/chat-themes-library",
        label: "Themes Library",
        match: () => false,
      },
      {
        kind: "leaf",
        href: "/nex-native/manage/shop/themes",
        label: "Shop Themes",
        match: () => false,
      },
      {
        kind: "leaf",
        href:
          "/nex-native/create/product/category?business=a81e53d5-7a3c-4a49-9b95-613de648a749",
        label: "Create · Category",
        match: () => false,
      },
    ],
  },
];

export function HqNav(): React.JSX.Element {
  const pathname = usePathname() ?? "";

  // Each section starts collapsed unless the current pathname lives
  // inside it. Clicking the section header toggles the drawer.
  const [openKeys, setOpenKeys] = React.useState<Set<string>>(() => {
    const open = new Set<string>();
    for (const item of NAV) {
      if (item.kind === "section" && item.match(pathname)) {
        open.add(item.key);
      }
    }
    return open;
  });

  function toggle(key: string): void {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
      <header
        style={{
          padding: "4px 10px 10px",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
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
        {NAV.map((item) =>
          item.kind === "leaf" ? (
            <LeafRow key={item.href} item={item} pathname={pathname} />
          ) : (
            <SectionRow
              key={item.key}
              item={item}
              pathname={pathname}
              open={openKeys.has(item.key)}
              onToggle={() => toggle(item.key)}
            />
          ),
        )}
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
        Changes made in HQ affect the platform. Use preview before
        activate.
        <br />
        No production migration · no deployment from this surface.
      </div>
    </aside>
  );
}

function LeafRow({
  item,
  pathname,
}: {
  readonly item: NavLeaf;
  readonly pathname: string;
}): React.JSX.Element {
  const active = item.match(pathname);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      style={rowStyle(active)}
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
        {item.glyph ?? "•"}
      </span>
      <span style={{ flex: 1 }}>{item.label}</span>
      {active ? <ActiveDot /> : null}
    </Link>
  );
}

function SectionRow({
  item,
  pathname,
  open,
  onToggle,
}: {
  readonly item: NavSection;
  readonly pathname: string;
  readonly open: boolean;
  readonly onToggle: () => void;
}): React.JSX.Element {
  const activeSection = item.match(pathname);
  const expanded = open || activeSection;
  const headerLabelId = `nav-sec-${item.key}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={headerLabelId}
        style={{
          ...rowStyle(activeSection),
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 20,
            textAlign: "center",
            fontSize: 15,
            color: activeSection ? ACCENT : INK_MUTED,
          }}
        >
          {item.glyph}
        </span>
        <span style={{ flex: 1 }}>{item.label}</span>
        <span
          aria-hidden
          style={{
            width: 14,
            textAlign: "center",
            fontSize: 11,
            color: expanded ? ACCENT : INK_MUTED,
            transition: "transform 160ms ease",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          ▸
        </span>
      </button>

      {expanded && (
        <ul
          id={headerLabelId}
          style={{
            listStyle: "none",
            margin: 0,
            padding: "2px 0 4px 26px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            borderLeft: `1px dashed ${BORDER}`,
            marginLeft: 16,
          }}
        >
          {item.homeHref ? (
            <SubLeaf
              href={item.homeHref}
              label="Overview"
              active={
                pathname === item.homeHref ||
                pathname === `${item.homeHref}/`
              }
            />
          ) : null}
          {item.children
            .filter((c) => c.href !== item.homeHref)
            .map((c) => (
              <SubLeaf
                key={c.href}
                href={c.href}
                label={c.label}
                active={c.match(pathname)}
              />
            ))}
        </ul>
      )}
    </div>
  );
}

function SubLeaf({
  href,
  label,
  active,
}: {
  readonly href: string;
  readonly label: string;
  readonly active: boolean;
}): React.JSX.Element {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 10px",
          borderRadius: 7,
          textDecoration: "none",
          color: active ? INK : INK_DIM,
          background: active ? ACCENT_SOFT : "transparent",
          border: active
            ? `1px solid ${BORDER_HI}`
            : "1px solid transparent",
          fontSize: 12.5,
          fontWeight: active ? 700 : 500,
        }}
      >
        <span style={{ flex: 1 }}>{label}</span>
        {active ? <ActiveDot small /> : null}
      </Link>
    </li>
  );
}

function ActiveDot({
  small = false,
}: {
  readonly small?: boolean;
}): React.JSX.Element {
  const size = small ? 5 : 6;
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: ACCENT,
        boxShadow: `0 0 10px ${ACCENT}`,
      }}
    />
  );
}

function rowStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 10,
    textDecoration: "none",
    color: active ? INK : INK_DIM,
    background: active ? SURFACE_HI : "transparent",
    border: active ? `1px solid ${BORDER_HI}` : "1px solid transparent",
    fontSize: 13.5,
    fontWeight: active ? 800 : 600,
    transition: "background 120ms ease, border-color 120ms ease",
  };
}
