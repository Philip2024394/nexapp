"use client";

// src/app/nex-native/cover/_product-detail-sheet.tsx
//
// Product detail bottom sheet · the "slider from bottom for view
// product details and add to cart and checkout".
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Opens as a slide-up sheet scoped to the phone frame when the shop
// surface receives `?product=<id>`. Shows:
//   · Large product image
//   · Name · price · description
//   · Quantity picker (1-20)
//   · "Add to cart" (writes NEX_CART_STORAGE_KEY · fires nex-cart-changed)
//   · "Buy now · message the shop" → deep-links to chat with the
//     product attached via the existing pending_product flow so the
//     owner receives the enquiry in their peer chat
//   · "Payment on arrival" strip listing the shop's accepted payment
//     methods (NEX never handles money per the sealed doctrine — the
//     strip just tells the buyer what the owner accepts)
//
// Close: X button · backdrop · ESC · router.push removes the ?product
// param so the URL returns to the clean shop surface.

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  NEX_CART_STORAGE_KEY,
  type NexCartItem,
} from "@/lib/nex-native/cart-types";
import { writeShopPaymentMeta } from "../cart/_shop-payment-methods";
import { openShopChatAction } from "../[businessSlug]/_open-shop-chat-action";
// Stage 7 · item 5 · 2026-11-14 · shared Stage-4 popup component
// extracted to `@/components/nex-native/business-chat` so the shop
// cover FAB and the anon preview chat can mount the SAME polished
// modal · copy + hrefs still live in the pure helper the inline
// version used.
import { ShopChatRegistrationPopup } from "@/components/nex-native/business-chat/ShopChatRegistrationPopup";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "#FAF8F4";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "rgba(5, 15, 28, 0.98)";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.6)";

export interface ProductDetailSheetProduct {
  readonly id: string;
  readonly name: string;
  readonly price_pence: number;
  readonly currency: string;
  readonly image_url: string | null;
  readonly description: string | null;
}

export interface ProductDetailSheetProps {
  readonly products: ReadonlyArray<ProductDetailSheetProduct>;
  readonly shopOwnerAccountId: string;
  readonly shopName: string;
  readonly shopBusinessId: string;
  readonly shopSlug: string;
  readonly acceptedPaymentMethods?: ReadonlyArray<string>;
  readonly acceptedPaymentLabels: ReadonlyArray<string>;
  readonly shopQrCodeImageUrl?: string | null;
  readonly accentHex?: string | null;
  /** Stage 4 · 2026-11-14 · when false, the "More Details" button
   *  opens the in-sheet ShopChatRegistrationPopup instead of firing
   *  the server action immediately. Signed-in viewers skip the
   *  popup and submit through to openShopChatAction. Defaults to
   *  false so a caller that forgets to pass it defaults to the
   *  safer behaviour (popup rather than a surprise redirect). */
  readonly isSignedIn?: boolean;
}

