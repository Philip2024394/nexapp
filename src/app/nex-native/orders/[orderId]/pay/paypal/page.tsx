// src/app/nex-native/orders/[orderId]/pay/paypal/page.tsx
//
// Buyer PayPal payment page · sealed 2026-11-10 (revised).
//
// Flow:
//   1. Session required · buyer owns the order (customer_account_id match).
//   2. Order must be in 'created' or 'pending' state.
//   3. Seller must have a PayPal merchant_id in nex_business (mig 336).
//   4. Server calls `createMerchantDirectPaypalOrder` · if OK → redirect
//      the browser to the PayPal approval URL via 302 (no client JS).
//   5. Fail states each render a clear, honest message · no mockup, no
//      "payment successful" claim before the webhook confirms.
//
// Access rules mirror the QR page exactly · only the buyer can hit it.
// Never exposes the seller's PayPal merchant id in page content.

import type * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as orderService from "@/lib/nex-native/order-service";
import {
  createMerchantDirectPaypalOrder,
  getSellerPaypalMerchantId,
} from "@/lib/nex-native/payments/paypal-checkout-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const PALETTE = {
  bg: "var(--nex-world-drawer-bg, #123D2B)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
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

function Stage({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <main
      data-nex-pay-paypal
      style={{
        minHeight: "100dvh",
        background: PALETTE.bg,
        color: PALETTE.text,
        padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 60px",
        fontFamily: SANS,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>{children}</div>
    </main>
  );
}

function Card({
  heading,
  children,
  tone = "info",
}: {
  readonly heading: string;
  readonly children: React.ReactNode;
  readonly tone?: "info" | "warn";
}): React.JSX.Element {
  return (
    <section
      style={{
        background: PALETTE.cardBg,
        border: `1.5px solid ${tone === "warn" ? PALETTE.warn : PALETTE.cardBorder}`,
        borderRadius: 14,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          color: tone === "warn" ? PALETTE.warn : PALETTE.accent,
          fontWeight: 900,
          textTransform: "uppercase",
        }}
      >
        {heading}
      </div>
      {children}
    </section>
  );
}

export default async function BuyerPayPaypalPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<{ cancelled?: string }>;
}): Promise<React.JSX.Element> {
  const { orderId } = await params;
  const sp = (await searchParams) ?? {};

  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(`/nex-native/sign-in?next=/nex-native/orders/${orderId}/pay/paypal`);
  }

  const order = await orderService.getOrderById(orderId);
  if (!order) notFound();

  if (order.customer_account_id !== session.account.id) notFound();

  if (!["created", "pending"].includes(order.state)) {
    redirect(`/nex-native/orders/${orderId}`);
  }

  const cancelled = sp.cancelled === "1";

  if (cancelled) {
    return (
      <Stage>
        <Card heading="Payment cancelled" tone="warn">
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
            You cancelled the PayPal approval. Your order is still open.
            You can retry below, or go back to the order page.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <Link
              href={`/nex-native/orders/${orderId}/pay/paypal`}
              data-nex-paypal-retry
              style={{
                flex: 1,
                textAlign: "center",
                padding: "10px 14px",
                borderRadius: 12,
                background: PALETTE.accent,
                color: "#0a1c14",
                textDecoration: "none",
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              Try PayPal again
            </Link>
            <Link
              href={`/nex-native/orders/${orderId}`}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "10px 14px",
                borderRadius: 12,
                border: `1.5px solid ${PALETTE.cardBorder}`,
                color: PALETTE.text,
                textDecoration: "none",
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              Back to order
            </Link>
          </div>
        </Card>
      </Stage>
    );
  }

  const sellerPaypalMerchantId = await getSellerPaypalMerchantId(order.business_id);

  const createResult = await createMerchantDirectPaypalOrder({
    order,
    sellerPaypalMerchantId,
  });

  if (createResult.ok) {
    redirect(createResult.url);
  }

  const amount = formatMoney(order.price_pence, order.currency);

  if (createResult.reason === "seller_not_connected") {
    return (
      <Stage>
        <Card heading="PayPal not set up yet" tone="warn">
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
            This seller has not connected a PayPal account yet. Please pick
            a different payment method on the order page, or message the
            seller through NEX Chat to arrange payment.
          </p>
          <p style={{ margin: 0, fontSize: 12, color: PALETTE.textMuted, lineHeight: 1.6 }}>
            Order total: {amount}
          </p>
          <Link
            href={`/nex-native/orders/${orderId}/pay`}
            style={{
              alignSelf: "flex-start",
              padding: "10px 14px",
              borderRadius: 12,
              background: PALETTE.accent,
              color: "#0a1c14",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 13,
              marginTop: 4,
            }}
          >
            Choose another method
          </Link>
        </Card>
      </Stage>
    );
  }

  if (createResult.reason === "credentials_missing") {
    return (
      <Stage>
        <Card heading="PayPal is not available yet" tone="warn">
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
            PayPal payments are configured but not yet activated on this
            NEX deployment. Your order is safe · nothing has been charged.
          </p>
          <p style={{ margin: 0, fontSize: 12, color: PALETTE.textMuted, lineHeight: 1.6 }}>
            Order total: {amount}
          </p>
          <Link
            href={`/nex-native/orders/${orderId}`}
            style={{
              alignSelf: "flex-start",
              padding: "10px 14px",
              borderRadius: 12,
              background: PALETTE.accent,
              color: "#0a1c14",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 13,
              marginTop: 4,
            }}
          >
            Back to order
          </Link>
        </Card>
      </Stage>
    );
  }

  if (createResult.reason === "order_not_payable") {
    redirect(`/nex-native/orders/${orderId}`);
  }

  // oauth_failed · paypal_api_error · same user-facing message.
  return (
    <Stage>
      <Card heading="PayPal is temporarily unavailable" tone="warn">
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
          We couldn't reach PayPal just now. Your order is safe · nothing
          has been charged. Please retry in a moment, or choose another
          payment method on the order page.
        </p>
        <p style={{ margin: 0, fontSize: 12, color: PALETTE.textMuted, lineHeight: 1.6 }}>
          Order total: {amount}
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <Link
            href={`/nex-native/orders/${orderId}/pay/paypal`}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "10px 14px",
              borderRadius: 12,
              background: PALETTE.accent,
              color: "#0a1c14",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            Retry PayPal
          </Link>
          <Link
            href={`/nex-native/orders/${orderId}/pay`}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "10px 14px",
              borderRadius: 12,
              border: `1.5px solid ${PALETTE.cardBorder}`,
              color: PALETTE.text,
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            Other methods
          </Link>
        </div>
      </Card>
    </Stage>
  );
}
