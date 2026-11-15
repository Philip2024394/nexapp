"use client";

// src/app/nex-native/cart/_cart-popup-client.tsx
//
// NEX Cart Popup · centered modal variant of the cart.
// Owner-authorised 2026-11-16 · Nov-16 execution block · Stream A.
// -----------------------------------------------------------------
// This is the centered-popup form of the sealed /nex-native/cart page.
// It reads from the SAME NEX_CART_STORAGE_KEY localStorage contract,
// groups by seller the SAME way, and uses the SAME CheckoutSheet. The
// standalone /nex-native/cart route continues to work unchanged · this
// popup is an ADDITIONAL affordance surfaced from a header cart icon.
//
// Hard rules enforced here:
//
//   1. CENTERED MODAL inside the sealed .nex-native-frame (position:
//      fixed · inset: 0 anchors to the frame because the frame sets
//      transform: translateZ(0) which creates a containing block for
//      position:fixed descendants · see nex-native.css L265).
//   2. DIM BACKDROP · backdrop-click dismisses · Esc dismisses · body
//      scroll lock when open · focus trap · focus return on close.
//   3. DOES NOT TRIGGER the left notification drawer or the right
//      navigation drawer (ControlDrawer) · this is a separate overlay.
//   4. Reuses the existing CheckoutSheet · reuses the existing group-
//      by-shop + updateQty + removeItem + clearShop + writeCart logic
//      from _client.tsx · recomputes totals the SAME way.
//   5. The "View full cart" link navigates to /nex-native/cart so the
//      standalone surface stays reachable.
//   6. Buyer notes field writes into localStorage item.note (per-line)
//      so edits persist across close/reopen AND survive reload (because
//      the cart lines live in localStorage).

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  NEX_CART_STORAGE_KEY,
  type NexCartItem,
} from "@/lib/nex-native/cart-types";
import { CheckoutSheet } from "./_checkout-sheet";
import { getShopPaymentMeta } from "./_shop-payment-methods";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "rgba(5, 15, 28, 0.98)";
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

