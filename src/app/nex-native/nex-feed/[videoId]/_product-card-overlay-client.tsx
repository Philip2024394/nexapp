"use client";

// src/app/nex-native/nex-feed/[videoId]/_product-card-overlay-client.tsx
//
// Owner-authorised 2026-11-05 iter 25 · shoppable-card overlay for the
// NEX Live video viewer. Portaled to document.body so it floats above
// the sealed viewer chrome without the viewer needing a code change
// beyond "render me when product is non-null".
//
// Behaviour:
//   · Fixed-position card hugging the bottom-left of the viewport,
//     above the action rail / composer area.
//   · Tap → navigates to the business shop (/nex-native/<slug>) OR
//     the product-detail page if we later add one · for v1 the
//     seller's shop is the honest destination.
//   · Price formatted via the shared penceToDisplay helper IF the
//     currency is known · falls back to "View product" otherwise.
//   · Null-safe · returns null when `product` is missing.
//
// No background-video rendering here · the underlying `<video>`
// already plays the video the product references (because
// background_video_id = this video's id · that's HOW this card got
// rendered). The overlay is purely the card chrome.

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

export interface ProductCardOverlayProps {
  readonly product: {
    readonly productId: string;
    readonly businessId: string;
    readonly title: string;
    readonly pricePence: number | null;
    readonly currency: string | null;
    readonly imageUrl: string | null;
    readonly shopSlug: string | null;
  } | null;
}

export function ProductCardOverlayClient({
  product,
}: ProductCardOverlayProps): React.JSX.Element | null {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted || !product) return null;

  const priceLabel = formatPrice(product.pricePence, product.currency);
  const destination = product.shopSlug
    ? `/nex-native/${product.shopSlug}`
    : `/nex-native/u/${product.businessId}`;

  return createPortal(
    <Link
      href={destination}
      data-nex-product-card-overlay
      data-nex-product-id={product.productId}
      aria-label={`Open shop · ${product.title}`}
      style={{
        position: "fixed",
        left: "max(env(safe-area-inset-left, 0px), 12px)",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        gap: 10,
        maxWidth: "calc(100vw - 90px)",
        padding: 8,
        borderRadius: 14,
        background: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        boxShadow:
          "0 12px 30px rgba(0,0,0,0.55), inset 0 0 0 1px color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 24%, transparent)",
        color: "#F2F5F8",
        textDecoration: "none",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt=""
          width={52}
          height={52}
          loading="lazy"
          decoding="async"
          style={{
            width: 52,
            height: 52,
            borderRadius: 10,
            objectFit: "cover",
            flexShrink: 0,
            background: "#111",
          }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            width: 52,
            height: 52,
            borderRadius: 10,
            background:
              "linear-gradient(135deg, var(--nex-world-secondary, #C6A15B) 0%, #1a1208 100%)",
            flexShrink: 0,
          }}
        />
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minWidth: 0,
          paddingRight: 4,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "-0.005em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 220,
          }}
        >
          {product.title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {priceLabel ? (
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "var(--nex-world-secondary, #C6A15B)",
                letterSpacing: "0.01em",
              }}
            >
              {priceLabel}
            </span>
          ) : null}
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "3px 8px",
              borderRadius: 999,
              background: "#FF7200",
              color: "#1A0808",
            }}
          >
            View
          </span>
        </div>
      </div>
    </Link>,
    document.body,
  );
}

function formatPrice(pence: number | null, currency: string | null): string | null {
  if (pence === null || !Number.isFinite(pence)) return null;
  const cur = (currency ?? "").trim().toUpperCase() || "EUR";
  const units = pence / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 2,
    }).format(units);
  } catch {
    return `${cur} ${units.toFixed(2)}`;
  }
}
