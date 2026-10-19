"use client";

// src/app/nex-native/chat/_shop-grid-modal.tsx
//
// Peer shop grid modal · sealed 2026-09-27.
// -----------------------------------------
// Renders the peer's product catalogue as a 2-column grid inside a
// glass modal. Opened from the shop icon in the chat header (top-
// right corner · only visible when the peer owns a nex_business).
//
// Doctrine · products live INSIDE chat, not on separate pages. This
// modal is the first step toward Bridge 11 (product-in-chat) · users
// can already browse the peer's inventory without leaving the chat
// context. Bridge 11 will add "Send to chat" per card so a product
// card can attach directly to the composer as its own message type.

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ProductDetailSheet } from "./_product-detail-sheet";
// Owner-authorised 2026-10-18 · S5 · the chooser's card list is
// read from the sealed catalogue so the sealed modal + trigger
// architecture is unchanged while the Sell / Earn split and
// Coming-soon chips land additively. The catalogue is a plain
// data module · it also powers the S5 unit tests.
import {
  SHOP_CHOOSER_CATALOG,
  sellCards,
  earnCards,
  type ShopChooserCard,
  type ShopChooserCardId,
} from "./_shop-chooser-catalog";

const NEX = {
  panel: "rgba(3,16,29,0.96)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#009FEF",
  cyanSoft: "rgba(0,159,239,0.5)",
  cyanBorder: "rgba(0,159,239,0.35)",
  orange: "#FF7800",
};

export interface ShopProduct {
  id: string;
  /** Bridge 52 · discriminator so the in-chat cart send knows which
   *  server-side lookup to run (products refresh authoritative price
   *  from nex_product · menu items keep client-supplied price). */
  kind: "product" | "menu_item";
  name: string;
  description: string | null;
  price_pence: number;
  currency: string;
  image_url: string | null;
  tags: string[] | null;
  stock_status: string | null;
  /** Category Tabs sealed 2026-09-30 · FK to nex_product_section (for
   *  kind='product') or nex_menu_section (for kind='menu_item'). NULL =
   *  uncategorised · visible only under the "All" tab. */
  section_id?: string | null;
}

/** Category Tabs · sealed 2026-09-30. Passed through from the peer's
 *  nex_product_section (or nex_menu_section for venue shops). Hard cap
 *  of 3 enforced at the seller UX layer; this list may be empty. */
export interface ShopSection {
  id: string;
  name: string;
  sort_order?: number;
}

const SHOP_ALL_TAB_ID = "__all__";

export interface ShopContext {
  shop_id: string;
  shop_slug: string | null;
  shop_owner_account_id: string;
  shop_display_name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  shopName: string;
  shopHref: string | null;
  products: ShopProduct[];
  /** Category Tabs sealed 2026-09-30 · optional list of the peer's
   *  one-word sections. Doctrine: 0-1 sections hides the tab bar
   *  entirely; 2-3 shows tabs + "All" first; 4+ shows first 3 by
   *  sort_order. Callers that haven't wired sections yet pass nothing
   *  and the modal behaves exactly as before. */
  sections?: ShopSection[];
  /** Peer's display name · used in the product detail sheet copy. */
  peerName: string;
  /** True when the peer is a venue seller · swaps the eyebrow label
   *  ("Menu" vs "Shop") + CTA ("Open menu →" vs "Open shop →") +
   *  passes through to the detail sheet for consistent copy. */
  isVenue?: boolean;
  /** Shop identity fields for the in-chat cart send · required
   *  alongside sendCartOrderAction for the Order-in-chat CTA. */
  shopContext?: ShopContext;
  /** Server Action bound with peerAccountId · fired when user taps
   *  Send-in-chat on a product detail. */
  sendCartOrderAction?: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
  /** Server Action bound with peerAccountId · fired when user taps
   *  Ask about this / I want this on a product detail. Kept for
   *  backward compat · superseded by Add-to-cart + Send-in-chat. */
  inquiryAction?: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
  /** Optional per-theme backdrop image · sealed 2026-10-01.
   *  Resolved upstream from `theme-assets.ts` (e.g. Joker → the alley
   *  wallpaper). Renders UNDER the modal's dark gradient so product
   *  cards stay legible. Null = default gradient only. */
  backgroundImageUrl?: string | null;
  /** Shop-type chooser · sealed 2026-10-01 · when true the slider
   *  renders a 3-button first-time chooser (Sell Products / Sell
   *  Food / Affiliate) INSTEAD of the product grid. Shown when the
   *  viewer has no shop configured yet (first visit to Shop). */
  showSetupChooser?: boolean;
  /** Callback fired when the user taps one of the chooser buttons.
   *  Parent decides what to do (navigate to onboarding, show the
   *  profession picker, open the affiliate waitlist, etc.). */
  onSelectShopType?: (type: "products" | "food" | "affiliate") => void;
  /** Sealed 2026-10-11 · theme accent threaded from HeaderRightCluster
   *  (which gets it from `themeAccent` which gets it from the
   *  ThemePackage `accent_hex`). When supplied every rim · active-tab
   *  underline · CTA border · chip border + accent-coloured text
   *  switches to the theme hue instead of the hardcoded NEX cyan.
   *  Null falls back to NEX cyan for routes without a theme. */
  themeAccent?: string | null;
}

