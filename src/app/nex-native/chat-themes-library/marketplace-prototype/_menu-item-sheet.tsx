"use client";

// src/app/nex-native/chat-themes-library/marketplace-prototype/_menu-item-sheet.tsx
//
// Owner directive 2026-10-22 · menu-item bottom sheet · opens when a
// product card is tapped inside the brand-aware shop preview iframe.
// Shows the item at full detail · hero image · variants / description ·
// −/+ qty picker · themed Add-to-Order button with live total.
//
// Scope · PROTOTYPE ONLY. Add-to-Order does not persist anywhere ·
// a toast confirms the shape of the interaction (what a real buyer-
// facing food-order flow would do) · the marketplace commerce cart
// still tracks THEMES / INTROS / SHOPS, not individual menu items.
// A real buyer-facing order flow is a separate downstream product.

import * as React from "react";
import { CRISPY_CHICKEN_MOCK } from "@/app/nex-native/cover/mock-data";
import { formatDispatchLabel, type DispatchKind } from "./_types";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.3)",
  green: "#16D66B",
};

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatIdr(cents: number): string {
  const rupiah = Math.round(cents / 100);
  return `Rp ${rupiah.toLocaleString("id-ID")}`;
}

export interface MenuItemSheetProps {
  readonly brand: string;
  readonly productId: string;
  readonly accent: string;
  /** The chat theme wallpaper for the brand · used as the sheet
   *  background so the sheet reads as part of the brand surface
   *  rather than generic NEX chrome. A dark gradient overlay keeps
   *  text legible across any wallpaper. */
  readonly wallpaperUrl?: string | null;
  readonly onClose: () => void;
  /** Called when the buyer taps Add to Order with the final qty.
   *  Prototype only · the parent toasts a honest confirmation. */
  readonly onAdd?: (productId: string, quantity: number) => void;
  /** Owner directive 2026-10-22 · Ask-Seller slice 1 · when provided,
   *  renders an "Ask Seller" button alongside Add to Cart. Tapping it
   *  posts the product card into the owner's chat (production) or
   *  surfaces a toast (prototype). When omitted, the button is hidden
   *  so this prop is additive · no footer regression on surfaces that
   *  haven't wired a handler yet. */
  readonly onAskSeller?: (productId: string) => void;
}

