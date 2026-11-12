"use client";

// src/components/nex-native/shop-drawer/shop-drawer-client.tsx
//
// NEX · Shop Drawer · Phase 1 prototype UI.
// Owner-authorised 2026-11-05.
// -----------------------------------------------------------------------------
// Left-slide drawer that opens from the lower-right 3-dot FAB. Shows
// the viewer's shop products one-per-row (square product card + title +
// price · visual style modelled on the sealed Music Library card). Tap
// a card → sends the product to the peer via the sealed share-product
// server action (zero new backend · reuses sendPeerMessageOrShareProductAction
// with product_id in the form data).
//
// Phase 1 scope:
//   · Mock product data from mock-shop-products.ts (not live yet).
//   · Seller gate delegated to the mounting page (hidden entirely for
//     non-shop accounts via `viewerHasShop={false}`).
//   · Call Centre is NOT accessible from this FAB · it remains reachable
//     via the + attach panel's Call Centre tile. The FAB previously
//     opened Call Centre on existing peer chats · the owner explicitly
//     repurposed this slot for the Shop drawer on the prototype.
//
// Phase 2 (NOT authorised yet):
//   · Server-resolved nex_product rows scoped to viewer's nex_business.
//   · Real signed image URLs + live price formatting.
//   · Back-navigation, product-detail preview, quantity/variant picker.
//
// Visual language · Ireland palette (same tokens as NotificationsDrawer
// + ControlDrawer):
//   · Panel BG    · var(--nex-world-drawer-bg)    → Ireland #123D2B
//   · Primary ink · var(--nex-world-primary-ink)  → Ireland Sage #AFC5B5
//   · Muted ink   · var(--nex-world-muted-ink)    → Ireland dim Sage #8FA69A
//   · Accent      · var(--nex-world-secondary)    → Ireland Gold #C6A15B
//   · Edge-light  · gated by same control-drawer-edge-light-display var

import * as React from "react";
import { createPortal } from "react-dom";
import {
  MOCK_SHOP_PRODUCTS,
  type ShopProduct,
} from "@/lib/nex-native/shop-drawer/mock-shop-products";

const CYAN = "var(--nex-world-secondary, #00AFFF)";
const TEXT = "var(--nex-world-primary-ink, #F2F5F8)";
const MUTED = "var(--nex-world-muted-ink, #7D9BC0)";
const PANEL = "var(--nex-world-drawer-bg, #0A1526)";
const PANEL_BORDER =
  "color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 18%, transparent)";

export interface ShopDrawerProps {
  /** True when the viewer owns a shop · when false the 3-dot FAB is
   *  NOT rendered · non-shop viewers see no bottom-right FAB at all. */
  readonly viewerHasShop: boolean;
  /** Peer display name · rendered in the drawer header ("Share with Aoife"). */
  readonly peerDisplayName: string;
  /** Bound share action · the mounting page calls
   *  `sendPeerMessageOrShareProductAction.bind(null, peer.id)` so this
   *  component never sees the raw peer id. */
  readonly shareAction: (formData: FormData) => Promise<void> | Promise<never> | void;
  /** Optional product list · Phase 1 defaults to MOCK_SHOP_PRODUCTS so
   *  the prototype renders without further wiring. Phase 2 will pass a
   *  server-resolved array here. */
  readonly products?: ReadonlyArray<ShopProduct>;
}

