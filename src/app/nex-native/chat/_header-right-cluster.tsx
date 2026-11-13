"use client";

// src/app/nex-native/chat/_header-right-cluster.tsx
//
// Standard chat-header right-cluster · sealed 2026-09-29 · Bridge 53.
// -------------------------------------------------------------------
// Three fixed-position circle buttons in the top-right of any chat
// surface using PortraitBloomShell:
//
//   [ Home ]  [ Shop / Menu (conditional) ]  [ Cart ]
//
// · Home  · always visible · links to /nex-native/home
// · Shop  · only when the peer owns a business · opens the in-chat
//           slider (products + menu items) via ShopGridModal · the
//           glyph swaps between shop-bag (products) and cutlery
//           (venue sellers) based on isVenue
// · Cart  · always visible · links to /nex-native/cart · shows a
//           pink badge with the total item count from localStorage
//           (updates live via the `nex-cart-changed` event)
//
// One shared cluster, one shared visual language across every chat
// surface (peer chat, business chat, NEX official). Per-theme
// coloring can be layered in later via the accentColor prop — for
// now every chat uses NEX orange to match the current PortraitBloom
// treatment. Founder direction 2026-09-29: this is THE standard.

import * as React from "react";
import Link from "next/link";
import {
  ShopGridModal,
  type ShopProduct,
  type ShopSection,
} from "./_shop-grid-modal";
import {
  NEX_CART_STORAGE_KEY,
  type NexCartItem,
} from "@/lib/nex-native/cart-types";
import { NEX_COMMERCE_ENABLED } from "@/lib/nex-native/launch-flags";

const NEX = {
  text: "#F4F7FC",
  orange: "#FF7800",
  orangeSoft: "rgba(255,120,0,0.5)",
  pink: "#FF3F9F",
  pinkGlow: "rgba(255,63,159,0.55)",
  cyan: "#00AFFF", // NEX cyan · fallback when a theme passes no accent
};

interface Props {
  /** Peer's display name · surfaces in the shop slider header. */
  peerName: string;
  /** Shop identity fields when the peer owns a nex_business.
   *  When null, the shop/menu button is not rendered — only Home
   *  and Cart show. Home + Cart always render. */
  shop: {
    name: string;
    href: string | null;
    products: ShopProduct[];
    /** Category Tabs sealed 2026-09-30 · the peer's one-word sections
     *  (auto-detected upstream: menu items → nex_menu_section, else
     *  nex_product_section). Empty list hides the tab bar per doctrine. */
    sections?: ShopSection[];
    isVenue: boolean;
    context?: {
      shop_id: string;
      shop_slug: string | null;
      shop_owner_account_id: string;
      shop_display_name: string;
    };
  } | null;
  /** Server Action (bound with peerAccountId) that posts a
   *  cart_order chat message · used by the detail sheet's
   *  Send-in-chat CTA. */
  sendCartOrderAction?: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
  /** Legacy inquiry action fallback. */
  inquiryAction?: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
  /** Bridge 97h · when true, both the Shop and Cart buttons render
   *  regardless of NEX_COMMERCE_ENABLED. Used by the theme viewer
   *  so previews show the full 3-button [Home] [Shop] [Cart]
   *  cluster even while commerce is gated off during the Indonesia
   *  launch. Default = false · production behaviour unchanged.
   *  (Kept the name `forceShowCart` for callsite brevity even though
   *  it now controls both commerce buttons together.) */
  forceShowCart?: boolean;
  /** Optional per-theme shop background image · threaded straight
   *  into ShopGridModal. Resolved upstream from theme-assets.ts. */
  shopBackgroundImageUrl?: string | null;
  /** Shop-type chooser · when true, tapping the Shop icon opens the
   *  slider in first-time setup mode (3 cards: Products / Food /
   *  Affiliate) instead of the product grid. */
  showShopSetupChooser?: boolean;
  onSelectShopType?: (type: "products" | "food" | "affiliate") => void;
  /** Peer's chat_theme accent · the cluster icons sit muted at 55%
   *  white and only light up to this colour on hover / focus / press.
   *  Scarcity rule applied to chrome · icons disappear into the
   *  environment until the user actually reaches for them. Defaults
   *  to NEX cyan. Sealed 2026-10-01. */
  themeAccent?: string | null;
}

/** Read the total quantity of items currently in the localStorage
 *  cart. Returns 0 in SSR / private-browsing / parse-error cases. */
function readCartCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(NEX_CART_STORAGE_KEY);
    if (!raw) return 0;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return 0;
    return arr.reduce(
      (n, x) =>
        n +
        (x && typeof x === "object" && typeof (x as NexCartItem).quantity === "number"
          ? Math.max(0, Math.floor((x as NexCartItem).quantity))
          : 0),
      0,
    );
  } catch {
    return 0;
  }
}

