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

interface MenuRow {
  readonly href: string;
  readonly icon: string;
  readonly label: string;
}

const MENU: readonly MenuRow[] = [
  { href: "/nex-native/contacts?action=add", icon: "👤", label: "Add contact" },
  { href: "/nex-native/contacts?action=invite", icon: "✉", label: "Invite friends" },
  { href: "/nex-native/settings", icon: "⚙", label: "Settings" },
  { href: "/nex-native/home", icon: "🏠", label: "Home" },
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
                {MENU.map((row) => (
                  <Link
                    key={row.href}
                    href={row.href}
                    onClick={close}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "14px 20px",
                      color: "#F2F5F8",
                      textDecoration: "none",
                      fontSize: 15,
                      fontWeight: 600,
                      borderLeft: "3px solid transparent",
                      transition: "background 150ms ease-out",
                    }}
                  >
                    <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden>
                      {row.icon}
                    </span>
                    <span>{row.label}</span>
                  </Link>
                ))}
              </nav>
            </aside>
            <style>{`
              [role="dialog"][aria-label="Contacts menu"] a:hover {
                background: color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 8%, transparent);
                border-left-color: var(--nex-world-secondary, #C6A15B) !important;
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
    </>
  );
}
