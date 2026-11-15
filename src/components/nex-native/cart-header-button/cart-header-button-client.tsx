"use client";

// src/components/nex-native/cart-header-button/cart-header-button-client.tsx
//
// NEX Cart Header Button · opens the centered cart popup.
// Owner-authorised 2026-11-16 · Nov-16 execution block · Stream A.
// -----------------------------------------------------------------
// Visual twin of the sealed `HeaderCartIcon` (inline variant · solid
// NEX orange + white glyph · owner directive 2026-11-10 iter 3) but
// CLICK BEHAVIOUR DIFFERS:
//   · HeaderCartIcon       → Link to /nex-native/cart (full page)
//   · CartHeaderButton (us) → opens CartPopupClient (centered modal)
//
// The numeric badge is DISTINCT from the notification indicator and
// reads the same localStorage contract as HeaderCartIcon (nex_cart_v1).
// Zero count hides the badge · the icon stays visible so buyers always
// know where the cart lives.
//
// This button does NOT trigger the left notification drawer or the
// right ControlDrawer. It is a standalone overlay root.

import * as React from "react";
import { CartPopupClient } from "@/app/nex-native/cart/_cart-popup-client";
import {
  NEX_CART_STORAGE_KEY,
  type NexCartItem,
} from "@/lib/nex-native/cart-types";

function readCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(NEX_CART_STORAGE_KEY);
    if (!raw) return 0;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return 0;
    return arr.reduce(
      (n, x) =>
        n +
        (x &&
        typeof x === "object" &&
        typeof (x as NexCartItem).quantity === "number"
          ? Math.max(0, Math.floor((x as NexCartItem).quantity))
          : 0),
      0,
    );
  } catch {
    return 0;
  }
}

export interface CartHeaderButtonProps {
  /** Visual size variant. "inline" matches other 36×36 header icons,
   *  "fixed" places the button in the top-right of the phone frame. */
  readonly variant?: "inline" | "fixed";
}

/** Header cart icon · clicking opens the centered CartPopupClient. */
export function CartHeaderButton({
  variant = "inline",
}: CartHeaderButtonProps = {}): React.JSX.Element {
  const [count, setCount] = React.useState(0);
  const [hydrated, setHydrated] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setCount(readCount());
    setHydrated(true);
    const onChange = () => setCount(readCount());
    window.addEventListener("nex-cart-changed", onChange);
    const onStorage = (e: StorageEvent) => {
      if (e.key === NEX_CART_STORAGE_KEY) setCount(readCount());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("nex-cart-changed", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const isInline = variant === "inline";
  const iconSize = isInline ? 15 : 20;

  const svg = (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={isInline ? 1.9 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="21" r="1.5" />
      <circle cx="18" cy="21" r="1.5" />
      <path d="M3 3h2l2.7 12.3a2 2 0 0 0 2 1.7h7.6a2 2 0 0 0 2-1.6L21 8H6" />
    </svg>
  );

  const badge =
    hydrated && count > 0 ? (
      <span
        aria-hidden
        data-nex-cart-header-button-badge
        style={{
          position: "absolute",
          top: isInline ? -5 : -4,
          right: isInline ? -6 : -4,
          minWidth: isInline ? 14 : 20,
          height: isInline ? 14 : 20,
          padding: isInline ? "0 3px" : "0 5px",
          borderRadius: 999,
          background: "linear-gradient(180deg, #CC1818, #7A0000)",
          color: "#FFFFFF",
          fontSize: isInline ? 9 : 11,
          fontWeight: 800,
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: isInline ? "1px solid #050f1e" : "1.5px solid #050f1e",
          boxShadow: "0 4px 10px rgba(122,0,0,0.65)",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {count > 99 ? "99+" : count}
      </span>
    ) : null;

  const trigger = isInline ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={
        count > 0
          ? `Open cart · ${count} item${count === 1 ? "" : "s"}`
          : "Open cart"
      }
      aria-haspopup="dialog"
      aria-expanded={open}
      data-nex-cart-header-button
      style={{
        position: "relative",
        display: "inline-grid",
        placeItems: "center",
        width: 36,
        height: 36,
        padding: 0,
        borderRadius: "50%",
        background: "#FF7200",
        color: "#FFFFFF",
        border: "none",
        cursor: "pointer",
        boxShadow: "0 2px 8px rgba(255, 114, 0, 0.35)",
        fontFamily: "inherit",
      }}
    >
      {svg}
      {badge}
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={
        count > 0
          ? `Open cart · ${count} item${count === 1 ? "" : "s"}`
          : "Open cart"
      }
      aria-haspopup="dialog"
      aria-expanded={open}
      data-nex-cart-header-button
      className="fixed z-40 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-white"
      style={{
        right: 68,
        top: 16,
        background: "#FF7200",
        border: "none",
        cursor: "pointer",
        boxShadow: "0 2px 10px rgba(255, 114, 0, 0.4)",
      }}
    >
      {svg}
      {badge}
    </button>
  );

  return (
    <>
      {trigger}
      <CartPopupClient open={open} onClose={() => setOpen(false)} />
    </>
  );
}
