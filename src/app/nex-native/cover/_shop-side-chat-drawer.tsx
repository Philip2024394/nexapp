"use client";

// src/app/nex-native/cover/_shop-side-chat-drawer.tsx
//
// Chat left-side drawer mounted on shop surfaces.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Owner directive 2026-11-06 "chat left side drawer loads when shop
// loading" — brings the chat context onto the shop template so the
// user stays inside the NEX family instead of context-switching.
//
// Implementation:
//   · Top-left 32×32 stroke-3 chat glyph (matches the burger-menu
//     right-cluster weight)
//   · Tap opens a left-anchored drawer scoped to the phone frame
//     (position: absolute inset:0 wrapper with the drawer on the left
//     half) · world-palette gold accent · emerald surface
//   · Drawer content:
//       · Shop title + "Chatting as you" header
//       · "Open full chat" primary CTA → /nex-native/free-chat
//       · "Jump to contacts" secondary CTA → /nex-native/contacts
//       · "Chat with this shop" CTA when ownerHandle is present →
//         deep-links to the shop owner's peer chat
//   · ESC closes · backdrop click closes
//
// Positioning uses position: absolute so the sealed phone-frame
// transform (translateZ(0)) scopes `fixed` descendants correctly.

import * as React from "react";
import Link from "next/link";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "#FAF8F4";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "rgba(5, 15, 28, 0.96)";
const BORDER = "rgba(198, 161, 91, 0.3)";
const BORDER_HI = "rgba(198, 161, 91, 0.6)";

export interface ShopSideChatDrawerProps {
  /** Shop display name shown in the drawer header. */
  readonly shopName: string | null;
  /** Shop owner's account id · when present a "Chat with this shop"
   *  CTA deep-links to their peer chat. */
  readonly shopOwnerAccountId: string | null;
  /** Accent hex that tracks the applied theme tint so the drawer
   *  reads as part of the current shop template. */
  readonly accentHex?: string | null;
}

export function ShopSideChatDrawer({
  shopName,
  shopOwnerAccountId,
  accentHex,
}: ShopSideChatDrawerProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const accent =
    accentHex && /^#[0-9A-Fa-f]{6}$/.test(accentHex) ? accentHex : GOLD;

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      {/* Top-left trigger · same visual weight as the burger cluster
          on the right (28px stroke-3 glyph · drop-shadow · no button
          chrome). */}
      <button
        type="button"
        aria-label="Open chat drawer"
        onClick={() => setOpen(true)}
        data-nex-shop-side-chat-trigger
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          width: 32,
          height: 32,
          borderRadius: 0,
          background: "transparent",
          border: "none",
          color: CREAM,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          zIndex: 50,
          WebkitTapHighlightColor: "transparent",
          padding: 0,
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.75))",
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 5h18v12H8l-5 4z" />
        </svg>
      </button>

      {open ? (
        <>
          {/* Backdrop · dim the shop but keep it visible so the drawer
              feels anchored to the surface. */}
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.55)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              zIndex: 70,
            }}
          />

          {/* Drawer · left-anchored, spans 78% of the phone width so
              the backdrop peek on the right stays tappable as a close
              hitbox. */}
          <aside
            role="dialog"
            aria-label="Chat drawer"
            data-nex-shop-side-chat-drawer
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: "78%",
              maxWidth: 320,
              background: SURFACE,
              borderRight: `2px solid ${accent}`,
              zIndex: 71,
              display: "flex",
              flexDirection: "column",
              padding:
                "calc(env(safe-area-inset-top, 0px) + 14px) 14px calc(env(safe-area-inset-bottom, 0px) + 14px)",
              boxSizing: "border-box",
              fontFamily: "Inter, system-ui, sans-serif",
              animation: "nexShopSideChatSlideIn 240ms ease-out",
              borderTopRightRadius: 18,
              borderBottomRightRadius: 18,
            }}
          >
            <style>{`
              @keyframes nexShopSideChatSlideIn {
                from { transform: translateX(-100%); opacity: 0.6; }
                to   { transform: translateX(0);     opacity: 1;   }
              }
            `}</style>

            {/* Header · shop context · close X */}
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 12,
                borderBottom: `1px solid ${BORDER}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: accent,
                  }}
                >
                  NEX Chat
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 900,
                    color: CREAM,
                    letterSpacing: "-0.01em",
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {shopName ?? "This shop"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: "rgba(255, 255, 255, 0.06)",
                  color: INK,
                  border: `1px solid ${BORDER}`,
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </header>

            {/* CTAs · chat-with-shop (when owner known) + Open full
                chat + Contacts · each a tappable row that drops the
                user into the sealed chat surface. */}
            <nav
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                paddingTop: 14,
              }}
            >
              {shopOwnerAccountId ? (
                <DrawerLink
                  href={`/nex-native/chat/peer/${shopOwnerAccountId}`}
                  accent={accent}
                  icon="💬"
                  title={`Chat with ${shopName ?? "this shop"}`}
                  sublabel="Open the peer chat with the owner"
                />
              ) : null}
              <DrawerLink
                href="/nex-native/free-chat"
                accent={accent}
                icon="🏠"
                title="Open full chat"
                sublabel="All your chats, contacts, drafts"
              />
              <DrawerLink
                href="/nex-native/contacts"
                accent={accent}
                icon="👥"
                title="Contacts"
                sublabel="Friends and business contacts"
              />
            </nav>

            {/* Footer hint · explains why this drawer exists. */}
            <footer
              style={{
                marginTop: "auto",
                fontSize: 10.5,
                color: INK_MUTED,
                lineHeight: 1.5,
                textAlign: "center",
                paddingTop: 12,
                borderTop: `1px solid ${BORDER}`,
              }}
            >
              Shop + chat stay linked · everything you say here goes
              on your chat record with this shop.
            </footer>
          </aside>
        </>
      ) : null}
      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
      {BORDER_HI && INK_DIM ? null : null}
    </>
  );
}

function DrawerLink({
  href,
  accent,
  icon,
  title,
  sublabel,
}: {
  href: string;
  accent: string;
  icon: string;
  title: string;
  sublabel: string;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 12px",
        background: "rgba(5, 15, 28, 0.9)",
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        color: INK,
        textDecoration: "none",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: accent,
          color: "#1A120A",
          display: "grid",
          placeItems: "center",
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 12.5,
            fontWeight: 800,
            color: CREAM,
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </span>
        <span
          style={{
            display: "block",
            fontSize: 10.5,
            color: INK_DIM,
            marginTop: 1,
            lineHeight: 1.35,
          }}
        >
          {sublabel}
        </span>
      </span>
      <span aria-hidden style={{ color: INK_MUTED, fontSize: 14 }}>
        ›
      </span>
    </Link>
  );
}
