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
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  NEX_CART_STORAGE_KEY,
  type NexCartItem,
} from "@/lib/nex-native/cart-types";

export interface SellerShopDrawerBroadcaster {
  readonly accountId: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly nexHandle: string | null;
}

export interface SellerShopDrawerShop {
  readonly id: string;
  readonly slug: string | null;
  readonly displayName: string;
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
  readonly shop: SellerShopDrawerShop;
  readonly products: readonly SellerShopDrawerProduct[];
}

export function SellerShopDrawer(
  props: SellerShopDrawerProps,
): React.JSX.Element | null {
  const [open, setOpen] = React.useState(false);
  // Owner directive 2026-11-01 · sheet-based product detail flow.
  // Which product's bottom sheet is currently open · null when no
  // sheet. Esc closes the sheet first, then (on second Esc) the
  // drawer. Multiple sheets never stack · tapping another View
  // details just swaps the open id.
  const [openProductId, setOpenProductId] = React.useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // No dead buttons · if there are no live products the icon hides.
  if (props.products.length === 0) return null;

  const close = React.useCallback(() => setOpen(false), []);
  const closeSheet = React.useCallback(() => setOpenProductId(null), []);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        if (openProductId) closeSheet();
        else close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openProductId, close, closeSheet]);

  const activeProduct = openProductId
    ? props.products.find((p) => p.id === openProductId) ?? null
    : null;

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
                // Owner directive 2026-11-01 (sheet refactor) · drawer
                // slides out just one card's width so the viewer keeps
                // most of the feed visible · product details open in a
                // separate bottom sheet. Phone: 50vw (one card + gutter).
                // Desktop capped at 240px for sanity.
                width: "min(240px, 50vw)",
                zIndex: 101,
                // Owner directive 2026-11-01 · "shop slider should be
                // same color theme as our slider on the right side".
                // Mirror LiveSideDrawer's sealed background chain so
                // Ireland deployment serves the sealed Ireland-green
                // drawer-bg and Worldwide inherits the sealed navy.
                // All future worlds opt-in via --nex-world-drawer-bg.
                background:
                  "var(--nex-world-drawer-bg, var(--nex-world-background-base, #020914))",
                // Right seam · hairline matches LiveSideDrawer's left
                // seam so the two drawers read as one visual family.
                borderRight: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "4px 0 32px rgba(0,0,0,0.6)",
                display: "flex",
                flexDirection: "column",
                overflowX: "hidden",
                color: "#F2F5F8",
                fontFamily: "Inter, system-ui, sans-serif",
                paddingTop: "env(safe-area-inset-top, 0px)",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
                paddingLeft: "env(safe-area-inset-left, 0px)",
              }}
            >
              {/* Owner directive 2026-11-01 · "edge running small light".
               *  Mirrors LiveSideDrawer's running-gold accent · same
               *  3400ms keyframe · same gating on the sealed
               *  --nex-world-live-drawer-edge-light-display CSS var so
               *  the overlay only shows where the world opts in
               *  (Ireland today). Positioned on the RIGHT seam here
               *  (shop drawer slides from left · meets the viewer at
               *  its right edge) · the LiveSideDrawer runs its light
               *  on the LEFT seam (mirror symmetry). */}
              <style>{`
                @keyframes nex-seller-shop-drawer-edge-light {
                  0%   { transform: translateY(-100px); opacity: 0; }
                  12%  { opacity: 1; }
                  88%  { opacity: 1; }
                  100% { transform: translateY(calc(100vh + 20px)); opacity: 0; }
                }
              `}</style>
              <div
                aria-hidden
                data-nex-seller-shop-drawer-edge
                style={{
                  display:
                    "var(--nex-world-live-drawer-edge-light-display, none)",
                  position: "absolute",
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  overflow: "hidden",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    right: -1,
                    width: 3,
                    height: 90,
                    background:
                      "linear-gradient(180deg, rgba(198,161,91,0) 0%, #C6A15B 50%, rgba(198,161,91,0) 100%)",
                    boxShadow: "0 0 10px rgba(198,161,91,0.6)",
                    animation:
                      "nex-seller-shop-drawer-edge-light 3400ms linear infinite",
                    willChange: "transform",
                  }}
                />
              </div>
              <ShopHeader
                broadcaster={props.broadcaster}
                productCount={props.products.length}
                shopHref={shopHref}
                onClose={close}
              />
              <ShopProductList
                products={props.products}
                onOpenProduct={setOpenProductId}
              />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {/* Owner directive 2026-11-01 · product-detail bottom sheet.
       *  Portal to document.body so it layers above the drawer. Opens
       *  with a spring-up animation (prefers-reduced-motion fallback
       *  to a crossfade). Two CTAs: "Ask seller" routes to the sealed
       *  pending_product chat flow · "Add to cart" writes to the
       *  sealed NEX_CART_STORAGE_KEY using the same NexCartItem
       *  shape as the chat shop sheet (dedupe by shop_id+product_id,
       *  bump quantity, dispatch nex-cart-changed for header counters). */}
      {activeProduct ? (
        <ProductDetailSheet
          product={activeProduct}
          broadcaster={props.broadcaster}
          shop={props.shop}
          onClose={closeSheet}
          prefersReducedMotion={prefersReducedMotion}
        />
      ) : null}
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
            color: "#B5C3D6",
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
  readonly onOpenProduct: (id: string) => void;
}): React.JSX.Element {
  // Owner directive 2026-11-01 (sheet refactor) · 1-column grid at
  // 50vw drawer width · each card is full width of the drawer. Dim
  // wash matches MusicLibraryOverlay's card-container (rgba(0,0,0,
  // 0.35) over the drawer's world-themed base).
  return (
    <div
      data-nex-seller-shop-product-list
      style={{
        flex: 1,
        overflowY: "auto",
        background: "rgba(0, 0, 0, 0.35)",
        padding: "12px 10px 20px",
        display: "grid",
        gridTemplateColumns: "repeat(1, 1fr)",
        gap: 10,
        alignContent: "start",
      }}
    >
      {props.products.map((p) => (
        <ShopProductCard
          key={p.id}
          product={p}
          onOpen={props.onOpenProduct}
        />
      ))}
    </div>
  );
}

