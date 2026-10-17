"use client";

// src/app/nex-native/themes/[id]/_theme-preview-rail.tsx
//
// NEX Chat Theme Preview · right-edge Shop + Cart rail · owner-sealed
// 2026-10-18.
// --------------------------------------------------------------------
// Owner directive · "build the right side 2 buttons on the right side
// near screen edge and make sure chat bubbles do not hide behind the
// buttons".
//
// What this does:
//
//   1. Injects a scoped <style> block that HIDES the native Shop +
//      Cart buttons on both preview chrome paths:
//        · Standard Experience · `[data-nex-se-header-action="shop"]`
//          and `[data-nex-se-header-action="cart"]`
//        · Viewer path (PortraitBloomShell / HeaderRightCluster) ·
//          `[data-nex-native-r1-cluster] a[title="Shop"]` and
//          `a[title="Cart"]`
//      Same scoping pattern as the Home-hide block in
//      _theme-preview-drawer.tsx so turning the rail off restores
//      the native cluster instantly.
//
//   2. Pads the chat message area on the right so bubbles can't
//      visually sit behind the floating rail · 56px gives the 40px
//      button + 10px margin + a touch of breathing room.
//
//   3. Mounts two 40px circular buttons at `right: 10px`, stacked
//      vertically. Shop on top (opens the sealed shop slider by
//      firing a synthetic click on the hidden native Shop button
//      so each theme's slider wiring stays untouched). Cart below
//      (links to /nex-native/cart).
//
//   4. Vertical anchor · roughly center of the chat area · low
//      enough that the identity header + wallpaper hero are
//      unobstructed · high enough that it clears the composer and
//      the lower-right 3-dot/+ pair. `top: 40%` is the pragmatic
//      sweet spot in a phone-aspect frame.
//
// Client Component · owns the shop-click bridge + CSS injection.

import * as React from "react";
import Link from "next/link";

interface ThemePreviewRailProps {
  /** Theme accent hex · drives rim colour on both buttons so the
   *  rail visibly belongs to the active theme. */
  readonly accent: string;
}

export function ThemePreviewRail({
  accent,
}: ThemePreviewRailProps): React.JSX.Element {
  const fireNativeShopClick = React.useCallback(() => {
    // Prefer Standard Experience · else fall through to the viewer
    // path's native shop link. Both are hidden by the <style> below
    // but still accept synthetic clicks.
    const seShop = document.querySelector<HTMLButtonElement>(
      '[data-nex-se-header-action="shop"]',
    );
    if (seShop) {
      seShop.click();
      return;
    }
    const viewerShop = document.querySelector<HTMLAnchorElement>(
      '[data-nex-native-r1-cluster] a[title="Shop"]',
    );
    if (viewerShop) viewerShop.click();
  }, []);

  return (
    <>
      <style>{`
        /* Hide the native Shop + Cart buttons so the rail is the
           sole affordance. Home is already hidden by the sibling
           ThemePreviewDrawer block. Owner directive 2026-10-18. */
        [data-nex-se-header-action="shop"],
        [data-nex-se-header-action="cart"] {
          display: none !important;
        }
        [data-nex-native-r1-cluster] a[title="Shop"],
        [data-nex-native-r1-cluster] a[title="Cart"] {
          display: none !important;
        }
        /* Pad the chat message area so bubbles can't sit behind
           the floating rail. 56px = 40 button + 10 rail-right + 6
           breathing room. Applied to both scroll containers. */
        [data-nex-se-messages],
        [data-nex-message-scroll] {
          padding-right: 56px !important;
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
          onClick={fireNativeShopClick}
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
      style={{ ...sharedStyle, border: `1px solid ${props.accent}66` }}
    >
      {props.children}
    </button>
  );
}

// ─── Icons · match the sealed R1 cluster vocabulary ─────

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
