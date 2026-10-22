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
import { MenuItemSheet } from "./_menu-item-sheet";
import { MenuDrawer } from "./_menu-drawer";
import { JokerKeypad } from "@/app/nex-native/chat-standard/_joker-keypad";
import { CRISPY_CHICKEN_MOCK } from "@/app/nex-native/cover/mock-data";
import {
  CoverCartDrawer,
  readCartItems,
  type CoverCartLineItem,
} from "@/app/nex-native/cover/layouts";

// Owner directive 2026-10-22 · persist menu-item adds into the
// production cart key (nex_cart_v1) so the CoverCartButton in every
// shop template cover (src/app/nex-native/cover/layouts.tsx) picks
// them up on its next refresh. Prototype → prod bridge: writes the
// same NexCartItem shape the real cart-service expects, scoped to
// the current brand so each shop keeps its own line items.
function persistMenuItemToCart(
  entry: MarketplaceCatalogEntry,
  productId: string,
  qty: number,
): void {
  if (typeof window === "undefined") return;
  const brandMock =
    entry.themeId === "crispy-chicken" ? CRISPY_CHICKEN_MOCK : null;
  if (!brandMock) return;
  const product = brandMock.products.find((p) => p.id === productId);
  if (!product) return;
  try {
    const raw = window.localStorage.getItem("nex_cart_v1");
    const parsed = raw
      ? (JSON.parse(raw) as {
          items?: Array<{ key?: string; quantity?: number; shop_id?: string }>;
          [key: string]: unknown;
        })
      : { items: [] };
    const items = Array.isArray(parsed.items) ? [...parsed.items] : [];
    const key = `${entry.themeId}:${product.id}`;
    const existingIdx = items.findIndex((i) => i?.key === key);
    if (existingIdx >= 0) {
      const existing = items[existingIdx];
      items[existingIdx] = {
        ...existing,
        quantity: (existing?.quantity ?? 1) + qty,
      };
    } else {
      items.push({
        key,
        kind: "menu_item",
        id: product.id,
        shop_id: entry.themeId,
        shop_slug: entry.themeId,
        shop_owner_account_id: `prototype-owner-${entry.themeId}`,
        shop_display_name: entry.displayName,
        name: product.name,
        price_pence: product.price_pence,
        currency: product.currency,
        image_url: product.image_url ?? null,
        quantity: qty,
        variants: [],
        added_at: Date.now(),
      } as Record<string, unknown>);
    }
    const next = { ...parsed, items };
    window.localStorage.setItem("nex_cart_v1", JSON.stringify(next));
    // Nudge same-window listeners (storage event only fires across
    // tabs). CoverCartButton listens for storage AND focus · we
    // dispatch a synthetic storage event here so iframe + parent
    // consumers refresh immediately.
    try {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "nex_cart_v1",
          newValue: JSON.stringify(next),
        }),
      );
    } catch {
      /* StorageEvent constructor missing · older webviews · fall through */
    }
  } catch {
    /* storage denied · prototype cart stays session-only */
  }
}

