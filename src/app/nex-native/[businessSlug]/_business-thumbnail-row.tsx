"use client";

// src/app/nex-native/[businessSlug]/_business-thumbnail-row.tsx
//
// Phase 3 · Owner-shop product/service thumbnails under the business
// name on the public business page.
//
// Visual contract:
//   · 92 × 92 CSS pixel tiles, horizontally scrollable
//   · ~6 initially visible on a 375px-wide mobile viewport
//   · owner-upload images (nex_product.image_url) rendered as-is
//   · never fabricated · empty array ⇒ component renders null
//
// Interaction contract:
//   · each tile is an <a href> to the owner's peer chat with the
//     selected product id in the query string. The peer chat page
//     reads `?focus_product=<id>` and auto-opens the shop sheet
//     scrolled to that item.
//   · if the visitor is unsigned, the peer chat page redirects to
//     /nex-native/sign-in?next=<the full chat URL>. The sign-in flow
//     then returns the visitor to the exact URL after login, so the
//     selected product is preserved across the auth round-trip.
//
// Honesty:
//   · if the business has zero live products this component renders
//     NOTHING · never an empty strip, never a placeholder, never
//     "coming soon" copy. The decision happens on the server (parent
//     page). The client here only renders what it's handed.
//   · if a product has no image, a neutral initial glyph is drawn in
//     the same 92×92 frame · we do NOT substitute a category tile or
//     a stock photo (ADR-0022 compliance).

import * as React from "react";
import Link from "next/link";
import type { ProductThumbnail } from "@/lib/nex-native/product-service";

export interface BusinessThumbnailRowProps {
  readonly ownerAccountId: string;
  readonly products: readonly ProductThumbnail[];
}

const PALETTE = {
  surface: "rgba(2,9,20,0.72)",
  surfaceHi: "#0E1C33",
  border: "rgba(255,255,255,0.08)",
  text: "#F2F5F8",
  textSoft: "#7D9BC0",
  orange: "#FF7200",
} as const;

export function BusinessThumbnailRow(
  props: BusinessThumbnailRowProps,
): React.JSX.Element | null {
  const { ownerAccountId, products } = props;
  // Zero live products · render nothing. Never an empty strip.
  if (products.length === 0) return null;

  return (
    <nav
      data-nex-business-thumbnail-row
      data-nex-business-thumbnail-count={products.length}
      aria-label="Shop products"
      style={{
        marginTop: 18,
        marginBottom: 4,
        display: "flex",
        gap: 10,
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        paddingBottom: 4,
        // -20px negative margin extends the scroll area to the hero's
        // edge-to-edge horizontal padding without the thumbnail row
        // itself overflowing the hero column.
        marginLeft: -4,
        paddingLeft: 4,
      }}
    >
      {products.map((p) => (
        <ThumbnailTile
          key={p.id}
          product={p}
          ownerAccountId={ownerAccountId}
        />
      ))}
    </nav>
  );
}

function ThumbnailTile(props: {
  readonly product: ProductThumbnail;
  readonly ownerAccountId: string;
}): React.JSX.Element {
  const { product, ownerAccountId } = props;
  // Build the destination · the viewer may or may not be signed in.
  // The peer chat page's own session gate will route to sign-in with
  // ?next= if needed. We send the plain chat URL + focus_product.
  const href =
    `/nex-native/chat/peer/${ownerAccountId}` +
    `?focus_product=${encodeURIComponent(product.id)}`;
  const alt = product.image_url
    ? `${product.name} · product image`
    : `${product.name} · no image uploaded by the shop`;
  return (
    <Link
      href={href}
      data-nex-business-thumbnail-tile
      data-nex-business-thumbnail-product-id={product.id}
      aria-label={`Message about ${product.name}`}
      style={{
        flexShrink: 0,
        width: 92,
        height: 92,
        borderRadius: 14,
        overflow: "hidden",
        background: PALETTE.surfaceHi,
        border: `1px solid ${PALETTE.border}`,
        display: "block",
        position: "relative",
        textDecoration: "none",
      }}
    >
      {product.image_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={product.image_url}
          alt={alt}
          loading="lazy"
          decoding="async"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <NoImageGlyph name={product.name} />
      )}
    </Link>
  );
}

function NoImageGlyph(props: { readonly name: string }): React.JSX.Element {
  // Pure deterministic · take the first letter of the first word of
  // the product name. Never fabricates a photo-like image.
  const initial =
    (props.name.trim().split(/\s+/)[0]?.[0] ?? "·").toUpperCase().slice(0, 1);
  return (
    <div
      data-nex-business-thumbnail-noimage
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        color: PALETTE.textSoft,
        fontSize: 32,
        fontWeight: 700,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {initial}
    </div>
  );
}
