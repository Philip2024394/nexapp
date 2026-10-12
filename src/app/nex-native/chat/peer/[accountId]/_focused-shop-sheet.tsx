"use client";

// src/app/nex-native/chat/peer/[accountId]/_focused-shop-sheet.tsx
//
// Phase 3 · auto-opening shop sheet on peer chat when the URL carries
// `?focus_product=<id>`.
//
// Mounting rule:
//   · parent peer page.tsx ONLY includes this component when the
//     peer owns a nex_business AND the business has at least one
//     live product. The server-side guard enforces that contract.
//
// Interaction rule:
//   · opens as a slide-up overlay on mount
//   · the card whose id matches focusProductId gets a 2px accent
//     outline and is scrolled into view
//   · tapping the backdrop OR the close button dismisses the sheet
//     and reveals normal chat behind it. The URL search param stays
//     intact so the deep link remains shareable
//
// Honesty contract:
//   · prices and names come straight from `nex_product` · no synth
//   · if a product has no image we draw a neutral initial glyph
//     (same shape as the business-page thumbnail row) · we never
//     substitute a stock photo
//   · if focusProductId does not match any product in `products`,
//     the sheet still opens and shows the slider · no accent is
//     drawn and nothing is scrolled into view. Honest-null handling
//     for stale or cross-business deep links.
//
// What this file does NOT do:
//   · it does NOT bypass auth · the peer chat page itself gates
//     sign-in before this component ever reaches the client
//   · it does NOT persist any state outside the URL
//   · it does NOT fetch anything · all data arrives as props

import * as React from "react";

export interface FocusedShopSheetProduct {
  readonly id: string;
  readonly name: string;
  readonly priceLabel: string | null;
  readonly imageUrl: string | null;
}

export interface FocusedShopSheetProps {
  readonly products: readonly FocusedShopSheetProduct[];
  readonly focusProductId: string | null;
}

const PALETTE = {
  backdrop: "rgba(2,9,20,0.72)",
  panelBg: "#03101D",
  panelBorder: "rgba(255,255,255,0.06)",
  cardBg: "#0E1C33",
  cardBorder: "rgba(255,255,255,0.08)",
  text: "#F2F5F8",
  textSoft: "#7D9BC0",
  orange: "#FF7200",
} as const;

export function FocusedShopSheet(
  props: FocusedShopSheetProps,
): React.JSX.Element | null {
  const { products, focusProductId } = props;
  const [open, setOpen] = React.useState<boolean>(focusProductId !== null);
  const focusedCardRef = React.useRef<HTMLDivElement | null>(null);

  // Scroll the focused card into view once we mount OR when the id
  // changes. Honest-null: if the id isn't present in `products`, no
  // ref gets attached and the effect no-ops.
  React.useEffect(() => {
    if (!open) return;
    if (focusProductId === null) return;
    const target = focusedCardRef.current;
    if (!target) return;
    target.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
  }, [open, focusProductId]);

  if (focusProductId === null) return null;
  if (products.length === 0) return null;
  if (!open) return null;

  return (
    <div
      data-nex-focused-shop-sheet
      data-nex-focused-shop-sheet-focus-id={focusProductId}
      role="dialog"
      aria-label="Shop products"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <button
        type="button"
        aria-label="Close shop"
        onClick={() => setOpen(false)}
        data-nex-focused-shop-sheet-backdrop
        style={{
          position: "absolute",
          inset: 0,
          background: PALETTE.backdrop,
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      />
      <div
        data-nex-focused-shop-sheet-panel
        style={{
          position: "relative",
          background: PALETTE.panelBg,
          color: PALETTE.text,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderTop: `1px solid ${PALETTE.panelBorder}`,
          padding: "14px 14px 20px",
          maxHeight: "68vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          boxShadow: "0 -8px 36px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 4px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "inherit",
              letterSpacing: "0.02em",
            }}
          >
            Shop
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close shop"
            data-nex-focused-shop-sheet-close
            style={{
              background: "transparent",
              color: PALETTE.textSoft,
              border: "none",
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
              padding: 6,
            }}
          >
            ×
          </button>
        </div>
        <div
          data-nex-focused-shop-sheet-slider
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            paddingBottom: 6,
          }}
        >
          {products.map((p) => {
            const isFocused =
              focusProductId !== null && p.id === focusProductId;
            return (
              <div
                key={p.id}
                ref={isFocused ? focusedCardRef : null}
                data-nex-focused-shop-sheet-card={p.id}
                data-nex-focused-shop-sheet-card-focused={
                  isFocused ? "true" : "false"
                }
                style={{
                  flexShrink: 0,
                  width: 136,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: 8,
                  background: PALETTE.cardBg,
                  border: `1px solid ${PALETTE.cardBorder}`,
                  borderRadius: 14,
                  outline: isFocused ? `2px solid ${PALETTE.orange}` : undefined,
                  outlineOffset: isFocused ? 2 : undefined,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "#1A2944",
                  }}
                >
                  {p.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.imageUrl}
                      alt={`${p.name} · product image`}
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
                    <NoImageGlyph name={p.name} />
                  )}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: PALETTE.text,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p.name}
                </div>
                {p.priceLabel !== null ? (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: PALETTE.orange,
                    }}
                  >
                    {p.priceLabel}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NoImageGlyph(props: { readonly name: string }): React.JSX.Element {
  const initial =
    (props.name.trim().split(/\s+/)[0]?.[0] ?? "·").toUpperCase().slice(0, 1);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        color: PALETTE.textSoft,
        fontSize: 40,
        fontWeight: 700,
      }}
    >
      {initial}
    </div>
  );
}
