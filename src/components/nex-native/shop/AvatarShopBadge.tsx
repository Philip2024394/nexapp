"use client";

// src/components/nex-native/shop/AvatarShopBadge.tsx
//
// Social-to-Shop Discovery · Phase V · P15 · 2026-11-05.
// -----------------------------------------------------------------
// A small circular "Shop" button positioned at the bottom-right of a
// profile avatar. When the viewer taps it, it routes to the owner's
// public shop page at /nex-native/{slug}.
//
// Core rules (owner-sealed 2026-11-05):
//   1. Only renders when the owner has a published, accessible shop
//      (caller resolves `hasShop + shopHref` server-side · we never
//      guess · nothing renders when shopHref is null/empty).
//   2. Always routes to the actual owner's shop URL · never a
//      generic directory.
//   3. Visible but discreet · doesn't cover the face · uses the
//      shop glyph + NEX cyan rim · drop-shadow so it reads over any
//      avatar colour.
//   4. The tap target is isolated from any parent <Link> or <button>
//      wrapping the avatar · preventDefault + stopPropagation so the
//      card's primary click (open chat / open profile) is NOT
//      triggered by the badge tap.
//
// Does NOT handle the "has shop" check · caller MUST pass a resolved
// shopHref · pattern keeps the component dumb + testable.

import * as React from "react";
import { useRouter } from "next/navigation";

export interface AvatarShopBadgeProps {
  /** Resolved public shop URL (/nex-native/{slug}). When null or
   *  empty, nothing renders. Caller resolves this from the owner's
   *  nex_business row server-side. */
  readonly shopHref: string | null | undefined;
  /** Seller display name · used for aria-label only · kept honest. */
  readonly sellerName: string;
  /** Pixel diameter of the surrounding avatar · drives the badge's
   *  own size so the badge stays proportional on 48 / 56 / 64 / 72
   *  avatars without a layout-specific override. */
  readonly avatarPx: number;
  /** Optional palette override for callers rendering on a shop
   *  template with a specific accent. Falls back to the sealed NEX
   *  cyan. */
  readonly accentHex?: string;
}

export function AvatarShopBadge({
  shopHref,
  sellerName,
  avatarPx,
  accentHex,
}: AvatarShopBadgeProps): React.JSX.Element | null {
  const router = useRouter();
  if (!shopHref) return null;

  // Badge diameter · about 36% of the avatar diameter · reads clearly
  // without covering more than a quadrant.
  const badgePx = Math.max(18, Math.round(avatarPx * 0.36));
  const accent = accentHex ?? "#00AFFF";

  function handleTap(e: React.MouseEvent<HTMLButtonElement>) {
    // Isolate from any parent <Link> or clickable row wrapping the
    // avatar · owner-sealed 2026-11-05 · a shop-badge tap is NEVER
    // the same event as a chat-row tap.
    e.preventDefault();
    e.stopPropagation();
    router.push(shopHref ?? "/nex-native");
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      aria-label={`Visit ${sellerName}'s shop`}
      data-nex-avatar-shop-badge
      style={{
        position: "absolute",
        bottom: -2,
        right: -2,
        width: badgePx,
        height: badgePx,
        borderRadius: "50%",
        background: "#0A1120",
        border: `2px solid ${accent}`,
        color: accent,
        display: "grid",
        placeItems: "center",
        padding: 0,
        cursor: "pointer",
        boxShadow:
          "0 2px 6px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.08)",
        zIndex: 3,
        // Re-paint reliably over any avatar colour; backdrop-filter
        // softens any busy avatar background so the glyph still reads.
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <ShopGlyph size={Math.round(badgePx * 0.55)} />
    </button>
  );
}

function ShopGlyph({ size }: { readonly size: number }): React.JSX.Element {
  // Simple shopfront glyph · awning + door · reads as "shop" at tiny
  // sizes where a shopping-bag can get muddy. Uses currentColor so
  // the parent button's `color` drives the stroke.
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9 L5 4 L19 4 L21 9" />
      <path d="M4 9 L4 20 L20 20 L20 9" />
      <path d="M10 20 L10 13 L14 13 L14 20" />
    </svg>
  );
}
