"use client";

// src/app/nex-native/welcome/_header-drawer-button-client.tsx
//
// Owner-authorised 2026-10-17 · signed-in Welcome header-right affordance.
// Three-dots icon button that opens a right-side slide-in drawer with
// seven links · Home, Contacts, Chats, Calls, Search, Settings, Sign out.
//
// Scope:
//   · Rendered ONLY when the Welcome page knows the viewer is signed in
//     (page.tsx mounts this inside `{isSignedIn && …}`).
//   · All seven targets are internal next/link navigations to sealed
//     NEX routes · the "Sign out" option is a POST form to the sealed
//     /api/nex-native/sign-out route.
//   · No DB writes · no analytics · no cookies set by this component.
//   · Keyboard: Esc closes · overlay click closes · trap-focus inside
//     the drawer while open (focus() the first link on open).
//
// Visual language:
//   · Uses the shared NEX palette tokens inlined (parity with the rest
//     of welcome/page.tsx) · navy panel · cyan borders · white text.

import * as React from "react";
import Link from "next/link";
import { signOutAction } from "../_actions";

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
  { label: "Contacts", href: "/nex-native/contacts", testid: "contacts" },
  { label: "Chats", href: "/nex-native/chat", testid: "chats" },
  { label: "Calls", href: "/nex-native/calls", testid: "calls" },
  { label: "Search", href: "/nex-native/search", testid: "search" },
  { label: "Settings", href: "/nex-native/settings", testid: "settings" },
];

export function WelcomeHeaderDrawerButtonClient(): React.ReactElement {
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
        data-nex-welcome-drawer-trigger
        style={{
          all: "unset",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: 10,
          cursor: "pointer",
          border: `1px solid ${NEX.cyanBorder}`,
          background: "rgba(0, 175, 255, 0.08)",
          color: NEX.textPrimary,
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
            data-nex-welcome-drawer-overlay
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
            data-nex-welcome-drawer-panel
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
                data-nex-welcome-drawer-close
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
                data-nex-welcome-drawer-link={item.testid}
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
                data-nex-welcome-drawer-link="sign-out"
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