export function ShopDrawer({
  viewerHasShop,
  peerDisplayName,
  shareAction,
  products,
}: ShopDrawerProps): React.JSX.Element | null {
  const [open, setOpen] = React.useState(false);
  const [rendered, setRendered] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [frameNode, setFrameNode] = React.useState<HTMLElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  const searchRef = React.useRef<HTMLInputElement | null>(null);

  const list = products ?? MOCK_SHOP_PRODUCTS;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.tag?.toLowerCase().includes(q) ?? false),
    );
  }, [list, query]);

  const openDrawer = React.useCallback(() => {
    if (typeof document !== "undefined") {
      const frame = document.querySelector<HTMLElement>(".nex-native-frame");
      setFrameNode(frame ?? document.body);
    }
    setRendered(true);
    setOpen(true);
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const closeDrawer = React.useCallback(() => {
    setVisible(false);
    setOpen(false);
    setTimeout(() => {
      setRendered(false);
      triggerRef.current?.focus();
    }, 280);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeDrawer]);

  React.useEffect(() => {
    if (visible) closeRef.current?.focus();
  }, [visible]);

  // Owner directive 2026-11-12 · prior gate hid the entire drawer and
  // FAB for viewers without a shop. The new behaviour keeps the FAB
  // visible AND lets the drawer open · the body shows an "Activate
  // your shop" container with a CTA so buyers-who-are-not-yet-sellers
  // can learn about shop sharing in-context. Call Centre remains
  // reachable via + regardless.
  const noShopMode = !viewerHasShop;

  const overlay = (
    <>
      <button
        type="button"
        aria-label="Close shop"
        onClick={closeDrawer}
        data-nex-shop-drawer-backdrop
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          border: "none",
          padding: 0,
          cursor: "pointer",
          opacity: visible ? 1 : 0,
          transition: "opacity 220ms ease-out",
          zIndex: 60,
        }}
      />

      <aside
        role="dialog"
        aria-label="Your shop · share a product"
        aria-modal="true"
        data-nex-shop-drawer
        data-nex-shop-drawer-visible={visible ? "true" : "false"}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          maxHeight: "100%",
          // Owner directive 2026-11-05 · drawer width matches the
          // product card width · one card per row. Card = 220px square
          // + 16px side padding on each side = 252px panel content ·
          // rounded to 260px for safe-area + border. Narrow on purpose.
          width: "min(260px, 85%)",
          maxWidth: 280,
          background: PANEL,
          borderRight: `1.5px solid ${PANEL_BORDER}`,
          boxShadow: "8px 0 32px rgba(0,0,0,0.6)",
          zIndex: 61,
          display: "flex",
          flexDirection: "column",
          transform: visible ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 280ms cubic-bezier(0.22, 0.9, 0.3, 1)",
          willChange: "transform",
          overflow: "hidden",
          color: TEXT,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <style>{`
          @keyframes nex-shop-drawer-edge-light {
            0% { transform: translateY(-100px); opacity: 0; }
            12% { opacity: 1; }
            88% { opacity: 1; }
            100% { transform: translateY(calc(100vh + 20px)); opacity: 0; }
          }
          [data-nex-shop-drawer-card]:hover [data-nex-shop-drawer-card-image],
          [data-nex-shop-drawer-card]:focus-visible [data-nex-shop-drawer-card-image] {
            border-color: ${CYAN};
            box-shadow: 0 0 14px color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 55%, transparent);
            outline: none;
          }
          [data-nex-shop-drawer-card]:hover [data-nex-shop-drawer-card-send],
          [data-nex-shop-drawer-card]:focus-visible [data-nex-shop-drawer-card-send] {
            opacity: 1;
          }
          /* Owner directive 2026-11-05 · bar-type scrollbar · gold pill
             thumb clamped to a minimum 30% of visible height. Firefox +
             WebKit both styled. Short content keeps a visible handle. */
          [data-nex-shop-drawer-scroll] {
            scrollbar-width: thin;
            scrollbar-color: ${CYAN} transparent;
          }
          [data-nex-shop-drawer-scroll]::-webkit-scrollbar {
            width: 8px;
          }
          [data-nex-shop-drawer-scroll]::-webkit-scrollbar-track {
            background: transparent;
          }
          [data-nex-shop-drawer-scroll]::-webkit-scrollbar-thumb {
            background: ${CYAN};
            border-radius: 999px;
            min-height: 30%;
            border: 2px solid transparent;
            background-clip: padding-box;
          }
          [data-nex-shop-drawer-scroll]::-webkit-scrollbar-thumb:hover {
            background-color: color-mix(in srgb, ${CYAN} 85%, white 15%);
          }
        `}</style>
        <div
          aria-hidden
          data-nex-shop-drawer-edge
          style={{
            display:
              "var(--nex-world-control-drawer-edge-light-display, none)",
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
                "nex-shop-drawer-edge-light 3400ms linear infinite",
              willChange: "transform",
            }}
          />
        </div>

        <header
          style={{
            padding:
              "calc(env(safe-area-inset-top, 0px) + 16px) 14px 10px 14px",
            borderBottom: `1px solid ${PANEL_BORDER}`,
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ShopGlyph accent={CYAN} />
              <h2
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "-0.005em",
                  color: TEXT,
                }}
              >
                Your shop
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              aria-label="Close shop"
              onClick={closeDrawer}
              style={{
                // Owner directive 2026-11-10 · shop-drawer × now a
                // solid NEX Orange puck with a white glyph · matches
                // the How-It-Works sheet close + the chat-header
                // orange CTA language.
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#FF7200",
                border: "1px solid #FF7200",
                color: "#FFFFFF",
                cursor: "pointer",
                padding: 0,
                fontSize: 18,
                fontWeight: 800,
                lineHeight: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(255, 114, 0, 0.35)",
              }}
            >
              ×
            </button>
          </div>
          <p
            style={{
              margin: "6px 0 0 0",
              fontSize: 11,
              color: MUTED,
              letterSpacing: "0.02em",
            }}
          >
            {noShopMode ? (
              <>Never been as easy to impress and seal the deal.</>
            ) : (
              <>
                Tap a product to send it to{" "}
                <span style={{ color: TEXT }}>{peerDisplayName}</span>
              </>
            )}
          </p>

          {/* Search · sticky under header · hidden in noShopMode since
              there is nothing to search yet. */}
          <div
            style={{
              display: noShopMode ? "none" : "flex",
              marginTop: 10,
              position: "relative",
              alignItems: "center",
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: MUTED,
                pointerEvents: "none",
                display: "inline-flex",
              }}
            >
              <SearchGlyph />
            </span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your products"
              aria-label="Search your products"
              data-nex-shop-drawer-search
              style={{
                width: "100%",
                padding: "8px 10px 8px 32px",
                borderRadius: 10,
                background:
                  "color-mix(in srgb, var(--nex-world-background-base, #020914) 60%, transparent)",
                border: `1px solid ${PANEL_BORDER}`,
                color: TEXT,
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
        </header>

        {/* Body · scrollable product list · 1 per row */}
        <div
          data-nex-shop-drawer-scroll
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 20px 20px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {noShopMode ? (
            <ActivateShopContainer onClose={closeDrawer} />
          ) : filtered.length === 0 ? (
            <EmptyState hasQuery={query.trim().length > 0} />
          ) : (
            filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                shareAction={shareAction}
                onSent={closeDrawer}
              />
            ))
          )}
        </div>
      </aside>
    </>
  );

  return (
    <>
      {/* Trigger · lower-right 3-dot FAB · same slot the Call Centre
          FAB occupies elsewhere. On the prototype this slot opens the
          Shop drawer for sellers · hidden entirely for buyers via the
          component-level gate above. */}
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open your shop · share a product"
        aria-expanded={open}
        onClick={openDrawer}
        data-nex-shop-drawer-trigger
        style={{
          position: "absolute",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)",
          right: 16,
          width: 44,
          height: 44,
          borderRadius: "50%",
          // Owner directive 2026-11-05 later-same-day iter 2 · SOLID
          // BLACK FAB (no translucency, no blur) matching the new
          // header `+` + bell styling. White hairline + gold inner
          // ring kept for definition over the chat wallpaper.
          background: "#000000",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          color: CYAN,
          cursor: "pointer",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50,
          boxShadow:
            "0 6px 18px rgba(0,0,0,0.55), inset 0 0 0 1px color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 24%, transparent)",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <ThreeDotsGlyph accent={CYAN} />
      </button>

      {rendered && frameNode ? createPortal(overlay, frameNode) : null}
    </>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────

function ProductCard({
  product,
  shareAction,
  onSent,
}: {
  readonly product: ShopProduct;
  readonly shareAction: (
    formData: FormData,
  ) => Promise<void> | Promise<never> | void;
  readonly onSent: () => void;
}): React.JSX.Element {
  // Server action invocation · tap the whole card to send. The form
  // submission handles the redirect itself · we close the drawer
  // optimistically on submit so the chat scroll-to-bottom isn't fighting
  // an open drawer when the new bubble lands.
  const [pending, startTransition] = React.useTransition();
  return (
    <form
      action={shareAction}
      onSubmit={() => {
        startTransition(() => {});
        // Owner-authored 2026-11-05 · action toast · fires on card tap
        // so the seller sees "Product shared" instantly rather than
        // waiting for the chat round-trip.
        void (async () => {
          const mod = await import(
            "@/components/nex-native/ui/action-toast"
          );
          mod.showActionToast({
            message: `Shared ${product.name}`,
            kind: "success",
          });
        })();
        setTimeout(onSent, 120);
      }}
      style={{
        margin: 0,
        display: "block",
      }}
    >
      <input type="hidden" name="product_id" value={product.id} />
      <button
        type="submit"
        disabled={pending}
        data-nex-shop-drawer-card
        aria-label={`Send ${product.name} to the chat`}
        style={{
          width: "100%",
          padding: 0,
          background: "transparent",
          border: "none",
          cursor: pending ? "default" : "pointer",
          color: "inherit",
          textAlign: "left",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          opacity: pending ? 0.6 : 1,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {/* Square image area · modelled on the Music Library card */}
        <div
          data-nex-shop-drawer-card-image
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1 / 1",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--nex-world-background-base, #020914)",
            border: `1px solid ${PANEL_BORDER}`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
            transition:
              "border-color 160ms ease-out, box-shadow 160ms ease-out",
            boxSizing: "border-box",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />

          {/* Send chip · fades in on hover/focus */}
          <span
            data-nex-shop-drawer-card-send
            aria-hidden
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              padding: "4px 10px",
              borderRadius: 999,
              background: CYAN,
              color: "#0a0608",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              opacity: 0,
              transition: "opacity 160ms ease-out",
              pointerEvents: "none",
            }}
          >
            Send
          </span>
        </div>

        {/* Title · up to two lines · min-height reserved so cards don't
            jump between one- and two-line names. */}
        <span
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            fontSize: 14,
            fontWeight: 600,
            color: TEXT,
            lineHeight: 1.25,
            overflow: "hidden",
            minHeight: "calc(1.25em * 2)",
            wordBreak: "break-word",
          }}
        >
          {product.name}
        </span>

        {/* Price + optional tag */}
        <span
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
            fontSize: 12,
            marginTop: -4,
          }}
        >
          <span
            style={{
              color: CYAN,
              fontWeight: 700,
              letterSpacing: "0.01em",
            }}
          >
            {product.priceLabel}
          </span>
          {product.tag ? (
            <span style={{ color: MUTED, fontSize: 11 }}>{product.tag}</span>
          ) : null}
        </span>
      </button>
    </form>
  );
}