function ShopProductCard(props: {
  readonly product: SellerShopDrawerProduct;
  readonly onOpen: (id: string) => void;
}): React.JSX.Element {
  const { product } = props;
  const price = formatPrice(product.pricePence, product.currency);
  const openSheet = (): void => props.onOpen(product.id);

  // Whole-card tap AND the View details button both open the sheet ·
  // the button is a visible affordance; the whole-card tap honours
  // the viewer's "I just tapped the picture" expectation.
  return (
    <div
      data-nex-seller-shop-card
      onClick={openSheet}
      role="button"
      tabIndex={0}
      aria-label={`View details · ${product.name}${price ? " · " + price : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openSheet();
        }
      }}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 6,
        padding: 0,
        minWidth: 0,
        maxWidth: "100%",
        background: "transparent",
        border: "none",
        color: "inherit",
        fontFamily: "inherit",
        textAlign: "left",
        cursor: "pointer",
        boxSizing: "border-box",
      }}
    >
      {/* Cover · square · letterboxed (Universal Image Display
       *  Integrity doctrine 2026-10-30 clause 1 "preserve the entire
       *  image"). */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 10,
          overflow: "hidden",
          background: "var(--nex-world-background-base, #020914)",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.45)",
          boxSizing: "border-box",
        }}
      >
        {product.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.imageUrl}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              fontSize: 11,
              color: "#7D9BC0",
            }}
          >
            no image
          </div>
        )}
        {/* Owner directive 2026-11-01 (sheet refactor + gold accent)
         *  · "View details button lower right on the image · should
         *  be like the gold color we have for our theme".
         *  Uses the sealed `--nex-world-secondary` world token · on
         *  Ireland deployment it resolves to the Irish gold #C6A15B
         *  (same gold as the sealed right-seam edge-light) · on
         *  Worldwide it resolves to #1DA1F2 · future worlds opt-in
         *  via the registry. Dark text (#0A1526) + subtle glow
         *  match the sealed accent-chip pattern used elsewhere. */}
        <div
          data-nex-seller-shop-view-details-pill
          aria-hidden
          style={{
            position: "absolute",
            right: 8,
            bottom: 8,
            padding: "4px 10px",
            borderRadius: 999,
            background: "var(--nex-world-secondary, #C6A15B)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            boxShadow: "0 0 12px rgba(198, 161, 91, 0.45)",
            color: "#0A1526",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 0.2,
            lineHeight: 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          View details
          <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>
            ›
          </span>
        </div>
      </div>
      <div style={{ padding: "0 2px", minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: "#F2F5F8",
          }}
        >
          {product.name}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            marginTop: 1,
            color: "#F2F5F8",
          }}
        >
          {price ?? "—"}
        </div>
      </div>
    </div>
  );
}

/** Owner-authorised 2026-11-01 · product-detail bottom sheet. Opens
 *  from the shop drawer's View details button. Two CTAs:
 *   · Ask seller · routes to the sealed pending_product chat flow.
 *   · Add to cart · writes to NEX_CART_STORAGE_KEY (sealed shape ·
 *     see src/lib/nex-native/cart-types.ts). Dedupes on
 *     (shop_id, product_id) and bumps quantity · mirrors the chat
 *     sheet's writeItemToCart logic. */
function ProductDetailSheet(props: {
  readonly product: SellerShopDrawerProduct;
  readonly broadcaster: SellerShopDrawerBroadcaster;
  readonly shop: SellerShopDrawerShop;
  readonly onClose: () => void;
  readonly prefersReducedMotion: boolean | null;
}): React.ReactPortal | null {
  const [mounted, setMounted] = React.useState(false);
  const [added, setAdded] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted || typeof document === "undefined") return null;

  const { product, broadcaster, shop } = props;
  const price = formatPrice(product.pricePence, product.currency);
  const chatHref = `/nex-native/chat/peer/${broadcaster.accountId}?pending_product=${encodeURIComponent(product.id)}`;

  const handleAddToCart = (): void => {
    try {
      const raw = window.localStorage.getItem(NEX_CART_STORAGE_KEY);
      const arr: NexCartItem[] = raw ? (JSON.parse(raw) as NexCartItem[]) : [];
      const dedupeKey = `${shop.id}::${product.id}::`;
      const idx = arr.findIndex(
        (x) =>
          x &&
          `${x.shop_id}::${x.id}::${(x.variants ?? []).slice().sort().join("|")}` ===
            dedupeKey,
      );
      if (idx >= 0) {
        const existing = arr[idx];
        if (existing) {
          arr[idx] = { ...existing, quantity: (existing.quantity || 1) + 1 };
        }
      } else {
        arr.push({
          key:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${dedupeKey}::${Date.now()}`,
          kind: "product",
          id: product.id,
          shop_id: shop.id,
          shop_slug: shop.slug ?? "",
          shop_owner_account_id: broadcaster.accountId,
          shop_display_name: shop.displayName,
          shop_lat: null,
          shop_lng: null,
          name: product.name,
          price_pence: product.pricePence ?? 0,
          currency: product.currency ?? "EUR",
          image_url: product.imageUrl,
          quantity: 1,
          variants: [],
          perks: [],
          perks_note: null,
          note: null,
          added_at: Date.now(),
        });
      }
      window.localStorage.setItem(NEX_CART_STORAGE_KEY, JSON.stringify(arr));
      try {
        window.dispatchEvent(new CustomEvent("nex-cart-changed"));
      } catch {
        /* best-effort notification · persistence already succeeded */
      }
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1500);
    } catch {
      /* localStorage full / blocked · user sees no "Added" confirm */
    }
  };

  const useSpring = !props.prefersReducedMotion;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="product-sheet-backdrop"
        onClick={props.onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        data-nex-seller-shop-sheet-backdrop
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1100,
          background: "rgba(2, 9, 20, 0.6)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          cursor: "pointer",
        }}
      />
      <motion.div
        key="product-sheet-panel"
        initial={useSpring ? { y: "100%" } : { opacity: 0 }}
        animate={useSpring ? { y: 0 } : { opacity: 1 }}
        exit={useSpring ? { y: "100%" } : { opacity: 0 }}
        transition={
          useSpring
            ? { type: "spring", stiffness: 260, damping: 32, mass: 0.9 }
            : { duration: 0.2 }
        }
        data-nex-seller-shop-sheet
        role="dialog"
        aria-label={`${product.name} · details`}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1101,
          height: "85vh",
          maxHeight: "85vh",
          background:
            "var(--nex-world-drawer-bg, var(--nex-world-background-base, #020914))",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: "1px solid rgba(255, 255, 255, 0.14)",
          boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.6)",
          display: "flex",
          flexDirection: "column",
          color: "#F2F5F8",
          fontFamily: "Inter, system-ui, sans-serif",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Drag handle */}
        <div
          aria-hidden
          style={{
            width: 36,
            height: 4,
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.3)",
            margin: "8px auto 4px",
          }}
        />
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close product details"
          style={{
            position: "absolute",
            top: 10,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            color: "inherit",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          ✕
        </button>

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "4px 18px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Product cover · larger · letterboxed */}
          <div
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              maxHeight: "40vh",
              borderRadius: 14,
              overflow: "hidden",
              background: "var(--nex-world-background-base, #020914)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {product.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={product.imageUrl}
                alt=""
                aria-hidden
                decoding="async"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
              <div
                aria-hidden
                style={{
                  fontSize: 13,
                  color: "#7D9BC0",
                }}
              >
                no image
              </div>
            )}
          </div>
          {/* Name · price · seller line */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                lineHeight: 1.25,
              }}
            >
              {product.name}
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: "#F2F5F8",
              }}
            >
              {price ?? "—"}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#B5C3D6",
                marginTop: 2,
              }}
            >
              Sold by {shop.displayName}
            </div>
          </div>
        </div>

        {/* Dual CTA footer */}
        <div
          data-nex-seller-shop-sheet-ctas
          style={{
            padding: "12px 14px 14px",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            gap: 10,
            background:
              "linear-gradient(0deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 100%)",
          }}
        >
          <Link
            href={chatHref}
            onClick={props.onClose}
            aria-label={`Ask ${shop.displayName} about ${product.name}`}
            data-nex-seller-shop-sheet-ask
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px 14px",
              borderRadius: 999,
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              color: "inherit",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            <ChatBubbleIcon />
            Ask seller
          </Link>
          <button
            type="button"
            onClick={handleAddToCart}
            aria-label={`Add ${product.name} to cart`}
            data-nex-seller-shop-sheet-add-to-cart
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px 14px",
              borderRadius: 999,
              background: added
                ? "#16D66B"
                : "var(--nex-world-primary, #00AFFF)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#0A1526",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 900,
              transition: "background 180ms ease-out",
            }}
          >
            <BagIconSmall />
            {added ? "Added ✓" : "Add to cart"}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
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

function BagIconSmall(): React.JSX.Element {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
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
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
