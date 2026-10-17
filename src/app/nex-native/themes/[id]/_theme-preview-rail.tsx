"use client";

// src/app/nex-native/themes/[id]/_theme-preview-rail.tsx
//
// NEX Chat Theme Preview · right-edge Shop + Cart rail · owner-sealed
// 2026-10-18.
// --------------------------------------------------------------------
// Owner directive · "build the right side 2 buttons on the right side
// near screen edge and make sure chat bubbles do not hide behind the
// buttons" + "shop slider when button shop is activated will show
// slider the exact same as joker slider all themes same".
//
// What this does:
//
//   1. Injects a scoped <style> block that HIDES the native Shop +
//      Cart buttons on both preview chrome paths so the rail is the
//      sole affordance. Chat scroll area gets padding-right: 56 so
//      bubbles can't disappear behind the floating buttons.
//
//   2. Mounts two 40px circular buttons at `right: 10px`, stacked
//      vertically. Shop on top (opens the sealed ShopGridModal · the
//      SAME slider Joker uses, so every theme shows the identical
//      slider · recoloured via themeAccent). Cart below (links to
//      /nex-native/cart).
//
//   3. Vertical anchor · top: 40% · high enough above the composer
//      and lower-right 3-dot/+ pair, low enough that the header +
//      hero stay visible.
//
//   4. Supplies mock product data to the slider · 4 generic items ·
//      enough to prove the slider's grid + chrome in preview without
//      pretending there's a real backend behind it. For a real chat
//      the shop products come from the peer's business shop.
//
// Client Component · owns the shop-open state + the ShopGridModal
// mount + CSS injection.

import * as React from "react";
import Link from "next/link";
import {
  ShopGridModal,
  type ShopProduct,
  type ShopContext,
} from "@/app/nex-native/chat/_shop-grid-modal";

interface ThemePreviewRailProps {
  /** Theme accent hex · drives rim colour on both rail buttons AND
   *  the ShopGridModal (every rim · active-tab underline · CTA
   *  border switches to this hue). */
  readonly accent: string;
  /** Theme display name · shown in the slider header. */
  readonly themeName: string;
  /** Whether the preview is a venue (menu) · swaps the slider
   *  eyebrow "Menu" vs "Shop" + CTA copy. Defaults to false. */
  readonly isVenue?: boolean;
}

const MOCK_PREVIEW_PRODUCTS: ReadonlyArray<ShopProduct> = [
  {
    id: "mock-1",
    kind: "product",
    name: "Signature piece",
    description: "A hero product from this shop · preview-only mock.",
    price_pence: 2499,
    currency: "GBP",
    image_url: null,
    tags: null,
    stock_status: "in_stock",
  },
  {
    id: "mock-2",
    kind: "product",
    name: "Everyday pick",
    description: "The regular reach-for item · preview-only mock.",
    price_pence: 1299,
    currency: "GBP",
    image_url: null,
    tags: null,
    stock_status: "in_stock",
  },
  {
    id: "mock-3",
    kind: "product",
    name: "Bundle deal",
    description: "Two-for-one combo · preview-only mock.",
    price_pence: 3499,
    currency: "GBP",
    image_url: null,
    tags: null,
    stock_status: "in_stock",
  },
  {
    id: "mock-4",
    kind: "product",
    name: "Limited run",
    description: "Scarcity marker for test rendering · preview mock.",
    price_pence: 4999,
    currency: "GBP",
    image_url: null,
    tags: null,
    stock_status: "in_stock",
  },
];

