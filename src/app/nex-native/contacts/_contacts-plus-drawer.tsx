"use client";

// src/app/nex-native/contacts/_contacts-plus-drawer.tsx
//
// Minimal side drawer launched by the "+" button in the Contacts header.
// -----------------------------------------------------------------------
// Owner directive 2026-11-03 · "the plus button will open the side
// drawer". The sealed LiveSideDrawer hard-codes a 3-dot SVG trigger
// and can't be re-skinned to show a "+" character, so this tiny
// Contacts-local client component mirrors LiveSideDrawer's slide-in
// pattern + glass-panel palette while keeping the Gold "+" trigger
// the owner asked for.
//
// Behaviour:
//   · Click the "+" trigger → drawer slides in from the right
//   · Backdrop click OR Esc key → closes
//   · Portals into the nearest `.nex-native-frame` so the drawer stays
//     within the phone frame on desktop. Falls through to document.body
//     if no frame ancestor is present.
//
// Menu rows are PLACEHOLDERS pending the owner's directive on exact
// items. Add Friend / Invite / Settings / Home are reasonable defaults.

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { signOutAction } from "../_actions";
// Owner directive 2026-11-17 · Settings Correction §3 · the
// "Notifications" entry on this "+" drawer previously linked to
// /nex-native/settings/notifications, which was never built. It now
// opens the canonical LEFT notifications drawer via a window
// CustomEvent. The hidden drawer mount is instantiated inside this
// component so the event has a listener on the Contacts surface (the
// Contacts page itself doesn't mount the drawer separately).
import { NotificationsDrawer } from "@/components/nex-native/notifications-drawer/notifications-drawer-client";
// Gap D wiring · 2026-11-17 continuation 3 (addendum round).
// Pre-sign-out synchronous translation-only cache + DOM sweep. Does not
// touch session / Supabase / Vault / IDB / encryption. Never calls
// preventDefault; the server action always runs.
import { runTranslationLogoutCleanup } from "@/lib/nex-native/translation/client/translation-logout-cleanup";

interface MenuRow {
  readonly icon: string;
  readonly label: string;
  readonly sub?: string;
  // Exactly one of `href` or `action` is set. `href` renders a <Link>;
  // `action` renders a <button> that invokes a client-side trigger.
  readonly href?: string;
  readonly action?: "open-notifications-drawer";
}

// Owner directive 2026-11-03 · drawer menu for the "+" button in the
// Contacts/Chat header. No HQ admin row (shipped via /hq nav). No
// My Community row (already a card on the Groups tab).
// 2026-11-17 · the "Notifications" row dropped its dead link to
// /nex-native/settings/notifications; it now fires the canonical LEFT
// notifications drawer via window CustomEvent (§3 Settings Correction).
// 2026-11-27 · Founder scope-simplification seal · NEX launches with
// three pillars: Chat · Shop · Themes. The Vault row and the Live
// Commerce row below are suppressed from the "+" drawer. Underlying
// routes (`/nex-native/vault/**`, `/nex-native/live-commerce/**`),
// migrations, DB tables, HQ admin surfaces, and Chat↔Vault shared
// libraries (vault-entry-service · useVaultSession, both still used
// by peer-chat to gate vaulted conversations) are preserved unchanged.
// Delete the `false &&` guards to re-expose when the founder authorises
// Vault or Live Commerce launch.
const MENU: readonly MenuRow[] = [
  { href: "/nex-native/settings/profile/edit", icon: "👤", label: "Profile", sub: "Edit name · country · interests · socials" },
  { href: "/nex-native/chat-themes-library", icon: "🎨", label: "Chat themes", sub: "Wallpapers · bubbles · intros" },
  { href: "/nex-native/settings/privacy", icon: "🔒", label: "Privacy", sub: "Presence · blocked · read receipts" },
  { action: "open-notifications-drawer", icon: "🔔", label: "Notifications", sub: "Chat · community · live" },
  // Vault row suppressed 2026-11-27 — restore here when founder authorises Vault launch.
  // { href: "/nex-native/vault", icon: "💾", label: "Vault", sub: "Secure storage · 5 GB" },
  // Live row suppressed 2026-11-27 — Live Commerce on hold per founder scope seal.
  // { href: "/nex-native/live-commerce/go-live", icon: "📺", label: "Live", sub: "Broadcast to your contacts" },
  { href: "/nex-native/settings/tier", icon: "💳", label: "Package & billing", sub: "Your plan · trial · invoices" },
  { href: "/nex-native/help", icon: "💬", label: "Help · NEX1", sub: "Chat with the NEX team" },
];