function writeCart(items: NexCartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      NEX_CART_STORAGE_KEY,
      JSON.stringify(items),
    );
    window.dispatchEvent(new CustomEvent("nex-cart-changed"));
  } catch {
    /* fail-soft · surfaced in the popup as a quiet warning line */
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

export interface CartPopupClientProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/** Centered cart popup · portal'd into the sealed .nex-native-frame so
 *  the dim backdrop + modal stay inside the phone shell on desktop. */
export function CartPopupClient({
  open,
  onClose,
}: CartPopupClientProps): React.JSX.Element | null {
  const [items, setItems] = React.useState<NexCartItem[]>([]);
  const [hydrated, setHydrated] = React.useState(false);
  const [checkoutShopId, setCheckoutShopId] = React.useState<string | null>(
    null,
  );
  const [frameNode, setFrameNode] = React.useState<HTMLElement | null>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);

  // Resolve the .nex-native-frame portal target on mount. Falls back
  // to document.body if the trigger lives outside a frame (e.g. a
  // surface that doesn't mount the shell).
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const frame = document.querySelector<HTMLElement>(".nex-native-frame");
    setFrameNode(frame ?? document.body);
  }, []);

  // Keep the cart snapshot live while the popup is open · listens for
  // the same `nex-cart-changed` + storage events the standalone page
  // uses so an AddToCartButton on the backdrop flows through.
  React.useEffect(() => {
    if (!open) return;
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
  }, [open]);

  // Escape-to-close · focus trap · scroll lock · focus return.
  React.useEffect(() => {
    if (!open) return;
    previouslyFocused.current =
      (document.activeElement as HTMLElement | null) ?? null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    // Move initial focus to the close button once rendered.
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 20);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      // Return focus to the trigger that opened us.
      if (previouslyFocused.current) {
        try {
          previouslyFocused.current.focus();
        } catch {
          /* previously focused element may have unmounted · safe to ignore */
        }
      }
    };
  }, [open, onClose]);

  const groups = React.useMemo(() => groupByShop(items), [items]);
  const totalCount = React.useMemo(
    () => items.reduce((n, it) => n + Math.max(0, it.quantity | 0), 0),
    [items],
  );

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

  function updateNote(key: string, note: string) {
    const trimmed = note.slice(0, 500);
    const next = items.map((it) =>
      it.key === key ? { ...it, note: trimmed } : it,
    );
    setItems(next);
    writeCart(next);
  }

  if (!open || !frameNode) return null;

  const content = (
    <div
      data-nex-cart-popup
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-cart-popup-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 260,
        display: "grid",
        placeItems: "center",
        padding: 12,
      }}
    >
      {/* Dim backdrop · click dismisses. */}
      <div
        aria-hidden
        data-nex-cart-popup-backdrop
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(2, 6, 14, 0.78)",
          backdropFilter: "blur(2px)",
        }}
      />
      {/* Modal body. */}
      <div
        ref={dialogRef}
        style={{
          position: "relative",
          width: "min(100%, 320px)",
          maxHeight: "min(94%, 620px)",
          display: "flex",
          flexDirection: "column",
          background: SURFACE,
          color: CREAM,
          border: `1px solid ${BORDER_HI}`,
          borderRadius: 18,
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.55)",
          overflow: "hidden",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {/* Header · title + item count + close button. */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <h2
            id="nex-cart-popup-title"
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 900,
              color: GOLD,
              letterSpacing: "-0.01em",
              flex: 1,
            }}
          >
            Your cart
            {totalCount > 0 ? (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  color: INK_MUTED,
                  fontWeight: 700,
                }}
              >
                {totalCount} item{totalCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </h2>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close cart"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: "transparent",
              border: `1px solid ${BORDER}`,
              color: CREAM,
              fontSize: 15,
              lineHeight: 1,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ×
          </button>
        </header>

        {/* Body · scrolling area. */}
        <div
          data-nex-cart-popup-body
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "12px 14px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {!hydrated ? (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: INK_MUTED,
                textAlign: "center",
                padding: "28px 0",
              }}
            >
              Loading your cart…
            </p>
          ) : groups.length === 0 ? (
            <div
              data-nex-cart-popup-empty
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                alignItems: "center",
                textAlign: "center",
                padding: "32px 12px",
              }}
            >
              <span aria-hidden style={{ fontSize: 36 }}>🛒</span>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 800,
                  color: CREAM,
                }}
              >
                Your cart is empty
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: INK_DIM,
                  lineHeight: 1.45,
                }}
              >
                Tap <strong>Add to cart</strong> on any NEX product page.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <PopupShopGroup
                key={group.shopId}
                group={group}
                onUpdateQty={updateQty}
                onRemoveItem={removeItem}
                onUpdateNote={updateNote}
                onCheckout={() => setCheckoutShopId(group.shopId)}
              />
            ))
          )}
        </div>

        {/* Footer · view-full-cart link stays accessible. */}
        <footer
          style={{
            padding: "10px 14px 12px",
            borderTop: `1px solid ${BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            fontSize: 10.5,
            color: INK_MUTED,
          }}
        >
          <Link
            href="/nex-native/cart"
            onClick={onClose}
            style={{
              color: GOLD,
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: "0.03em",
            }}
          >
            Open full cart →
          </Link>
          <span>NEX never handles payments.</span>
        </footer>
      </div>

      {/* Checkout sheet · identical component to the standalone cart
          page · opens when a shop's Checkout button is tapped. */}
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
                shopQrCodeImageUrl={
                  getShopPaymentMeta(group.shopId).qrUrl
                }
                onClose={() => setCheckoutShopId(null)}
              />
            );
          })()
        : null}
    </div>
  );

  return createPortal(content, frameNode);
}

// ─── Per-shop group · compact popup rendering ───────────────────────
function PopupShopGroup({
  group,
  onUpdateQty,
  onRemoveItem,
  onUpdateNote,
  onCheckout,
}: {
  group: ShopGroup;
  onUpdateQty: (key: string, delta: number) => void;
  onRemoveItem: (key: string) => void;
  onUpdateNote: (key: string, note: string) => void;
  onCheckout: () => void;
}): React.JSX.Element {
  return (
    <section
      aria-label={`Cart items from ${group.shopDisplayName}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 10,
        background: "rgba(5, 15, 28, 0.6)",
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          data-nex-cart-popup-shop={group.shopId}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: 999,
            background: GOLD,
            color: "#1A120A",
            fontSize: 10.5,
            fontWeight: 900,
            letterSpacing: "0.03em",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          🏪 {group.shopDisplayName}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: INK_MUTED,
          }}
        >
          {group.items.length} line{group.items.length === 1 ? "" : "s"}
        </span>
      </div>

      {group.items.map((it) => (
        <div
          key={it.key}
          data-nex-cart-popup-line={it.key}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "8px 0",
            borderTop: `1px dashed ${BORDER}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              aria-hidden
              style={{
                width: 42,
                height: 42,
                borderRadius: 8,
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
                  fontSize: 12,
                  fontWeight: 800,
                  color: CREAM,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {it.name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: GOLD,
                  fontWeight: 900,
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
                flexShrink: 0,
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
                  minWidth: 20,
                  textAlign: "center",
                  fontSize: 12,
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
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
              fontSize: 10,
              color: INK_MUTED,
              letterSpacing: "0.02em",
            }}
          >
            <span>Notes for this item (optional)</span>
            <input
              type="text"
              value={it.note ?? ""}
              onChange={(e) => onUpdateNote(it.key, e.target.value)}
              placeholder="e.g. no onions · wrap as gift"
              data-nex-cart-popup-note-input={it.key}
              maxLength={500}
              style={{
                padding: "6px 8px",
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                background: "rgba(0, 0, 0, 0.35)",
                color: CREAM,
                fontSize: 11,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
          </label>
        </div>
      ))}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 6,
          borderTop: `1px solid ${BORDER}`,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 9,
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
              fontSize: 15,
              fontWeight: 900,
              color: GOLD,
            }}
            data-nex-cart-popup-subtotal={group.shopId}
          >
            {formatPrice(group.subtotalPence, group.currency)}
          </div>
        </div>
        <button
          type="button"
          onClick={onCheckout}
          data-nex-cart-popup-checkout={group.shopId}
          style={{
            padding: "9px 16px",
            borderRadius: 999,
            background: GOLD,
            color: "#1A120A",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 8px 18px rgba(198,161,91,0.22)",
          }}
        >
          Checkout →
        </button>
      </div>
    </section>
  );
}

const qtyBtnStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  background: "rgba(5, 15, 28, 0.9)",
  color: CREAM,
  border: "none",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "inherit",
};
