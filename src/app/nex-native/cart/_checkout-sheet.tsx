"use client";

// src/app/nex-native/cart/_checkout-sheet.tsx
//
// Buyer details + payment picker · opens when a shop's Checkout →
// button is tapped on the cart page.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Three-field buyer collect + optional payment method pick · submits
// to the sealed sendCartOrderAction with enriched payload so the
// owner receives the whole intent in one chat message (name · phone
// · delivery_address · preferred_payment_method · cart items).
//
// NEX never handles money per the sealed doctrine. The owner + buyer
// settle payment in chat using one of the shop's accepted methods
// (COD / QRIS / meetup / escrow / PayPal / etc.) · the picker here
// just signals the buyer's preference so the owner replies with the
// matching instructions (e.g. a QR code when QRIS is picked).

import * as React from "react";
import { sendCartOrderAction } from "../_actions";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "rgba(5, 15, 28, 0.98)";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";

export interface CheckoutSheetProps {
  readonly shopDisplayName: string;
  readonly shopSlug: string;
  readonly shopId: string;
  readonly shopOwnerAccountId: string;
  readonly currency: string;
  /** Cart items for this shop · serialised into cart_payload.items */
  readonly items: ReadonlyArray<{
    product_id: string;
    kind: "product" | "menu_item";
    name: string;
    price_pence: number;
    currency: string;
    quantity: number;
    image_url: string | null;
    variants: string[];
  }>;
  readonly subtotalLabel: string;
  /** Shop's declared accepted payment methods · sealed enum from
   *  NEX_PAYMENT_METHODS (cod / qris_delivery / courier_cod / meetup /
   *  escrow / paypal) · empty = "confirm in chat". */
  readonly acceptedPaymentMethods: ReadonlyArray<string>;
  /** Pre-rendered labels for the methods (e.g. "💵 Cash on Delivery"). */
  readonly acceptedPaymentLabels: ReadonlyArray<string>;
  readonly onClose: () => void;
}

const PAYMENT_META: Record<
  string,
  { emoji: string; label: string; blurb: string }
> = {
  cod: {
    emoji: "💵",
    label: "Cash on Delivery",
    blurb: "Pay the driver in cash when the order arrives.",
  },
  qris_delivery: {
    emoji: "📱",
    label: "QRIS on Delivery",
    blurb: "Scan the shop's QR when the package arrives.",
  },
  courier_cod: {
    emoji: "📦",
    label: "Courier C.O.D",
    blurb: "Courier collects + remits to the shop after delivery.",
  },
  meetup: {
    emoji: "🤝",
    label: "Meet in Person",
    blurb: "Inspect the item live · pay cash on the spot.",
  },
  escrow: {
    emoji: "🔒",
    label: "Escrow",
    blurb: "Third-party holds the money until you confirm receipt.",
  },
  paypal: {
    emoji: "🌏",
    label: "PayPal",
    blurb: "PayPal Buyer Protection · verified sellers only.",
  },
};