export function ContactsPlusDrawer(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [rendered, setRendered] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [frameNode, setFrameNode] = React.useState<HTMLElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  // Resolve portal target.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const el = triggerRef.current?.closest(".nex-native-frame") as HTMLElement | null;
    setFrameNode(el ?? document.body);
  }, []);

  // Mount / visibility choreography · 20ms mount gap · 220ms unmount tail.
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (open) {
      setRendered(true);
      timer = setTimeout(() => setVisible(true), 20);
    } else {
      setVisible(false);
      timer = setTimeout(() => setRendered(false), 220);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [open]);

  // Esc closes.
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const close = (): void => setOpen(false);

  const overlay =
    rendered && frameNode
      ? createPortal(
          <>
            <div
              aria-hidden
              onClick={close}
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                zIndex: 60,
                cursor: "pointer",
                transition: "opacity 200ms ease-out",
                opacity: visible ? 1 : 0,
              }}
            />
            <aside
              role="dialog"
              aria-label="Contacts menu"
              aria-modal="true"
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                height: "100%",
                width: "min(320px, 85%)",
                background: "var(--nex-world-drawer-bg, #123D2B)",
                borderLeft: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "-8px 0 32px rgba(0,0,0,0.6)",
                zIndex: 61,
                display: "flex",
                flexDirection: "column",
                transform: visible ? "translateX(0)" : "translateX(100%)",
                transition: "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
                color: "#F2F5F8",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding:
                    "calc(env(safe-area-inset-top, 0) + 18px) 18px 14px",
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

              {/* Emergency help button · owner directive 2026-11-03
                  "we need the emergcey button for user help" · prominent
                  red CTA at the top of the drawer · dials 112 (EU-wide
                  emergency number · Ireland standard). Separate from
                  the "Help · NEX1" row below which is non-emergency
                  team chat. */}
              <a
                href="tel:112"
                onClick={close}
                aria-label="Emergency help · dial 112"
                data-nex-drawer-emergency
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
                  overflowY: "auto",
                  padding: "8px 0",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {MENU.map((row) => {
                  const rowStyle: React.CSSProperties = {
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
                  };
                  const rowBody = (
                    <>
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
                    </>
                  );
                  // Action row · fires the canonical notifications drawer
                  // via window CustomEvent (see import note). Close the
                  // "+" drawer so the user sees the LEFT drawer cleanly.
                  if (row.action === "open-notifications-drawer") {
                    return (
                      <button
                        key={`action:${row.action}`}
                        type="button"
                        onClick={() => {
                          close();
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(
                              new CustomEvent("nex:open-notifications-drawer"),
                            );
                          }
                        }}
                        style={{
                          ...rowStyle,
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          fontFamily: "inherit",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        {rowBody}
                      </button>
                    );
                  }
                  // Standard navigation row.
                  return (
                    <Link
                      key={row.href}
                      href={row.href!}
                      onClick={close}
                      style={rowStyle}
                    >
                      {rowBody}
                    </Link>
                  );
                })}

                {/* Sign out · server action · clears the sealed Supabase
                    session (nexAppSsrServerClient) + redirects to /sign-in.
                    Rendered as a form button (not a Link) so the action
                    actually fires server-side. */}
                <form
                  action={signOutAction}
                  style={{ margin: 0 }}
                  onSubmit={() => {
                    // Gap D · translation-only pre-sign-out cleanup. Never
                    // preventDefault — the server action must still fire.
                    try { runTranslationLogoutCleanup(null); } catch { /* ignore */ }
                  }}
                >
                  <button
                    type="submit"
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
            </aside>
            <style>{`
              [role="dialog"][aria-label="Contacts menu"] a:hover,
              [role="dialog"][aria-label="Contacts menu"] button[type="submit"]:hover {
                background: color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 8%, transparent);
                border-left-color: var(--nex-world-secondary, #C6A15B) !important;
              }
              [role="dialog"][aria-label="Contacts menu"] [data-nex-drawer-emergency]:hover {
                filter: brightness(1.12);
              }
            `}</style>
          </>,
          frameNode,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open contacts menu"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "var(--nex-world-secondary, #C6A15B)",
          color: "var(--nex-world-drawer-bg, #123D2B)",
          border: "none",
          fontSize: 24,
          fontWeight: 900,
          lineHeight: 1,
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          padding: 0,
        }}
      >
        +
      </button>
      {overlay}
      {/* 2026-11-17 · hidden canonical notifications drawer mount ·
          its bell button is suppressed via hideTrigger so it does not
          collide with the "+" button or the existing header bell.
          Listens for `nex:open-notifications-drawer` fired by the
          Notifications menu row above. */}
      <NotificationsDrawer hideTrigger />
    </>
  );
}