// Owner directive 2026-10-22 · diamond-standard preload pass · while
// a viewer sits on the Theme or Intro sheet, warm the browser cache
// for the first Shop iframe URL so tapping into the Shop preview
// paints instantly instead of blank-then-fill. Hidden <link rel=
// "prefetch"> is additive · if the browser ignores it (older iOS)
// nothing breaks · the sheet behaves exactly as before.
function useShopIframePrefetch(entry: MarketplaceCatalogEntry): void {
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const firstLayout = SHOP_LAYOUTS[0];
    if (!firstLayout) return;
    const params = new URLSearchParams({
      embed: "1",
      theme: entry.themeId,
      tint: entry.ownerAccentHex ?? entry.accentHex,
      bg: entry.wallpaperUrl,
      brand: entry.themeId,
    });
    const href = `/nex-native/cover/preview/${firstLayout.layoutId}?${params.toString()}`;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = href;
    link.setAttribute("data-nex-marketplace-shop-prefetch", entry.themeId);
    document.head.appendChild(link);
    return () => {
      try {
        document.head.removeChild(link);
      } catch {
        /* link already removed · idempotent cleanup */
      }
    };
  }, [
    entry.themeId,
    entry.ownerAccentHex,
    entry.accentHex,
    entry.wallpaperUrl,
  ]);
}

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

  // Diamond preload · prefetch the first Shop layout iframe so Shop tab
  // paints instantly if the viewer taps across from Theme preview.
  useShopIframePrefetch(entry);

  // Owner directive 2026-10-22 · "add the keypad to themes chat so
  // user can type few words and see it live on the screen". Tap the
  // composer input → sealed JokerKeypad opens in the theme accent →
  // user types → the typed value shows live in the composer pill ·
  // Send drops the typed message as a NEW self bubble so the user
  // sees it alongside the two preset sample bubbles.
  const themeAccent = entry.ownerAccentHex ?? entry.accentHex;
  const [composerValue, setComposerValue] = React.useState("");
  const [keypadOpen, setKeypadOpen] = React.useState(false);
  const [userBubbles, setUserBubbles] = React.useState<
    Array<{ id: string; text: string; time: string }>
  >([]);

  const nowHHmm = React.useCallback((): string => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }, []);

  const handleThemeSend = React.useCallback(() => {
    const trimmed = composerValue.trim();
    if (!trimmed) return;
    setUserBubbles((prev) => [
      ...prev,
      {
        id: `theme-preview-msg-${Date.now()}`,
        text: trimmed,
        time: nowHHmm(),
      },
    ]);
    setComposerValue("");
    setKeypadOpen(false);
  }, [composerValue, nowHHmm]);

  // Owner directive 2026-10-22 · Shop/Menu drawer · opens when the
  // buyer taps the right-dock Shop button in the chat theme preview.
  // Reads the sealed brand mock directly and reuses `MenuItemSheet`
  // for item taps (same qty picker · Add to Cart · wallpaper hero).
  const [menuDrawerOpen, setMenuDrawerOpen] = React.useState(false);
  // Owner directive 2026-10-22 · live status viewer · when the brand
  // has a published status (`entry.liveStatus`), a green rim dot
  // sits on the chat-header avatar and tapping the avatar opens
  // the StatusSheet · once viewed, the rim dims to grey (seen).
  // Local-state only · no persistence · in production this would
  // store `last_seen_status_at` per account.
  const hasActiveStatus = Boolean(entry.liveStatus);
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [statusSeen, setStatusSeen] = React.useState(false);
  const openStatus = React.useCallback(() => {
    if (!entry.liveStatus) return;
    setStatusOpen(true);
    setStatusSeen(true);
  }, [entry.liveStatus]);

  // Local menu-cart counter · when the buyer taps Add to Cart in the
  // MenuItemSheet (inside the drawer), the right-dock Cart badge
  // ticks up. This counter represents in-shop menu orders · it is
  // distinct from the outer marketplace cart (which tracks themes /
  // intros / shops as PURCHASED PRODUCTS, not food orders).
  // Prototype only · no persistence · demo of the end-state buyer
  // flow a published Crispy Chicken shop would show.
  const [menuCartCount, setMenuCartCount] = React.useState(0);
  const [menuCartToast, setMenuCartToast] = React.useState<string | null>(
    null,
  );
  // Owner directive 2026-10-22 · right-dock Cart button now opens the
  // SAME shared drawer the shop template cart icon uses · one cart
  // system, one slider across both surfaces. Items + delivery footer
  // read from nex_cart_v1 so additions from the menu drawer and the
  // shop iframe appear in the same place.
  const [chatCartOpen, setChatCartOpen] = React.useState(false);
  const [chatCartItems, setChatCartItems] = React.useState<
    CoverCartLineItem[]
  >([]);
  const refreshChatCart = React.useCallback(() => {
    setChatCartItems(readCartItems());
  }, []);
  React.useEffect(() => {
    refreshChatCart();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "nex_cart_v1") refreshChatCart();
    };
    const onFocus = () => refreshChatCart();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshChatCart]);
  const chatCartQty = chatCartItems.reduce((acc, i) => acc + i.quantity, 0);

  const handleMenuAdd = React.useCallback(
    (productId: string, qty: number) => {
      // Owner directive 2026-10-22 · persist to nex_cart_v1 so the
      // cover template's CoverCartButton + drawer show the counter.
      // In-component menuCartCount stays as a local right-dock badge.
      persistMenuItemToCart(entry, productId, qty);
      setMenuCartCount((prev) => prev + qty);
      setMenuCartToast(
        qty > 1
          ? `Added ${qty} to Cart`
          : "Added to Cart",
      );
    },
    [entry],
  );

  // Toast auto-dismiss.
  React.useEffect(() => {
    if (!menuCartToast) return;
    const t = window.setTimeout(() => setMenuCartToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [menuCartToast]);

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
        {/* Profile avatar · 48×48 · themed accent fill + ping ring
            behind · owner directive 2026-10-22 · now tappable to
            open the live-status viewer when the brand has an active
            status · green rim dot (unseen) → grey rim dot (seen)
            → no dot (no status). */}
        <button
          type="button"
          onClick={openStatus}
          disabled={!hasActiveStatus}
          aria-label={
            hasActiveStatus
              ? statusSeen
                ? `${entry.displayName} · view status (seen)`
                : `${entry.displayName} · view new status`
              : entry.displayName
          }
          data-nex-marketplace-prototype-theme-chat-header-avatar
          data-nex-marketplace-prototype-theme-chat-header-online={
            entry.online !== false ? "true" : "false"
          }
          data-nex-marketplace-prototype-theme-chat-header-status={
            hasActiveStatus
              ? statusSeen
                ? "seen"
                : "unseen"
              : "none"
          }
          style={{
            position: "relative",
            flexShrink: 0,
            width: 48,
            height: 48,
            padding: 0,
            borderRadius: "50%",
            background: "transparent",
            border: "none",
            cursor: hasActiveStatus ? "pointer" : "default",
            fontFamily: "inherit",
            WebkitTapHighlightColor: "transparent",
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
          <span
            aria-hidden
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
          </span>
          {hasActiveStatus && (
            <span
              aria-hidden
              data-nex-marketplace-prototype-theme-chat-header-status-dot
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: statusSeen
                  ? "rgba(255, 255, 255, 0.35)"
                  : "#16D66B",
                border: "2px solid rgba(2, 9, 20, 0.95)",
                boxShadow: statusSeen
                  ? "none"
                  : "0 0 10px -1px rgba(22, 214, 107, 0.9)",
                pointerEvents: "none",
              }}
            />
          )}
        </button>
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
          // Owner directive 2026-10-22 · right-side action dock (shop ·
          // cart · live) sits inside the chat area. Right padding
          // bumped from 14 → 72 so chat bubbles stop short of the
          // dock and the layout reads as a two-column chat + action
          // rail.
          padding:
            "calc(env(safe-area-inset-top, 0px) + 84px) 72px calc(env(safe-area-inset-bottom, 0px) + 240px) 14px",
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
        {/* Owner directive 2026-10-22 · live-typed bubbles · each time
            the user hits Send in the keypad, a new self bubble lands
            here with the themed glass + accent. Lets the buyer feel
            exactly how their own messages will read inside this
            theme. */}
        {userBubbles.map((msg) => (
          <Bubble
            key={msg.id}
            time={msg.time}
            accent={entry.customerAccentHex ?? entry.accentHex}
            rimPx={entry.rimPx}
          >
            {msg.text}
          </Bubble>
        ))}
      </section>

      {/* Owner directive 2026-10-22 · right-side action dock · shown
          as the layout a buyer sees once the business owner has
          purchased + activated their shop inside this chat theme.
          Three stacked themed buttons · Shop · Cart · Live status.
          Pulse ring on the Live button broadcasts online presence
          using the sealed ping pattern (same keyframe as the header
          avatar). All three buttons use the theme accent so the
          dock reads as part of the brand surface. */}
      <style>{`
        @keyframes nex-mp-theme-dock-live-pulse {
          0%   { transform: scale(0.9); opacity: 0.85; }
          70%  { transform: scale(1.9); opacity: 0;    }
          100% { transform: scale(1.9); opacity: 0;    }
        }
      `}</style>
      <aside
        data-nex-marketplace-prototype-theme-chat-right-dock
        aria-label="Shop · Cart · Live status"
        style={{
          // Owner directive 2026-10-22 · dock sits centred on the
          // sheet height · translate up by half the dock's own
          // height so the middle button (Cart) lines up with the
          // vertical centre of the chat area.
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 2,
        }}
      >
        {/* Shop · opens the shop menu (future · prototype just
            toasts). Icon = restaurant-style fork+knife + spoon so a
            food business reads as a menu, not a generic shop. */}
        <DockButton
          accent={themeAccent}
          label="Shop · menu"
          onClick={() => setMenuDrawerOpen(true)}
          data-nex-marketplace-prototype-theme-dock-shop
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
            {/* fork · 3 tines + handle */}
            <path d="M7 2v7a2 2 0 0 0 2 2v11" />
            <path d="M11 2v9" />
            <path d="M15 2v9" />
            {/* spoon */}
            <path d="M18 2a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3v10" />
          </svg>
        </DockButton>

        {/* Owner directive 2026-10-22 · Cart · opens the SAME shared
            CoverCartDrawer the shop template cart icon uses · one
            cart system, one slider. Count reads from nex_cart_v1 so
            adds from the menu drawer and from the shop iframe show
            up in the same place. */}
        <DockButton
          accent={themeAccent}
          label={`Cart · ${chatCartQty} item${chatCartQty === 1 ? "" : "s"}`}
          onClick={() => setChatCartOpen(true)}
          badge={chatCartQty > 0 ? chatCartQty : null}
          data-nex-marketplace-prototype-theme-dock-cart
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
        </DockButton>

        {/* Owner directive 2026-10-22 · Live status DockButton
            retired · the status affordance moved to the chat-header
            avatar (tap profile picture · green rim dot broadcasts
            unseen content). Dock now holds only Shop + Cart. */}
      </aside>

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
            Theme Price idr 25.000 · once
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
          {/* Owner directive 2026-10-22 · tappable composer input ·
              opens the sealed JokerKeypad in the theme accent · the
              typed value renders live here (replaces the "Message"
              placeholder when non-empty). */}
          <button
            type="button"
            onClick={() => setKeypadOpen(true)}
            aria-label="Open keypad"
            data-nex-marketplace-prototype-theme-chat-input
            style={{
              flex: 1,
              minHeight: 32,
              display: "flex",
              alignItems: "center",
              padding: "0 4px",
              fontSize: 16,
              color: composerValue
                ? "#FFFFFF"
                : "rgba(255, 255, 255, 0.52)",
              background: "transparent",
              border: "none",
              fontFamily: "inherit",
              lineHeight: 1.2,
              textAlign: "left",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {composerValue || "Message"}
          </button>
          <button
            type="button"
            onClick={handleThemeSend}
            disabled={!composerValue.trim()}
            aria-label="Send"
            data-nex-marketplace-prototype-theme-chat-send
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: entry.ownerAccentHex ?? entry.accentHex,
              color: "#FFFFFF",
              border: "none",
              cursor: composerValue.trim() ? "pointer" : "default",
              opacity: composerValue.trim() ? 1 : 0.55,
              fontFamily: "inherit",
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 4px 10px -4px ${
                entry.ownerAccentHex ?? entry.accentHex
              }`,
              WebkitTapHighlightColor: "transparent",
              transition: "opacity 150ms ease",
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

      {/* Owner directive 2026-10-22 · sealed JokerKeypad mounted so
          the buyer can type a few words and feel how the theme
          colours the input, keys, and accents in real time. Accent
          follows the theme's owner-colour · same primitive the
          chat-standard + free-chat surfaces use. Preview-only · Send
          creates a new self bubble above (no network / no DB). */}
      <JokerKeypad
        open={keypadOpen}
        value={composerValue}
        onChange={setComposerValue}
        onSend={handleThemeSend}
        onClose={() => setKeypadOpen(false)}
        accentColor={themeAccent}
      />
      {/* Owner directive 2026-10-22 · mobile-first keypad width on
          desktop · the sealed JokerKeypad is `position: fixed` and
          by default spans the full browser viewport, which visibly
          escapes the sealed 420×909 phone frame on desktop. This
          scoped style block clamps the keypad to the frame width
          (same breakpoint as the free-chat composer's iteration-50
          clamp at `nex-native.css` line 214 / 420px frame). Mobile
          viewports (<500px) stay untouched because the frame IS
          the viewport there. Scoped to this preview surface so no
          other keypad consumer is affected. */}
      {keypadOpen && (
        <style>{`
          @media (min-width: 500px) {
            [data-nex-joker-keypad] {
              left: 0 !important;
              right: 0 !important;
              max-width: 420px !important;
              margin: 0 auto !important;
              border-bottom-left-radius: 44px !important;
              border-bottom-right-radius: 44px !important;
            }
          }
        `}</style>
      )}

      {/* Owner directive 2026-10-22 · shared cart drawer · opens
          when the right-dock Cart button is tapped. Same drawer the
          shop template uses · one cart system, one slider across
          both surfaces. themeAccent passed through so the drawer
          renders in the current brand accent even outside a
          theme-skin wrapper. */}
      {chatCartOpen && (
        <CoverCartDrawer
          items={chatCartItems}
          onClose={() => setChatCartOpen(false)}
          onRefresh={refreshChatCart}
          themeAccent={themeAccent}
        />
      )}

      {/* Owner directive 2026-10-22 · menu drawer · rises from the
          bottom when the buyer taps the right-dock Shop button.
          Reads the sealed brand mock · reuses MenuItemSheet when a
          card is tapped. */}
      {menuDrawerOpen && (
        <MenuDrawer
          brand={entry.themeId}
          accent={themeAccent}
          wallpaperUrl={entry.wallpaperUrl}
          onItemAdd={handleMenuAdd}
          onItemAskSeller={(_productId) => {
            setMenuDrawerOpen(false);
            setMenuCartToast(
              "Ask Seller · prototype · product card will post into owner chat",
            );
          }}
          onClose={() => setMenuDrawerOpen(false)}
        />
      )}

      {/* Owner directive 2026-10-22 · menu-cart toast · same shape as
          the Shop preview's add-to-cart toast · lives in the Theme
          preview so the user sees confirmation when they Add to Cart
          from the menu drawer (which closes on add). */}
      {menuCartToast && (
        <div
          role="status"
          aria-live="polite"
          data-nex-marketplace-prototype-theme-cart-toast
          style={{
            position: "absolute",
            left: "50%",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 112px)",
            transform: "translateX(-50%)",
            padding: "10px 16px",
            borderRadius: 999,
            background: "rgba(2, 9, 20, 0.92)",
            color: NEX.text,
            fontSize: 12,
            fontWeight: 700,
            border: `1px solid ${hexWithAlpha(themeAccent, 0.5)}`,
            boxShadow: `0 12px 28px -8px rgba(0,0,0,0.7), 0 0 14px -4px ${hexWithAlpha(themeAccent, 0.6)}`,
            zIndex: 800,
            maxWidth: "calc(100% - 28px)",
            textAlign: "center",
          }}
        >
          {menuCartToast}
        </div>
      )}

      {/* Owner directive 2026-10-22 · live-status viewer · opens
          when the buyer taps the chat-header avatar (gated on
          `entry.liveStatus` being present). */}
      {statusOpen && entry.liveStatus && (
        <StatusSheet
          brand={entry.displayName}
          accent={themeAccent}
          wallpaperUrl={entry.wallpaperUrl}
          status={entry.liveStatus}
          onClose={() => setStatusOpen(false)}
        />
      )}
    </div>
  );
}

// Owner directive 2026-10-22 · shared right-side dock button · 44×44
// themed round chip · white glyph · optional red count badge · soft
// themed glow matching the detail-card + composer treatment.
function DockButton({
  children,
  accent,
  label,
  onClick,
  badge,
  livePulse,
  ...rest
}: {
  readonly children: React.ReactNode;
  readonly accent: string;
  readonly label: string;
  readonly onClick?: () => void;
  readonly badge?: number | null;
  /** Owner directive 2026-10-22 · when true, the button broadcasts
   *  that the owner has posted a live status (text or image) · a
   *  translucent green ring pulses behind the button + the icon
   *  itself turns green with a soft green glow. When false, the
   *  button stays themed-accent with a white icon. */
  readonly livePulse?: boolean;
} & Record<`data-${string}`, string | number | boolean | undefined>): React.JSX.Element {
  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
    >
      {/* Green pulse ring · emanates from behind the button when the
          owner has an active live status. */}
      {livePulse && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "#16D66B",
            animation:
              "nex-mp-theme-dock-live-pulse 1800ms ease-out infinite",
            pointerEvents: "none",
          }}
        />
      )}
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        {...rest}
        style={{
          position: "relative",
          width: 44,
          height: 44,
          padding: 0,
          borderRadius: "50%",
          background: accent,
          // Icon tints green when the owner has an active live
          // status; stays white otherwise. The SVG inside inherits
          // via `stroke="currentColor"` / `fill="currentColor"`.
          color: livePulse ? "#16D66B" : "#FFFFFF",
          border: "1px solid rgba(255, 255, 255, 0.22)",
          cursor: onClick ? "pointer" : "default",
          fontFamily: "inherit",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          WebkitTapHighlightColor: "transparent",
          boxShadow: livePulse
            ? `0 4px 12px -4px ${hexWithAlpha(accent, 0.7)}, 0 2px 4px rgba(0, 0, 0, 0.4), 0 0 14px -2px rgba(22, 214, 107, 0.85)`
            : `0 4px 12px -4px ${hexWithAlpha(accent, 0.7)}, 0 2px 4px rgba(0, 0, 0, 0.4)`,
        }}
      >
        {children}
        {badge && badge > 0 && (
          <span
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              width: 20,
              height: 20,
              padding: 0,
              borderRadius: "50%",
              background: "#8B0000",
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 900,
              lineHeight: "20px",
              textAlign: "center",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow:
                "0 0 0 2px rgba(2, 9, 20, 0.9), 0 2px 6px -2px rgba(139, 0, 0, 0.85)",
              pointerEvents: "none",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {badge}
          </span>
        )}
      </button>
    </span>
  );
}

// ─── Live-status viewer ──────────────────────────────────────────
//
// Owner directive 2026-10-22 · Instagram-stories / WhatsApp-status
// style sheet · opens when the buyer taps the chat-header avatar
// (gated on `entry.liveStatus` being present). Full-sheet backdrop
// so the buyer's focus is on the owner's post; tap outside, tap the
// × close, or press Esc to dismiss.

function StatusSheet({
  brand,
  accent,
  wallpaperUrl,
  status,
  onClose,
}: {
  readonly brand: string;
  readonly accent: string;
  readonly wallpaperUrl?: string | null;
  readonly status: {
    readonly text: string;
    readonly imageUrl?: string;
    readonly postedAt: string;
  };
  readonly onClose: () => void;
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
      role="dialog"
      aria-modal="true"
      aria-label={`${brand} · live status`}
      data-nex-marketplace-prototype-theme-status-sheet
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 750,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close status"
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(2, 9, 20, 0.78)",
          backdropFilter: "blur(8px) saturate(140%)",
          WebkitBackdropFilter: "blur(8px) saturate(140%)",
          border: "none",
          cursor: "pointer",
          padding: 0,
          margin: 0,
        }}
      />
      <section
        data-nex-marketplace-prototype-theme-status-sheet-panel
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 360,
          maxHeight: "calc(100% - 36px)",
          overflow: "hidden",
          borderRadius: 20,
          background: wallpaperUrl
            ? `
              linear-gradient(180deg, rgba(5, 13, 24, 0.72) 0%, rgba(5, 13, 24, 0.88) 60%, rgba(5, 13, 24, 0.95) 100%),
              url("${wallpaperUrl}") center / cover no-repeat,
              #07131F
            `
            : "#07131F",
          border: `1px solid ${hexWithAlpha(accent, 0.55)}`,
          boxShadow: `0 20px 48px -16px rgba(0, 0, 0, 0.75), 0 0 24px -8px ${hexWithAlpha(accent, 0.55)}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 14px 10px",
            borderBottom: `1px solid rgba(255, 255, 255, 0.08)`,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: accent,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              Live status
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 15,
                fontWeight: 900,
                color: NEX.text,
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textShadow: "0 1px 3px rgba(0, 0, 0, 0.6)",
              }}
            >
              {brand}
            </div>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255, 255, 255, 0.68)",
              flexShrink: 0,
              textShadow: "0 1px 3px rgba(0, 0, 0, 0.55)",
            }}
          >
            {status.postedAt}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30,
              height: 30,
              padding: 0,
              borderRadius: "50%",
              background: "#000000",
              color: "#FFFFFF",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              fontSize: 18,
              fontWeight: 900,
              lineHeight: 1,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              WebkitTapHighlightColor: "transparent",
              boxShadow: "0 4px 10px -4px rgba(0, 0, 0, 0.65)",
            }}
          >
            ×
          </button>
        </header>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {status.imageUrl && (
            <div
              style={{
                width: "100%",
                aspectRatio: "4 / 3",
                borderRadius: 14,
                background: `url("${status.imageUrl}") center / cover no-repeat, ${NEX.bg}`,
                border: `1px solid ${hexWithAlpha(accent, 0.4)}`,
              }}
              aria-hidden
            />
          )}
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.55,
              color: NEX.text,
              textShadow: "0 1px 3px rgba(0, 0, 0, 0.5)",
            }}
          >
            {status.text}
          </p>
        </div>
      </section>
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

  // Diamond preload · prefetch the first Shop layout iframe so Shop tab
  // paints instantly if the viewer taps across from Intro preview.
  useShopIframePrefetch(entry);

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
            Intro Price idr 99.000 · once
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
  cartCount,
  onCartClick,
  onAddToCart,
  onClose,
}: {
  readonly entry: MarketplaceCatalogEntry;
  readonly inCartKeys: ReadonlySet<string>;
  readonly cartCount: number;
  readonly onCartClick: () => void;
  readonly onAddToCart: (layoutId: string) => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  // Owner directive 2026-10-21 · Shop preview rebuilt to the Theme +
  // Intro full-bleed shape · chat-style business header at top ·
  // iframe swipe deck fills the entire sheet · dots indicator + a
  // themed detail card at the bottom (layout name + Shop Price +
  // themed Close + themed Add to Cart).
  const [index, setIndex] = React.useState(0);
  // Owner directive 2026-10-22 · info modal · when the ⓘ button is
  // tapped a center panel explains what the shopper can customise
  // after they purchase the template. Reduces pre-purchase
  // uncertainty · same list across every brand because every shop
  // template exposes the same editable fields.
  const [infoOpen, setInfoOpen] = React.useState(false);
  // Owner directive 2026-10-22 · menu-item sheet · opens when a
  // product tap arrives via postMessage from the sealed cover-
  // preview iframe (BrandTapBridge). State carries the tapped
  // product id · the sheet pulls the full product record from the
  // brand mock and renders qty picker + Add to Order.
  const [tappedProductId, setTappedProductId] = React.useState<string | null>(null);
  const [orderToast, setOrderToast] = React.useState<string | null>(null);

  const total = SHOP_LAYOUTS.length;
  const current = SHOP_LAYOUTS[index];
  const currentKey = cartKey({
    themeId: entry.themeId,
    productType: "shop",
    shopLayoutId: current.layoutId,
  });
  const currentInCart = inCartKeys.has(currentKey);
  const themeAccent = entry.ownerAccentHex ?? entry.accentHex;

  const goTo = React.useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(total - 1, next)));
    },
    [total],
  );
  const goPrev = React.useCallback(() => goTo(index - 1), [goTo, index]);
  const goNext = React.useCallback(() => goTo(index + 1), [goTo, index]);

  // Owner directive 2026-10-21 · each shop template must be fully
  // interactive · users scroll vertically, tap category toggles,
  // open sections, etc. inside the live sealed cover preview. That
  // means the iframe captures its own pointer events · the whole-
  // sheet horizontal swipe gesture is retired · layout navigation
  // happens through the explicit prev / next arrow buttons (and the
  // keyboard ←/→ arrows for desktop).
  //
  // Theme pass-through · the iframe loads the sealed cover-preview
  // page with `theme`, `tint` + `bg` query params so each entry's
  // shop renders with its own chat theme (Crispy Chicken wallpaper
  // for Crispy Chicken, Pink Dream wallpaper for Pink Dream, etc).
  const iframeSrc = React.useMemo(() => {
    const params = new URLSearchParams({
      embed: "1",
      theme: entry.themeId,
      tint: entry.ownerAccentHex ?? entry.accentHex,
      bg: entry.wallpaperUrl,
      // Owner directive 2026-10-22 · pass the chat theme id as the
      // brand key so the sealed cover-preview can swap in a brand-
      // fit mock (Crispy Chicken → Burgers / Chicken / Meal Deals).
      // Themes without a registered brand mock fall through to the
      // sealed MARIA_MOCK silently.
      brand: entry.themeId,
    });
    return `/nex-native/cover/preview/${current.layoutId}?${params.toString()}`;
  }, [
    current.layoutId,
    entry.themeId,
    entry.ownerAccentHex,
    entry.accentHex,
    entry.wallpaperUrl,
  ]);

  // Keyboard · Esc closes · ← / → navigate the deck.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goPrev, goNext, onClose]);

  // Owner directive 2026-10-22 · listen for product taps forwarded
  // from the sealed cover-preview iframe (BrandTapBridge). Only
  // react when the message's brand matches this entry · belt + braces
  // against unrelated postMessage traffic.
  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as unknown;
      if (
        data &&
        typeof data === "object" &&
        (data as { type?: unknown }).type ===
          "nex-marketplace:product-tap" &&
        (data as { brand?: unknown }).brand === entry.themeId &&
        typeof (data as { productId?: unknown }).productId === "string"
      ) {
        setTappedProductId(
          (data as { productId: string }).productId,
        );
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [entry.themeId]);

  // Owner directive 2026-10-22 · when the cart drawer opens inside
  // the iframe (CoverCartDrawer in cover/layouts.tsx) it posts
  // "nex-cover:cart-drawer-visibility". We hide the info button +
  // detail card + layout nav so the buyer sees a clean theme behind
  // the drawer instead of these outer overlays bleeding through.
  const [coverCartDrawerOpen, setCoverCartDrawerOpen] =
    React.useState<boolean>(false);
  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as unknown;
      if (
        data &&
        typeof data === "object" &&
        (data as { type?: unknown }).type ===
          "nex-cover:cart-drawer-visibility" &&
        typeof (data as { open?: unknown }).open === "boolean"
      ) {
        setCoverCartDrawerOpen(Boolean((data as { open: boolean }).open));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Auto-dismiss the honest Add-to-Order toast after 2.4s so it
  // doesn't linger over the shop template.
  React.useEffect(() => {
    if (!orderToast) return;
    const t = setTimeout(() => setOrderToast(null), 2400);
    return () => clearTimeout(t);
  }, [orderToast]);

  return (
    <div
      data-nex-marketplace-prototype-sheet
      data-nex-marketplace-prototype-sheet-variant="shop-fullbleed"
      role="dialog"
      aria-modal="true"
      aria-label={`${entry.displayName} Shop`}
      style={{
        // Owner directive 2026-10-22 · sheet background is flat NEX
        // navy · the sealed CoverPage still applies its 20px side
        // padding inside each shop template, so a wallpaper backdrop
        // would show as a visible strip in those gutters. Navy blends
        // the gutter into NEX chrome so the shop template reads as
        // full width to the viewer.
        position: "absolute",
        inset: 0,
        zIndex: 500,
        background: NEX.bg,
        overflow: "hidden",
      }}
    >
      {/* Full-bleed interactive iframe · owner directive 2026-10-21
          · pointer events pass through so users can scroll + tap
          category toggles inside the live sealed cover preview.
          Horizontal swipe navigation is retired · layouts change
          via the dots indicator (and keyboard ←/→). */}
      <iframe
        key={current.layoutId}
        src={iframeSrc}
        title={`${current.label} shop cover preview`}
        data-nex-marketplace-prototype-shop-iframe={current.layoutId}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "none",
          backgroundColor: "transparent",
          zIndex: 0,
        }}
      />

      {/* Owner directive 2026-10-22 · info button · owner-facing hint
          for first-time shop setup ("What you can customise"). Moved
          down from the top-right header so the universal cart icon
          (CoverCartButton in cover/layouts.tsx) owns the top-right
          slot across every shop template. Sits below the shop's
          identity badge so it doesn't overlap the cart or compete
          with the header actions. Future gating: hide for returning
          owners / non-owners once we wire shop-setup state. */}
      {!coverCartDrawerOpen && (
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          aria-label="What you can customise with this template"
          data-nex-marketplace-prototype-shop-info-btn
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0px) + 170px)",
            right: 22,
            width: 28,
            height: 28,
            padding: 0,
            borderRadius: "50%",
            background: "#000000",
            color: "#DC2626",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            fontSize: 16,
            fontWeight: 900,
            lineHeight: 1,
            fontStyle: "italic",
            fontFamily: "'Times New Roman', Georgia, serif",
            cursor: "pointer",
            zIndex: 3,
            WebkitTapHighlightColor: "transparent",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            // Under-glow · soft red halo sits beneath the chip so the
            // info icon reads as hot but the chip body stays matte
            // black on top of the shop wallpaper.
            boxShadow:
              "0 5px 10px -2px rgba(220, 38, 38, 0.4), 0 2px 4px rgba(0, 0, 0, 0.5)",
          }}
        >
          i
        </button>
      )}

      {/* Owner directive 2026-10-22 · info modal · center panel over
          the shop preview · explains everything a buyer can edit
          after purchase. Dismiss via Close button, backdrop tap, or
          Esc. */}
      {infoOpen && (
        <ShopInfoModal
          brand={entry.displayName}
          brandId={entry.themeId}
          accent={themeAccent}
          onClose={() => setInfoOpen(false)}
        />
      )}

      {/* Owner directive 2026-10-22 · prev / next layout navigation ·
          high-quality compact badge · chevron-left + center counter
          + chevron-right · themed rim + glow matches the detail
          card. Floats top-centre of the sheet. Hidden while the cart
          drawer is open so the buyer sees a clean shop template behind
          the drawer. */}
      {!coverCartDrawerOpen && (
      <div
        data-nex-marketplace-prototype-shop-nav
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 12px)",
          left: "50%",
          transform: "translateX(-50%)",
          display: "inline-flex",
          alignItems: "center",
          padding: "3px 4px",
          borderRadius: 999,
          background: "rgba(2, 9, 20, 0.82)",
          border: `1px solid ${hexWithAlpha(themeAccent, 0.5)}`,
          backdropFilter: "blur(14px) saturate(160%)",
          WebkitBackdropFilter: "blur(14px) saturate(160%)",
          zIndex: 3,
          pointerEvents: "auto",
          boxShadow: `0 8px 20px -8px rgba(0, 0, 0, 0.7), 0 0 16px -4px ${hexWithAlpha(themeAccent, 0.55)}, inset 0 1px 0 rgba(255, 255, 255, 0.08)`,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <button
          type="button"
          onClick={goPrev}
          disabled={index === 0}
          aria-label="Previous layout"
          data-nex-marketplace-prototype-shop-prev
          style={{
            width: 30,
            height: 30,
            padding: 0,
            borderRadius: "50%",
            background: index === 0 ? "transparent" : `${hexWithAlpha(themeAccent, 0.12)}`,
            color:
              index === 0 ? "rgba(255, 255, 255, 0.25)" : "#FFFFFF",
            border: "none",
            cursor: index === 0 ? "default" : "pointer",
            fontFamily: "inherit",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
            transition: "background 150ms ease",
          }}
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 3,
            padding: "0 10px",
            minWidth: 48,
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: themeAccent,
              letterSpacing: "-0.01em",
              lineHeight: 1,
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(255, 255, 255, 0.4)",
              lineHeight: 1,
            }}
          >
            /
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(255, 255, 255, 0.65)",
              lineHeight: 1,
            }}
          >
            {String(total).padStart(2, "0")}
          </span>
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={index === total - 1}
          aria-label="Next layout"
          data-nex-marketplace-prototype-shop-next
          style={{
            width: 30,
            height: 30,
            padding: 0,
            borderRadius: "50%",
            background:
              index === total - 1
                ? "transparent"
                : `${hexWithAlpha(themeAccent, 0.12)}`,
            color:
              index === total - 1
                ? "rgba(255, 255, 255, 0.25)"
                : "#FFFFFF",
            border: "none",
            cursor: index === total - 1 ? "default" : "pointer",
            fontFamily: "inherit",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
            transition: "background 150ms ease",
          }}
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
      )}

      {/* Owner directive 2026-10-21 · floating details card restored
          · same shape as Theme + Intro · themed rim + outer glow ·
          layout name + Shop Price + themed Close + Add to Cart in
          theme accent · red cart-count badge on the Add to Cart
          button so the shopper always sees how many items are
          already in the cart. Hidden while cart drawer is open so
          the buyer sees a clean theme behind the drawer. */}
      {!coverCartDrawerOpen && (
      <aside
        data-nex-marketplace-prototype-shop-detail-card
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
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
          zIndex: 3,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
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
              textOverflow: "ellipsis",
            }}
          >
            Shop Price idr 99.000 /mo
          </h2>
          <span
            data-nex-marketplace-prototype-shop-counter
            style={{
              flexShrink: 0,
              fontSize: 10,
              fontWeight: 700,
              color: NEX.textMute,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            {index + 1} / {total}
          </span>
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
            onClick={() => onAddToCart(current.layoutId)}
            disabled={currentInCart}
            data-nex-marketplace-prototype-add-to-cart="shop"
            data-nex-marketplace-prototype-add-to-cart-layout={current.layoutId}
            style={{
              position: "relative",
              minHeight: 40,
              padding: "0 14px",
              borderRadius: 10,
              background: currentInCart ? NEX.green : themeAccent,
              color: currentInCart ? "#042416" : "#FFFFFF",
              border: "none",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 0.3,
              textShadow: currentInCart
                ? "none"
                : "0 1px 3px rgba(0, 0, 0, 0.55)",
              boxShadow: currentInCart
                ? "none"
                : `0 6px 16px -6px ${hexWithAlpha(themeAccent, 0.75)}`,
              cursor: currentInCart ? "default" : "pointer",
              fontFamily: "inherit",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {currentInCart ? "✓ Added to Cart" : "Add to Cart"}
            {cartCount > 0 && (
              <span
                data-nex-marketplace-prototype-shop-add-to-cart-badge
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  minWidth: 20,
                  height: 20,
                  padding: "0 5px",
                  borderRadius: 999,
                  background: "#DC2626",
                  color: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: 900,
                  lineHeight: "20px",
                  textAlign: "center",
                  boxShadow:
                    "0 0 0 2px rgba(2, 9, 20, 0.9), 0 0 10px -2px rgba(220, 38, 38, 0.8)",
                  pointerEvents: "none",
                }}
              >
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </aside>
      )}

      {/* Owner directive 2026-10-22 · menu-item bottom sheet · opens
          when a product tap arrives from the sealed iframe. Only
          rendered when a tapped product id is set. Ask-Seller slice
          1 · onAskSeller surfaces an honest prototype toast · wires
          to shareProductToContactAction + ?pending_product=<id> in
          the production ShopPreviewSheet mount. */}
      {tappedProductId && (
        <MenuItemSheet
          brand={entry.themeId}
          productId={tappedProductId}
          accent={themeAccent}
          wallpaperUrl={entry.wallpaperUrl}
          onClose={() => setTappedProductId(null)}
          onAdd={(productId, qty) => {
            // Owner directive 2026-10-22 · persist to nex_cart_v1
            // so the shop template's CoverCartButton + drawer show
            // the count. Writes a NexCartItem-shape row scoped to
            // this brand.
            persistMenuItemToCart(entry, productId, qty);
            setTappedProductId(null);
            setOrderToast(
              qty > 1
                ? `Added ${qty} to Cart`
                : "Added to Cart",
            );
          }}
          onAskSeller={(_productId) => {
            setTappedProductId(null);
            setOrderToast(
              "Ask Seller · prototype · product card will post into owner chat",
            );
          }}
        />
      )}

      {/* Honest add-to-order toast · the prototype does NOT track
          menu-item orders · this is a UX preview. */}
      {orderToast && (
        <div
          role="status"
          aria-live="polite"
          data-nex-marketplace-prototype-shop-order-toast
          style={{
            position: "absolute",
            left: "50%",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 100px)",
            transform: "translateX(-50%)",
            padding: "10px 16px",
            borderRadius: 999,
            background: "rgba(2, 9, 20, 0.92)",
            color: NEX.text,
            fontSize: 12,
            fontWeight: 700,
            border: `1px solid ${hexWithAlpha(themeAccent, 0.5)}`,
            boxShadow: `0 12px 28px -8px rgba(0,0,0,0.7), 0 0 14px -4px ${hexWithAlpha(themeAccent, 0.6)}`,
            zIndex: 800,
            maxWidth: "calc(100% - 28px)",
            textAlign: "center",
          }}
        >
          {orderToast}
        </div>
      )}
    </div>
  );
}

