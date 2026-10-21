"use client";

// src/app/nex-native/chat-themes-library/marketplace-prototype/_preview-sheets.tsx
//
// Three preview sheets · Theme / Intro / Shop · each a full-canvas
// overlay inside the phone frame. Owner-authorised 2026-10-21.
// -----------------------------------------------------------------------------
// Scope:
//   · Theme preview: paints the real wallpaper + sample bubbles
//     using the sealed asset URL. No sealed theme-engine import ·
//     this is a prototype visual preview only · the real activation
//     path remains unchanged.
//   · Intro preview: inlines the actual intro-video <video> element
//     with replay + close controls. Does NOT touch the sealed
//     StandardIntroOverlay or its twice-then-skip tracking.
//   · Shop preview: lists the 11 sealed cover-layout IDs with a
//     "Preview" state and per-row Add to Cart. Honest · doesn't
//     invent prices · doesn't claim entitlement.

import * as React from "react";
import type { MarketplaceCatalogEntry } from "./_catalog";
import { SHOP_LAYOUTS } from "./_catalog";
import { cartKey } from "./_types";
import { hexWithAlpha } from "@/app/nex-native/free-chat/_types";

// Owner directive 2026-10-21 · shared Price badge · top-right of the
// preview content area · small rounded corners · translucent navy
// over cyan rim · reads as a price tag. Used by Theme + Intro preview
// surfaces (Shop surface already has its own top-right badge).
function PriceBadge(): React.JSX.Element {
  return (
    <span
      data-nex-marketplace-prototype-preview-price-badge
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        padding: "4px 9px",
        background: "rgba(2, 9, 20, 0.78)",
        border: `1px solid rgba(0, 175, 255, 0.42)`,
        borderRadius: 6,
        color: "#00AFFF",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 3,
        pointerEvents: "none",
      }}
    >
      Price TBD
    </span>
  );
}

const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  orangeInk: "#1A0808",
  green: "#16D66B",
};

// ─── Shared sheet shell ──────────────────────────────────────────

