"use client";

// src/components/nex-native/nex-feed/_seller-shop-drawer.tsx
//
// Owner-authorised 2026-11-01 · Social Commerce master build · Phase 8.
// --------------------------------------------------------------------
// Right-rail shop icon + slide-in Seller Shop Drawer for the NEX feed
// viewer. Shows the broadcaster's existing live products so a viewer
// can tap through to the product on their profile or start a product-
// specific chat with the seller.
//
// Owner spec rules honoured verbatim:
//   · Show the shop icon ONLY when the broadcaster has an eligible
//     active shop + ≥ 1 eligible published product · the server page
//     passes products=[] when there's nothing to show and the icon
//     returns null ("no dead buttons").
//   · Drawer slides in from the LEFT and preserves the current feed
//     position · it's a client-mounted overlay, viewer client state
//     (video playback) is untouched.
//   · Keep video playback running · we never pause / unmount the
//     viewer.
//   · Show seller profile + shop identity · header renders avatar +
//     display name + a "Visit Shop" link that routes to the sealed
//     /profile/<handle> page (shop = business + theme + layout per
//     Doctrine Decision D3 of 2026-11-01).
//   · Chat About This Product · each product row renders a chat icon
//     that routes to /nex-native/chat/peer/<accountId>?product=<id>.
//     Phase 10 will wire the chat prefill to read the `product` param
//     and auto-attach the sealed product snapshot (migration 059).
//     Zero-impact to Phase 10 if the receiver doesn't exist yet · the
//     plain chat route still works, prefill just skipped.
//   · Mobile safe areas · uses env(safe-area-inset-*).
//   · Existing NEX themes · all surfaces consume `var(--nex-world-*)`
//     tokens so Ireland deployment = Ireland green chrome, Worldwide
//     deployment = nex-original cyan, no per-country hardcoding.
//
// Honours the sealed Global Development Scope Rule 2026-11-01:
//   · Shared infra · applies to all country deployments + Worldwide.
//   · No new product / shop entity · uses existing nex_product +
//     nex_business + /profile/<handle> (sealed Doctrine D3).

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export interface SellerShopDrawerBroadcaster {
  readonly accountId: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly nexHandle: string | null;
}

export interface SellerShopDrawerProduct {
  readonly id: string;
  readonly name: string;
  readonly pricePence: number | null;
  readonly currency: string | null;
  readonly imageUrl: string | null;
}

export interface SellerShopDrawerProps {
  readonly broadcaster: SellerShopDrawerBroadcaster;
  readonly products: readonly SellerShopDrawerProduct[];
}

