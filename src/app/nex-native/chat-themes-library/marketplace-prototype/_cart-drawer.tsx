"use client";

// src/app/nex-native/chat-themes-library/marketplace-prototype/_cart-drawer.tsx
//
// NEX Themes Marketplace · PROTOTYPE cart drawer.
// Owner-authorised 2026-10-21.
// -----------------------------------------------------------------------------
// Right-side drawer. Lists cart items grouped by product type.
// Checkout button is HONESTLY GATED · it does NOT claim success,
// does NOT invent a payment, does NOT grant any entitlement. It
// shows a "Checkout coming soon" state with an explanation.

import * as React from "react";
import {
  cartKey,
  PRODUCT_TYPE_GLYPH,
  PRODUCT_TYPE_LABEL,
  type CartItem,
  type ProductType,
} from "./_types";

const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  orangeInk: "#1A0808",
  danger: "#F23A4F",
  green: "#16D66B",
};

export function CartDrawer({
  cart,
  onRemove,
  onClear,
  onClose,
}: {
  readonly cart: ReadonlyArray<CartItem>;
  readonly onRemove: (key: string) => void;
  readonly onClear: () => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  const [showCheckoutState, setShowCheckoutState] = React.useState(false);

  // Escape closes.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const grouped = React.useMemo(() => {
    const bucket: Record<ProductType, CartItem[]> = {
      theme: [],
      intro: [],
      shop: [],
    };
    for (const item of cart) bucket[item.productType].push(item);
    return bucket;
  }, [cart]);

  const total = cart.length;

  return (
    <>
      {/* Backdrop */}
      <div
        data-nex-marketplace-prototype-cart-backdrop
        onClick={onClose}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.55)",
          zIndex: 600,
          cursor: "pointer",
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        data-nex-marketplace-prototype-cart
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(360px, 90%)",
          maxWidth: 420,
          background: NEX.bg,
          borderLeft: `1px solid ${NEX.cyanSoft}`,
          zIndex: 601,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "-10px 0 40px rgba(0, 0, 0, 0.7)",
        }}
      >
        <header
          style={{
            padding:
              "calc(env(safe-area-inset-top, 0px) + 16px) 14px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${NEX.cyanSoft}`,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: NEX.cyan,
                fontWeight: 800,
              }}
            >
              NEX · Cart
            </div>
            <h2
              style={{
                margin: "2px 0 0",
                fontSize: 17,
                fontWeight: 800,
                color: NEX.text,
              }}
            >
              {total === 0 ? "Empty" : `${total} item${total === 1 ? "" : "s"}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            style={{
              padding: "4px 10px",
              background: NEX.cyan,
              color: "#0a0608",
              border: `1px solid ${NEX.cyan}`,
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.4,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Close
          </button>
        </header>

        {/* Scrollable item list */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "12px",
          }}
        >
          {total === 0 && (
            <div
              style={{
                padding: "32px 16px",
                textAlign: "center",
                color: NEX.textMute,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 10 }}>🛒</div>
              Your cart is empty.
              <br />
              Browse themes to add Theme / Intro / Shop products.
            </div>
          )}

          {(["theme", "intro", "shop"] as ProductType[]).map((pt) =>
            grouped[pt].length === 0 ? null : (
              <section
                key={pt}
                data-nex-marketplace-prototype-cart-section={pt}
                style={{ marginBottom: 14 }}
              >
                <h3
                  style={{
                    margin: "0 2px 8px",
                    fontSize: 10,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    color: NEX.cyan,
                    fontWeight: 800,
                  }}
                >
                  {PRODUCT_TYPE_GLYPH[pt]} {PRODUCT_TYPE_LABEL[pt]} ·{" "}
                  {grouped[pt].length}
                </h3>
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {grouped[pt].map((item) => {
                    const key = cartKey(item);
                    return (
                      <li
                        key={key}
                        style={{
                          padding: "10px 12px",
                          background: "rgba(5, 15, 28, 0.72)",
                          border: `1px solid ${NEX.cyanSoft}`,
                          borderRadius: 10,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: NEX.text,
                            }}
                          >
                            {item.themeDisplayName}
                          </div>
                          {item.productType === "shop" && item.shopLayoutId && (
                            <div
                              style={{
                                fontSize: 11,
                                color: NEX.textMute,
                                marginTop: 1,
                              }}
                            >
                              Layout: {item.shopLayoutId}
                            </div>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: 0.5,
                            textTransform: "uppercase",
                            color: NEX.cyan,
                            padding: "2px 6px",
                            border: `1px solid ${NEX.cyanSoft}`,
                            borderRadius: 999,
                          }}
                        >
                          Price TBD
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemove(key)}
                          aria-label={`Remove ${item.themeDisplayName} ${pt}`}
                          data-nex-marketplace-prototype-cart-remove={key}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: "transparent",
                            color: NEX.danger,
                            border: `1px solid rgba(242, 58, 79, 0.42)`,
                            cursor: "pointer",
                            fontSize: 14,
                            lineHeight: 1,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: "inherit",
                            WebkitTapHighlightColor: "transparent",
                          }}
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ),
          )}
        </div>

        {/* Honest total + checkout */}
        <footer
          style={{
            padding:
              "12px 14px calc(env(safe-area-inset-bottom, 0px) + 12px)",
            borderTop: `1px solid ${NEX.cyanSoft}`,
            background: "rgba(2, 9, 20, 0.9)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {!showCheckoutState ? (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  fontSize: 12,
                  color: NEX.textDim,
                }}
              >
                <span>Total</span>
                <span style={{ color: NEX.text, fontWeight: 800 }}>
                  Price TBD
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutState(true)}
                disabled={total === 0}
                data-nex-marketplace-prototype-cart-checkout
                style={{
                  minHeight: 44,
                  padding: "0 14px",
                  borderRadius: 10,
                  background: total === 0 ? "rgba(255, 114, 0, 0.2)" : NEX.orange,
                  color: total === 0 ? NEX.textMute : NEX.orangeInk,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 900,
                  letterSpacing: 0.3,
                  cursor: total === 0 ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                Checkout
              </button>
              {total > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  style={{
                    minHeight: 32,
                    padding: "0 10px",
                    borderRadius: 8,
                    background: "transparent",
                    color: NEX.textMute,
                    border: "none",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.3,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textDecoration: "underline",
                  }}
                >
                  Clear cart
                </button>
              )}
            </>
          ) : (
            <div
              data-nex-marketplace-prototype-checkout-state
              style={{
                padding: "12px 12px",
                background: "rgba(255, 114, 0, 0.1)",
                border: `1px solid rgba(255, 114, 0, 0.42)`,
                borderRadius: 10,
                color: NEX.text,
                fontSize: 12,
                lineHeight: 1.5,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: NEX.orange,
                  letterSpacing: 0.3,
                }}
              >
                Checkout coming soon
              </div>
              <div style={{ color: NEX.textDim }}>
                NEX is <strong style={{ color: NEX.text }}>not currently
                processing payments</strong> for Theme / Intro / Shop
                products. Nothing is activated until approved pricing +
                a wired payment provider are in place. Your cart is
                saved so you can revisit this once the system is live.
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutState(false)}
                style={{
                  marginTop: 2,
                  padding: "8px 12px",
                  minHeight: 36,
                  borderRadius: 8,
                  background: "transparent",
                  color: NEX.cyan,
                  border: `1px solid ${NEX.cyanSoft}`,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  alignSelf: "flex-start",
                }}
              >
                ← Back to cart
              </button>
            </div>
          )}
        </footer>
      </aside>
    </>
  );
}