export function ShopGridModal({
  open,
  onClose,
  shopName,
  shopHref,
  products,
  sections = [],
  peerName,
  isVenue = false,
  shopContext,
  sendCartOrderAction,
  inquiryAction,
  backgroundImageUrl,
  showSetupChooser,
  onSelectShopType,
  themeAccent,
}: Props) {
  // Sealed 2026-10-11 · theme accent plumbed from HeaderRightCluster.
  // Every "NEX.cyan*" below used to be hardcoded cyan which produced
  // a BLUE rim on Joker's acid-green chat · now the rim adopts the
  // theme's accent. Alpha variants (soft / border) derive from the
  // same accent so the whole modal reads as one coherent theme.
  const accentSolid = themeAccent ?? NEX.cyan;
  const accentSoft = themeAccent ? `${themeAccent}80` : NEX.cyanSoft;
  const accentBorder = themeAccent ? `${themeAccent}5A` : NEX.cyanBorder;
  const [mounted, setMounted] = React.useState(false);
  const [selectedProductId, setSelectedProductId] = React.useState<
    string | null
  >(null);
  const [activeSectionId, setActiveSectionId] =
    React.useState<string>(SHOP_ALL_TAB_ID);
  React.useEffect(() => setMounted(true), []);

  // Sealed 2026-10-01 · broadcast open/close so the Joker 3-dots
   // dancing-dots trigger (and any other floating UI pinned to the
   // bottom-right) can hide itself while the shop slider is up.
   // Fires once per open-state change · pure event, no shared store.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("nex-shop-slider-visible", { detail: { open } }),
    );
    return () => {
      if (open) {
        window.dispatchEvent(
          new CustomEvent("nex-shop-slider-visible", {
            detail: { open: false },
          }),
        );
      }
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedProductId) setSelectedProductId(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, selectedProductId]);

  const selectedProduct = selectedProductId
    ? products.find((p) => p.id === selectedProductId) ?? null
    : null;

  // Category Tabs · sealed 2026-09-30. Filter products by the active tab
  // when it's not the sentinel "All". Uncategorised (section_id === null)
  // remain visible only under All.
  const visibleProducts =
    activeSectionId === SHOP_ALL_TAB_ID
      ? products
      : products.filter((p) => p.section_id === activeSectionId);

  if (!open || !mounted) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes nex-shop-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes nex-shop-slide-up {
          /* Owner directive 2026-10-18 · keep translateX(-50%)
             during the slide so the sheet stays centred under the
             phone frame on desktop · without this the sheet would
             briefly jump from the viewport left edge to centre. */
          from { transform: translateX(-50%) translateY(100%); }
          to   { transform: translateX(-50%) translateY(0); }
        }
        [data-nex-shop-scroll] { scrollbar-width: none; }
        [data-nex-shop-scroll]::-webkit-scrollbar {
          display: none; width: 0; height: 0;
        }
      `}</style>

      {/* Dim backdrop over the chat surface · tap to close. Sits
          only over the message zone so the header identity chip
          stays legible above and the composer stays reachable. */}
      <div
        role="button"
        aria-label="Close shop"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,9,20,0.42)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 1000,
          animation: "nex-shop-fade 200ms ease-out both",
        }}
      />

      {/* Bottom sheet · slides up from the bottom of the chat page.
          Founder direction 2026-09-27 · "shop cards open on the chat
          page not container" · this is a chat-anchored panel, not a
          floating modal.
          Owner directive 2026-10-18 · bound the sheet to the phone-
          frame width on desktop. The sealed nex-native.css note at
          line 148-151 flags that `position: fixed` escapes the
          frame · we clamp via maxWidth + horizontal centering so the
          sheet matches the phone screen width exactly instead of
          spanning the entire browser viewport. */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${shopName} products`}
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: 0,
          width: "100%",
          maxWidth: 420,
          maxHeight: "78vh",
          // Per-theme backdrop image (sealed 2026-10-01) · when a
          // theme supplies one, the image reads CLEARLY under a very
          // light vignette · product cards carry their own
          // backgrounds so the modal doesn't need a heavy scrim.
          // Linear-gradient first in the shorthand = top layer.
          background: backgroundImageUrl
            ? `linear-gradient(180deg, rgba(6,15,28,0.18) 0%, rgba(3,10,20,0.32) 100%), url(${backgroundImageUrl}) center center / cover no-repeat`
            : "linear-gradient(180deg, rgba(6,15,28,0.96) 0%, rgba(3,10,20,0.98) 100%)",
          borderTop: `1px solid ${accentSoft}`,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          boxShadow: `0 -20px 60px rgba(0,0,0,0.7), 0 0 60px ${accentSolid}1F, inset 0 1px 0 rgba(255,255,255,0.06)`,
          zIndex: 1001,
          color: NEX.text,
          fontFamily: "inherit",
          display: "flex",
          flexDirection: "column",
          animation: "nex-shop-slide-up 320ms cubic-bezier(.2,.7,.2,1) both",
          paddingBottom: "env(safe-area-inset-bottom, 0)",
        }}
      >
        {/* Drag handle · visual affordance that this is a bottom sheet */}
        <div
          aria-hidden
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: "rgba(255,255,255,0.28)",
            margin: "8px auto 0",
            flexShrink: 0,
          }}
        />
        {/* Header */}
        <div
          style={{
            padding: "18px 18px 12px",
            borderBottom: "1px solid rgba(0,159,239,0.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: accentSolid,
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              {isVenue ? "Menu" : "Shop"}
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {shopName}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.42)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: NEX.text,
              cursor: "pointer",
              padding: 0,
              display: "grid",
              placeItems: "center",
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {showSetupChooser ? (
          /* First-time setup chooser · sealed 2026-10-01 · replaces
             the Category Tabs + product grid with a 3-button row that
             lets a new user declare their shop type before anything
             else loads. Category Tabs are suppressed because they'd
             be meaningless with no sections. */
          <ShopTypeChooser
            onSelect={onSelectShopType}
            accentSolid={accentSolid}
            accentSoft={accentSoft}
            accentBorder={accentBorder}
          />
        ) : (
          <>
            {/* Category Tabs · sealed 2026-09-30 · appears above the grid
                when the seller has 2+ sections. */}
            <ShopCategoryTabs
              sections={sections}
              activeId={activeSectionId}
              onSelect={setActiveSectionId}
              accentSolid={accentSolid}
            />

            {/* Product grid */}
            <div
              data-nex-shop-scroll
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 14,
              }}
            >
              {visibleProducts.length === 0 ? (
                <div
                  style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    color: NEX.textDim,
                    fontSize: 13,
                    lineHeight: 1.55,
                  }}
                >
                  {isVenue
                    ? "This kitchen has no live menu items yet."
                    : "This shop has no live products yet."}
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  {visibleProducts.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onOpen={() => setSelectedProductId(p.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer · Bridge 11 hint + open shop link */}
        <div
          style={{
            padding: "10px 14px 12px",
            borderTop: "1px solid rgba(0,159,239,0.14)",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <div
            style={{
              flex: 1,
              fontSize: 10,
              letterSpacing: "0.04em",
              color: NEX.textMute,
              lineHeight: 1.4,
            }}
          >
            Tap a {isVenue ? "dish" : "product"} to add it to your cart
            and send the order right here in chat.
          </div>
          {/* Chat-native doctrine sealed 2026-09-29 · the slider stays
              inside the conversation · footer Close returns the buyer
              to the chat surface without leaving the peer's message
              stream. The public landing page is reachable from NEX
              Search, not from here. */}
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 14px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: NEX.text,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Close
          </button>
        </div>
      </section>

      {/* Product detail sheet · stacks over the grid on card tap.
          Escape / backdrop tap closes to grid · close button on the
          detail also fires the parent onClose so the whole shop
          collapses. Bridge 52 · always mount when we have a product
          (Add-to-cart + Send-in-chat live inside · inquiryAction is
          the legacy fallback only). */}
      <ProductDetailSheet
        open={!!selectedProduct}
        onClose={() => {
          setSelectedProductId(null);
          onClose();
        }}
        onBack={() => setSelectedProductId(null)}
        product={selectedProduct}
        peerName={peerName}
        isVenue={isVenue}
        shopContext={shopContext}
        sendCartOrderAction={sendCartOrderAction}
        inquiryAction={inquiryAction}
      />
    </>,
    document.body,
  );
}

function ProductCard({
  product,
  onOpen,
}: {
  product: ShopProduct;
  onOpen: () => void;
}) {
  const price = formatPrice(product.price_pence, product.currency);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${product.name}`}
      style={{
        borderRadius: 14,
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        padding: 0,
        color: "inherit",
        fontFamily: "inherit",
        textAlign: "left",
        transition: "transform 140ms ease, border-color 140ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(0,159,239,0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
      }}
    >
      {/* Image · fixed 4:3 aspect · falls back to a neutral tile
          if the product has no image_url yet. */}
      <div
        style={{
          aspectRatio: "4 / 3",
          background: "#0a1a30",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {product.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.image_url}
            alt={product.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              display: "grid",
              placeItems: "center",
              width: "100%",
              height: "100%",
              color: NEX.textMute,
              fontSize: 22,
            }}
          >
            🛍️
          </div>
        )}
      </div>

      {/* Meta */}
      <div style={{ padding: "8px 10px 10px" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: 2,
          }}
        >
          {product.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: NEX.orange,
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          {price}
        </div>
      </div>
    </button>
  );
}

/** Format a minor-unit price (e.g. IDR pence) into a display string.
 *  For IDR we render the major amount without decimals · millions
 *  read as "Rp 2,850,000" which matches how vintage-market listings
 *  are quoted locally. GBP and other 2-decimal currencies would need
 *  a slightly different formatter · not needed for the seed data. */
function formatPrice(pence: number, currency: string): string {
  const majors = Math.round(pence / 100);
  const withCommas = majors.toLocaleString();
  if (currency === "IDR") return `Rp ${withCommas}`;
  if (currency === "GBP") return `£${(pence / 100).toFixed(2)}`;
  if (currency === "USD") return `$${(pence / 100).toFixed(2)}`;
  return `${currency} ${withCommas}`;
}

function CloseIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** Category Tabs · sealed 2026-09-30 · updated 2026-09-30 (no-All).
 *  Chat-flavored equivalent of <CoverCategoryTabs> using the NEX palette
 *  rather than CSS vars. Founder direction: no "All" tab · nothing
 *  selected shows every product · only the highlighted tab carries a
 *  line beneath it. Tap active tab again to clear the filter. */
function ShopCategoryTabs({
  sections,
  activeId,
  onSelect,
  accentSolid,
}: {
  sections: ShopSection[];
  activeId: string;
  onSelect: (id: string) => void;
  accentSolid: string;
}) {
  if (sections.length <= 1) return null;

  const ordered = [...sections].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const visible = ordered.slice(0, 3);
  const tabs = visible.map((s) => ({ id: s.id, label: s.name }));

  return (
    <div
      role="tablist"
      aria-label="Shop category tabs"
      style={{
        display: "flex",
        gap: 4,
        padding: "0 14px",
        overflow: "hidden",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(isActive ? SHOP_ALL_TAB_ID : tab.id)}
            type="button"
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              padding: "10px 12px 12px",
              margin: 0,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: isActive ? 700 : 500,
              letterSpacing: "0.02em",
              color: isActive ? accentSolid : NEX.textDim,
              borderBottom: isActive
                ? `2px solid ${accentSolid}`
                : "none",
              transition: "color 160ms ease, border-color 160ms ease",
              whiteSpace: "nowrap",
              textTransform: "capitalize",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shop-type chooser · first-time setup slider · sealed 2026-10-01
// · S5 alignment 2026-10-18.
// ---------------------------------------------------------------------------
// Owner directive 2026-10-18 · the chooser now renders FOUR Sell
// cards (Products, Services, Food, Accommodation) + a separate
// "Earn with NEX" section (Affiliate). Services and Accommodation
// are visibly marked "Coming soon" because their /onboarding
// backends are not yet in place · tapping them does nothing (no
// synthetic flow, no fabricated route). The sealed modal + trigger
// architecture (and default-closed state) are unchanged · the only
// edit here is additive to the chooser's card list.
//
// The viewer picks their lane and the parent (viewer / peer-chat
// page / manage flow) routes to the appropriate next step. Products
// / Food / Affiliate still fire `onSelect(type)` on tap so existing
// callers that need the signal continue to work.

/** Resolve the icon for a given shop-chooser card. Kept close to
 *  the renderer so the SVG definitions stay colocated. */
function iconForCard(id: ShopChooserCardId): React.JSX.Element {
  switch (id) {
    case "products":
      return <ShopTypeProductsIcon />;
    case "services":
      return <ShopTypeServicesIcon />;
    case "food":
      return <ShopTypeFoodIcon />;
    case "accommodation":
      return <ShopTypeAccommodationIcon />;
    case "affiliate":
      return <ShopTypeAffiliateIcon />;
  }
}

function ShopTypeChooser({
  onSelect,
  accentSolid,
  accentSoft,
  accentBorder,
}: {
  onSelect?: (type: "products" | "food" | "affiliate") => void;
  accentSolid: string;
  accentSoft: string;
  accentBorder: string;
}): React.JSX.Element {
  // Narrow onSelect's union · only the live Sell cards (products /
  // food) and Affiliate fire the callback. Services / Accommodation
  // are Coming-soon · their button renders disabled and never
  // dispatches.
  const dispatch = (card: ShopChooserCard): (() => void) | undefined => {
    if (!card.available) return undefined;
    if (card.id === "products")
      return () => onSelect?.("products");
    if (card.id === "food") return () => onSelect?.("food");
    if (card.id === "affiliate")
      return () => onSelect?.("affiliate");
    // Services / Accommodation are not in the callback's narrow
    // union · they stay silent (no onClick dispatch).
    return undefined;
  };

  const sell = sellCards();
  const earn = earnCards();

  return (
    <div
      style={{
        flex: 1,
        padding: "18px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          textAlign: "center",
          color: NEX.text,
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 1.3,
        }}
      >
        What are you selling on NEX?
      </div>
      <div
        style={{
          textAlign: "center",
          color: NEX.textDim,
          fontSize: 11,
          lineHeight: 1.4,
        }}
      >
        Pick a lane · you can change it later from Manage.
      </div>

      {/* Sell section · four cards per the owner-approved spec.
          Services and Accommodation render with a Coming-soon chip
          when `available === false` · unclickable, no synthetic
          backend. */}
      <div
        data-nex-shop-chooser-section="sell"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 4,
        }}
      >
        {sell.map((card) => (
          <ShopTypeButton
            key={card.id}
            icon={iconForCard(card.id)}
            label={card.label}
            caption={card.caption}
            href={card.href}
            comingSoon={!card.available}
            onClick={dispatch(card)}
            accentSolid={accentSolid}
            accentSoft={accentSoft}
            accentBorder={accentBorder}
            dataLayout={card.id}
          />
        ))}
      </div>

      {/* Earn with NEX · separate section · owner directive
          2026-10-18 "separate 'Earn with NEX' section for
          Affiliate". Only renders when the catalogue has at least
          one earn card so the section header can't orphan. */}
      {earn.length > 0 && (
        <>
          <div
            data-nex-shop-chooser-section-divider
            aria-hidden
            style={{
              marginTop: 4,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${accentSoft}, transparent)`,
            }}
          />
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.textDim,
              textAlign: "center",
            }}
          >
            Earn with NEX
          </div>
          <div
            data-nex-shop-chooser-section="earn"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {earn.map((card) => (
              <ShopTypeButton
                key={card.id}
                icon={iconForCard(card.id)}
                label={card.label}
                caption={card.caption}
                href={card.href}
                comingSoon={!card.available}
                onClick={dispatch(card)}
                accentSolid={accentSolid}
                accentSoft={accentSoft}
                accentBorder={accentBorder}
                dataLayout={card.id}
              />
            ))}
          </div>
        </>
      )}

      <div
        style={{
          marginTop: "auto",
          textAlign: "center",
          color: NEX.textMute,
          fontSize: 10,
          letterSpacing: "0.04em",
          lineHeight: 1.5,
        }}
      >
        Setting up your shop takes about a minute · nothing publishes
        until you're ready.
      </div>
    </div>
  );
}