export function SellerShopDrawer(
  props: SellerShopDrawerProps,
): React.JSX.Element | null {
  const [open, setOpen] = React.useState(false);
  const prefersReducedMotion = useReducedMotion();

  // No dead buttons · if there are no live products the icon hides.
  if (props.products.length === 0) return null;

  const close = React.useCallback(() => setOpen(false), []);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const shopHref = props.broadcaster.nexHandle
    ? `/nex-native/profile/${props.broadcaster.nexHandle}`
    : null;

  return (
    <>
      {/* Right-rail icon · positioned 60px above the country switcher
       *  (switcher sits at top:50%, this sits at calc(50% - 60px)). */}
      <div
        data-nex-seller-shop-icon-mount
        style={{
          position: "fixed",
          right: 12,
          top: "calc(50% - 60px)",
          transform: "translateY(-50%)",
          zIndex: 50,
          pointerEvents: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open ${props.broadcaster.displayName}'s shop · ${props.products.length} product${props.products.length === 1 ? "" : "s"}`}
          data-nex-seller-shop-icon
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
            cursor: "pointer",
            padding: 0,
            color: "#F2F5F8",
            position: "relative",
          }}
        >
          <ShopBagIcon />
          {/* Small badge · product count · caps at 9+ for readability */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 999,
              background: "var(--nex-world-primary, #00AFFF)",
              color: "#0A1526",
              fontSize: 10,
              fontWeight: 900,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              border: "1.5px solid rgba(2, 9, 20, 0.65)",
            }}
          >
            {props.products.length > 9 ? "9+" : props.products.length}
          </span>
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <>
            {/* Backdrop · tap to dismiss */}
            <motion.div
              key="seller-shop-backdrop"
              onClick={close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              data-nex-seller-shop-backdrop
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 100,
                background: "rgba(2, 9, 20, 0.52)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                cursor: "pointer",
              }}
            />
            {/* Panel · slide in from the LEFT */}
            <motion.aside
              key="seller-shop-panel"
              initial={prefersReducedMotion ? { opacity: 0 } : { x: "-100%", opacity: 0.6 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { x: "-100%", opacity: 0 }}
              transition={{
                type: prefersReducedMotion ? "tween" : "spring",
                stiffness: 220,
                damping: 28,
                mass: 0.9,
                duration: prefersReducedMotion ? 0.2 : undefined,
              }}
              data-nex-seller-shop-drawer
              role="dialog"
              aria-label={`${props.broadcaster.displayName}'s shop`}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                bottom: 0,
                width: "min(360px, 85vw)",
                zIndex: 101,
                background:
                  "linear-gradient(180deg, var(--nex-world-surface, #061322) 0%, var(--nex-world-surface-sunken, #030B18) 100%)",
                borderRight:
                  "1px solid var(--nex-world-border-accent, rgba(0,175,255,0.35))",
                boxShadow: "4px 0 32px rgba(0,0,0,0.6)",
                display: "flex",
                flexDirection: "column",
                color: "var(--nex-world-text-primary, #F2F5F8)",
                fontFamily: "Inter, system-ui, sans-serif",
                paddingTop: "env(safe-area-inset-top, 0px)",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
                paddingLeft: "env(safe-area-inset-left, 0px)",
              }}
            >
              <ShopHeader
                broadcaster={props.broadcaster}
                productCount={props.products.length}
                shopHref={shopHref}
                onClose={close}
              />
              <ShopProductList
                products={props.products}
                broadcaster={props.broadcaster}
                onClose={close}
              />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function ShopHeader(props: {
  readonly broadcaster: SellerShopDrawerBroadcaster;
  readonly productCount: number;
  readonly shopHref: string | null;
  readonly onClose: () => void;
}): React.JSX.Element {
  return (
    <header
      style={{
        padding: "14px 16px 12px",
        borderBottom:
          "1px solid var(--nex-world-border, rgba(0,175,255,0.14))",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {props.broadcaster.avatarUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={props.broadcaster.avatarUrl}
          alt=""
          aria-hidden
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            objectFit: "cover",
            border: "2px solid var(--nex-world-border-accent, rgba(0,175,255,0.5))",
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
            display: "grid",
            placeItems: "center",
            fontSize: 16,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {props.broadcaster.displayName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {props.broadcaster.displayName}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--nex-world-text-secondary, #B5C3D6)",
            marginTop: 2,
          }}
        >
          {props.productCount} product{props.productCount === 1 ? "" : "s"}
        </div>
      </div>
      {props.shopHref ? (
        <Link
          href={props.shopHref}
          onClick={props.onClose}
          data-nex-seller-shop-visit
          style={{
            fontSize: 12,
            fontWeight: 800,
            padding: "8px 12px",
            borderRadius: 999,
            background: "var(--nex-world-primary, #00AFFF)",
            color: "#0A1526",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          Visit Shop
        </Link>
      ) : null}
      <button
        type="button"
        onClick={props.onClose}
        aria-label="Close shop drawer"
        style={{
          marginLeft: 4,
          width: 32,
          height: 32,
          borderRadius: 999,
          background: "transparent",
          border: "1px solid var(--nex-world-border, rgba(255,255,255,0.14))",
          color: "inherit",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        ✕
      </button>
    </header>
  );
}

function ShopProductList(props: {
  readonly products: readonly SellerShopDrawerProduct[];
  readonly broadcaster: SellerShopDrawerBroadcaster;
  readonly onClose: () => void;
}): React.JSX.Element {
  return (
    <div
      data-nex-seller-shop-product-list
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "8px 10px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {props.products.map((p) => (
        <ShopProductRow
          key={p.id}
          product={p}
          broadcaster={props.broadcaster}
          onClose={props.onClose}
        />
      ))}
    </div>
  );
}

function ShopProductRow(props: {
  readonly product: SellerShopDrawerProduct;
  readonly broadcaster: SellerShopDrawerBroadcaster;
  readonly onClose: () => void;
}): React.JSX.Element {
  const { product } = props;
  const price = formatPrice(product.pricePence, product.currency);
  // Owner-authorised 2026-11-01 · Phase 10 of Social Commerce roadmap
  // "Chat About This Product". The sealed peer-chat page already
  // reads `?pending_product=<id>` (Ask-Seller slice 2 · 2026-10-22):
  // server-resolves the product snapshot, the composer renders a
  // product-card chip above the pill, and the first send carries the
  // sealed product attachment via sendPeerMessageOrShareProductAction.
  // We use the exact sealed param name used elsewhere (see
  // src/app/nex-native/cover/primitives.tsx:692).
  const chatHref = `/nex-native/chat/peer/${props.broadcaster.accountId}?pending_product=${encodeURIComponent(product.id)}`;
  const detailHref = props.broadcaster.nexHandle
    ? `/nex-native/profile/${props.broadcaster.nexHandle}#product-${product.id}`
    : chatHref;

  return (
    <div
      data-nex-seller-shop-row
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 10,
        padding: 8,
        borderRadius: 12,
        background: "var(--nex-world-surface, rgba(255,255,255,0.03))",
        border: "1px solid var(--nex-world-border, rgba(255,255,255,0.08))",
      }}
    >
      <Link
        href={detailHref}
        onClick={props.onClose}
        data-nex-seller-shop-row-tap
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          color: "inherit",
          minWidth: 0,
        }}
      >
        {product.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.imageUrl}
            alt=""
            aria-hidden
            style={{
              width: 56,
              height: 56,
              objectFit: "cover",
              borderRadius: 10,
              flexShrink: 0,
              background: "rgba(255,255,255,0.04)",
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              display: "grid",
              placeItems: "center",
              fontSize: 11,
              color: "var(--nex-world-text-muted, #7D9BC0)",
              flexShrink: 0,
            }}
          >
            no image
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {product.name}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "var(--nex-world-text-primary, #F2F5F8)",
              marginTop: 2,
            }}
          >
            {price ?? "—"}
          </div>
        </div>
      </Link>
      <Link
        href={chatHref}
        onClick={props.onClose}
        aria-label={`Chat about ${product.name}`}
        data-nex-seller-shop-row-chat
        style={{
          width: 40,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid var(--nex-world-border, rgba(255,255,255,0.1))",
          color: "inherit",
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        <ChatBubbleIcon />
      </Link>
    </div>
  );
}

function formatPrice(
  pricePence: number | null,
  currency: string | null,
): string | null {
  if (pricePence === null || !currency) return null;
  try {
    const major = pricePence / 100;
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    // Unknown currency string · fall back to a safe raw render.
    return `${currency} ${(pricePence / 100).toFixed(2)}`;
  }
}

function ShopBagIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function ChatBubbleIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
