"use client";

// src/components/nex-native/live-commerce/ProductOverlayCard.tsx
//
// Owner directive 2026-10-22 · NEX Live Commerce · landscape product
// card overlaid on the live-stream viewport. Theme-tinted (reads CSS
// vars from the active theme-skin). Rendered client-side on the viewer
// surface · product data flows via Supabase Realtime presence meta,
// not through NEX server media storage (zero-cost architecture).
//
// Interactions:
//   · "Order now" fires onOrderNow(productId) · parent routes to
//     peer chat with the live session + product context attached.
//   · "Hide" fires onHide · broadcaster-side control only · hidden
//     cards are not rendered.
//
// Rendering notes:
//   · Fixed to bottom-left when prop position === "bottom-left"
//     (default · stays clear of right-dock controls).
//   · Max width 320px · scales down on narrow mobile.
//   · Thumbnail aspect ratio 1:1 · 64x64 on compact, 80x80 standard.

import * as React from "react";

export interface LiveProductSnapshot {
  readonly productId: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly priceLabel: string;              // pre-formatted · e.g. "Rp 48.000"
  readonly shopName: string;                // small-text eyebrow
  readonly stockStatus: "in_stock" | "low_stock" | "sold_out" | "made_to_order";
  readonly hasVariants: boolean;            // decides whether Order-now shows the variant sheet first
}

export interface ProductOverlayCardProps {
  readonly product: LiveProductSnapshot;
  readonly onOrderNow: (productId: string) => void;
  /** Owner-only control · hides the card without ending the stream. */
  readonly onHide?: () => void;
  /** When true, the hide button is visible (broadcaster view). */
  readonly showHideButton?: boolean;
  readonly position?: "bottom-left" | "bottom-right";
}

export function ProductOverlayCard(props: ProductOverlayCardProps): React.JSX.Element {
  const { product, onOrderNow, onHide, showHideButton = false, position = "bottom-left" } = props;
  const unavailable = product.stockStatus === "sold_out";

  return (
    <div
      data-nex-live-product-overlay={product.productId}
      role="group"
      aria-label={`Live product · ${product.name}`}
      style={{
        position: "absolute",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)",
        left: position === "bottom-left" ? 14 : "auto",
        right: position === "bottom-right" ? 14 : "auto",
        maxWidth: "min(320px, calc(100vw - 28px))",
        boxSizing: "border-box",
        display: "flex",
        gap: 10,
        alignItems: "center",
        padding: 10,
        borderRadius: 14,
        background: "rgba(2, 9, 20, 0.78)",
        border: "1px solid var(--nex-accent-soft, rgba(0, 175, 255, 0.42))",
        boxShadow: "0 12px 28px -10px rgba(0, 0, 0, 0.65), 0 0 20px -8px var(--nex-accent-glow, rgba(0, 175, 255, 0.55))",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        color: "var(--nex-text, #F2F5F8)",
        fontFamily: "inherit",
        zIndex: 20,
      }}
    >
      {/* Thumbnail · fallback to initials when image missing */}
      <div
        aria-hidden={!!product.imageUrl}
        role={product.imageUrl ? undefined : "img"}
        aria-label={product.imageUrl ? undefined : "Product image placeholder"}
        style={{
          flexShrink: 0,
          width: 64,
          height: 64,
          borderRadius: 12,
          background: product.imageUrl
            ? `url(${product.imageUrl}) center / cover no-repeat, #0A1526`
            : "linear-gradient(135deg, var(--nex-accent-faint, rgba(0, 175, 255, 0.18)), #0A1526)",
          border: "1px solid var(--nex-accent-soft, rgba(0, 175, 255, 0.32))",
          display: "grid",
          placeItems: "center",
          color: "var(--nex-accent, #00AFFF)",
          fontSize: 24,
          fontWeight: 900,
          letterSpacing: "-0.02em",
        }}
      >
        {!product.imageUrl
          ? product.name
              .split(" ")
              .map((w) => w[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
          : null}
      </div>

      {/* Metadata column */}
      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: "var(--nex-accent, #00AFFF)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {product.shopName}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "var(--nex-text, #F2F5F8)",
            lineHeight: 1.25,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {product.name}
        </div>
        <div
          style={{
            marginTop: 2,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 900,
            color: "var(--nex-accent, #00AFFF)",
          }}
        >
          <span>{product.priceLabel}</span>
          {product.stockStatus === "low_stock" && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                color: "#F59E0B",
                background: "rgba(245, 158, 11, 0.14)",
                border: "1px solid rgba(245, 158, 11, 0.38)",
                padding: "1px 5px",
                borderRadius: 5,
                lineHeight: 1,
              }}
            >
              Low stock
            </span>
          )}
          {product.stockStatus === "sold_out" && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                color: "#FF3355",
                background: "rgba(255, 51, 85, 0.14)",
                border: "1px solid rgba(255, 51, 85, 0.38)",
                padding: "1px 5px",
                borderRadius: 5,
                lineHeight: 1,
              }}
            >
              Sold out
            </span>
          )}
        </div>
      </div>

      {/* Action column */}
      <div style={{ display: "grid", gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => !unavailable && onOrderNow(product.productId)}
          disabled={unavailable}
          data-nex-live-product-overlay-order
          style={{
            minHeight: 36,
            padding: "0 12px",
            borderRadius: 10,
            background: unavailable ? "rgba(255, 255, 255, 0.08)" : "var(--nex-accent, #00AFFF)",
            color: unavailable ? "rgba(255, 255, 255, 0.5)" : "#031018",
            border: "none",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 0.3,
            cursor: unavailable ? "default" : "pointer",
            fontFamily: "inherit",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
            whiteSpace: "nowrap",
          }}
        >
          {unavailable ? "Unavailable" : "Order now"}
        </button>
        {showHideButton && onHide && (
          <button
            type="button"
            onClick={onHide}
            aria-label="Hide product card"
            data-nex-live-product-overlay-hide
            style={{
              minHeight: 28,
              padding: "0 10px",
              borderRadius: 8,
              background: "transparent",
              color: "var(--nex-text-dim, #8BA9D1)",
              border: "1px solid rgba(139, 169, 209, 0.3)",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              touchAction: "manipulation",
            }}
          >
            Hide
          </button>
        )}
      </div>
    </div>
  );
}