function SheetShell({
  title,
  onClose,
  children,
  footer,
}: {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
  readonly footer: React.ReactNode;
}): React.JSX.Element {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      data-nex-marketplace-prototype-sheet
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 500,
        background: NEX.bg,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Owner directive 2026-10-21 · simplified sheet header · one
          line (title left + price badge right) · NEX eyebrow and
          subtitle retired · content area below fills the remaining
          height between header and footer with zero padding so the
          preview image uses the full width. */}
      <header
        style={{
          padding:
            "calc(env(safe-area-inset-top, 0px) + 12px) 14px 10px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: `1px solid ${NEX.cyanSoft}`,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          data-nex-marketplace-prototype-sheet-close
          style={{
            width: 36,
            height: 36,
            background: "transparent",
            color: NEX.text,
            border: "none",
            fontSize: 22,
            lineHeight: 1,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            flexShrink: 0,
          }}
        >
          ←
        </button>
        <h2
          style={{
            flex: 1,
            minWidth: 0,
            margin: 0,
            fontSize: 16,
            fontWeight: 800,
            color: NEX.text,
            letterSpacing: "-0.005em",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {title}
        </h2>
        <span
          data-nex-marketplace-prototype-sheet-price-badge
          style={{
            flexShrink: 0,
            padding: "4px 9px",
            background: "rgba(2, 9, 20, 0.78)",
            border: `1px solid rgba(0, 175, 255, 0.42)`,
            borderRadius: 6,
            color: NEX.cyan,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          Price TBD
        </span>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>

      <footer
        style={{
          padding:
            "10px 14px calc(env(safe-area-inset-bottom, 0px) + 12px)",
          borderTop: `1px solid ${NEX.cyanSoft}`,
          background: "rgba(2, 9, 20, 0.9)",
          display: "flex",
          gap: 8,
          flexShrink: 0,
        }}
      >
        {footer}
      </footer>
    </div>
  );
}

// ─── Theme preview ───────────────────────────────────────────────

export function ThemePreviewSheet({
  entry,
  alreadyInCart,
  cartCount,
  onCartClick,
  onAddToCart,
  onClose,
}: {
  readonly entry: MarketplaceCatalogEntry;
  readonly alreadyInCart: boolean;
  readonly cartCount: number;
  readonly onCartClick: () => void;
  readonly onAddToCart: () => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  // Owner directive 2026-10-21 · Theme preview goes FULL-BLEED · the
  // chat preview + wallpaper fill the entire sheet (no header bar,
  // no footer button row) · a small floating "details card" sits
  // over the lower edge with the theme name + price + Add Cart +
  // Close. Esc still closes.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      data-nex-marketplace-prototype-sheet
      data-nex-marketplace-prototype-sheet-variant="theme-fullbleed"
      role="dialog"
      aria-modal="true"
      aria-label={`${entry.displayName} Chat theme`}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 500,
        background: NEX.bg,
        overflow: "hidden",
      }}
    >
      {/* Owner directive 2026-10-21 · chat-style business header ·
          back arrow retired · header shade (gradient + blur +
          border) removed · profile avatar matches the sealed free-
          chat NexPingBadge size (48px) + ping ring in the owner's
          theme accent · stronger dual-wave pulse when the owner is
          online (two rings offset 900ms, opacity 0.85 → 0, scale
          0.85 → 1.9) · when offline the avatar is static. */}
      <style>{`
        @keyframes nex-mp-profile-ping {
          0%   { transform: scale(0.85); opacity: 0.85; }
          70%  { transform: scale(1.9);  opacity: 0;    }
          100% { transform: scale(1.9);  opacity: 0;    }
        }
      `}</style>
      <header
        data-nex-marketplace-prototype-theme-chat-header
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding:
            "calc(env(safe-area-inset-top, 0px) + 12px) 14px 10px",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          gap: 12,
          zIndex: 2,
        }}
      >
        {/* Profile avatar · 48×48 (matches sealed NexPingBadge) ·
            themed accent fill + ping ring behind. */}
        <div
          data-nex-marketplace-prototype-theme-chat-header-avatar
          data-nex-marketplace-prototype-theme-chat-header-online={
            entry.online !== false ? "true" : "false"
          }
          aria-hidden
          style={{
            position: "relative",
            flexShrink: 0,
            width: 48,
            height: 48,
          }}
        >
          {entry.online !== false && (
            <>
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: entry.ownerAccentHex ?? entry.accentHex,
                  animation: "nex-mp-profile-ping 1800ms ease-out infinite",
                  pointerEvents: "none",
                }}
                aria-hidden
              />
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: entry.ownerAccentHex ?? entry.accentHex,
                  animation: "nex-mp-profile-ping 1800ms ease-out infinite",
                  animationDelay: "900ms",
                  pointerEvents: "none",
                }}
                aria-hidden
              />
            </>
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: entry.ownerAccentHex ?? entry.accentHex,
              border: `2px solid rgba(255, 255, 255, 0.65)`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              boxShadow: `0 0 14px -4px ${entry.ownerAccentHex ?? entry.accentHex}`,
            }}
          >
            {entry.displayName.charAt(0)}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "#FFFFFF",
              letterSpacing: "-0.005em",
              textShadow: "0 1px 4px rgba(0, 0, 0, 0.5)",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {entry.displayName}
          </div>
          <div
            data-nex-marketplace-prototype-theme-chat-header-nexid
            style={{
              marginTop: 1,
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255, 255, 255, 0.78)",
              letterSpacing: 0.6,
              textShadow: "0 1px 3px rgba(0, 0, 0, 0.5)",
            }}
          >
            NEX {entry.nexId ?? "-00000"}
          </div>
        </div>
        <button
          type="button"
          onClick={onCartClick}
          aria-label={`Cart · ${cartCount} item${cartCount === 1 ? "" : "s"}`}
          data-nex-marketplace-prototype-theme-chat-header-cart
          style={{
            position: "relative",
            width: 36,
            height: 36,
            background: "transparent",
            color: "#FFFFFF",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx={9} cy={21} r={1.5} />
            <circle cx={18} cy={21} r={1.5} />
            <path d="M2.5 3h2l2.6 12.3a2 2 0 0 0 2 1.7h7.9a2 2 0 0 0 2-1.6L21 7H6" />
          </svg>
          {cartCount > 0 && (
            <span
              data-nex-marketplace-prototype-theme-chat-header-cart-badge
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                borderRadius: 999,
                background: "#DC2626",
                color: "#FFFFFF",
                fontSize: 10,
                fontWeight: 900,
                lineHeight: "16px",
                textAlign: "center",
                boxShadow:
                  "0 0 0 2px rgba(2, 9, 20, 0.9), 0 0 8px -2px rgba(220, 38, 38, 0.75)",
              }}
            >
              {cartCount}
            </span>
          )}
        </button>
      </header>

      <section
        data-nex-marketplace-prototype-theme-preview
        data-nex-marketplace-prototype-theme-preview-accent={entry.accentHex}
        style={{
          // Full-bleed wallpaper · zero border-radius, zero padding
          // on the parent · chat sample bubbles sit on top via inner
          // padding. Top padding leaves room for the business header
          // bar · bottom padding reserves space for the floating
          // detail card.
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          background: `
            linear-gradient(rgba(2, 9, 20, 0.3), rgba(2, 9, 20, 0.5)),
            url("${entry.wallpaperUrl}") center / cover no-repeat, #0A1526
          `,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding:
            "calc(env(safe-area-inset-top, 0px) + 84px) 14px calc(env(safe-area-inset-bottom, 0px) + 240px)",
        }}
      >

        {/* Owner directive 2026-10-21 · peer bubble = business
            owner's message → tinted to OWNER accent (dark red for
            Crispy Chicken) · self bubble = customer's message →
            tinted to CUSTOMER accent (white for Crispy Chicken).
            Sender-name chip on the peer bubble reads in the OWNER
            colour so the business name is visually tied to its
            brand hue even if the glass is a near-match tone. */}
        <Bubble
          peer
          time="15:03"
          sender={entry.displayName}
          accent={entry.ownerAccentHex ?? entry.accentHex}
          senderAccent={entry.senderNameHex ?? entry.ownerAccentHex ?? entry.accentHex}
          rimPx={entry.rimPx}
        >
          Welcome To {entry.displayName} how can we help you
        </Bubble>
        <Bubble
          time="15:04"
          accent={entry.customerAccentHex ?? entry.accentHex}
          rimPx={entry.rimPx}
        >
          Do you Deliver
        </Bubble>
      </section>

      {/* Owner directive 2026-10-21 · floating details card over the
          lower edge · theme name + Price TBD + Add Cart + Close ·
          translucent navy with cyan rim · backdrop blur so the
          wallpaper reads through subtly. · Lifted above the chat
          composer footer so the preview reads like a real chat
          surface (composer input + send + 3-dots sit below). */}
      <aside
        data-nex-marketplace-prototype-theme-detail-card
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 82px)",
          padding: "12px 14px",
          background: "rgba(2, 9, 20, 0.88)",
          border: `1px solid ${hexWithAlpha(
            entry.ownerAccentHex ?? entry.accentHex,
            0.55,
          )}`,
          borderRadius: 14,
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
          boxShadow: `0 12px 32px -12px rgba(0, 0, 0, 0.7), 0 0 18px -6px ${hexWithAlpha(
            entry.ownerAccentHex ?? entry.accentHex,
            0.55,
          )}`,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 10,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 800,
              color: NEX.text,
              letterSpacing: "-0.005em",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            Theme Price idr 23.000
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            data-nex-marketplace-prototype-sheet-close
            style={{
              padding: "0 16px",
              minHeight: 40,
              borderRadius: 10,
              background: "transparent",
              color: entry.ownerAccentHex ?? entry.accentHex,
              border: `1px solid ${hexWithAlpha(
                entry.ownerAccentHex ?? entry.accentHex,
                0.6,
              )}`,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={onAddToCart}
            disabled={alreadyInCart}
            data-nex-marketplace-prototype-add-to-cart="theme"
            style={{
              minHeight: 40,
              padding: "0 14px",
              borderRadius: 10,
              background: alreadyInCart
                ? NEX.green
                : (entry.ownerAccentHex ?? entry.accentHex),
              color: alreadyInCart ? "#042416" : "#FFFFFF",
              border: "none",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 0.3,
              textShadow: alreadyInCart
                ? "none"
                : "0 1px 3px rgba(0, 0, 0, 0.55)",
              boxShadow: alreadyInCart
                ? "none"
                : `0 6px 16px -6px ${hexWithAlpha(
                    entry.ownerAccentHex ?? entry.accentHex,
                    0.75,
                  )}`,
              cursor: alreadyInCart ? "default" : "pointer",
              fontFamily: "inherit",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {alreadyInCart ? "✓ Added to Cart" : "Add to Cart"}
          </button>
        </div>
      </aside>

      {/* Owner directive 2026-10-21 · composer footer · mirrors the
          sealed `ChatComposerPill` shape (translucent navy pill, +
          button, textarea, send button) + a 3-dots side-drawer
          trigger on the lower right. Presentation-only in the
          preview · no messages are sent, no drawer opens · reads
          as a real chat surface so the owner can judge the theme
          end-to-end. Theme accent lights the rim + glow. */}
      <footer
        data-nex-marketplace-prototype-theme-chat-footer
        style={{
          position: "absolute",
          left: 10,
          right: 10,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 2,
        }}
      >
        <div
          data-nex-marketplace-prototype-theme-chat-composer-pill
          style={{
            flex: 1,
            minHeight: 44,
            padding: "4px 6px 4px 4px",
            borderRadius: 14,
            background: "rgba(2, 9, 20, 0.78)",
            border: `1px solid ${hexWithAlpha(
              entry.ownerAccentHex ?? entry.accentHex,
              0.5,
            )}`,
            boxShadow: `0 0 14px -4px ${hexWithAlpha(
              entry.ownerAccentHex ?? entry.accentHex,
              0.55,
            )}`,
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <button
            type="button"
            aria-label="Attach"
            tabIndex={-1}
            data-nex-marketplace-prototype-theme-chat-plus
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "transparent",
              color: "#FFFFFF",
              border: `1px solid rgba(255, 255, 255, 0.35)`,
              fontSize: 18,
              lineHeight: 1,
              cursor: "default",
              fontFamily: "inherit",
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            +
          </button>
          <div
            aria-hidden
            data-nex-marketplace-prototype-theme-chat-input
            style={{
              flex: 1,
              minHeight: 32,
              display: "flex",
              alignItems: "center",
              padding: "0 4px",
              fontSize: 16,
              color: "rgba(255, 255, 255, 0.52)",
              fontFamily: "inherit",
              lineHeight: 1.2,
              userSelect: "none",
            }}
          >
            Message
          </div>
          <button
            type="button"
            aria-label="Send"
            tabIndex={-1}
            data-nex-marketplace-prototype-theme-chat-send
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: entry.ownerAccentHex ?? entry.accentHex,
              color: "#FFFFFF",
              border: "none",
              cursor: "default",
              fontFamily: "inherit",
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 4px 10px -4px ${
                entry.ownerAccentHex ?? entry.accentHex
              }`,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 19V5" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          aria-label="More"
          data-nex-marketplace-prototype-theme-chat-dots
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(2, 9, 20, 0.78)",
            color: "#FFFFFF",
            border: `1px solid rgba(255, 255, 255, 0.22)`,
            cursor: "pointer",
            fontFamily: "inherit",
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(10px) saturate(140%)",
            WebkitBackdropFilter: "blur(10px) saturate(140%)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <circle cx={12} cy={5.5} r={1.6} />
            <circle cx={12} cy={12} r={1.6} />
            <circle cx={12} cy={18.5} r={1.6} />
          </svg>
        </button>
      </footer>
    </div>
  );
}

function Bubble({
  children,
  time,
  peer,
  sender,
  accent,
  senderAccent,
  rimPx,
}: {
  readonly children: React.ReactNode;
  readonly time: string;
  readonly peer?: boolean;
  readonly sender?: string;
  readonly accent: string;
  /** Optional override for the sender-name chip colour · defaults
   *  to `accent` when not supplied. Lets the business name read
   *  in the owner brand colour even when the bubble glass uses a
   *  different hue (e.g. Crispy Chicken owner-dark-red name on a
   *  white-glass bubble). */
  readonly senderAccent?: string;
  /** Optional rim thickness in px · defaults to 1px (sealed free-
   *  chat value). Themes may pass 2+ for a chunkier branded rim. */
  readonly rimPx?: number;
}): React.JSX.Element {
  // Owner directive 2026-10-21 (iteration · thicker rim option) ·
  // same free-chat glass pattern; when `rimPx > 1` is passed the
  // rim alpha is also bumped so the thicker outline reads as a
  // confident brand rim, not a faded thick line.
  //   Default (1px) rim · peer 42% · self 72% (sealed values)
  //   Chunky (2+px) rim · peer 72% · self 95% (bolder brand feel)
  const thickRim = (rimPx ?? 1) > 1;
  const fill = hexWithAlpha(accent, peer ? 0.12 : 0.16);
  const rim = thickRim
    ? hexWithAlpha(accent, peer ? 0.72 : 0.95)
    : hexWithAlpha(accent, peer ? 0.42 : 0.72);
  return (
    <article
      style={{
        maxWidth: "80%",
        alignSelf: peer ? "flex-start" : "flex-end",
        padding: "8px 14px 10px",
        borderRadius: 18,
        borderBottomLeftRadius: peer ? 6 : 18,
        borderBottomRightRadius: peer ? 18 : 6,
        background: fill,
        border: `${rimPx ?? 1}px solid ${rim}`,
        color: NEX.text,
        fontSize: 14,
        lineHeight: 1.4,
        boxShadow: "0 6px 14px -8px rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(10px) saturate(140%)",
        WebkitBackdropFilter: "blur(10px) saturate(140%)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 6,
          alignSelf: "flex-end",
          fontSize: 10,
          color: peer ? NEX.textMute : "rgba(242, 245, 248, 0.72)",
          lineHeight: 1,
        }}
      >
        {sender && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "-0.005em",
              // Sender chip uses senderAccent when supplied (brand
              // name in the owner colour) otherwise falls back to
              // the bubble accent.
              color: senderAccent ?? accent,
            }}
          >
            {sender}
          </span>
        )}
        <span>{time}</span>
      </div>
      <div style={{ whiteSpace: "pre-wrap" }}>{children}</div>
    </article>
  );
}

// ─── Intro preview ───────────────────────────────────────────────

export function IntroPreviewSheet({
  entry,
  alreadyInCart,
  cartCount,
  onCartClick,
  onAddToCart,
  onClose,
}: {
  readonly entry: MarketplaceCatalogEntry;
  readonly alreadyInCart: boolean;
  readonly cartCount: number;
  readonly onCartClick: () => void;
  readonly onAddToCart: () => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [finished, setFinished] = React.useState(false);
  const replay = React.useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => {});
    setFinished(false);
  }, []);

  const hasVideo = entry.introVideoUrl !== null;
  const themeAccent = entry.ownerAccentHex ?? entry.accentHex;

  // Owner directive 2026-10-21 · Intro preview mirrors the Theme
  // preview full-bleed layout · chat-style business header at top
  // (avatar + name + NEX id + cart) · intro video fills the whole
  // sheet · hero text "Welcome to {Business}" overlays upper area
  // · hours badge sits above the detail card · detail card at the
  // bottom with Intro Price + Close + themed Add to Cart.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      data-nex-marketplace-prototype-sheet
      data-nex-marketplace-prototype-sheet-variant="intro-fullbleed"
      role="dialog"
      aria-modal="true"
      aria-label={`${entry.displayName} Intro`}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 500,
        background: "#000",
        overflow: "hidden",
      }}
    >
      {/* Full-bleed intro video · video gets `object-fit: cover` so
          it fills the whole phone frame. Dark underlay for load /
          finish states. */}
      {hasVideo && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          ref={videoRef}
          src={entry.introVideoUrl ?? undefined}
          autoPlay
          playsInline
          onEnded={() => setFinished(true)}
          data-nex-marketplace-prototype-intro-video={entry.themeId}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}
      {!hasVideo && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            color: NEX.textDim,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 12 }}>🎬</div>
          <div
            style={{
              fontSize: 15,
              color: NEX.text,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Scripted intro · no video yet
          </div>
          <div style={{ fontSize: 12 }}>
            {entry.displayName} uses the sealed scripted-animation
            intro. A paid video variant can be added later.
          </div>
        </div>
      )}

      {/* Chat-style business header · same primitive shape as the
          Theme preview · NEX ping avatar + name + NEX id + red cart
          badge. Nothing else in the header. */}
      <style>{`
        @keyframes nex-mp-intro-ping {
          0%   { transform: scale(0.85); opacity: 0.85; }
          70%  { transform: scale(1.9);  opacity: 0;    }
          100% { transform: scale(1.9);  opacity: 0;    }
        }
      `}</style>
      <header
        data-nex-marketplace-prototype-intro-chat-header
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding:
            "calc(env(safe-area-inset-top, 0px) + 12px) 14px 10px",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          gap: 12,
          zIndex: 3,
        }}
      >
        <div
          aria-hidden
          style={{
            position: "relative",
            flexShrink: 0,
            width: 48,
            height: 48,
          }}
        >
          {entry.online !== false && (
            <>
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: themeAccent,
                  animation: "nex-mp-intro-ping 1800ms ease-out infinite",
                  pointerEvents: "none",
                }}
                aria-hidden
              />
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: themeAccent,
                  animation: "nex-mp-intro-ping 1800ms ease-out infinite",
                  animationDelay: "900ms",
                  pointerEvents: "none",
                }}
                aria-hidden
              />
            </>
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: themeAccent,
              border: `2px solid rgba(255, 255, 255, 0.65)`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              boxShadow: `0 0 14px -4px ${themeAccent}`,
            }}
          >
            {entry.displayName.charAt(0)}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "#FFFFFF",
              letterSpacing: "-0.005em",
              textShadow: "0 1px 4px rgba(0, 0, 0, 0.65)",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {entry.displayName}
          </div>
          <div
            style={{
              marginTop: 1,
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255, 255, 255, 0.82)",
              letterSpacing: 0.6,
              textShadow: "0 1px 3px rgba(0, 0, 0, 0.6)",
            }}
          >
            NEX {entry.nexId ?? "-00000"}
          </div>
        </div>
        <button
          type="button"
          onClick={onCartClick}
          aria-label={`Cart · ${cartCount} item${cartCount === 1 ? "" : "s"}`}
          data-nex-marketplace-prototype-intro-chat-header-cart
          style={{
            position: "relative",
            width: 36,
            height: 36,
            background: "transparent",
            color: "#FFFFFF",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx={9} cy={21} r={1.5} />
            <circle cx={18} cy={21} r={1.5} />
            <path d="M2.5 3h2l2.6 12.3a2 2 0 0 0 2 1.7h7.9a2 2 0 0 0 2-1.6L21 7H6" />
          </svg>
          {cartCount > 0 && (
            <span
              data-nex-marketplace-prototype-intro-chat-header-cart-badge
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                borderRadius: 999,
                background: "#DC2626",
                color: "#FFFFFF",
                fontSize: 10,
                fontWeight: 900,
                lineHeight: "16px",
                textAlign: "center",
                boxShadow:
                  "0 0 0 2px rgba(2, 9, 20, 0.9), 0 0 8px -2px rgba(220, 38, 38, 0.75)",
              }}
            >
              {cartCount}
            </span>
          )}
        </button>
      </header>

      {/* Hero text · owner directive 2026-10-21 · three stacked
          lines (Welcome / Business name / Location) · overlays the
          upper third of the video with heavy shadow for legibility
          across any background. */}
      <div
        data-nex-marketplace-prototype-intro-hero
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          top: "calc(env(safe-area-inset-top, 0px) + 110px)",
          zIndex: 2,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          data-nex-marketplace-prototype-intro-hero-greeting
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: "rgba(255, 255, 255, 0.92)",
            letterSpacing: "-0.005em",
            lineHeight: 1,
            textShadow:
              "0 2px 10px rgba(0, 0, 0, 0.75), 0 0 20px rgba(0, 0, 0, 0.45)",
          }}
        >
          Welcome
        </div>
        <div
          data-nex-marketplace-prototype-intro-hero-business
          style={{
            fontSize: 34,
            fontWeight: 900,
            color: "#FFFFFF",
            letterSpacing: "-0.025em",
            lineHeight: 1.02,
            textShadow:
              "0 2px 12px rgba(0, 0, 0, 0.8), 0 0 24px rgba(0, 0, 0, 0.5)",
          }}
        >
          {entry.displayName}
        </div>
        {entry.location && (
          <div
            data-nex-marketplace-prototype-intro-hero-location
            style={{
              marginTop: 2,
              fontSize: 15,
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.86)",
              letterSpacing: 0.3,
              lineHeight: 1,
              textShadow:
                "0 1px 6px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 0, 0, 0.45)",
            }}
          >
            {entry.location}
          </div>
        )}
      </div>

      {/* Tap-to-replay overlay when the video finishes. */}
      {hasVideo && finished && (
        <button
          type="button"
          onClick={replay}
          data-nex-marketplace-prototype-intro-replay
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(2, 9, 20, 0.5)",
            color: NEX.text,
            border: "none",
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 0.4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            zIndex: 2,
          }}
        >
          ↺ Tap to replay
        </button>
      )}

      {/* Long opening-hours badge · owner directive 2026-10-21 ·
          moved to the very bottom (footer) · full-width translucent
          pill with themed rim + glow · one-line mock schedule copy
          from the catalog so each theme feels like a real business. */}
      <div
        data-nex-marketplace-prototype-intro-hours
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
          padding: "9px 14px",
          background: "rgba(2, 9, 20, 0.78)",
          border: `1px solid ${hexWithAlpha(themeAccent, 0.5)}`,
          borderRadius: 999,
          backdropFilter: "blur(12px) saturate(140%)",
          WebkitBackdropFilter: "blur(12px) saturate(140%)",
          color: "#FFFFFF",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.4,
          textAlign: "center",
          boxShadow: `0 0 14px -6px ${hexWithAlpha(themeAccent, 0.55)}`,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          zIndex: 2,
        }}
      >
        {entry.hours ?? "Hours · ask the owner"}
      </div>

      {/* Floating details card · same shape as the Theme preview ·
          themed rim + outer glow · Add to Cart in theme accent ·
          lifted so the hours badge can sit at the footer. */}
      <aside
        data-nex-marketplace-prototype-intro-detail-card
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 62px)",
          padding: "12px 14px",
          background: "rgba(2, 9, 20, 0.88)",
          border: `1px solid ${hexWithAlpha(themeAccent, 0.55)}`,
          borderRadius: 14,
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
          boxShadow: `0 12px 32px -12px rgba(0, 0, 0, 0.7), 0 0 18px -6px ${hexWithAlpha(themeAccent, 0.55)}`,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 10,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 800,
              color: NEX.text,
              letterSpacing: "-0.005em",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            Intro Price idr 15.000
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            data-nex-marketplace-prototype-sheet-close
            style={{
              padding: "0 16px",
              minHeight: 40,
              borderRadius: 10,
              background: "transparent",
              color: themeAccent,
              border: `1px solid ${hexWithAlpha(themeAccent, 0.6)}`,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={onAddToCart}
            disabled={alreadyInCart || !hasVideo}
            data-nex-marketplace-prototype-add-to-cart="intro"
            style={{
              minHeight: 40,
              padding: "0 14px",
              borderRadius: 10,
              background: !hasVideo
                ? "rgba(255, 255, 255, 0.08)"
                : alreadyInCart
                ? NEX.green
                : themeAccent,
              color: !hasVideo
                ? NEX.textMute
                : alreadyInCart
                ? "#042416"
                : "#FFFFFF",
              border: "none",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 0.3,
              textShadow:
                !hasVideo || alreadyInCart
                  ? "none"
                  : "0 1px 3px rgba(0, 0, 0, 0.55)",
              boxShadow:
                !hasVideo || alreadyInCart
                  ? "none"
                  : `0 6px 16px -6px ${hexWithAlpha(themeAccent, 0.75)}`,
              cursor:
                alreadyInCart || !hasVideo ? "default" : "pointer",
              fontFamily: "inherit",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {!hasVideo
              ? "No Intro video yet"
              : alreadyInCart
              ? "✓ Added to Cart"
              : "Add to Cart"}
          </button>
        </div>
      </aside>
    </div>
  );
}

// ─── Shop preview ────────────────────────────────────────────────

export function ShopPreviewSheet({
  entry,
  inCartKeys,
  onAddToCart,
  onClose,
}: {
  readonly entry: MarketplaceCatalogEntry;
  readonly inCartKeys: ReadonlySet<string>;
  readonly onAddToCart: (layoutId: string) => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  // Owner directive 2026-10-21 (prototype iteration) · Shop preview
  // becomes a Tinder-style swipe deck · one layout card at a time,
  // horizontal swipe (touch + mouse drag) between layouts, dots +
  // arrow buttons for discoverability, snap-back on short drags.
  const [index, setIndex] = React.useState(0);
  const [dragDx, setDragDx] = React.useState(0);
  const dragStartXRef = React.useRef<number | null>(null);
  const draggingRef = React.useRef(false);
  const SWIPE_THRESHOLD = 60; // px to commit a direction

  const total = SHOP_LAYOUTS.length;
  const current = SHOP_LAYOUTS[index];
  const currentKey = cartKey({
    themeId: entry.themeId,
    productType: "shop",
    shopLayoutId: current.layoutId,
  });
  const currentInCart = inCartKeys.has(currentKey);

  const goTo = React.useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(total - 1, next)));
      setDragDx(0);
    },
    [total],
  );
  const goPrev = React.useCallback(() => goTo(index - 1), [goTo, index]);
  const goNext = React.useCallback(() => goTo(index + 1), [goTo, index]);

  const onPointerDown = React.useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    dragStartXRef.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);
  const onPointerMove = React.useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || dragStartXRef.current === null) return;
    setDragDx(e.clientX - dragStartXRef.current);
  }, []);
  const onPointerUp = React.useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      const dx = dragDx;
      dragStartXRef.current = null;
      if (dx <= -SWIPE_THRESHOLD && index < total - 1) {
        goNext();
      } else if (dx >= SWIPE_THRESHOLD && index > 0) {
        goPrev();
      } else {
        setDragDx(0); // snap back
      }
    },
    [dragDx, goNext, goPrev, index, total],
  );

  // Arrow keys as a desktop a11y affordance.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goPrev, goNext]);

  return (
    <SheetShell
      title={`${entry.displayName} Shop`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "0 16px",
              minHeight: 44,
              borderRadius: 10,
              background: "transparent",
              color: NEX.text,
              border: `1px solid ${NEX.cyanSoft}`,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onAddToCart(current.layoutId)}
            disabled={currentInCart}
            data-nex-marketplace-prototype-add-to-cart="shop"
            data-nex-marketplace-prototype-add-to-cart-layout={current.layoutId}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 10,
              background: currentInCart ? NEX.green : NEX.orange,
              color: currentInCart ? "#042416" : NEX.orangeInk,
              border: "none",
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 0.3,
              cursor: currentInCart ? "default" : "pointer",
              fontFamily: "inherit",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {currentInCart
              ? "✓ Added to Cart"
              : `Add ${current.label} to Cart · Price TBD`}
          </button>
        </>
      }
    >
      <div
        style={{
          marginBottom: 12,
          padding: "8px 12px",
          background: "rgba(22, 214, 107, 0.08)",
          border: `1px solid rgba(22, 214, 107, 0.42)`,
          borderRadius: 10,
          color: NEX.textDim,
          fontSize: 11,
          lineHeight: 1.45,
        }}
      >
        Shop covers today are <strong style={{ color: NEX.text }}>free for Bisnis owners</strong>{" "}
        via /cover-themes-library. Catalog here uses the sealed layout
        IDs · paid themed shop skins arrive after the Shop SKU model is
        approved.
      </div>

      {/* ─── Swipe deck ─── */}
      <div
        data-nex-marketplace-prototype-shop-swipe
        style={{
          position: "relative",
          borderRadius: 16,
          overflow: "hidden",
          minHeight: 400,
          background: "rgba(5, 15, 28, 0.72)",
          border: `1px solid ${NEX.cyanSoft}`,
          touchAction: "pan-y",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <article
          data-nex-marketplace-prototype-shop-card={current.layoutId}
          style={{
            position: "relative",
            width: "100%",
            minHeight: 520,
            background: "#020914",
            transform: `translateX(${dragDx}px) rotate(${dragDx * 0.03}deg)`,
            transition: draggingRef.current ? "none" : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
            overflow: "hidden",
          }}
        >
          {/* Owner directive 2026-10-21 (prototype iteration) · the
              Shop swipe card now embeds the sealed cover-preview route
              (/nex-native/cover/preview/[layoutId]) as the actual
              visual · guarantees the user sees the real cover design,
              not a mock. pointer-events: none on the iframe lets the
              swipe gesture on the parent surface still fire · the
              `key` prop forces React to swap iframes cleanly when the
              layout changes rather than reusing the same one. */}
          <iframe
            key={current.layoutId}
            src={`/nex-native/cover/preview/${current.layoutId}`}
            title={`${current.label} shop cover preview`}
            data-nex-marketplace-prototype-shop-iframe={current.layoutId}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: "none",
              pointerEvents: "none",
              backgroundColor: "#020914",
            }}
          />

          {/* Top overlay · counter + price chip over the live preview */}
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              right: 12,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 10,
              zIndex: 2,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                padding: "4px 10px",
                background: "rgba(2, 9, 20, 0.75)",
                border: `1px solid ${NEX.cyanSoft}`,
                borderRadius: 999,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: NEX.cyan,
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
              }}
            >
              Shop · {index + 1} of {total}
            </div>
            {/* Price TBD chip retired here · the sheet header now
                carries the universal Price badge. */}
          </div>

          {/* Bottom overlay · label + blurb + swipe hint */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "40px 16px 16px",
              background:
                "linear-gradient(180deg, rgba(2, 9, 20, 0) 0%, rgba(2, 9, 20, 0.85) 60%, rgba(2, 9, 20, 0.95) 100%)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              zIndex: 2,
              pointerEvents: "none",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 900,
                color: "#FFFFFF",
                letterSpacing: "-0.01em",
                textShadow: "0 2px 10px rgba(0, 0, 0, 0.7)",
              }}
            >
              {current.label}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: 1.4,
                color: "rgba(255, 255, 255, 0.82)",
                textShadow: "0 1px 4px rgba(0, 0, 0, 0.6)",
              }}
            >
              {current.blurb}
            </p>
            <div
              style={{
                marginTop: 4,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 10,
                fontSize: 10,
                color: "rgba(255, 255, 255, 0.6)",
                letterSpacing: 0.4,
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              {index > 0 && <span>← Swipe</span>}
              <span style={{ opacity: 0.5 }}>•</span>
              {index < total - 1 && <span>Swipe →</span>}
            </div>
          </div>
        </article>

        {/* Prev / Next arrow buttons · click target for desktop */}
        {index > 0 && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous layout"
            data-nex-marketplace-prototype-shop-prev
            style={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(2, 9, 20, 0.75)",
              color: NEX.text,
              border: `1px solid ${NEX.cyanSoft}`,
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
              fontFamily: "inherit",
              zIndex: 2,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            ‹
          </button>
        )}
        {index < total - 1 && (
          <button
            type="button"
            onClick={goNext}
            aria-label="Next layout"
            data-nex-marketplace-prototype-shop-next
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(2, 9, 20, 0.75)",
              color: NEX.text,
              border: `1px solid ${NEX.cyanSoft}`,
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
              fontFamily: "inherit",
              zIndex: 2,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            ›
          </button>
        )}
      </div>

      {/* Dots indicator */}
      <div
        data-nex-marketplace-prototype-shop-dots
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {SHOP_LAYOUTS.map((layout, i) => {
          const inThisCart = inCartKeys.has(
            cartKey({
              themeId: entry.themeId,
              productType: "shop",
              shopLayoutId: layout.layoutId,
            }),
          );
          return (
            <button
              key={layout.layoutId}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to ${layout.label}`}
              data-nex-marketplace-prototype-shop-dot={i}
              data-nex-marketplace-prototype-shop-dot-active={i === index ? "true" : "false"}
              style={{
                width: i === index ? 20 : 8,
                height: 8,
                padding: 0,
                borderRadius: 4,
                background: inThisCart
                  ? NEX.green
                  : i === index
                  ? NEX.cyan
                  : "rgba(0, 175, 255, 0.28)",
                border: "none",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                transition: "width 180ms ease, background 180ms ease",
              }}
            />
          );
        })}
      </div>
    </SheetShell>
  );
}