export function MenuItemSheet({
  brand,
  productId,
  accent,
  wallpaperUrl,
  onClose,
  onAdd,
  onAskSeller,
}: MenuItemSheetProps): React.JSX.Element | null {
  // Only Crispy Chicken is wired to a brand mock today · others fall
  // back to null so the sheet never opens with placeholder content.
  const brandMock =
    brand === "crispy-chicken" ? CRISPY_CHICKEN_MOCK : null;

  const product = React.useMemo(() => {
    if (!brandMock) return null;
    return brandMock.products.find((p) => p.id === productId) ?? null;
  }, [brandMock, productId]);

  const section = React.useMemo(() => {
    if (!brandMock || !product) return null;
    return (
      brandMock.sections.find((s) => s.id === product.section_id) ?? null
    );
  }, [brandMock, product]);

  const [qty, setQty] = React.useState(1);

  // Owner directive 2026-10-22 · pull multi-image gallery from the
  // editor's localStorage (if the buyer previously ran the editor
  // and uploaded photos). Falls back to [] when no editor data ·
  // the sheet then shows the initials placeholder.
  const editorImages = React.useMemo(() => {
    if (typeof window === "undefined") return [] as string[];
    try {
      const raw = window.localStorage.getItem(`nex-mp-editor-${brand}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as {
        products?: Array<{ id?: string; images?: string[] }>;
      };
      const match = parsed.products?.find((p) => p?.id === productId);
      return Array.isArray(match?.images)
        ? (match.images.filter((s) => typeof s === "string") as string[])
        : [];
    } catch {
      return [];
    }
  }, [brand, productId]);

  // Owner directive 2026-10-22 · dispatch overlay · reads the same
  // editor localStorage so the sheet shows "Ready in 15 min" / "Dispatch
  // 2 days" alongside the price. Honest-null when the owner hasn't set
  // one · no chip renders.
  const dispatchLabel = React.useMemo((): string | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(`nex-mp-editor-${brand}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        products?: Array<{
          id?: string;
          dispatchKind?: string | null;
          dispatchValue?: number | null;
        }>;
      };
      const match = parsed.products?.find((p) => p?.id === productId);
      if (!match) return null;
      const kind =
        match.dispatchKind === "minutes" || match.dispatchKind === "days"
          ? (match.dispatchKind as DispatchKind)
          : null;
      const value =
        typeof match.dispatchValue === "number" && match.dispatchValue > 0
          ? match.dispatchValue
          : null;
      return formatDispatchLabel(kind, value);
    } catch {
      return null;
    }
  }, [brand, productId]);

  const [carouselIndex, setCarouselIndex] = React.useState(0);
  const hasGallery = editorImages.length > 0;
  const multiImages = editorImages.length > 1;

  // Esc + arrow keys when a gallery is present.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (multiImages && e.key === "ArrowLeft") {
        setCarouselIndex((i) =>
          i === 0 ? editorImages.length - 1 : i - 1,
        );
      }
      if (multiImages && e.key === "ArrowRight") {
        setCarouselIndex((i) => (i + 1) % editorImages.length);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, multiImages, editorImages.length]);

  if (!product) return null;

  const soldOut = product.stock_status === "sold_out";
  const lowStock = product.stock_status === "low_stock";
  const unitCents = product.price_pence;
  const totalCents = unitCents * qty;
  // Owner directive 2026-10-22 · spicy indicator · simple name match
  // for Crispy Chicken's spicy / nashville-hot items. When the real
  // seller editor lands, this becomes a per-item boolean (plus
  // vegetarian / dairy-free / etc. dietary chips).
  const isSpicy = /spicy|hot|sriracha|nashville/i.test(
    `${product.name} ${product.description ?? ""}`,
  );
  const addLabel = soldOut
    ? "Sold out"
    : qty > 1
    ? `Add ${qty} to Cart · ${formatIdr(totalCents)}`
    : `Add to Cart · ${formatIdr(totalCents)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${product.name} · menu item`}
      data-nex-marketplace-prototype-menu-item-sheet
      data-nex-marketplace-prototype-menu-item-sheet-brand={brand}
      data-nex-marketplace-prototype-menu-item-sheet-product={product.id}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 700,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      {/* Backdrop · tap to dismiss. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close menu item"
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(2, 9, 20, 0.68)",
          backdropFilter: "blur(6px) saturate(140%)",
          WebkitBackdropFilter: "blur(6px) saturate(140%)",
          border: "none",
          cursor: "pointer",
          padding: 0,
          margin: 0,
        }}
      />

      {/* Sheet · owner directive 2026-10-22 · wallpaper backs the
          whole panel + a dark gradient overlay keeps text legible
          across any brand image. Fallback to flat navy when the
          wallpaper is absent. */}
      <section
        data-nex-marketplace-prototype-menu-item-sheet-panel
        style={{
          position: "relative",
          background: wallpaperUrl
            ? `
              linear-gradient(180deg, rgba(5, 13, 24, 0.72) 0%, rgba(5, 13, 24, 0.88) 50%, rgba(5, 13, 24, 0.95) 100%),
              url("${wallpaperUrl}") center / cover no-repeat,
              #07131F
            `
            : "#07131F",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          border: `1px solid ${hexWithAlpha(accent, 0.5)}`,
          borderBottom: "none",
          boxShadow: `0 -16px 48px -12px rgba(0, 0, 0, 0.8), 0 0 24px -8px ${hexWithAlpha(accent, 0.55)}`,
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100% - 48px)",
          overflow: "hidden",
        }}
      >
        {/* Drag handle · visual-only, keyboard users have the ×
            button. Owner directive 2026-10-22 · tinted to the brand
            accent (the same colour the Add-to-Cart button carries)
            so the slider reads as part of the brand surface the
            moment it rises. */}
        <div
          aria-hidden
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: 10,
            paddingBottom: 4,
          }}
        >
          <div
            style={{
              width: 56,
              height: 5,
              borderRadius: 3,
              background: accent,
              boxShadow: `0 2px 8px -2px ${hexWithAlpha(accent, 0.7)}`,
            }}
          />
        </div>

        {/* Close button · top-right · black fill with white × ink. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            padding: 0,
            borderRadius: "50%",
            background: "#000000",
            color: "#FFFFFF",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            fontSize: 18,
            fontWeight: 900,
            lineHeight: 1,
            cursor: "pointer",
            fontFamily: "inherit",
            zIndex: 2,
            boxShadow: "0 4px 10px -4px rgba(0, 0, 0, 0.65)",
            WebkitTapHighlightColor: "transparent",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "6px 18px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Hero · gallery when the editor supplies photos ·
              otherwise themed initials placeholder. Arrows + count
              only render when there's more than one image. */}
          <div
            data-nex-marketplace-prototype-menu-item-hero
            data-nex-marketplace-prototype-menu-item-hero-count={editorImages.length}
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 10",
              borderRadius: 14,
              background: hasGallery
                ? `url("${editorImages[carouselIndex]}") center / cover no-repeat, ${NEX.bg}`
                : `linear-gradient(135deg, ${hexWithAlpha(accent, 0.42)}, ${hexWithAlpha(accent, 0.14)}), ${NEX.bg}`,
              border: `1px solid ${hexWithAlpha(accent, 0.3)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              transition: "background 220ms ease",
            }}
            aria-hidden={!hasGallery}
            aria-roledescription={hasGallery ? "carousel" : undefined}
          >
            {!hasGallery && (
              <span
                style={{
                  color: hexWithAlpha(accent, 0.9),
                  fontSize: 42,
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                  textShadow: `0 2px 10px rgba(0, 0, 0, 0.5)`,
                  fontFamily:
                    "'Georgia', 'Times New Roman', serif",
                }}
              >
                {product.name
                  .split(" ")
                  .map((w) => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")}
              </span>
            )}
            {multiImages && (
              <>
                {/* Count · top-center */}
                <div
                  data-nex-marketplace-prototype-menu-item-hero-counter
                  style={{
                    position: "absolute",
                    top: 10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "rgba(0, 0, 0, 0.6)",
                    color: "#FFFFFF",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.4,
                    fontVariantNumeric: "tabular-nums",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                  }}
                >
                  {carouselIndex + 1} / {editorImages.length}
                </div>
                {/* Prev · left */}
                <button
                  type="button"
                  onClick={() =>
                    setCarouselIndex((i) =>
                      i === 0 ? editorImages.length - 1 : i - 1,
                    )
                  }
                  aria-label="Previous photo"
                  data-nex-marketplace-prototype-menu-item-hero-prev
                  style={{
                    position: "absolute",
                    left: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 32,
                    height: 32,
                    padding: 0,
                    borderRadius: "50%",
                    background: "rgba(0, 0, 0, 0.6)",
                    color: "#FFFFFF",
                    border: "1px solid rgba(255, 255, 255, 0.14)",
                    fontSize: 16,
                    fontWeight: 900,
                    lineHeight: 1,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    boxShadow: "0 4px 10px -4px rgba(0, 0, 0, 0.6)",
                  }}
                >
                  ‹
                </button>
                {/* Next · right */}
                <button
                  type="button"
                  onClick={() =>
                    setCarouselIndex((i) => (i + 1) % editorImages.length)
                  }
                  aria-label="Next photo"
                  data-nex-marketplace-prototype-menu-item-hero-next
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 32,
                    height: 32,
                    padding: 0,
                    borderRadius: "50%",
                    background: "rgba(0, 0, 0, 0.6)",
                    color: "#FFFFFF",
                    border: "1px solid rgba(255, 255, 255, 0.14)",
                    fontSize: 16,
                    fontWeight: 900,
                    lineHeight: 1,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    boxShadow: "0 4px 10px -4px rgba(0, 0, 0, 0.6)",
                  }}
                >
                  ›
                </button>
              </>
            )}
          </div>

          {/* Section eyebrow + stock chip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 800,
            }}
          >
            {section && (
              <span style={{ color: accent }}>{section.name}</span>
            )}
            {lowStock && (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(255, 180, 0, 0.18)",
                  color: "#FFC14D",
                  border: "1px solid rgba(255, 180, 0, 0.4)",
                }}
              >
                Low stock
              </span>
            )}
            {soldOut && (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(220, 38, 38, 0.18)",
                  color: "#FF8080",
                  border: "1px solid rgba(220, 38, 38, 0.45)",
                }}
              >
                Sold out
              </span>
            )}
          </div>

          {/* Title + price */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 900,
                color: NEX.text,
                letterSpacing: "-0.015em",
                lineHeight: 1.15,
              }}
            >
              {product.name}
            </h2>
            <div
              style={{
                flexShrink: 0,
                fontSize: 15,
                fontWeight: 900,
                color: accent,
                letterSpacing: "-0.005em",
              }}
            >
              {formatIdr(unitCents)}
            </div>
          </div>

          {/* Owner directive 2026-10-22 · dispatch chip · "Ready in
              15 min" / "Dispatch 2 days" · pulled from editor
              localStorage · hidden when the owner hasn't set one. */}
          {dispatchLabel && (
            <div
              data-nex-marketplace-prototype-menu-item-dispatch
              style={{
                display: "inline-flex",
                alignSelf: "flex-start",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: 999,
                background: hexWithAlpha(accent, 0.14),
                border: `1px solid ${hexWithAlpha(accent, 0.4)}`,
                color: accent,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.3,
                lineHeight: 1,
              }}
            >
              <span aria-hidden>⏱</span>
              <span>{dispatchLabel}</span>
            </div>
          )}

          {/* Description · owner directive 2026-10-22 · hard-clamped
              to 5 lines so the sheet height stays predictable. The
              seller editor is where longer copy becomes an "about
              this item" expandable. */}
          {product.description && (
            <p
              data-nex-marketplace-prototype-menu-item-description
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.55,
                color: NEX.textDim,
                display: "-webkit-box",
                WebkitLineClamp: 5,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {product.description}
            </p>
          )}

          {/* Owner directive 2026-10-22 · spicy chip on the left,
              −/+ quantity picker on the right · same row · lives
              in the scrollable body so the footer stays a single
              clean Add-to-Cart action. */}
          <div
            data-nex-marketplace-prototype-menu-item-controls
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginTop: 4,
            }}
          >
            {isSpicy ? (
              <span
                data-nex-marketplace-prototype-menu-item-spicy
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "#000000",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  color: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                  boxShadow:
                    "0 4px 10px -4px rgba(0, 0, 0, 0.65)",
                }}
              >
                <span aria-hidden>🌶️</span>
                Spicy
              </span>
            ) : (
              <span aria-hidden />
            )}
            <div
              data-nex-marketplace-prototype-menu-item-qty
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={soldOut || qty <= 1}
                aria-label="Decrease quantity"
                data-nex-marketplace-prototype-menu-item-qty-minus
                style={{
                  width: 34,
                  height: 34,
                  padding: 0,
                  borderRadius: "50%",
                  background: "#000000",
                  color:
                    soldOut || qty <= 1
                      ? "rgba(255, 255, 255, 0.3)"
                      : "#FFFFFF",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  fontSize: 20,
                  fontWeight: 900,
                  lineHeight: 1,
                  cursor:
                    soldOut || qty <= 1 ? "default" : "pointer",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow:
                    soldOut || qty <= 1
                      ? "none"
                      : "0 4px 10px -4px rgba(0, 0, 0, 0.65)",
                  WebkitTapHighlightColor: "transparent",
                  opacity: soldOut || qty <= 1 ? 0.55 : 1,
                }}
              >
                −
              </button>
              <span
                aria-live="polite"
                style={{
                  minWidth: 22,
                  textAlign: "center",
                  fontSize: 16,
                  fontWeight: 900,
                  color: NEX.text,
                  fontVariantNumeric: "tabular-nums",
                  textShadow: "0 1px 3px rgba(0, 0, 0, 0.55)",
                }}
              >
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
                disabled={soldOut}
                aria-label="Increase quantity"
                data-nex-marketplace-prototype-menu-item-qty-plus
                style={{
                  width: 34,
                  height: 34,
                  padding: 0,
                  borderRadius: "50%",
                  background: "#000000",
                  color: soldOut
                    ? "rgba(255, 255, 255, 0.3)"
                    : "#FFFFFF",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  fontSize: 20,
                  fontWeight: 900,
                  lineHeight: 1,
                  cursor: soldOut ? "default" : "pointer",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: soldOut
                    ? "none"
                    : "0 4px 10px -4px rgba(0, 0, 0, 0.65)",
                  WebkitTapHighlightColor: "transparent",
                  opacity: soldOut ? 0.55 : 1,
                }}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Owner directive 2026-10-22 · footer · Ask-Seller slice 1 ·
            optional "Ask Seller" secondary action renders when the
            parent passes onAskSeller. Add to Cart stays the primary
            CTA (filled accent) · Ask Seller is secondary (outline).
            Both min 48px tall for touch-target spec. */}
        <footer
          style={{
            padding: "12px 14px calc(env(safe-area-inset-bottom, 0px) + 14px)",
            borderTop: `1px solid rgba(255, 255, 255, 0.08)`,
            background: "rgba(2, 9, 20, 0.6)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          {onAskSeller && (
            <button
              type="button"
              onClick={() => onAskSeller(product.id)}
              data-nex-marketplace-prototype-menu-item-ask-seller
              style={{
                flex: "0 0 auto",
                minHeight: 48,
                padding: "0 16px",
                borderRadius: 14,
                background: "transparent",
                color: accent,
                border: `1.5px solid ${hexWithAlpha(accent, 0.75)}`,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 0.3,
                cursor: "pointer",
                fontFamily: "inherit",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
                whiteSpace: "nowrap",
              }}
            >
              Ask Seller
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (soldOut) return;
              onAdd?.(product.id, qty);
            }}
            disabled={soldOut}
            data-nex-marketplace-prototype-menu-item-add
            style={{
              flex: 1,
              minHeight: 48,
              padding: "0 16px",
              borderRadius: 14,
              background: soldOut
                ? "rgba(255, 255, 255, 0.08)"
                : accent,
              color: soldOut ? NEX.textMute : "#FFFFFF",
              border: "none",
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 0.3,
              textShadow: soldOut
                ? "none"
                : "0 1px 3px rgba(0, 0, 0, 0.55)",
              boxShadow: soldOut
                ? "none"
                : `0 8px 20px -8px ${hexWithAlpha(accent, 0.8)}`,
              cursor: soldOut ? "default" : "pointer",
              fontFamily: "inherit",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            {addLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