function EmptyState({
  hasQuery,
}: {
  readonly hasQuery: boolean;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: "48px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        textAlign: "center",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${PANEL_BORDER}`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: CYAN,
        }}
      >
        <ShopGlyph accent={CYAN} />
      </div>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>
        {hasQuery ? "No products match" : "Your shop is empty"}
      </p>
      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: MUTED, maxWidth: 240 }}>
        {hasQuery
          ? "Try a different term, or clear the search to see everything."
          : "Products you list for sale will appear here · tap any one to share it in this chat for instant selling."}
      </p>
    </div>
  );
}

// Owner directive 2026-11-12 · Activate-your-shop container · rendered
// in the drawer body when the viewer has no shop set up yet. The 3-dot
// trigger still opens the drawer so non-sellers can discover the shop
// feature in-context; the body explains the pitch and offers a CTA to
// start the Shop setup. Palette matches the sealed Emerald drawer.
function ActivateShopContainer({
  onClose,
}: {
  readonly onClose: () => void;
}): React.JSX.Element {
  return (
    <div
      data-nex-shop-drawer-activate
      style={{
        padding: "4px 2px 0",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "rgba(255, 114, 0, 0.14)",
          border: `1px solid ${PANEL_BORDER}`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FF7200",
          alignSelf: "center",
        }}
      >
        <ShopGlyph accent="#FF7200" size={26} />
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1.3,
          color: TEXT,
          textAlign: "center",
        }}
      >
        Activate your shop to see products in this area for sharing to
        your customers on chat.
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          lineHeight: 1.45,
          color: MUTED,
          textAlign: "center",
        }}
      >
        Never been as easy to impress and seal the deal.
      </p>
      <a
        href="/nex-native/manage/shop"
        onClick={() => onClose()}
        data-nex-shop-drawer-activate-cta
        style={{
          marginTop: 2,
          padding: "12px 18px",
          borderRadius: 999,
          background: "#FF7200",
          color: "#FFFFFF",
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          textDecoration: "none",
          textAlign: "center",
          boxShadow: "0 4px 14px rgba(255, 114, 0, 0.4)",
        }}
      >
        Activate your shop
      </a>
    </div>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────

function ThreeDotsGlyph({
  accent,
}: {
  readonly accent: string;
}): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill={accent}
      aria-hidden
    >
      <circle cx="6" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="18" cy="12" r="1.9" />
    </svg>
  );
}

function ShopGlyph({
  accent,
  size = 16,
}: {
  readonly accent: string;
  readonly size?: number;
}): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={accent}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function SearchGlyph(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
