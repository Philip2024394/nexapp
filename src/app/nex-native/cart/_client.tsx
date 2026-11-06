"use client";

// src/app/nex-native/cart/_client.tsx
//
// NEX Cart · buyer's multi-shop cart client.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Reads NEX_CART_STORAGE_KEY from localStorage · groups items by
// shop_id · one checkout button per shop · tap fires the sealed
// sendCartOrderAction with that shop's cart snapshot · the owner
// receives the whole order as a chat message (TradeAgreementCard
// primitive, already sealed).
//
// Per-shop state:
//   · items list with image + name + qty controls + per-item total
//   · running shop subtotal
//   · "Buyer details + Checkout →" button that opens the sealed
//     action with the current cart snapshot
//
// NEX never touches payments. Owner + buyer settle in chat using one
// of the shop's accepted methods (COD / QRIS / meetup / etc.).

import * as React from "react";
import Link from "next/link";
import {
  NEX_CART_STORAGE_KEY,
  type NexCartItem,
} from "@/lib/nex-native/cart-types";
import { CheckoutSheet } from "./_checkout-sheet";
import {
  getShopPaymentMeta,
} from "./_shop-payment-methods";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "rgba(5, 15, 28, 0.72)";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";

interface ShopGroup {
  readonly shopId: string;
  readonly shopSlug: string;
  readonly shopDisplayName: string;
  readonly shopOwnerAccountId: string;
  readonly currency: string;
  readonly items: NexCartItem[];
  readonly subtotalPence: number;
}

function readCart(): NexCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NEX_CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as NexCartItem[]) : [];
  } catch {
    return [];
  }
}

function writeCart(items: NexCartItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      NEX_CART_STORAGE_KEY,
      JSON.stringify(items),
    );
    window.dispatchEvent(new CustomEvent("nex-cart-changed"));
  } catch {
    /* fail-soft */
  }
}

function groupByShop(items: ReadonlyArray<NexCartItem>): ShopGroup[] {
  const byShop = new Map<string, NexCartItem[]>();
  for (const it of items) {
    const list = byShop.get(it.shop_id) ?? [];
    list.push(it);
    byShop.set(it.shop_id, list);
  }
  return Array.from(byShop.entries()).map(([shopId, list]) => {
    const head = list[0]!;
    return {
      shopId,
      shopSlug: head.shop_slug,
      shopDisplayName: head.shop_display_name,
      shopOwnerAccountId: head.shop_owner_account_id,
      currency: head.currency,
      items: list,
      subtotalPence: list.reduce(
        (sum, l) => sum + l.price_pence * l.quantity,
        0,
      ),
    };
  });
}

function formatPrice(pence: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(pence / 100);
  } catch {
    return `${currency} ${(pence / 100).toFixed(2)}`;
  }
}

export function CartPageClient(): React.JSX.Element {
  const [items, setItems] = React.useState<NexCartItem[]>([]);
  const [hydrated, setHydrated] = React.useState(false);
  const [checkoutShopId, setCheckoutShopId] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    setItems(readCart());
    setHydrated(true);
    const onChange = () => setItems(readCart());
    window.addEventListener("nex-cart-changed", onChange);
    const onStorage = (e: StorageEvent) => {
      if (e.key === NEX_CART_STORAGE_KEY) setItems(readCart());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("nex-cart-changed", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const groups = React.useMemo(() => groupByShop(items), [items]);

  function updateQty(key: string, delta: number) {
    const next = items
      .map((it) =>
        it.key === key
          ? { ...it, quantity: Math.max(0, it.quantity + delta) }
          : it,
      )
      .filter((it) => it.quantity > 0);
    setItems(next);
    writeCart(next);
  }

  function removeItem(key: string) {
    const next = items.filter((it) => it.key !== key);
    setItems(next);
    writeCart(next);
  }

  function clearShop(shopId: string) {
    const next = items.filter((it) => it.shop_id !== shopId);
    setItems(next);
    writeCart(next);
  }

  if (!hydrated) {
    return (
      <div
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          color: INK_MUTED,
          fontSize: 12,
        }}
      >
        Loading your cart…
      </div>
    );
  }

  if (groups.length === 0) {
    return <EmptyCart />;
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 0,
        overflow: "auto",
      }}
    >
      <Header totalGroups={groups.length} />
      {groups.map((group) => (
        <ShopCartGroup
          key={group.shopId}
          group={group}
          onUpdateQty={updateQty}
          onRemoveItem={removeItem}
          onClearShop={clearShop}
          onCheckout={() => setCheckoutShopId(group.shopId)}
        />
      ))}
      <Footer />

      {/* Checkout sheet · opens when a shop's Checkout → button is
          tapped · collects buyer name / phone / delivery address /
          payment method pick then POSTs to sendCartOrderAction. */}
      {checkoutShopId
        ? (() => {
            const group = groups.find((g) => g.shopId === checkoutShopId);
            if (!group) return null;
            return (
              <CheckoutSheet
                shopDisplayName={group.shopDisplayName}
                shopSlug={group.shopSlug}
                shopId={group.shopId}
                shopOwnerAccountId={group.shopOwnerAccountId}
                currency={group.currency}
                items={group.items.map((it) => ({
                  product_id: it.id,
                  kind: it.kind,
                  name: it.name,
                  price_pence: it.price_pence,
                  currency: it.currency,
                  quantity: it.quantity,
                  image_url: it.image_url,
                  variants: it.variants,
                }))}
                subtotalLabel={formatPrice(
                  group.subtotalPence,
                  group.currency,
                )}
                acceptedPaymentMethods={
                  getShopPaymentMeta(group.shopId).methods
                }
                acceptedPaymentLabels={
                  getShopPaymentMeta(group.shopId).methods
                }
                onClose={() => setCheckoutShopId(null)}
              />
            );
          })()
        : null}
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────
function Header({ totalGroups }: { totalGroups: number }): React.JSX.Element {
  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        paddingBottom: 8,
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Link
          href="/nex-native/free-chat"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            fontSize: 11,
            fontWeight: 700,
            color: GOLD,
            textDecoration: "none",
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
          }}
        >
          ← Back
        </Link>
      </nav>
      <h1
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 900,
          color: GOLD,
          letterSpacing: "-0.01em",
        }}
      >
        Your cart
      </h1>
      <p style={{ margin: 0, fontSize: 11.5, color: INK_DIM }}>
        {totalGroups === 1
          ? "One shop · one checkout"
          : `${totalGroups} shops · one checkout per shop`}
      </p>
    </header>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────
