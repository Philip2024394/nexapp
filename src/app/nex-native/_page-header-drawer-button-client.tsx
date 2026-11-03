"use client";

// src/app/nex-native/_page-header-drawer-button-client.tsx
//
// Owner directive 2026-11-03 · "the side drawer is active on the plus
// button in header · this is global for chat app" · the sealed shared
// NEX side-drawer. Mounts automatically on every surface that uses
// `NexPageHeader`. Opened by the Gold "+" trigger in the header right
// cluster.
//
// Menu (10 rows + Emergency CTA):
//   🚨 Emergency help     tel:112
//   👤 Profile            /profile/me
//   🎨 Chat themes        /chat-themes-library
//   🔒 Privacy            /settings/privacy
//   🔔 Notifications      /settings/notifications
//   💾 Vault              /vault
//   📺 Live               /live-commerce/go-live
//   💳 Package & billing  /settings/tier
//   💬 Help · NEX1        /help
//   🚪 Sign out           server action
//
// Load-bearing invariants:
//   · Sign out posts to the sealed `signOutAction` server action ·
//     never simulates sign-out · never introduces a second auth path.
//   · Emergency row is `tel:112` (EU-wide · Ireland standard).
//   · Ireland palette throughout (--nex-world-drawer-bg · secondary ·
//     primary-ink CSS vars emitted by _world-stylesheet.tsx).
//   · Scoped data attributes `data-nex-page-header-drawer-*` so tests
//     + analytics can address rows without collision.
//
// Owner-authorised 2026-10-17 sealed revision retired · the earlier
// seven-link navigation (Home · Contacts · Chat · Calls · Search ·
// Settings · Sign out) is superseded by the new 10-row drawer. The
// retired links still exist as separate routes · they're just no
// longer surfaced through this drawer.

import * as React from "react";
import Link from "next/link";
import { signOutAction } from "./_actions";

interface MenuRow {
  readonly href: string;
  readonly icon: string;
  readonly label: string;
  readonly sub?: string;
  readonly testid: string;
}

const MENU: readonly MenuRow[] = [
  { href: "/nex-native/settings/profile/edit", icon: "👤", label: "Profile", sub: "Edit name · country · interests · socials", testid: "profile" },
  { href: "/nex-native/chat-themes-library", icon: "🎨", label: "Chat themes", sub: "Wallpapers · bubbles · intros", testid: "chat-themes" },
  { href: "/nex-native/settings/privacy", icon: "🔒", label: "Privacy", sub: "Presence · blocked · read receipts", testid: "privacy" },
  { href: "/nex-native/settings/notifications", icon: "🔔", label: "Notifications", sub: "Chat · community · live", testid: "notifications" },
  { href: "/nex-native/vault", icon: "💾", label: "Vault", sub: "Secure storage · 5 GB", testid: "vault" },
  { href: "/nex-native/live-commerce/go-live", icon: "📺", label: "Live", sub: "Broadcast to your contacts", testid: "live" },
  { href: "/nex-native/settings/tier", icon: "💳", label: "Package & billing", sub: "Your plan · trial · invoices", testid: "tier" },
  { href: "/nex-native/help", icon: "💬", label: "Help · NEX1", sub: "Chat with the NEX team", testid: "help" },
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

  const close = React.useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
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
          background: "var(--nex-world-secondary, #C6A15B)",
          color: "var(--nex-world-drawer-bg, #123D2B)",
          fontSize: 26,
          fontWeight: 900,
          lineHeight: 1,
          WebkitTapHighlightColor: "transparent",
          boxShadow: "0 2px 8px rgba(10, 31, 21, 0.35)",
        }}
      >
        +
      </button>

      {open ? (
        <>
          <div
            role="presentation"
            onClick={close}
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
            aria-label="NEX menu"
            data-nex-page-header-drawer-panel
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(84vw, 320px)",
              background: "var(--nex-world-drawer-bg, #123D2B)",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.6)",
              padding: "calc(env(safe-area-inset-top, 0) + 16px) 0 14px",
              zIndex: 91,
              display: "flex",
              flexDirection: "column",
              color: "#F2F5F8",
              overflowY: "auto",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 18px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: "0.03em",
                  color: "var(--nex-world-secondary, #C6A15B)",
                }}
              >
                Menu
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                data-nex-page-header-drawer-close
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "transparent",
                  color: "#F2F5F8",
                  border: "1px solid rgba(255,255,255,0.2)",
                  fontSize: 16,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                ×
              </button>
            </div>

            {/* Emergency help · red CTA · tel:112 (EU-wide + Ireland). */}
            <a
              href="tel:112"
              onClick={close}
              aria-label="Emergency help · dial 112"
              data-nex-page-header-drawer-emergency
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                margin: "12px 14px 6px",
                padding: "14px 16px",
                borderRadius: 12,
                background: "#9B1C1C",
                color: "#FFF",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: "0.03em",
                boxShadow: "0 4px 14px rgba(155,28,28,0.45)",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>🚨</span>
              <span style={{ flex: 1 }}>Emergency help</span>
              <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>112</span>
            </a>

            {/* Menu rows */}
            <nav
              style={{
                flex: 1,
                padding: "8px 0 0",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {MENU.map((row, idx) => (
                <Link
                  key={row.testid}
                  href={row.href}
                  role="menuitem"
                  ref={idx === 0 ? firstLinkRef : undefined}
                  onClick={close}
                  data-nex-page-header-drawer-link={row.testid}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 20px",
                    color: "#F2F5F8",
                    textDecoration: "none",
                    fontSize: 15,
                    fontWeight: 600,
                    borderLeft: "3px solid transparent",
                    transition: "background 150ms ease-out",
                  }}
                >
                  <span style={{ fontSize: 20, lineHeight: 1, width: 24, textAlign: "center" }} aria-hidden>
                    {row.icon}
                  </span>
                  <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span>{row.label}</span>
                    {row.sub ? (
                      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--nex-world-primary-ink, #AFC5B5)", opacity: 0.75 }}>
                        {row.sub}
                      </span>
                    ) : null}
                  </span>
                  <span aria-hidden style={{ fontSize: 14, color: "var(--nex-world-secondary, #C6A15B)", opacity: 0.5 }}>›</span>
                </Link>
              ))}

              {/* Sign out · server action · clears the sealed Supabase
                  session + redirects to /sign-in. */}
              <form action={signOutAction} style={{ margin: 0 }}>
                <button
                  type="submit"
                  role="menuitem"
                  data-nex-page-header-drawer-link="sign-out"
                  onClick={close}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 20px",
                    width: "100%",
                    background: "transparent",
                    color: "#F2F5F8",
                    border: "none",
                    borderLeft: "3px solid transparent",
                    fontSize: 15,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "background 150ms ease-out",
                  }}
                >
                  <span style={{ fontSize: 20, lineHeight: 1, width: 24, textAlign: "center" }} aria-hidden>
                    🚪
                  </span>
                  <span style={{ flex: 1 }}>Sign out</span>
                  <span aria-hidden style={{ fontSize: 14, color: "var(--nex-world-secondary, #C6A15B)", opacity: 0.5 }}>›</span>
                </button>
              </form>
            </nav>

            <style>{`
              [data-nex-page-header-drawer-panel] a:hover,
              [data-nex-page-header-drawer-panel] button[type="submit"]:hover {
                background: color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 8%, transparent);
                border-left-color: var(--nex-world-secondary, #C6A15B) !important;
              }
              [data-nex-page-header-drawer-emergency]:hover {
                filter: brightness(1.12);
              }
            `}</style>
          </aside>
        </>
      ) : null}
    </>
  );
}