export function ThemePreviewRail({
  accent,
  themeName,
  isVenue,
}: ThemePreviewRailProps): React.JSX.Element {
  const [shopOpen, setShopOpen] = React.useState(false);

  /* Owner directive 2026-10-18 · "shop slider when button shop is
     activated will show slider the exact same as joker slider all
     themes same". The rail owns the shop state + mounts the sealed
     ShopGridModal directly · bypasses each theme's own shop sheet so
     the slider is byte-identical on every preview. */
  const shopContext: ShopContext = React.useMemo(
    () => ({
      shop_id: `preview-${themeName.toLowerCase().replace(/\s+/g, "-")}`,
      shop_slug: null,
      shop_owner_account_id: "preview-mock",
      shop_display_name: themeName,
    }),
    [themeName],
  );

  return (
    <>
      <style>{`
        /* Hide the native Shop + Cart on both cluster paths so the
           rail is the sole affordance. Home is already hidden by
           the sibling ThemePreviewDrawer block. */
        [data-nex-se-header-action="shop"],
        [data-nex-se-header-action="cart"] {
          display: none !important;
        }
        [data-nex-native-r1-cluster] a[title="Shop"],
        [data-nex-native-r1-cluster] a[title="Cart"] {
          display: none !important;
        }
        /* Pad the chat message area so bubbles can't sit behind
           the floating rail. 56 = 40 button + 10 rail-right + 6
           breathing. Applied to both scroll containers. */
        [data-nex-se-messages],
        [data-nex-message-scroll] {
          padding-right: 56px !important;
        }
        /* Owner directive 2026-10-18 · the ShopGridModal AND the
           JokerKeypad both portal outside the phone frame so on
           desktop they span the full viewport width. Clip both to
           the app width (420px) and centre horizontally so they
           read as part of the phone preview. Mobile (< 500px) is
           unaffected · the frame already fills the viewport.
           The backdrop stays full-viewport (common bottom-sheet
           pattern) by not being clipped. */
        @media (min-width: 500px) {
          section[role="dialog"][aria-modal="true"][aria-label$="products"],
          [data-nex-joker-keypad] {
            left: 50% !important;
            right: auto !important;
            width: 420px !important;
            max-width: 420px !important;
            transform: translateX(-50%) !important;
          }
        }
        /* Owner directive 2026-10-18 · "slider must also match with
           back ground theme color for shop". Overlay the theme
           accent gradient (opaque enough to tint navy toward the
           theme) on top of the sealed slider panel. The existing
           product cards + text keep their legibility because the
           accent layer is semi-transparent. */
        section[role="dialog"][aria-modal="true"][aria-label$="products"] {
          background: linear-gradient(180deg, ${accent}55 0%, ${accent}22 100%), linear-gradient(180deg, rgba(6,15,28,0.96) 0%, rgba(3,10,20,0.98) 100%) !important;
        }
      `}</style>

      <div
        data-nex-theme-preview-rail
        style={{
          position: "absolute",
          right: 10,
          top: "40%",
          transform: "translateY(-50%)",
          zIndex: 7,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <RailButton
          label="Shop"
          accent={accent}
          onClick={() => setShopOpen(true)}
        >
          <ShopIcon />
        </RailButton>
        <RailButton
          label="Cart"
          accent={accent}
          as={Link}
          href="/nex-native/cart"
        >
          <CartIcon />
        </RailButton>
      </div>

      {/* Sealed ShopGridModal · the SAME slider Joker uses · recoloured
          by themeAccent. No real cart/inquiry wiring in preview · the
          slider still renders products + chrome correctly. */}
      <ShopGridModal
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        shopName={themeName}
        shopHref={null}
        products={[...MOCK_PREVIEW_PRODUCTS]}
        peerName={themeName}
        isVenue={isVenue}
        shopContext={shopContext}
        themeAccent={accent}
      />
    </>
  );
}

// ─── Shared button shell ─────

type RailButtonBaseProps = {
  readonly label: string;
  readonly accent: string;
  readonly children: React.ReactNode;
};

type RailButtonButtonProps = RailButtonBaseProps & {
  readonly as?: undefined;
  readonly onClick: () => void;
};

type RailButtonLinkProps = RailButtonBaseProps & {
  readonly as: typeof Link;
  readonly href: string;
};

function RailButton(
  props: RailButtonButtonProps | RailButtonLinkProps,
): React.JSX.Element {
  const sharedStyle: React.CSSProperties = {
    display: "grid",
    placeItems: "center",
    width: 40,
    height: 40,
    borderRadius: 999,
    background: "rgba(0,0,0,0.45)",
    border: `1px solid ${props.accent}66`,
    color: "#F2F5F8",
    cursor: "pointer",
    textDecoration: "none",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    boxShadow: `0 4px 14px rgba(0,0,0,0.5), 0 0 10px ${props.accent}33`,
  };
  if ("as" in props && props.as) {
    const LinkComp = props.as;
    return (
      <LinkComp
        href={props.href}
        aria-label={props.label}
        title={props.label}
        data-nex-preview-rail-button={props.label}
        style={sharedStyle}
      >
        {props.children}
      </LinkComp>
    );
  }
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      data-nex-preview-rail-button={props.label}
      onClick={props.onClick}
      style={sharedStyle}
    >
      {props.children}
    </button>
  );
}

// ─── Icons ─────

function ShopIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 2l-2 5h16l-2-5" />
      <path d="M4 7v13h16V7" />
      <path d="M9 11a3 3 0 0 0 6 0" />
    </svg>
  );
}

function CartIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M3 4h2l2.4 11.5a2 2 0 0 0 2 1.5h8.3a2 2 0 0 0 2-1.5L21 7H6" />
    </svg>
  );
}
