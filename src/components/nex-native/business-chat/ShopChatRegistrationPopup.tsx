"use client";

// src/components/nex-native/business-chat/ShopChatRegistrationPopup.tsx
//
// Stage 7 · item 5 · 2026-11-14 · owner-authorised.
// -----------------------------------------------------------------------------
// Shared polished Stage-4 registration popup. Reused by every anon
// entry into Shop Chat so copy, layout, and `?next=` round-trip
// shape stay identical across surfaces:
//
//   · Product Detail Sheet · "More Details"           (cover/_product-detail-sheet.tsx)
//   · Shop cover floating FAB · "Chat with us"        (cover/_shop-chat-fab.tsx)
//   · Anonymous chat preview · composer "Send"        ([businessSlug]/chat/_anon-preview.tsx)
//
// Copy source · src/lib/nex-native/business-chat/shop-chat-registration-popup.ts
// (`getShopChatRegistrationCopy` + `buildShopChatRegistrationHrefs`).
//
// Honesty invariants · unit-tested in shop-chat-registration-popup.test.ts:
//   · explains the account is the customer's OWN NEX, not the shop's
//   · promises replies arrive in customer's own NEX Chat
//   · never claims SMS / phone / push verification is in place
//
// Portalled to document.body so it floats above the sheet / shop
// surface regardless of parent stacking context. Esc + backdrop
// click dismiss. SSR-safe · returns null until mounted.

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  getShopChatRegistrationCopy,
  buildShopChatRegistrationHrefs,
} from "@/lib/nex-native/business-chat/shop-chat-registration-popup";

export interface ShopChatRegistrationPopupProps {
  /** Shop display name · interpolated into "Message <shop>" headline.
   *  Empty / null falls back to "this shop". */
  readonly shopName: string | null;
  /** Shop slug · routed into the `?next=` round-trip so the customer
   *  returns to the right shop after auth. */
  readonly shopSlug: string;
  /** Optional product id to preserve through the auth round-trip ·
   *  when present, the Create / Sign-in hrefs stamp `?product=<id>`
   *  on the `?next=` target so the Stage-1 chip repaints after auth. */
  readonly productId?: string | null;
  /** Shop accent hex · drives the primary CTA background colour. */
  readonly accent: string;
  /** Close handler · backdrop click / Esc / "Not now" all call this. */
  readonly onDismiss: () => void;
}

export function ShopChatRegistrationPopup({
  shopName,
  shopSlug,
  productId,
  accent,
  onDismiss,
}: ShopChatRegistrationPopupProps): React.JSX.Element | null {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);
  const copy = React.useMemo(
    () => getShopChatRegistrationCopy(shopName),
    [shopName],
  );
  const hrefs = React.useMemo(
    () => buildShopChatRegistrationHrefs(shopSlug, productId ?? null),
    [shopSlug, productId],
  );
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div
      data-nex-shop-chat-registration-popup
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-shop-chat-reg-headline"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        aria-hidden
        onClick={onDismiss}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
        }}
      />
      <section
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 340,
          background: "#FFFFFF",
          color: "#0A1526",
          borderRadius: 18,
          padding: "22px 20px 18px",
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <h2
          id="nex-shop-chat-reg-headline"
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: "-0.01em",
            color: "#0A1526",
          }}
        >
          {copy.headline}
        </h2>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13,
            lineHeight: 1.45,
            color: "#3B4A5C",
          }}
        >
          {copy.explainer}
        </p>
        <p
          data-nex-shop-chat-registration-reply-promise
          style={{
            margin: "8px 0 16px",
            fontSize: 12,
            lineHeight: 1.45,
            color: "#5A6A7E",
          }}
        >
          {copy.replyPromise}
        </p>
        <Link
          href={hrefs.signUpHref}
          data-nex-shop-chat-registration-primary
          style={{
            display: "block",
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            background: accent,
            color: "#1A120A",
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textAlign: "center",
            textDecoration: "none",
            boxShadow: "0 8px 20px rgba(198,161,91,0.25)",
            boxSizing: "border-box",
          }}
        >
          {copy.primaryCta}
        </Link>
        <Link
          href={hrefs.signInHref}
          data-nex-shop-chat-registration-secondary
          style={{
            display: "block",
            width: "100%",
            marginTop: 8,
            padding: "10px 14px",
            borderRadius: 12,
            background: "transparent",
            color: "#0A1526",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textAlign: "center",
            textDecoration: "none",
            border: `1px solid rgba(10,21,38,0.15)`,
            boxSizing: "border-box",
          }}
        >
          {copy.secondaryCta}
        </Link>
        <button
          type="button"
          data-nex-shop-chat-registration-dismiss
          onClick={onDismiss}
          style={{
            display: "block",
            margin: "12px auto 0",
            padding: "6px 10px",
            background: "transparent",
            color: "#5A6A7E",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.04em",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {copy.dismissLabel}
        </button>
      </section>
    </div>,
    document.body,
  );
}