// ─── Shop info modal ─────────────────────────────────────────────
//
// Owner directive 2026-10-22 · pre-purchase "what you can customise"
// panel · surfaces every editable field the shop template exposes
// so the buyer knows exactly what they can rewrite / upload once
// they own the template. Mirrors the live edit surface planned for
// Phase 2 (seller backend editor).

function ShopInfoModal({
  brand,
  brandId,
  accent,
  onClose,
}: {
  readonly brand: string;
  readonly brandId: string;
  readonly accent: string;
  readonly onClose: () => void;
}): React.JSX.Element {
  // Owner directive 2026-10-22 · the Phase 2 editor was replaced
  // by the focused "My Shop" surface which handles products end-to-
  // end (name · price · photo · spice · promo · discount · delivery).
  // Only Crispy Chicken is wired for the prototype · other brands
  // show a "coming soon" state so the panel never links to an
  // unbuilt page.
  const editorRoutes: Readonly<Record<string, string>> = {
    "crispy-chicken":
      "/nex-native/chat-themes-library/marketplace-prototype/my-shop/crispy-chicken",
  };
  const editorHref: string | null = editorRoutes[brandId] ?? null;
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Fields grouped by surface area so the buyer can skim and
  // understand coverage at a glance. Every bullet maps 1:1 to a
  // field on MockCoverContent (the sealed shop-template content
  // shape), so the Phase 2 editor can be scaffolded directly from
  // this list without copy drift.
  const groups: ReadonlyArray<{
    readonly title: string;
    readonly items: ReadonlyArray<string>;
  }> = [
    {
      title: "Identity",
      items: [
        "Business name + tagline",
        "Handle (@yourname) + NEX ID",
        "Logo portrait + hero wallpaper",
        "Country flag + online presence",
      ],
    },
    {
      title: "Menu",
      items: [
        "Category toggles (Burgers · Chicken · Meal Deals · Drinks)",
        "Add / rename / reorder categories",
        "Menu item name · price · description",
        "Upload a photo for every item",
        "In-stock · low-stock · sold-out",
      ],
    },
    {
      title: "Store info",
      items: [
        "Opening Hours (per day of the week)",
        "Address + Google Maps directions",
        "Social links (Instagram · TikTok · Facebook · WhatsApp)",
        "Accepted payment methods + QR code",
      ],
    },
    {
      title: "Story + extras",
      items: [
        "About us body · founder name · year established",
        "Services (dine-in · delivery · catering)",
        "Reviews from your customers",
        "Return policy · events / catering · FAQ",
        "Gallery photos",
      ],
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`What you can customise with the ${brand} template`}
      data-nex-marketplace-prototype-shop-info-modal
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
    >
      {/* Backdrop · tap to dismiss. */}
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(2, 9, 20, 0.72)",
          backdropFilter: "blur(6px) saturate(140%)",
          WebkitBackdropFilter: "blur(6px) saturate(140%)",
          cursor: "pointer",
        }}
      />

      {/* Panel */}
      <div
        data-nex-marketplace-prototype-shop-info-panel
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 360,
          maxHeight: "calc(100% - 36px)",
          background: "#061222",
          border: `1px solid ${hexWithAlpha(NEX.cyan, 0.5)}`,
          borderRadius: 18,
          boxShadow: `0 24px 60px -16px rgba(0, 0, 0, 0.8), 0 0 24px -8px ${hexWithAlpha(NEX.cyan, 0.55)}`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: "14px 16px 10px",
            borderBottom: `1px solid rgba(255, 255, 255, 0.06)`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: NEX.cyan,
              color: "#021018",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 900,
              fontStyle: "italic",
              fontFamily: "'Times New Roman', Georgia, serif",
              lineHeight: 1,
              flexShrink: 0,
              boxShadow: `0 0 14px -4px ${hexWithAlpha(NEX.cyan, 0.8)}`,
            }}
          >
            i
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX.cyan,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              Your template · fully editable
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 14,
                fontWeight: 800,
                color: NEX.text,
                letterSpacing: "-0.005em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              What you can customise
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              padding: 0,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.06)",
              color: NEX.text,
              border: "none",
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            ×
          </button>
        </header>

        {/* Body · scrollable list */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "14px 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.5,
              color: NEX.textDim,
            }}
          >
            Once you purchase the <strong style={{ color: NEX.text }}>{brand}</strong> template,
            every section becomes yours to rewrite · upload your own photos,
            change the menu, update your hours — all from a single edit
            screen. The design stays locked, the content is all you.
          </p>

          {groups.map((g) => (
            <div
              key={g.title}
              data-nex-marketplace-prototype-shop-info-group={g.title}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: accent,
                  fontWeight: 800,
                }}
              >
                {g.title}
              </div>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {g.items.map((item) => (
                  <li
                    key={item}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      fontSize: 12,
                      lineHeight: 1.45,
                      color: NEX.text,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        flex: "0 0 auto",
                        width: 14,
                        height: 14,
                        marginTop: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: NEX.cyan,
                      }}
                    >
                      <svg
                        width={12}
                        height={12}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {editorHref ? (
            <a
              href={editorHref}
              data-nex-marketplace-prototype-shop-info-open-my-shop
              style={{
                marginTop: 4,
                padding: "12px 14px",
                borderRadius: 10,
                background: NEX.cyan,
                color: "#021018",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 0.3,
                textAlign: "center",
                textDecoration: "none",
                boxShadow: `0 6px 16px -6px ${hexWithAlpha(NEX.cyan, 0.75)}`,
              }}
            >
              Open My Shop →
            </a>
          ) : (
            <div
              style={{
                marginTop: 4,
                padding: "10px 12px",
                borderRadius: 10,
                background: hexWithAlpha(NEX.cyan, 0.08),
                border: `1px solid ${hexWithAlpha(NEX.cyan, 0.28)}`,
                fontSize: 11,
                lineHeight: 1.5,
                color: NEX.textDim,
              }}
            >
              My Shop for <strong style={{ color: NEX.text }}>{brand}</strong> ·
              coming soon. Crispy Chicken is the first wired brand ·
              others follow once their mock content is sealed.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
