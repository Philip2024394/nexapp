// src/app/nex-native/chat-themes-library/_marketplace-side-drawer.tsx
//
// NEX Themes · header kebab (3-dots) + slide-in side drawer ·
// owner-sealed 2026-10-18.
// -------------------------------------------------------------------
// Replaces the former magnifying-glass trigger in the marketplace
// header. Tapping the kebab opens a right-side drawer with the
// marketplace navigation (Free/Premium filter shortcuts · Browse by
// Category · Back to Welcome). Scrim backdrop · Esc + outside-tap
// close · focus returns to the trigger on close.
//
// Client Component · owns the open/close state locally. The server
// `MarketplaceHeader` embeds this as a sibling of the title row.

"use client";

import * as React from "react";
import Link from "next/link";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const NEX = {
  bg: "#020914",
  panel: "rgba(3, 16, 29, 0.96)",
  text: "#F2F5F8",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  gold: "#FFC24A",
  goldSoft: "rgba(255, 194, 74, 0.45)",
  borderSoft: "rgba(255, 255, 255, 0.08)",
};

interface DrawerItem {
  readonly label: string;
  readonly sub: string;
  readonly href: string;
  readonly accent?: string;
  readonly icon: React.ReactElement;
}

const ITEMS: ReadonlyArray<DrawerItem> = [
  {
    label: "New",
    sub: "The latest themes · freshest arrivals",
    href: "/nex-native/chat-themes-library",
    accent: NEX.cyan,
    icon: <SparkleIcon />,
  },
  {
    label: "Free Themes",
    sub: "The 2 free-forever themes",
    href: "/nex-native/chat-themes-library?filter=free",
    accent: NEX.cyan,
    icon: <GiftIcon />,
  },
  {
    label: "Premium Themes",
    sub: "The paid catalogue",
    href: "/nex-native/chat-themes-library?filter=premium",
    accent: NEX.cyan,
    icon: <CrownIcon />,
  },
  {
    label: "Back to Welcome",
    sub: "Return to the NEX welcome surface",
    href: "/nex-native/welcome",
    icon: <HomeIcon />,
  },
];

export function MarketplaceSideDrawer(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  // Esc to close + lock body scroll while open.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the drawer for keyboard users.
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-nex-themes-drawer-trigger
        onClick={() => setOpen(true)}
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
          fontFamily: NEX_FONT_SANS,
        }}
      >
        <KebabIcon />
      </button>

      {/* Scrim · covers viewport · tap closes */}
      {open ? (
        <div
          data-nex-themes-drawer-scrim
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 9, 20, 0.72)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
            zIndex: 50,
          }}
        />
      ) : null}

      {/* Panel · slides in from the right · fixed max-width 320 */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Themes menu"
        aria-hidden={!open}
        tabIndex={-1}
        data-nex-themes-drawer-panel
        data-open={open ? "true" : "false"}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100dvh",
          width: "min(320px, 86vw)",
          background: NEX.panel,
          borderLeft: `1px solid ${NEX.cyanSoft}`,
          boxShadow: "-16px 0 40px rgba(0,0,0,0.6)",
          padding: "14px 14px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 220ms ease",
          zIndex: 51,
          fontFamily: NEX_FONT_SANS,
          color: NEX.text,
          outline: "none",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 13,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
            }}
          >
            Menu
          </h2>
          <button
            type="button"
            aria-label="Close menu"
            data-nex-themes-drawer-close
            onClick={() => setOpen(false)}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: `1px solid ${NEX.borderSoft}`,
              color: NEX.textMuted,
            }}
          >
            <CloseIcon />
          </button>
        </div>

        <nav
          data-nex-themes-drawer-nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {ITEMS.map((item) => (
            <DrawerLink key={item.label} item={item} onNavigate={() => setOpen(false)} />
          ))}
        </nav>

        <div
          style={{
            marginTop: "auto",
            fontSize: 11,
            color: NEX.textMuted,
            borderTop: `1px solid ${NEX.borderSoft}`,
            paddingTop: 10,
          }}
        >
          NEX Themes · Neon Marketplace
        </div>
      </aside>
    </>
  );
}

function DrawerLink({
  item,
  onNavigate,
}: {
  readonly item: DrawerItem;
  readonly onNavigate: () => void;
}): React.JSX.Element {
  const accent = item.accent ?? NEX.cyan;
  return (
    <Link
      href={item.href}
      data-nex-themes-drawer-item={item.label}
      onClick={onNavigate}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${NEX.borderSoft}`,
        color: NEX.text,
        textDecoration: "none",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "grid",
          placeItems: "center",
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: `${accent}1A`,
          border: `1px solid ${accent}55`,
          color: accent,
          flexShrink: 0,
        }}
      >
        {item.icon}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: NEX.text }}>{item.label}</span>
        <span
          style={{
            fontSize: 11,
            color: NEX.textMuted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.sub}
        </span>
      </span>
    </Link>
  );
}

// ─── Icons ───

function KebabIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}
function CloseIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
function SparkleIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
    </svg>
  );
}
function GiftIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 7l5 4 5-7 5 7 5-4-2 13H4L2 7z" />
    </svg>
  );
}
function HomeIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
