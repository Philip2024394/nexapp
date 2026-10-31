"use client";

// src/app/nex-native/chat-themes-library/marketplace-prototype/_cart-drawer.tsx
//
// NEX Themes Marketplace · PROTOTYPE cart drawer · world-class pass
// 2026-10-22.
// -----------------------------------------------------------------------------
// Right-side drawer presenting the customer's cart in a format that
// mirrors every mainstream SaaS checkout (Shopify Pay · Stripe
// Checkout · Linear subscription cart):
//
//   · NEX ping-badge in header (brand mark · owner identity)
//   · "N items" count under the title
//   · Three-chip cadence explainer so buyer sees what they're
//     committing to (Themes · once / Intros · once / Shops · /mo)
//   · Minimal item rows (no surrounding container · just typography,
//     accent dot per brand, and a dark-red circular × remove)
//   · Subtotal split into "Today's one-time" + "Monthly recurring"
//     so the buyer never confuses a one-time purchase with a
//     subscription (and vice versa)
//   · Checkout stays HONESTLY GATED · "Checkout coming soon" state
//     is preserved per Package Contract DRAFT 2026-10-20 ("Never
//     promise a feature simply because it appears in a design or
//     database") and Service Principle DRAFT 2026-10-20 ("best
//     effort INSUFFICIENT where harm from failure is non-recoverable")
//
// Prices below match the DRAFT recommendations in
// `docs/doctrine/nex-pricing-gtm-doctrine-draft-2026-10-22.md`.
// Nothing here is production-sealed. Section 10 of that doctrine is
// still empty for all three DRAFT rows (Theme IDN · Shop IDN · Intro
// IDN). This drawer is prototype demo copy only; promoting these
// to real payment surfaces requires explicit owner approval per
// row.

import * as React from "react";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import {
  cartKey,
  PRODUCT_TYPE_LABEL,
  type CartItem,
  type ProductType,
} from "./_types";
import { MARKETPLACE_CATALOG } from "./_catalog";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  orangeInk: "#1A0808",
  danger: "#DC2626",
  dangerDark: "#8B0000",
  green: "#16D66B",
};

// Owner directive 2026-10-22 · demo DRAFT prices per the sealed
// pricing + GTM doctrine (`docs/doctrine/nex-pricing-gtm-doctrine-
// draft-2026-10-22.md`). Indonesian IDR values are the only locale
// rendered today · EUR + USD support lands when the per-locale
// renderer is approved separately.
const PROTO_PRICE_IDR = {
  theme: 25_000,
  intro: 99_000,
  shop: 99_000, // per month
} as const;

