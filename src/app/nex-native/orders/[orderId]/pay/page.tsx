// src/app/nex-native/orders/[orderId]/pay/page.tsx
//
// P5 · buyer payment page. Owner-sealed 2026-11-10.
//
// Access rules (enforced server-side):
//   · Session required.
//   · session.account.id must equal order.customer_account_id (buyer
//     owns the order).
//   · Order must be in 'created' or 'pending' state (paid / completed
//     / cancelled / refunded states redirect to the order detail page
//     because payment is no longer expected).
//   · Seller must have an active QR asset · otherwise the page shows
//     a "seller has no payment QR configured" message · no QR image
//     is rendered.
//
// Rendering rules:
//   · QR image is served via a SHORT-LIVED signed URL minted
//     server-side (3 minutes). The URL is embedded in an <img> tag in
//     the server-rendered HTML · no client fetch.
//   · System-authored copy only · the seller cannot inject text.
//   · The page NEVER claims "payment verified" · it says only
//     "Waiting for the seller to confirm receipt".

import type * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as orderService from "@/lib/nex-native/order-service";
import {
  getActiveQrAsset,
  type NexMerchantQrAssetRow,
} from "@/lib/nex-native/merchant-qr/qr-asset-service";
import { mintForBuyerPay } from "@/lib/nex-native/merchant-qr/signed-url-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { getSellerActiveMethods } from "@/lib/nex-native/payments/method-resolver-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SANS = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const PALETTE = {
  bg: "var(--nex-world-drawer-bg, #123D2B)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  accent: "var(--nex-world-secondary, #C6A15B)",
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
  warn: "#FFAF40",
};

function formatMoney(pence: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(pence / 100);
  } catch {
    return `${currency} ${(pence / 100).toFixed(2)}`;
  }
}

