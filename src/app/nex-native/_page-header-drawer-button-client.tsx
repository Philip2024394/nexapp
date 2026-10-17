"use client";

// src/app/nex-native/_page-header-drawer-button-client.tsx
//
// Owner-authorised 2026-10-17 · shared three-dots drawer for the
// NEX shared page header. Mounted at the end of the right cluster
// inside `NexPageHeader` so every nex-native surface that uses the
// shared header picks up the same drawer for free.
//
// Load-bearing invariants:
//   · The seven links are the sealed NEX surfaces: Home, Contacts,
//     Chat, Calls, Search, Settings, Sign out. Sign out posts to
//     the sealed `signOutAction` server action · it never simulates
//     sign-out and never introduces a second auth mechanism.
//   · Search routes to `/nex-native/search` · the HardLocationGate
//     on that route still runs · this drawer does not bypass it.
//   · Settings routes to `/nex-native/settings` · the shared
//     SettingsHeaderSlot (lock + probe + modal) still owns the
//     gear/lock behaviour from the header itself · this drawer is a
//     secondary navigation surface, not a gate replacement.
//   · The drawer button and panel use scoped data attributes under
//     `data-nex-page-header-drawer-*` so tests + analytics can
//     address them without colliding with the Welcome bespoke drawer
//     which uses `data-nex-welcome-drawer-*`.
//   · Esc closes · overlay click closes · first link gets focus on
//     open. No cookies, no persistence, no DB writes.

import * as React from "react";
import Link from "next/link";
import { signOutAction } from "./_actions";

const NEX = {
  panel: "#071525",
  textPrimary: "#F2F5F8",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanBorder: "rgba(0, 175, 255, 0.35)",
  borderStrong: "rgba(139, 169, 209, 0.18)",
};

type DrawerLink = {
  label: string;
  href: string;
  testid: string;
};

const DRAWER_LINKS: ReadonlyArray<DrawerLink> = [
  { label: "Home", href: "/nex-native/home", testid: "home" },
  // Owner-authorised 2026-10-17 · the standalone /nex-native/contacts
  // route is retired · the Contacts experience lives on /chat?tab=friends.
  // Link direct to avoid the extra redirect hop.
  { label: "Contacts", href: "/nex-native/chat?tab=friends", testid: "contacts" },
  { label: "Chat", href: "/nex-native/chat", testid: "chat" },
  { label: "Calls", href: "/nex-native/calls", testid: "calls" },
  { label: "Search", href: "/nex-native/search", testid: "search" },
  { label: "Settings", href: "/nex-native/settings", testid: "settings" },
];

export function PageHeaderDrawerButtonClient(): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const firstLinkRef = React.useRef<HTMLAnchorElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        data-nex-page-header-drawer-trigger
        style={{
          all: "unset",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: "50%",
          cursor: "pointer",
          border: `1px solid ${NEX.cyanBorder}`,
          background: "transparent",
          color: NEX.cyan,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="10" cy="4" r="1.7" fill="currentColor" />
          <circle cx="10" cy="10" r="1.7" fill="currentColor" />
          <circle cx="10" cy="16" r="1.7" fill="currentColor" />
        </svg>
      </button>

      {open ? (
        <>
          <div
            role="presentation"
            onClick={() => setOpen(false)}
            data-nex-page-header-drawer-overlay
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(2, 9, 20, 0.72)",
              zIndex: 90,
            }}
          />
          <aside
            role="menu"
            aria-label="NEX navigation"
            data-nex-page-header-drawer-panel
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(84vw, 320px)",
              background: NEX.panel,
              borderLeft: `1px solid ${NEX.borderStrong}`,
              boxShadow: "0 0 48px rgba(0, 0, 0, 0.6)",
              padding: "calc(env(safe-area-inset-top, 0) + 16px) 14px 14px 14px",
              zIndex: 91,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: NEX.textMuted,
                }}
              >
                Navigation
              </span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                data-nex-page-header-drawer-close
                style={{
                  all: "unset",
                  cursor: "pointer",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: NEX.textMuted,
                  border: `1px solid ${NEX.borderStrong}`,
                }}
              >
                ×
              </button>
            </div>

            {DRAWER_LINKS.map((item, idx) => (
              <Link
                key={item.testid}
                href={item.href}
                role="menuitem"
                ref={idx === 0 ? firstLinkRef : undefined}
                data-nex-page-header-drawer-link={item.testid}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  minHeight: 44,
                  padding: "0 12px",
                  borderRadius: 10,
                  color: NEX.textPrimary,
                  textDecoration: "none",
                  fontSize: 15,
                  fontWeight: 600,
                  border: `1px solid ${NEX.borderStrong}`,
                  background: "transparent",
                }}
              >
                {item.label}
              </Link>
            ))}

            <form action={signOutAction} style={{ marginTop: 6 }}>
              <button
                type="submit"
                role="menuitem"
                data-nex-page-header-drawer-link="sign-out"
                style={{
                  all: "unset",
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  minHeight: 44,
                  padding: "0 12px",
                  borderRadius: 10,
                  color: NEX.cyan,
                  fontSize: 15,
                  fontWeight: 700,
                  border: `1px solid ${NEX.cyanBorder}`,
                  background: "rgba(0, 175, 255, 0.08)",
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
              >
                Sign out
              </button>
            </form>
          </aside>
        </>
      ) : null}
    </>
  );
}