function EmptyCart(): React.JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 24px",
      }}
    >
      <span aria-hidden style={{ fontSize: 42 }}>🛒</span>
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 900,
            color: CREAM,
            letterSpacing: "-0.01em",
          }}
        >
          Your cart is empty
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 12,
            color: INK_DIM,
            lineHeight: 1.5,
          }}
        >
          Tap any product on a NEX shop to add it here. Cart holds items
          from multiple shops at once — each shop is a separate checkout.
        </p>
      </div>
      <Link
        href="/nex-native/free-chat"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "12px 22px",
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#1A120A",
          background: GOLD,
          textDecoration: "none",
          borderRadius: 999,
        }}
      >
        Explore shops →
      </Link>
    </div>
  );
}

// ─── Per-shop group ───────────────────────────────────────────────────
function ShopCartGroup({
  group,
  onUpdateQty,
  onRemoveItem,
  onClearShop,
  onCheckout,
}: {
  group: ShopGroup;
  onUpdateQty: (key: string, delta: number) => void;
  onRemoveItem: (key: string) => void;
  onClearShop: (shopId: string) => void;
  onCheckout: () => void;
}): React.JSX.Element {
  return (
    <section
      aria-label={`Cart items from ${group.shopDisplayName}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "14px",
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
      }}
    >
      {/* Shop header · deep-link to the shop · clear-shop action */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Link
          href={`/nex-native/${group.shopSlug}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: 999,
            background: GOLD,
            color: "#1A120A",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.03em",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          🏪 {group.shopDisplayName}
        </Link>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10.5,
            fontWeight: 700,
            color: INK_MUTED,
          }}
        >
          {group.items.length} item{group.items.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => onClearShop(group.shopId)}
          aria-label={`Clear items from ${group.shopDisplayName}`}
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            background: "transparent",
            border: `1px solid ${BORDER}`,
            color: INK_MUTED,
            fontSize: 13,
            lineHeight: 1,
            cursor: "pointer",
            padding: 0,
            fontFamily: "inherit",
          }}
        >
          ×
        </button>
      </div>

      {/* Line items */}
      {group.items.map((it) => (
        <div
          key={it.key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 0",
            borderTop: `1px dashed ${BORDER}`,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              backgroundImage: it.image_url
                ? `url(${it.image_url})`
                : undefined,
              background: it.image_url
                ? undefined
                : "linear-gradient(135deg, rgba(198,161,91,0.22), rgba(5,15,28,0.9))",
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: `1px solid ${BORDER}`,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: CREAM,
                letterSpacing: "-0.005em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {it.name}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: GOLD,
                fontWeight: 900,
                marginTop: 2,
              }}
            >
              {formatPrice(it.price_pence * it.quantity, it.currency)}
              <span
                style={{
                  color: INK_MUTED,
                  fontWeight: 600,
                  marginLeft: 6,
                  fontSize: 10,
                }}
              >
                {formatPrice(it.price_pence, it.currency)} × {it.quantity}
              </span>
            </div>
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 999,
              border: `1px solid ${BORDER_HI}`,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => onUpdateQty(it.key, -1)}
              aria-label="Decrease quantity"
              style={qtyBtnStyle}
            >
              −
            </button>
            <span
              style={{
                minWidth: 22,
                textAlign: "center",
                fontSize: 13,
                fontWeight: 900,
                color: CREAM,
              }}
            >
              {it.quantity}
            </span>
            <button
              type="button"
              onClick={() => onUpdateQty(it.key, +1)}
              aria-label="Increase quantity"
              style={qtyBtnStyle}
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => onRemoveItem(it.key)}
            aria-label={`Remove ${it.name}`}
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              background: "transparent",
              border: `1px solid ${BORDER}`,
              color: INK_MUTED,
              fontSize: 12,
              lineHeight: 1,
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit",
            }}
          >
            ×
          </button>
        </div>
      ))}

      {/* Subtotal + checkout */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 8,
          borderTop: `1px solid ${BORDER}`,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: INK_MUTED,
            }}
          >
            Subtotal
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: GOLD,
            }}
          >
            {formatPrice(group.subtotalPence, group.currency)}
          </div>
        </div>
        <button
          type="button"
          onClick={onCheckout}
          style={{
            padding: "12px 20px",
            borderRadius: 999,
            background: GOLD,
            color: "#1A120A",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 10px 24px rgba(198,161,91,0.22)",
          }}
        >
          Checkout →
        </button>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────
function Footer(): React.JSX.Element {
  return (
    <footer
      style={{
        paddingTop: 10,
        fontSize: 10.5,
        color: INK_MUTED,
        lineHeight: 1.5,
        textAlign: "center",
      }}
    >
      Checkout sends your order into the shop&rsquo;s chat with you ·
      <br />
      NEX never handles payments · the shop confirms + collects directly.
    </footer>
  );
}

const qtyBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  background: "rgba(5, 15, 28, 0.9)",
  color: INK,
  border: "none",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "inherit",
};