export function CheckoutSheet({
  shopDisplayName,
  shopSlug,
  shopId,
  shopOwnerAccountId,
  currency,
  items,
  subtotalLabel,
  acceptedPaymentMethods,
  acceptedPaymentLabels,
  onClose,
}: CheckoutSheetProps): React.JSX.Element {
  const [buyerName, setBuyerName] = React.useState("");
  const [buyerPhone, setBuyerPhone] = React.useState("");
  const [line1, setLine1] = React.useState("");
  const [city, setCity] = React.useState("");
  const [postcode, setPostcode] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<string | null>(
    acceptedPaymentMethods[0] ?? null,
  );

  // Fresh idempotency token on every open. Re-opens get a new UUID so
  // the server treats them as independent orders.
  const sendIntentId = React.useMemo(
    () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    [],
  );

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const payload = React.useMemo(() => {
    const buyerNotesCombined = [
      paymentMethod
        ? `Preferred payment: ${PAYMENT_META[paymentMethod]?.label ?? paymentMethod}`
        : null,
      notes.trim() || null,
    ]
      .filter(Boolean)
      .join("\n");
    return JSON.stringify({
      peer_account_id: shopOwnerAccountId,
      shop_id: shopId,
      shop_slug: shopSlug,
      shop_display_name: shopDisplayName,
      currency,
      buyer_notes: buyerNotesCombined || null,
      delivery_address:
        line1 || city || postcode
          ? {
              buyer_name: buyerName.trim() || null,
              buyer_phone: buyerPhone.trim() || null,
              line1: line1.trim() || null,
              city: city.trim() || null,
              postcode: postcode.trim() || null,
            }
          : {
              buyer_name: buyerName.trim() || null,
              buyer_phone: buyerPhone.trim() || null,
            },
      items,
    });
  }, [
    buyerName,
    buyerPhone,
    line1,
    city,
    postcode,
    notes,
    paymentMethod,
    shopOwnerAccountId,
    shopId,
    shopSlug,
    shopDisplayName,
    currency,
    items,
  ]);

  const canSend = buyerName.trim().length > 0;

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.72)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 100,
        }}
      />
      <section
        role="dialog"
        aria-label={`Checkout with ${shopDisplayName}`}
        data-nex-checkout-sheet={shopId}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "92%",
          background: SURFACE,
          color: INK,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: `2px solid ${GOLD}`,
          boxShadow: "0 -24px 48px rgba(0,0,0,0.7)",
          zIndex: 101,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "Inter, system-ui, sans-serif",
          animation: "nexCheckoutSheetSlideUp 260ms ease-out",
        }}
      >
        <style>{`@keyframes nexCheckoutSheetSlideUp { from { transform: translateY(16%); opacity: 0.4; } to { transform: translateY(0); opacity: 1; } }`}</style>

        {/* Grab handle + close */}
        <div
          style={{
            position: "relative",
            padding: "8px 14px 6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
            onClick={onClose}
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

        {/* Header · shop + subtotal */}
        <header
          style={{
            padding: "4px 16px 12px",
            borderBottom: `1px solid ${BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span
              style={{
                display: "block",
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: GOLD,
              }}
            >
              Checkout with
            </span>
            <span
              style={{
                display: "block",
                fontSize: 16,
                fontWeight: 900,
                color: CREAM,
                letterSpacing: "-0.01em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              🏪 {shopDisplayName}
            </span>
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
              Subtotal
            </span>
            <span
              style={{
                display: "block",
                fontSize: 16,
                fontWeight: 900,
                color: GOLD,
              }}
            >
              {subtotalLabel}
            </span>
          </div>
        </header>

        {/* Form body · scrollable */}
        <form
          action={sendCartOrderAction}
          method="post"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <input type="hidden" name="send_intent_id" value={sendIntentId} />
          <input type="hidden" name="cart_payload" value={payload} />

          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: "14px 16px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {/* Name */}
            <div>
              <label htmlFor="co-name" style={LABEL_STYLE}>
                Your name
              </label>
              <input
                id="co-name"
                type="text"
                required
                placeholder="Full name"
                value={buyerName}
                onChange={(e) => setBuyerName(e.currentTarget.value)}
                style={FIELD_STYLE}
                maxLength={80}
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="co-phone" style={LABEL_STYLE}>
                Phone / WhatsApp{" "}
                <span style={OPTIONAL_STYLE}>optional</span>
              </label>
              <input
                id="co-phone"
                type="tel"
                placeholder="+353 1 234 5678"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.currentTarget.value)}
                style={FIELD_STYLE}
                maxLength={32}
              />
            </div>

            {/* Delivery address */}
            <div>
              <span style={LABEL_STYLE}>
                Delivery address{" "}
                <span style={OPTIONAL_STYLE}>skip for pickup</span>
              </span>
              <input
                type="text"
                placeholder="Street + number"
                value={line1}
                onChange={(e) => setLine1(e.currentTarget.value)}
                style={{ ...FIELD_STYLE, marginBottom: 6 }}
                maxLength={120}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="text"
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.currentTarget.value)}
                  style={{ ...FIELD_STYLE, flex: 2 }}
                  maxLength={60}
                />
                <input
                  type="text"
                  placeholder="Eircode"
                  value={postcode}
                  onChange={(e) => setPostcode(e.currentTarget.value)}
                  style={{ ...FIELD_STYLE, flex: 1 }}
                  maxLength={12}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="co-notes" style={LABEL_STYLE}>
                Notes to the shop{" "}
                <span style={OPTIONAL_STYLE}>optional</span>
              </label>
              <textarea
                id="co-notes"
                rows={2}
                placeholder="Gift wrap · delivery window · allergies · anything else"
                value={notes}
                onChange={(e) => setNotes(e.currentTarget.value)}
                style={{
                  ...FIELD_STYLE,
                  fontFamily: "inherit",
                  resize: "vertical",
                  minHeight: 54,
                }}
                maxLength={1500}
              />
            </div>

            {/* Payment method picker */}
            {acceptedPaymentMethods.length > 0 ? (
              <div>
                <span style={LABEL_STYLE}>Preferred payment</span>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {acceptedPaymentMethods.map((m, i) => {
                    const meta =
                      PAYMENT_META[m] ?? {
                        emoji: "💳",
                        label: acceptedPaymentLabels[i] ?? m,
                        blurb: "",
                      };
                    const isPicked = paymentMethod === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        aria-pressed={isPicked}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          background: isPicked
                            ? "rgba(198, 161, 91, 0.18)"
                            : "rgba(5, 15, 28, 0.9)",
                          border: `1.5px solid ${isPicked ? GOLD : BORDER}`,
                          borderRadius: 10,
                          color: INK,
                          textAlign: "left",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          boxShadow: isPicked
                            ? "0 0 0 3px rgba(198,161,91,0.14)"
                            : "none",
                        }}
                      >
                        <span aria-hidden style={{ fontSize: 18 }}>
                          {meta.emoji}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              display: "block",
                              fontSize: 12.5,
                              fontWeight: 900,
                              color: isPicked ? GOLD : CREAM,
                            }}
                          >
                            {meta.label}
                          </span>
                          {meta.blurb ? (
                            <span
                              style={{
                                display: "block",
                                fontSize: 10.5,
                                color: INK_DIM,
                                marginTop: 1,
                                lineHeight: 1.35,
                              }}
                            >
                              {meta.blurb}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <span
                  style={{
                    display: "block",
                    fontSize: 10,
                    color: INK_MUTED,
                    marginTop: 6,
                    lineHeight: 1.45,
                  }}
                >
                  Your pick lands with the order in chat so the shop
                  knows which instructions to send back.
                </span>
              </div>
            ) : null}
          </div>

          {/* Submit row */}
          <div
            style={{
              padding:
                "10px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)",
              borderTop: `1px solid ${BORDER}`,
              background: "rgba(2, 9, 20, 0.92)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <button
              type="submit"
              disabled={!canSend}
              style={{
                padding: "14px 20px",
                borderRadius: 999,
                background: canSend ? GOLD : "rgba(198, 161, 91, 0.35)",
                color: "#1A120A",
                fontSize: 12.5,
                fontWeight: 900,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                border: "none",
                cursor: canSend ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                boxShadow: canSend
                  ? "0 10px 24px rgba(198,161,91,0.22)"
                  : "none",
              }}
            >
              Send order to {shopDisplayName}
            </button>
            <span
              style={{
                display: "block",
                textAlign: "center",
                fontSize: 10,
                color: INK_MUTED,
                lineHeight: 1.45,
              }}
            >
              NEX never handles payments · shop + buyer settle in chat.
            </span>
          </div>
        </form>
      </section>
    </>
  );
}

const FIELD_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  background: "rgba(5, 15, 28, 0.9)",
  color: INK,
  border: `1px solid ${BORDER_HI}`,
  borderRadius: 10,
  fontSize: 13.5,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 10.5,
  fontWeight: 900,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: GOLD,
  marginBottom: 5,
};

const OPTIONAL_STYLE: React.CSSProperties = {
  marginLeft: 6,
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: "0.08em",
  color: INK_MUTED,
  textTransform: "uppercase",
};
