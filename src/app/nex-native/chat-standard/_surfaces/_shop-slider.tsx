"use client";

// src/app/nex-native/chat-standard/_surfaces/_shop-slider.tsx
//
// Phase 2A.0 · Standard shop + product-card surface.
//
// Horizontal slider of product cards. Treatment comes from the engine:
// Ocean gets driftwood-board cards with "current" scroll + buoy
// framing; Cakes gets glass cards with momentum; Joker gets ticket
// style; etc.
//
// Pure presentation. Caller supplies products; cards never read
// theme.id or hex colours directly.

import * as React from "react";
import type { ResolvedEngine } from "../_engine/theme-engine";

export interface StandardShopProduct {
  id: string;
  name: string;
  price: string;
  imageUrl: string | null;
  tagline?: string;
}

export interface StandardShopSliderProps {
  engine: ResolvedEngine;
  products: StandardShopProduct[];
  onProductTap?: (productId: string) => void;
  /** Phase 3 · deep-link focus. When non-null AND the id matches a
   *  product in `products`, that card is scrolled into view on mount
   *  and rendered with a 2px accent border. When null (default) the
   *  slider renders exactly as before · prop is additive. */
  focusProductId?: string | null;
}

export function StandardShopSlider({
  engine,
  products,
  onProductTap,
  focusProductId = null,
}: StandardShopSliderProps): React.JSX.Element {
  const t = engine.shopTreatment();
  const focusedCardRef = React.useRef<HTMLButtonElement | null>(null);
  // Scroll the focused card into view once on mount (and whenever the
  // focus id changes). Guard against zero-match: if the id isn't in
  // `products`, the effect no-ops · the slider still renders normally.
  React.useEffect(() => {
    if (focusProductId === null) return;
    const target = focusedCardRef.current;
    if (!target) return;
    // `scrollIntoView` with `inline:center` lines the card up in the
    // middle of the horizontal viewport · the shop sheet host decides
    // how tall it is, so we only control the horizontal placement.
    target.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
  }, [focusProductId]);
  return (
    <div
      data-nex-se-shop-slider
      data-nex-se-shop-slider-focus-id={focusProductId ?? ""}
      style={t.containerStyle}
    >
      {products.map((p) => {
        const isFocused = focusProductId !== null && p.id === focusProductId;
        return (
          <button
            key={p.id}
            type="button"
            ref={isFocused ? focusedCardRef : null}
            onClick={() => onProductTap?.(p.id)}
            data-nex-se-product-card={p.id}
            data-nex-se-product-card-focused={isFocused ? "true" : "false"}
            style={{
              ...t.cardStyle,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              textAlign: "left",
              // Accent ring on the focused card · uses the engine's
              // primary accent so the border honours the active theme.
              outline: isFocused ? `2px solid ${engine.colours.primary}` : undefined,
              outlineOffset: isFocused ? 2 : undefined,
            }}
          >
          <div
            style={{
              aspectRatio: "1 / 1",
              borderRadius: t.productFraming === "buoy" ? "50%" : 10,
              overflow: "hidden",
              background: p.imageUrl
                ? `center/cover url(${p.imageUrl})`
                : `linear-gradient(135deg, ${engine.colours.secondary}, ${engine.colours.deep})`,
              border: `1px solid ${engine.colours.primary}55`,
              marginBottom: 4,
            }}
          />
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "inherit",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {p.name}
          </div>
          {p.tagline && (
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.65)",
                lineHeight: 1.3,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {p.tagline}
            </div>
          )}
          <div
            style={{
              marginTop: "auto",
              fontSize: 13,
              fontWeight: 800,
              ...t.cardAccentStyle,
            }}
          >
            {p.price}
          </div>
        </button>
        );
      })}
    </div>
  );
}