// Keep SHOP_CHOOSER_CATALOG referenced so the module graph pins the
// sealed data module even if the renderer is later refactored.
void SHOP_CHOOSER_CATALOG;

function ShopTypeButton({
  icon,
  label,
  caption,
  href,
  comingSoon,
  onClick,
  accentSolid,
  accentSoft,
  accentBorder,
  dataLayout,
}: {
  icon: React.ReactNode;
  label: string;
  caption: string;
  href: string | null;
  comingSoon?: boolean;
  onClick?: () => void;
  accentSolid: string;
  accentSoft: string;
  accentBorder: string;
  dataLayout?: string;
}): React.JSX.Element {
  // Owner directive 2026-10-18 · when `comingSoon` is true we
  // render a disabled surface with a visible chip · no navigation,
  // no synthetic flow. The sealed Link version is reserved for the
  // live Products / Food / Affiliate paths.
  if (comingSoon || href === null) {
    return (
      <div
        role="button"
        aria-disabled="true"
        tabIndex={-1}
        data-nex-shop-type-card={dataLayout ?? ""}
        data-nex-shop-type-coming-soon="1"
        style={{
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 12px",
          borderRadius: 14,
          background: `linear-gradient(180deg, ${accentSolid}14 0%, ${accentSolid}06 100%)`,
          border: `1px dashed ${accentSoft}`,
          color: NEX.text,
          cursor: "not-allowed",
          textAlign: "left",
          position: "relative",
          width: "100%",
          boxSizing: "border-box",
          minWidth: 0,
          opacity: 0.65,
        }}
      >
        {/* Icon · left · muted to match the disabled treatment */}
        <div
          style={{
            flexShrink: 0,
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "rgba(0,0,0,0.3)",
            border: `1px solid ${accentBorder}`,
            display: "grid",
            placeItems: "center",
            color: accentSolid,
            opacity: 0.75,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.01em",
                color: NEX.text,
              }}
            >
              {label}
            </div>
            <span
              data-nex-shop-type-coming-soon-chip
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(255,120,0,0.14)",
                border: "1px solid rgba(255,120,0,0.55)",
                color: NEX.orange,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              Coming soon
            </span>
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: 12,
              fontWeight: 500,
              lineHeight: 1.35,
              color: "#B4BAC3",
              textShadow: "0 0 2px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.5)",
              overflowWrap: "anywhere",
            }}
          >
            {caption}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      data-nex-shop-type-card={dataLayout ?? ""}
      style={{
        textDecoration: "none",
        display: "flex",
        alignItems: "center",
        // Sealed 2026-10-11 · tighter gap + tighter horizontal
        // padding so the row fits a 390px (minus 28px parent
        // padding = 362px) card without wrapping the caption into
        // a third line. Horizontal padding reduced 16 → 12 ·
        // icon-to-text gap reduced 14 → 10 · the right arrow
        // margin uses auto so it pins to the row's right edge
        // without needing extra width.
        gap: 10,
        padding: "12px 12px",
        borderRadius: 14,
        background: `linear-gradient(180deg, ${accentSolid}24 0%, ${accentSolid}10 100%)`,
        border: `1px solid ${accentSoft}`,
        color: NEX.text,
        cursor: "pointer",
        textAlign: "left",
        position: "relative",
        width: "100%",
        boxSizing: "border-box",
        minWidth: 0,
        transition:
          "transform 140ms ease, box-shadow 140ms ease, background 140ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateX(2px)";
        e.currentTarget.style.boxShadow = `0 10px 24px ${accentSolid}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateX(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Icon · left · slightly smaller to make room on narrow phones */}
      <div
        style={{
          flexShrink: 0,
          width: 42,
          height: 42,
          borderRadius: 12,
          background: "rgba(0,0,0,0.4)",
          border: `1px solid ${accentBorder}`,
          display: "grid",
          placeItems: "center",
          color: accentSolid,
        }}
      >
        {icon}
      </div>
      {/* Label + caption · middle · min-width:0 lets the flex item
          actually shrink so long captions wrap instead of forcing
          overflow. */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.01em",
            color: NEX.text,
          }}
        >
          {label}
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.35,
            color: "#B4BAC3",
            textShadow: "0 0 2px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.5)",
            overflowWrap: "anywhere",
          }}
        >
          {caption}
        </div>
      </div>
      {/* Right · arrow · theme-tinted · flexShrink keeps it tight */}
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          color: accentSolid,
          fontSize: 18,
          lineHeight: 1,
          marginLeft: 2,
        }}
      >
        →
      </div>
    </Link>
  );
}

function ShopTypeProductsIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14l-1.5 12a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8L5 7Z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M9 7V5a3 3 0 0 1 6 0v2"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShopTypeFoodIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 3v8c0 1.1-.9 2-2 2v8"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path
        d="M10 3v8c0 1.1-.9 2-2 2v0c-1.1 0-2-.9-2-2V3"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path
        d="M18 3v18"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path
        d="M14 11c0-4 2-7 4-7v10"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShopTypeAffiliateIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 15 L15 9"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <path
        d="M10 7h-3a4 4 0 0 0 0 8h2"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 17h3a4 4 0 0 0 0-8h-2"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Owner-authorised 2026-10-18 · S5 · Services + Accommodation icons.
// Both marked "Coming soon" in the chooser so these glyphs render
// in a muted treatment · they still need distinct identities so the
// row doesn't read as a placeholder.
function ShopTypeServicesIcon(): React.JSX.Element {
  // Wrench crossed with sparkle · reads as "work · bookable service"
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 7a3 3 0 0 1 4 4l-7 7-4 1 1-4 7-7Z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 20l1-1"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <circle cx="18" cy="6" r="1" fill="currentColor" />
    </svg>
  );
}

function ShopTypeAccommodationIcon(): React.JSX.Element {
  // Bed / room silhouette · reads as "stay-and-book"
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 20V9"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path
        d="M21 20v-6a2 2 0 0 0-2-2H3"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 16h18"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <circle cx="8" cy="10.5" r="1.6" stroke="currentColor" strokeWidth={1.4} />
    </svg>
  );
}