export default async function BuyerPayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}): Promise<React.JSX.Element> {
  const { orderId } = await params;
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect(`/nex-native/sign-in?next=/nex-native/orders/${orderId}/pay`);

  const order = await orderService.getOrderById(orderId);
  if (!order) notFound();

  // Ownership: only the buyer can see their payment page.
  if (order.customer_account_id !== session.account.id) notFound();

  // State gate: only created / pending accept a payment page view.
  if (!["created", "pending"].includes(order.state)) {
    redirect(`/nex-native/orders/${orderId}`);
  }

  // Resolve the seller's business + every active payment method.
  const [{ data: biz }, methods] = await Promise.all([
    nexSupabaseAdmin
      .from("nex_business")
      .select("display_name, slug")
      .eq("id", order.business_id)
      .maybeSingle(),
    getSellerActiveMethods(order.business_id),
  ]);
  const sellerName = (biz as { display_name: string | null } | null)?.display_name ?? "the seller";

  // If the seller has 0 methods, this page shouldn't have been
  // reached · the buyer should be on /pay/chat. Redirect gracefully.
  if (!methods.any_configured) {
    redirect(`/nex-native/orders/${order.id}/pay/chat`);
  }

  // Multi-method picker: ≥ 2 methods active · buyer picks here.
  const showPicker = methods.configured_count > 1;

  let qr: NexMerchantQrAssetRow | null = null;
  let qrSignedUrl: string | null = null;
  if (!showPicker && methods.qr_manual) {
    try {
      qr = await getActiveQrAsset(order.business_id);
    } catch { qr = null; }
    if (qr) {
      const signed = await mintForBuyerPay(qr.storage_path);
      if (signed.ok) qrSignedUrl = signed.url;
    }
  }

  return (
    <>
      <style>{`html, body { background: ${PALETTE.bg}; }`}</style>
      <main
        data-nex-buyer-pay
        data-order-id={order.id}
        data-order-state={order.state}
        style={{
          minHeight: "100dvh",
          background: PALETTE.bg,
          color: PALETTE.text,
          fontFamily: SANS,
          padding: "calc(env(safe-area-inset-top, 0px) + 20px) 18px 48px",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <nav>
            <Link
              href={`/nex-native/orders/${order.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 700,
                color: PALETTE.accent,
                textDecoration: "none",
                border: `1px solid ${PALETTE.cardBorder}`,
                borderRadius: 999,
              }}
            >
              ← Order details
            </Link>
          </nav>

          {/* Amount card */}
          <section
            style={{
              padding: 18,
              borderRadius: 14,
              background: PALETTE.cardBg,
              border: `1.5px solid ${PALETTE.cardBorder}`,
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: "0.14em", color: PALETTE.accent, fontWeight: 900, textTransform: "uppercase" }}>
              Amount to pay
            </div>
            <div
              data-nex-amount-pence={order.price_pence}
              data-nex-amount-currency={order.currency}
              style={{ fontSize: 30, fontWeight: 900, marginTop: 4, letterSpacing: "-0.01em" }}
            >
              {formatMoney(order.price_pence, order.currency)}
            </div>
            <div style={{ fontSize: 12, color: PALETTE.textMuted, marginTop: 6 }}>
              Order <span style={{ fontFamily: "ui-monospace, Consolas, monospace" }}>
                #{order.id.slice(0, 8).toUpperCase()}
              </span> · {sellerName}
            </div>
          </section>

          {/* Multi-method picker · owner-sealed 2026-11-10. Buyer
              chooses between the active gateways. */}
          {showPicker ? (
            <section
              data-nex-method-picker
              style={{
                padding: 18,
                borderRadius: 14,
                background: PALETTE.cardBg,
                border: `1.5px solid ${PALETTE.cardBorder}`,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: PALETTE.accent,
                  fontWeight: 900,
                  textTransform: "uppercase",
                }}
              >
                Choose how to pay
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: PALETTE.textMuted, lineHeight: 1.55 }}>
                {sellerName} has set up multiple payment options. Pick one to continue.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Stripe deliberately absent · member subscriptions only ·
                    shop checkout routes through PayPal + QR + QRIS per
                    sealed 2026-11-10 gateway ownership rules */}
                {methods.qr_manual ? (
                  <Link
                    href={`/nex-native/orders/${order.id}/pay?method=qr`}
                    data-nex-picker-qr
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: "rgba(0,0,0,0.3)",
                      border: `1.5px solid ${PALETTE.cardBorder}`,
                      color: PALETTE.text,
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    <span>Scan seller's QR code</span>
                    <span aria-hidden style={{ color: PALETTE.accent }}>→</span>
                  </Link>
                ) : null}
                {methods.paypal ? (
                  <Link
                    href={`/nex-native/orders/${order.id}/pay/paypal`}
                    data-nex-picker-paypal
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: "rgba(0,0,0,0.3)",
                      border: `1.5px solid ${PALETTE.cardBorder}`,
                      color: PALETTE.text,
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    <span>PayPal</span>
                    <span aria-hidden style={{ color: PALETTE.accent }}>→</span>
                  </Link>
                ) : null}
                <Link
                  href={`/nex-native/orders/${order.id}/pay/chat`}
                  data-nex-picker-chat
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "transparent",
                    border: `1px dashed ${PALETTE.cardBorder}`,
                    color: PALETTE.textMuted,
                    textDecoration: "none",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <span>Arrange in chat with the seller instead</span>
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </section>
          ) : null}

          {/* Buyer-protection banner · owner-sealed 2026-11-10 ·
              high-prominence warning displayed ABOVE the QR card so
              the buyer reads it before scanning. */}
          {!showPicker && qr && qrSignedUrl ? (
            <section
              data-nex-buyer-warning
              role="alert"
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(255, 175, 64, 0.12)",
                border: `2px solid ${PALETTE.warn}`,
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>⚠️</span>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    color: PALETTE.warn,
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Verify before you pay
                </div>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: PALETTE.text }}>
                  Scanning a QR is NOT proof that it belongs to the
                  seller you ordered from. <strong>Check the merchant
                  name and amount your banking app shows before you
                  confirm the payment.</strong> If anything looks
                  unfamiliar, do not pay · message the seller.
                </p>
              </div>
            </section>
          ) : null}

          {/* QR card */}
          {!showPicker && qr && qrSignedUrl ? (
            <section
              data-nex-qr-card
              style={{
                padding: 18,
                borderRadius: 14,
                background: PALETTE.cardBg,
                border: `1.5px solid ${PALETTE.cardBorder}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: "0.14em", color: PALETTE.accent, fontWeight: 900, textTransform: "uppercase" }}>
                Seller's payment QR
              </div>
              {/* The signed URL is a short-lived token · we never
                  expose the private storage path publicly. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrSignedUrl}
                alt="Seller's payment QR code"
                width={300}
                height={300}
                data-nex-qr-img
                style={{
                  width: 300,
                  height: 300,
                  borderRadius: 10,
                  background: "#fff",
                  objectFit: "contain",
                }}
              />
              <div style={{ fontSize: 11, color: PALETTE.textDim, textAlign: "center" }}>
                QR link expires in a few minutes · refresh the page if the image stops loading.
              </div>
            </section>
          ) : !showPicker && !qr ? (
            <section
              data-nex-no-qr
              style={{
                padding: 18,
                borderRadius: 14,
                background: "rgba(139, 0, 0, 0.1)",
                border: `1.5px dashed ${PALETTE.warn}`,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: PALETTE.warn }}>
                The seller has not configured a payment QR yet
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: PALETTE.textMuted, lineHeight: 1.5 }}>
                You can message the seller to arrange payment another way, or wait for them to configure a QR and reload this page.
              </p>
            </section>
          ) : null}

          {/* System instructions, disclaimer, and "I have paid" CTA are
              QR-specific · only render when the QR card is on screen. */}
          {!showPicker && qr && qrSignedUrl ? (
            <>
              <section
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(0,0,0,0.25)",
                  border: `1px solid ${PALETTE.cardBorder}`,
                }}
              >
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: PALETTE.textMuted, lineHeight: 1.6 }}>
                  <li>Scan this QR with your bank or e-wallet app to pay the seller directly.</li>
                  <li><strong style={{ color: PALETTE.text }}>Verify the merchant name</strong> shown by your app before confirming the payment.</li>
                  <li>Payment is received by the seller, not by NEX.</li>
                  <li>The seller will confirm receipt manually after the payment reaches them. This may take a few minutes.</li>
                </ul>
              </section>

              <section
                data-nex-verification-disclaimer
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(198, 161, 91, 0.08)",
                  border: `1px solid ${PALETTE.accent}55`,
                }}
              >
                <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: PALETTE.textMuted }}>
                  <strong style={{ color: PALETTE.accent }}>NEX does not verify this payment.</strong>{" "}
                  The seller must confirm receipt in their dashboard. Until then, the order remains in <strong style={{ color: PALETTE.text }}>pending</strong>.
                </p>
              </section>

              <Link
                href={`/nex-native/orders/${order.id}`}
                style={{
                  alignSelf: "stretch",
                  padding: "12px 16px",
                  textAlign: "center",
                  background: PALETTE.accent,
                  color: "#061710",
                  textDecoration: "none",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                }}
              >
                I have paid · watch for seller confirmation
              </Link>
            </>
          ) : null}
        </div>
      </main>
    </>
  );
}