function formatIdr(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

interface EnrichedCartItem extends CartItem {
  readonly brandAccent: string;
  readonly brandLocation: string | null;
}

function enrichCartItem(item: CartItem): EnrichedCartItem {
  const entry = MARKETPLACE_CATALOG.find((e) => e.themeId === item.themeId);
  const brandAccent =
    entry?.ownerAccentHex ?? entry?.accentHex ?? NEX.cyan;
  const brandLocation = entry?.location ?? null;
  return { ...item, brandAccent, brandLocation };
}

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

  const enriched = React.useMemo(
    () => cart.map(enrichCartItem),
    [cart],
  );

  const grouped = React.useMemo(() => {
    const bucket: Record<ProductType, EnrichedCartItem[]> = {
      theme: [],
      intro: [],
      shop: [],
    };
    for (const item of enriched) bucket[item.productType].push(item);
    return bucket;
  }, [enriched]);

  const total = cart.length;
  const subOnceIdr =
    grouped.theme.length * PROTO_PRICE_IDR.theme +
    grouped.intro.length * PROTO_PRICE_IDR.intro;
  const subRecurringIdr = grouped.shop.length * PROTO_PRICE_IDR.shop;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close cart"
        data-nex-marketplace-prototype-cart-backdrop
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(4px) saturate(140%)",
          WebkitBackdropFilter: "blur(4px) saturate(140%)",
          border: "none",
          padding: 0,
          margin: 0,
          cursor: "pointer",
          zIndex: 600,
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="NEX Cart"
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
          boxShadow: "-10px 0 40px rgba(0, 0, 0, 0.75)",
        }}
      >
        {/* ─── Header · NEX ping avatar + title + cadence row ─── */}
        <header
          style={{
            padding:
              "calc(env(safe-area-inset-top, 0px) + 14px) 14px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            borderBottom: `1px solid ${NEX.cyanSoft}`,
            background:
              "linear-gradient(180deg, rgba(0, 175, 255, 0.08), transparent)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {/* Sealed NEX ping badge · brand mark · same primitive the
                marketplace header uses. */}
            <div style={{ flexShrink: 0 }}>
              <NexPingBadge
                size={48}
                accent={NEX.cyan}
                dataTestId="marketplace-prototype-cart-nex"
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: NEX.cyan,
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                Cart
              </div>
              <h2
                style={{
                  margin: "3px 0 0",
                  fontSize: 20,
                  fontWeight: 900,
                  color: NEX.text,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.05,
                }}
              >
                {total === 0
                  ? "Your cart"
                  : `${total} item${total === 1 ? "" : "s"}`}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close cart"
              style={{
                width: 32,
                height: 32,
                padding: 0,
                borderRadius: "50%",
                background: "transparent",
                color: NEX.text,
                border: `1px solid ${NEX.cyanSoft}`,
                fontSize: 18,
                lineHeight: 1,
                cursor: "pointer",
                fontFamily: "inherit",
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              ×
            </button>
          </div>

        </header>

        {/* ─── Scrollable item list ─── */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "12px 14px 16px",
          }}
        >
          {total === 0 ? (
            <div
              style={{
                padding: "48px 16px 24px",
                textAlign: "center",
                color: NEX.textMute,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontSize: 44, marginBottom: 12 }}>🛒</div>
              <div
                style={{
                  fontSize: 15,
                  color: NEX.text,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                Your cart is empty
              </div>
              Browse themes, intros, and shop templates to add them.
            </div>
          ) : (
            (["theme", "intro", "shop"] as ProductType[]).map((pt) => {
              const items = grouped[pt];
              if (items.length === 0) return null;
              const unitPrice =
                pt === "theme"
                  ? PROTO_PRICE_IDR.theme
                  : pt === "intro"
                  ? PROTO_PRICE_IDR.intro
                  : PROTO_PRICE_IDR.shop;
              const cadence: "once" | "monthly" =
                pt === "shop" ? "monthly" : "once";
              return (
                <section
                  key={pt}
                  data-nex-marketplace-prototype-cart-section={pt}
                  style={{
                    marginBottom: 18,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      padding: "0 2px 8px",
                      gap: 10,
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 10,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: NEX.cyan,
                        fontWeight: 800,
                      }}
                    >
                      {PRODUCT_TYPE_LABEL[pt]} · {items.length}
                    </h3>
                    <span
                      style={{
                        fontSize: 9,
                        letterSpacing: 0.4,
                        textTransform: "uppercase",
                        color: NEX.textMute,
                        fontWeight: 700,
                      }}
                    >
                      {cadence === "once" ? "One-time" : "Recurring"}
                    </span>
                  </div>
                  {items.map((item) => (
                    <CartRow
                      key={cartKey(item)}
                      item={item}
                      unitPriceIdr={unitPrice}
                      cadence={cadence}
                      onRemove={() => onRemove(cartKey(item))}
                    />
                  ))}
                </section>
              );
            })
          )}

          {total > 1 && (
            <button
              type="button"
              onClick={onClear}
              data-nex-marketplace-prototype-cart-clear
              style={{
                marginTop: 4,
                padding: "6px 10px",
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
        </div>

        {/* ─── Totals + Checkout footer ─── */}
        <footer
          style={{
            padding:
              "12px 14px calc(env(safe-area-inset-bottom, 0px) + 12px)",
            borderTop: `1px solid ${NEX.cyanSoft}`,
            background: "rgba(2, 9, 20, 0.95)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            flexShrink: 0,
          }}
        >
          {!showCheckoutState ? (
            <>
              {total > 0 && (
                <div
                  data-nex-marketplace-prototype-cart-totals
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {subOnceIdr > 0 && (
                    <SubtotalRow
                      label="Today · one-time"
                      value={formatIdr(subOnceIdr)}
                      hint="Themes + intros · yours forever"
                    />
                  )}
                  {subRecurringIdr > 0 && (
                    <SubtotalRow
                      label="Monthly · recurring"
                      value={`${formatIdr(subRecurringIdr)} /mo`}
                      hint="Shop subscription · billed monthly"
                    />
                  )}
                  <div
                    style={{
                      marginTop: 4,
                      paddingTop: 8,
                      borderTop: `1px dashed rgba(255, 255, 255, 0.08)`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      fontSize: 14,
                      fontWeight: 900,
                      color: NEX.text,
                    }}
                  >
                    <span>Due today</span>
                    <span>
                      {formatIdr(subOnceIdr + subRecurringIdr)}
                    </span>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowCheckoutState(true)}
                disabled={total === 0}
                data-nex-marketplace-prototype-cart-checkout
                style={{
                  minHeight: 48,
                  padding: "0 14px",
                  borderRadius: 12,
                  background:
                    total === 0 ? "rgba(255, 114, 0, 0.2)" : NEX.orange,
                  color: total === 0 ? NEX.textMute : NEX.orangeInk,
                  border: "none",
                  fontSize: 14,
                  fontWeight: 900,
                  letterSpacing: 0.3,
                  cursor: total === 0 ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  WebkitTapHighlightColor: "transparent",
                  boxShadow:
                    total === 0
                      ? "none"
                      : `0 8px 20px -8px ${NEX.orange}`,
                }}
              >
                {total === 0 ? "Cart empty" : "Checkout"}
              </button>
              <div
                style={{
                  fontSize: 10,
                  color: NEX.textMute,
                  textAlign: "center",
                  lineHeight: 1.45,
                }}
              >
                Prototype preview · prices in review · payment provider
                not wired · nothing is charged
              </div>
            </>
          ) : (
            <div
              data-nex-marketplace-prototype-checkout-state
              style={{
                padding: 14,
                background: "rgba(255, 114, 0, 0.1)",
                border: `1px solid rgba(255, 114, 0, 0.42)`,
                borderRadius: 12,
                color: NEX.text,
                fontSize: 12,
                lineHeight: 1.5,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: NEX.orange,
                  letterSpacing: 0.3,
                }}
              >
                Checkout coming soon
              </div>
              <div style={{ color: NEX.textDim }}>
                NEX is{" "}
                <strong style={{ color: NEX.text }}>
                  not currently processing payments
                </strong>{" "}
                for Theme / Intro / Shop products. Nothing is activated
                until the DRAFT pricing contract seals + a wired
                payment provider (Midtrans for Indonesia · Stripe for
                EU / US) is in place. Your cart is saved so you can
                revisit this once the system is live.
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

// ─── Cart row (unboxed) ──────────────────────────────────────────

function CartRow({
  item,
  unitPriceIdr,
  cadence,
  onRemove,
}: {
  readonly item: EnrichedCartItem;
  readonly unitPriceIdr: number;
  readonly cadence: "once" | "monthly";
  readonly onRemove: () => void;
}): React.JSX.Element {
  const secondary =
    item.productType === "shop" && item.shopLayoutId
      ? `${item.shopLayoutId.replaceAll("_", " ")}${
          item.brandLocation ? ` · ${item.brandLocation}` : ""
        }`
      : item.brandLocation ?? "Business owner";

  return (
    <div
      data-nex-marketplace-prototype-cart-row={cartKey(item)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 2px",
        borderBottom: "1px dashed rgba(255, 255, 255, 0.06)",
      }}
    >
      {/* Brand accent dot · 2-char initials inside */}
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: item.brandAccent,
          color: "#FFFFFF",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: "-0.02em",
          textShadow: "0 1px 3px rgba(0, 0, 0, 0.55)",
          boxShadow: `0 0 10px -2px ${item.brandAccent}`,
        }}
      >
        {item.themeDisplayName.charAt(0)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: NEX.text,
            letterSpacing: "-0.005em",
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.themeDisplayName}
        </div>
        <div
          style={{
            fontSize: 10,
            color: NEX.textMute,
            letterSpacing: 0.2,
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            textTransform: "capitalize",
          }}
        >
          {secondary}
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          textAlign: "right",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 1,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: NEX.text,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatIdr(unitPriceIdr)}
        </div>
        <div
          style={{
            fontSize: 9,
            color: NEX.textMute,
            letterSpacing: 0.3,
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {cadence === "once" ? "once" : "/mo"}
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.themeDisplayName}`}
        data-nex-marketplace-prototype-cart-remove={cartKey(item)}
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: NEX.dangerDark,
          color: "#FFFFFF",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          fontSize: 15,
          fontWeight: 900,
          lineHeight: 1,
          cursor: "pointer",
          fontFamily: "inherit",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          WebkitTapHighlightColor: "transparent",
          boxShadow: `0 2px 6px -2px rgba(139, 0, 0, 0.75)`,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── Subtotal row ────────────────────────────────────────────────

function SubtotalRow({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 10,
        padding: "4px 0",
        fontSize: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: NEX.textDim,
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {label}
        </div>
        <div
          style={{
            color: NEX.textMute,
            fontSize: 10,
            marginTop: 1,
            lineHeight: 1.4,
          }}
        >
          {hint}
        </div>
      </div>
      <div
        style={{
          color: NEX.text,
          fontWeight: 800,
          fontSize: 13,
          fontVariantNumeric: "tabular-nums",
          flexShrink: 0,
        }}
      >
        {value}
      </div>
    </div>
  );
}