export function HeaderRightCluster({
  peerName,
  shop,
  sendCartOrderAction,
  inquiryAction,
  forceShowCart = false,
  shopBackgroundImageUrl,
  showShopSetupChooser,
  onSelectShopType,
  themeAccent,
}: Props) {
  const [shopOpen, setShopOpen] = React.useState(false);
  const [cartCount, setCartCount] = React.useState(0);
  const [hydrated, setHydrated] = React.useState(false);

  // Owner-authorised 2026-10-18 · S9 · one-shot "open the Shop
  // slider on first chat landing" signal. The sealed `/chat/preview`
  // route consumes the `nex_open_shop_on_chat` cookie server-side
  // (one-shot · also cleared there) and forwards the signal via
  // `?openShop=1` on the redirect to `/themes/[id]`. We read that
  // param on mount and auto-open the slider for the Shop journey.
  //
  // Non-shop intents never set the cookie, never carry the param,
  // never auto-open · the sealed default-closed behaviour holds.
  //
  // Idempotent · after opening we strip the param from the URL so a
  // user who closes the slider and refreshes doesn't get it re-
  // opened on them.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("openShop") === "1") {
        setShopOpen(true);
        params.delete("openShop");
        const next =
          window.location.pathname +
          (params.toString() ? `?${params.toString()}` : "") +
          window.location.hash;
        window.history.replaceState(window.history.state, "", next);
      }
    } catch {
      // Non-fatal · if URL parsing or history replace fails the user
      // simply doesn't get the auto-open; the sealed shop button still
      // works manually.
    }
  }, []);

  React.useEffect(() => {
    setCartCount(readCartCount());
    setHydrated(true);
    const onChange = () => setCartCount(readCartCount());
    window.addEventListener("nex-cart-changed", onChange);
    const onStorage = (e: StorageEvent) => {
      if (e.key === NEX_CART_STORAGE_KEY) setCartCount(readCartCount());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("nex-cart-changed", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Bridge 55 · Phase 1 launch · commerce hidden by default.
  // Cart + Shop icons only render when NEX_COMMERCE_ENABLED is on.
  // Owner directive 2026-11-04 later-same-day · hydration fix ·
  // NEX_COMMERCE_ENABLED is a server-only env var (no NEXT_PUBLIC_
  // prefix) · server reads it from process.env but the client bundle
  // has no value for it, so the server renders the Cart link while
  // the client omits it → hydration mismatch. Gate the decision on
  // `hydrated` so server + initial client render MATCH (both omit)
  // and the Cart link surfaces only after a client-side useEffect
  // flips `hydrated=true`. forceShowCart still works on both.
  const showCart = forceShowCart || (hydrated && NEX_COMMERCE_ENABLED);
  // Owner hydration fix 2026-11-13 · showShop was still reading
  // NEX_COMMERCE_ENABLED directly, which the server resolves from
  // process.env but the client bundle sees as `undefined`. That split
  // produced the same server/client mismatch as showCart previously
  // did · classic "Open <Shop>'s shop" button on the SSR snapshot vs
  // missing on initial client render. Mirror the showCart pattern:
  // gate on `hydrated` so both renders match (both omit on first
  // paint, then the shop button surfaces after useEffect flips).
  const showShop =
    !!shop && (forceShowCart || (hydrated && NEX_COMMERCE_ENABLED));
  const hasShopProducts = !!shop && shop.products.length > 0;
  const shopAriaLabel = shop
    ? shop.isVenue
      ? `Open ${shop.name}'s menu`
      : `Open ${shop.name}'s shop`
    : "Shop";
  const shopTitle = shop ? (shop.isVenue ? "Menu" : "Shop") : "";

  const headerAccent = themeAccent ?? NEX.cyan;
  return (
    <>
      <style>{`
        /* Muted-until-touched · sealed 2026-10-01. Cluster icons live
           at 55% white so they recede into the environment; they
           light up to the per-theme accent (--nex-header-accent) on
           hover, keyboard focus, or press. */
        [data-nex-header-cluster-btn]:hover,
        [data-nex-header-cluster-btn]:focus-visible,
        [data-nex-header-cluster-btn]:active {
          color: var(--nex-header-accent, #00AFFF) !important;
        }
      `}</style>
      {/* R11b (sealed 2026-10-05) · tagged `data-nex-native-r1-cluster`
         so UniversalHeaderIconsOverlay can suppress this native R1
         cluster via CSS when it mounts. Suppression fires ONLY on
         routes that mount the overlay (currently themes/[id] legacy
         branch · peer chat / conversation routes do NOT mount the
         overlay, so this cluster remains visible there). Audit
         confirmed this cluster is 100% R1 (Home + conditional Cart +
         conditional Shop) so blanket cluster hiding is surgical. */}
      <div
        data-nex-header-cluster
        data-nex-native-r1-cluster
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0) + 14px)",
          right: 12,
          display: "flex",
          alignItems: "center",
          gap: 4,
          zIndex: 6,
          ["--nex-header-accent" as unknown as string]: headerAccent,
        }}
      >
        <ClusterLinkButton
          href="/nex-native/home"
          ariaLabel="Home"
          title="Home"
        >
          <HomeIcon />
        </ClusterLinkButton>

        {showCart && (
        <ClusterLinkButton
          href="/nex-native/cart"
          ariaLabel={
            cartCount > 0
              ? `Open cart · ${cartCount} item${cartCount === 1 ? "" : "s"}`
              : "Open cart"
          }
          title="Cart"
        >
          <CartIcon />
          {hydrated && cartCount > 0 && (
            // Sealed 2026-10-14 · universal Joker-red cart badge on
            // every theme (founder direction). Removes the earlier
            // per-theme pink/red split; the dark-red reads as "look
            // here" against any accent without a third colour.
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
                background: "linear-gradient(180deg, #CC1818, #7A0000)",
                color: "#FFFFFF",
                fontSize: 10,
                fontWeight: 800,
                lineHeight: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1.5px solid #050f1e",
                boxShadow: "0 4px 10px rgba(122,0,0,0.65)",
                fontFamily:
                  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
              }}
            >
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </ClusterLinkButton>
        )}

        {showShop && (
          hasShopProducts ? (
            <ClusterActionButton
              onClick={() => setShopOpen(true)}
              ariaLabel={shopAriaLabel}
              title={shopTitle}
            >
              {shop.isVenue ? <CutleryIcon /> : <ShopBagIcon />}
            </ClusterActionButton>
          ) : (
            <ClusterLinkButton
              href={shop.href ?? "#"}
              ariaLabel={shopAriaLabel}
              title={shopTitle}
            >
              {shop.isVenue ? <CutleryIcon /> : <ShopBagIcon />}
            </ClusterLinkButton>
          )
        )}
      </div>

      {shop && (
        <ShopGridModal
          open={shopOpen}
          onClose={() => setShopOpen(false)}
          shopName={shop.name}
          shopHref={shop.href}
          products={shop.products}
          sections={shop.sections ?? []}
          peerName={peerName}
          isVenue={shop.isVenue}
          shopContext={shop.context}
          sendCartOrderAction={sendCartOrderAction}
          inquiryAction={inquiryAction}
          backgroundImageUrl={shopBackgroundImageUrl ?? null}
          showSetupChooser={showShopSetupChooser}
          onSelectShopType={onSelectShopType}
          themeAccent={themeAccent ?? null}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------- *
 * Button primitives · same 40px circle · orange NEX treatment    *
 * -------------------------------------------------------------- */

const CIRCLE: React.CSSProperties = {
  // Sealed 2026-10-11 · bumped 36 → 44 · "icons on the right side"
  // need to match the larger header portrait (now 56px) so the
  // identity row + action row read as one scale. SVG strokes
  // bumped 22 → 26 in sync below.
  width: 44,
  height: 44,
  borderRadius: 0,
  background: "transparent",
  border: "none",
  // Sealed 2026-10-01 · ORIGINAL: muted-until-touched · icons sat at
  // 55% white and only lit up to the theme accent on :hover /
  // :focus-visible / :active. Mobile has no hover state, so Joker's
  // acid green (and every other theme accent) never appeared on
  // touch devices · users read it as "the theme colour is missing".
  //
  // Flipped 2026-10-11 · persistent theme accent · the CSS variable
  // `--nex-header-accent` is set on the cluster wrapper from
  // `themeAccent` (defaults to NEX cyan) · falling back to muted
  // white only when no theme is active. The :hover rule still
  // brightens on interaction (desktop pointer still gets a lift).
  color: "var(--nex-header-accent, rgba(255,255,255,0.55))",
  padding: 6,
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  transition: "color 160ms ease, transform 120ms ease",
  textDecoration: "none",
  position: "relative",
  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))",
};

function ClusterLinkButton({
  href,
  ariaLabel,
  title,
  children,
}: {
  href: string;
  ariaLabel: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      title={title}
      data-nex-header-cluster-btn
      style={CIRCLE}
    >
      {children}
    </Link>
  );
}

function ClusterActionButton({
  onClick,
  ariaLabel,
  title,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      data-nex-header-cluster-btn
      style={CIRCLE}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------- *
 * Glyphs · 18px stroked SVGs                                      *
 * -------------------------------------------------------------- */

function HomeIcon() {
  return (
    <svg
      width={26}
      height={26}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </svg>
  );
}

function ShopBagIcon() {
  return (
    <svg
      width={26}
      height={26}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}

function CutleryIcon() {
  return (
    <svg
      width={26}
      height={26}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 2v7a2 2 0 002 2v11" />
      <path d="M5 2v6" />
      <path d="M9 2v6" />
      <path d="M17 2c-2 0-3 2-3 5v5a2 2 0 002 2v8" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      width={26}
      height={26}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="21" r="1.5" />
      <circle cx="18" cy="21" r="1.5" />
      <path d="M3 3h2l2.7 12.3a2 2 0 0 0 2 1.7h7.6a2 2 0 0 0 2-1.6L21 8H6" />
    </svg>
  );
}
