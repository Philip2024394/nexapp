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
  /** Owner directive 2026-10-20 · top-right "Add listing" CTA shown
   *  only to the owner viewing their own shop. The caller resolves
   *  the route via `listingAddRouteFor(subtype)` and passes the
   *  concrete href + label here. When undefined the slider renders
   *  exactly as before · prop is additive · guest viewers never
   *  receive it. For blocked subtypes (accommodation Phase A1 ·
   *  property) the caller passes `blocked: true` + a reason chip
   *  instead of a Link, so the slider stays honest about Phase B. */
  ownerAddListing?:
    | { readonly state: "ready"; readonly href: string; readonly label: string }
    | { readonly state: "blocked"; readonly label: string; readonly reason: string };
}

export function StandardShopSlider({
  engine,
  products,
  onProductTap,
  focusProductId = null,
  ownerAddListing,
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
      {ownerAddListing ? (
        <StandardShopSliderOwnerAddCTA
          engine={engine}
          addListing={ownerAddListing}
        />
      ) : null}
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

// Owner-only "Add listing" tile · rendered as the first slide of the
// slider so the owner's eye lands on it immediately. For blocked
// subtypes (accommodation Phase A1 · property) renders a dimmed
// honest "coming in Phase B" chip instead of a Link, preserving the
// doctrine that the slider never implies functionality that doesn't
// exist.
function StandardShopSliderOwnerAddCTA(props: {
  readonly engine: ResolvedEngine;
  readonly addListing:
    | { readonly state: "ready"; readonly href: string; readonly label: string }
    | {
        readonly state: "blocked";
        readonly label: string;
        readonly reason: string;
      };
}): React.JSX.Element {
  const { engine, addListing } = props;
  const t = engine.shopTreatment();
  const commonStyle: React.CSSProperties = {
    ...t.cardStyle,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    gap: 8,
    outline: `2px dashed ${engine.colours.primary}88`,
    outlineOffset: -2,
  };

  if (addListing.state === "ready") {
    return (
      <a
        href={addListing.href}
        data-nex-se-shop-slider-owner-add-listing="ready"
        aria-label={addListing.label}
        style={{
          ...commonStyle,
          cursor: "pointer",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <span
          aria-hidden
          style={{
            fontSize: 28,
            lineHeight: 1,
            color: engine.colours.primary,
            fontWeight: 300,
          }}
        >
          +
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "inherit",
          }}
        >
          {addListing.label}
        </span>
      </a>
    );
  }

  // blocked
  return (
    <div
      data-nex-se-shop-slider-owner-add-listing="blocked"
      role="status"
      aria-label={addListing.reason}
      title={addListing.reason}
      style={{
        ...commonStyle,
        opacity: 0.65,
        cursor: "default",
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: 20,
          lineHeight: 1,
          color: "rgba(255,255,255,0.6)",
        }}
      >
        ⏳
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "rgba(255,255,255,0.75)",
          lineHeight: 1.3,
        }}
      >
        {addListing.label}
      </span>
    </div>
  );
}
