// src/app/nex-native/orders/[orderId]/pay/stripe/page.tsx
//
// Owner-sealed 2026-11-10 · Stripe Checkout landing page.
//
// Server-rendered. Resolves ownership + payability. If Stripe is
// fully configured, server-side creates a merchant-direct Checkout
// Session and 302-redirects to the Stripe-hosted URL. If anything
// is missing (credentials, seller not connected, etc.), renders a
// clear BLOCKED state and offers to fall back to chat with the
// seller.

import type * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as orderService from "@/lib/nex-native/order-service";
import {
  createMerchantDirectCheckoutSession,
  getSellerStripeAccountId,
} from "@/lib/nex-native/payments/stripe-checkout-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SANS = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const PALETTE = {
  bg: "var(--nex-world-drawer-bg, #123D2B)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  accent: "var(--nex-world-secondary, #C6A15B)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
  cardBg: "rgba(10, 28, 20, 0.72)",
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

export default async function StripeCheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}): Promise<React.JSX.Element> {
  const { orderId } = await params;
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect(`/nex-native/sign-in?next=/nex-native/orders/${orderId}/pay/stripe`);

  const order = await orderService.getOrderById(orderId);
  if (!order) notFound();
  if (order.customer_account_id !== session.account.id) notFound();
  if (!["created", "pending"].includes(order.state)) {
    redirect(`/nex-native/orders/${orderId}`);
  }

  const sellerStripeAccountId = await getSellerStripeAccountId(order.business_id);
  const result = await createMerchantDirectCheckoutSession({
    order,
    sellerStripeAccountId,
  });

  // Happy path · hand off to Stripe-hosted Checkout.
  if (result.ok) {
    redirect(result.url);
  }

  // Blocked · explain honestly and offer the chat fallback.
  const reasonLabel = (() => {
    switch (result.reason) {
      case "credentials_missing":
        return "Stripe Checkout is not configured on this environment yet.";
      case "seller_not_connected":
        return "The seller hasn't finished connecting Stripe to their shop.";
      case "order_not_payable":
        return "This order cannot be paid in its current state.";
      case "stripe_api_error":
      default:
        return "Stripe returned an error while creating the checkout session.";
    }
  })();

  return (
    <>
      <style>{`html, body { background: ${PALETTE.bg}; }`}</style>
      <main
        data-nex-stripe-checkout-blocked
        data-order-id={order.id}
        data-reason={result.reason}
        style={{
          minHeight: "100dvh",
          background: PALETTE.bg,
          color: PALETTE.text,
          fontFamily: SANS,
          padding: "calc(env(safe-area-inset-top, 0px) + 20px) 18px 48px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <nav>
            <Link
              href={`/nex-native/orders/${order.id}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 10px", fontSize: 11, fontWeight: 700,
                color: PALETTE.accent, textDecoration: "none",
                border: `1px solid ${PALETTE.cardBorder}`, borderRadius: 999,
              }}
            >
              ← Order details
            </Link>
          </nav>

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
            <div style={{ fontSize: 30, fontWeight: 900, marginTop: 4, letterSpacing: "-0.01em" }}>
              {formatMoney(order.price_pence, order.currency)}
            </div>
          </section>

          <section
            data-nex-blocked
            style={{
              padding: 16,
              borderRadius: 14,
              background: "rgba(255, 175, 64, 0.12)",
              border: `2px solid ${PALETTE.warn}`,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, color: PALETTE.warn, letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: 6 }}>
              Stripe Checkout unavailable
            </div>
            <p style={{ margin: 0, fontSize: 13, color: PALETTE.text, lineHeight: 1.55 }}>
              {reasonLabel}
            </p>
            {result.detail ? (
              <p style={{ margin: "6px 0 0", fontSize: 11, color: PALETTE.textMuted, fontFamily: "ui-monospace, Consolas, monospace" }}>
                {result.detail}
              </p>
            ) : null}
          </section>

          <Link
            href={`/nex-native/orders/${order.id}/pay/chat`}
            data-nex-fallback-cta
            style={{
              display: "block",
              padding: "14px 18px",
              textAlign: "center",
              background: PALETTE.accent,
              color: "#061710",
              textDecoration: "none",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 900,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              boxShadow: "0 4px 14px rgba(198, 161, 91, 0.22)",
            }}
          >
            Arrange payment in chat instead
          </Link>
        </div>
      </main>
    </>
  );
}