export function ProductDetailSheet({
  products,
  shopOwnerAccountId,
  shopName,
  shopBusinessId,
  shopSlug,
  acceptedPaymentMethods,
  acceptedPaymentLabels,
  shopQrCodeImageUrl,
  accentHex,
  isSignedIn = false,
}: ProductDetailSheetProps): React.JSX.Element | null {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const productId = searchParams?.get("product") ?? null;

  // Owner-authorised 2026-11-16 · the product-detail SLIDER is
  // retired on the shop surface in favour of the dedicated full
  // product page at `/nex-native/product/<id>`. When the shop URL
  // carries `?product=<id>` (deep-link, share-return, legacy caller)
  // we redirect to the full page instead of mounting the sheet. The
  // sheet code below stays in place for any remaining callers that
  // might still mount it directly (none found in the current repo)
  // · the useEffect redirect is the single switch flip.
  React.useEffect(() => {
    if (!productId) return;
    const target = `/nex-native/product/${encodeURIComponent(productId)}`;
    router.replace(target);
  }, [productId, router]);

  const product = React.useMemo(
    () => (productId ? products.find((p) => p.id === productId) : null),
    [productId, products],
  );

  // Owner-authorised 2026-11-16 · while the client-side redirect is
  // in flight, render nothing so the slider never flashes on top of
  // the shop. No sheet ever paints on the shop surface again.
  if (productId) return null;

  const [qty, setQty] = React.useState(1);
  const [status, setStatus] = React.useState<
    { kind: "idle" } | { kind: "added" } | { kind: "error"; msg: string }
  >({ kind: "idle" });

  // Reset qty + status every time a new product opens.
  React.useEffect(() => {
    setQty(1);
    setStatus({ kind: "idle" });
  }, [productId]);

  React.useEffect(() => {
    if (!product) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  if (!product) return null;

  const accent =
    accentHex && /^#[0-9A-Fa-f]{6}$/.test(accentHex) ? accentHex : GOLD;

  function close() {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.delete("product");
    const qs = next.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
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

  function addToCart() {
    if (!product) return;
    try {
      const raw = window.localStorage.getItem(NEX_CART_STORAGE_KEY);
      const existing: NexCartItem[] = raw
        ? (JSON.parse(raw) as NexCartItem[])
        : [];
      const idx = existing.findIndex(
        (c) => c.id === product.id && c.shop_id === shopBusinessId,
      );
      let next: NexCartItem[];
      if (idx >= 0) {
        next = existing.map((c, i) =>
          i === idx ? { ...c, quantity: c.quantity + qty } : c,
        );
      } else {
        const item: NexCartItem = {
          key: `${product.id}-${Date.now().toString(36)}`,
          kind: "product",
          id: product.id,
          shop_id: shopBusinessId,
          shop_slug: shopSlug,
          shop_owner_account_id: shopOwnerAccountId,
          shop_display_name: shopName,
          name: product.name,
          price_pence: product.price_pence,
          currency: product.currency,
          image_url: product.image_url,
          quantity: qty,
          variants: [],
        };
        next = [...existing, item];
      }
      window.localStorage.setItem(
        NEX_CART_STORAGE_KEY,
        JSON.stringify(next),
      );
      window.dispatchEvent(new CustomEvent("nex-cart-changed"));
      // Owner directive 2026-11-06 · also persist the shop's accepted
      // payment methods + QR code URL so the cart's CheckoutSheet can
      // read them without a server round-trip when the buyer lands
      // on /cart. Keyed by shop_id · fully optional (no methods just
      // hides the payment picker).
      if (
        acceptedPaymentMethods &&
        acceptedPaymentMethods.length > 0
      ) {
        writeShopPaymentMeta(shopBusinessId, {
          methods: acceptedPaymentMethods,
          qrUrl: shopQrCodeImageUrl ?? null,
        });
      }
      setStatus({ kind: "added" });
    } catch (e) {
      setStatus({ kind: "error", msg: (e as Error).message });
    }
  }

  // Owner directive 2026-11-14 · "More Details" opens the dedicated
  // Shop Chat (/nex-native/conversations/<id>) with the selected
  // product passed through via `?product=<id>`. The action resolves
  // / creates the business conversation server-side so this is
  // always the correct shop thread even if the customer has multiple
  // shops with the same owner. The customer never lands in the
  // owner's personal peer chat.
  const openShopChatWithProduct = React.useMemo(
    () => openShopChatAction.bind(null, shopSlug),
    [shopSlug],
  );

  // Stage 4 · 2026-11-14 · anon registration popup. When the viewer
  // is NOT signed in, tapping More Details opens an in-sheet popup
  // offering "Create Free Account" / "Sign In" INSTEAD of bouncing
  // to /sign-in via the server action. The popup carries the Stage
  // 3 `next=` so the selected product survives the auth round-trip.
  const [registrationPopupOpen, setRegistrationPopupOpen] =
    React.useState(false);
  const priceLabel = formatPrice(product.price_pence, product.currency);
  const totalLabel = formatPrice(product.price_pence * qty, product.currency);

  return (
    <>
      <div
        aria-hidden
        onClick={close}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          zIndex: 80,
        }}
      />
      <section
        role="dialog"
        aria-label={product.name}
        data-nex-product-detail-sheet={product.id}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "90%",
          background: SURFACE,
          color: INK,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: `2px solid ${accent}`,
          boxShadow: "0 -24px 48px rgba(0,0,0,0.7)",
          zIndex: 81,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "Inter, system-ui, sans-serif",
          animation: "nexProductSheetSlideUp 260ms ease-out",
        }}
      >
        <style>{`@keyframes nexProductSheetSlideUp { from { transform: translateY(16%); opacity: 0.4; } to { transform: translateY(0); opacity: 1; } }`}</style>

        {/* Grab handle + close */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 14px 4px",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 42,
              height: 4,
              background: BORDER_HI,
              borderRadius: 999,
            }}
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{
              position: "absolute",
              right: 12,
              top: 6,
              width: 28,
              height: 28,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              color: INK,
              border: `1px solid ${BORDER}`,
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "4px 14px 14px",
          }}
        >
          {/* Image */}
          <div
            aria-hidden={!!product.image_url}
            role={product.image_url ? undefined : "img"}
            aria-label={
              product.image_url ? undefined : `${product.name} image missing`
            }
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              borderRadius: 14,
              border: `1px solid ${BORDER}`,
              backgroundImage: product.image_url
                ? `url(${product.image_url})`
                : undefined,
              background: product.image_url
                ? undefined
                : `linear-gradient(135deg, ${accent}22, rgba(5,15,28,0.9))`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              display: "grid",
              placeItems: "center",
              color: INK_MUTED,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {!product.image_url ? "Image coming soon" : null}
          </div>

          {/* Name + price */}
          <h2
            style={{
              margin: "14px 0 4px",
              fontSize: 20,
              fontWeight: 900,
              color: CREAM,
              letterSpacing: "-0.015em",
              lineHeight: 1.2,
            }}
          >
            {product.name}
          </h2>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: accent,
                letterSpacing: "0.005em",
              }}
            >
              {priceLabel}
            </span>
            <span style={{ fontSize: 10.5, color: INK_MUTED }}>
              per item
            </span>
          </div>

          {/* Description */}
          {product.description && product.description.trim().length > 0 ? (
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 13,
                lineHeight: 1.55,
                color: INK_DIM,
              }}
            >
              {product.description}
            </p>
          ) : null}

          {/* Payment methods */}
          {acceptedPaymentLabels.length > 0 ? (
            <section
              aria-label="Accepted payment methods"
              style={{
                padding: "10px 12px",
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: accent,
                  marginBottom: 5,
                }}
              >
                Payment on arrival
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {acceptedPaymentLabels.map((label) => (
                  <span
                    key={label}
                    style={{
                      padding: "3px 9px",
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: INK,
                      background: "rgba(198, 161, 91, 0.12)",
                      border: `1px solid ${BORDER}`,
                      borderRadius: 999,
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  color: INK_MUTED,
                  lineHeight: 1.45,
                }}
              >
                NEX never handles payments · the shop confirms + collects
                directly.
              </div>
            </section>
          ) : null}
        </div>

        {/* Sticky action row · qty + totals + CTAs */}
        <div
          style={{
            padding:
              "10px 14px calc(env(safe-area-inset-bottom, 0px) + 12px)",
            borderTop: `1px solid ${BORDER}`,
            background: "rgba(2, 9, 20, 0.92)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* Qty + total row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
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
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                style={qtyBtnStyle}
              >
                −
              </button>
              <span
                style={{
                  minWidth: 28,
                  textAlign: "center",
                  fontSize: 14,
                  fontWeight: 900,
                  color: CREAM,
                }}
              >
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(20, q + 1))}
                aria-label="Increase quantity"
                style={qtyBtnStyle}
              >
                +
              </button>
            </div>
            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 10,
                  color: INK_MUTED,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Total
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 16,
                  fontWeight: 900,
                  color: accent,
                }}
              >
                {totalLabel}
              </span>
            </div>
          </div>

          {/* Owner directive 2026-11-14 · two clear CTAs matching the
              sealed customer journey:
                · BUY NOW → add the product to the cart and route the
                  customer straight to /cart to complete checkout. This
                  preserves the sealed "payment on arrival" doctrine —
                  NEX never handles money · the cart surface lists the
                  shop's accepted payment methods for the arranger.
                · MORE DETAILS → form-submit to openShopChatAction with
                  the product_id so the dedicated Shop Chat opens with
                  the product pinned above the composer. No personal
                  peer-chat detour. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => {
                addToCart();
                router.push("/nex-native/cart");
              }}
              data-nex-product-sheet-buy-now={product.id}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "none",
                background: accent,
                color: "#1A120A",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 8px 20px rgba(198,161,91,0.22)",
              }}
            >
              Buy Now
            </button>
            <form
              action={openShopChatWithProduct}
              style={{ display: "contents" }}
              onSubmit={(e) => {
                // Stage 4 · 2026-11-14 · anon viewers get the
                // polished in-sheet popup instead of a full-page
                // bounce to /sign-in. We preventDefault the form
                // submit so the action never fires; the popup's
                // Create / Sign-in links carry the Stage 3 `next=`
                // shape (built fresh below) and complete the
                // round-trip. Signed-in viewers skip the branch
                // and submit through to openShopChatAction.
                if (!isSignedIn) {
                  e.preventDefault();
                  setRegistrationPopupOpen(true);
                }
              }}
            >
              <input type="hidden" name="product_id" value={product.id} />
              <button
                type="submit"
                data-nex-product-sheet-more-details={product.id}
                data-nex-product-sheet-more-details-mode={
                  isSignedIn ? "submit" : "popup"
                }
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${accent}`,
                  background: "transparent",
                  color: accent,
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  width: "100%",
                }}
              >
                More Details
              </button>
            </form>
          </div>
          {status.kind === "error" ? (
            <span style={{ fontSize: 11, color: "#FF6B6B" }}>
              {status.msg}
            </span>
          ) : status.kind === "added" ? (
            <span
              style={{
                fontSize: 10.5,
                color: INK_MUTED,
                textAlign: "center",
              }}
            >
              In your cart · redirecting to checkout with {shopName}.
            </span>
          ) : null}
        </div>
      </section>
      {registrationPopupOpen ? (
        <ShopChatRegistrationPopup
          shopName={shopName}
          shopSlug={shopSlug}
          productId={product.id}
          accent={accent}
          onDismiss={() => setRegistrationPopupOpen(false)}
        />
      ) : null}
    </>
  );
}

// Stage 7 · item 5 · 2026-11-14 · inline ShopChatRegistrationPopup
// definition removed. The component now lives at
// `@/components/nex-native/business-chat/ShopChatRegistrationPopup`
// so the shop cover FAB and the anon chat preview can mount the
// SAME polished modal. Copy + hrefs unchanged.

const qtyBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  background: "rgba(5, 15, 28, 0.9)",
  color: CREAM,
  border: "none",
  fontSize: 18,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "inherit",
};
