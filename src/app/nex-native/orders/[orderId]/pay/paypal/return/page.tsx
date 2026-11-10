// src/app/nex-native/orders/[orderId]/pay/paypal/return/page.tsx
//
// PayPal return handler · sealed 2026-11-10 (revised).
//
// PayPal redirects the buyer here with ?token=<paypalOrderId> after the
// buyer approves. We capture the order server-side · on success we show
// a "received, waiting for seller confirmation" state. The authoritative
// order-state update is driven by the PayPal webhook (PAYMENT.CAPTURE
// .COMPLETED), NOT this page. This page NEVER claims the order is paid
// before the webhook updates it · we present a safe interim state only.
//
// Design doctrine:
//   · Return URL is a NON-authoritative signal (Stripe + PayPal both
//     warn against trusting it for state change). We trigger capture
//     here because PayPal requires the Platform to capture after
//     approval · but the ground-truth happens via webhook.
//   · If capture fails or returns not_approved_yet, we tell the buyer
//     honestly and NEVER mutate the order state.

import type * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as orderService from "@/lib/nex-native/order-service";
import { capturePaypalOrder } from "@/lib/nex-native/payments/paypal-checkout-service";

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
  ok: "#7ED19B",
};

function Stage({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <main
      data-nex-pay-paypal-return
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

export default async function BuyerPayPaypalReturn({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<{ token?: string; PayerID?: string }>;
}): Promise<React.JSX.Element> {
  const { orderId } = await params;
  const sp = (await searchParams) ?? {};
  const paypalOrderId = typeof sp.token === "string" ? sp.token : null;

  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(`/nex-native/sign-in?next=/nex-native/orders/${orderId}/pay/paypal/return`);
  }

  const order = await orderService.getOrderById(orderId);
  if (!order) notFound();
  if (order.customer_account_id !== session.account.id) notFound();

  // If order already past pending state (paid via webhook already, or
  // completed/refunded), send the buyer to the order page.
  if (!["created", "pending"].includes(order.state)) {
    redirect(`/nex-native/orders/${orderId}`);
  }

  if (!paypalOrderId) {
    // No token · buyer landed here without the PayPal round-trip.
    redirect(`/nex-native/orders/${orderId}/pay/paypal`);
  }

  const result = await capturePaypalOrder({ paypalOrderId });

  // Record a non-authoritative event so the audit trail shows the
  // capture attempt even if the webhook hasn't landed yet.
  try {
    await orderService.recordOrderEvent({
      order_id: orderId,
      event: "paypal.capture.attempted",
      actor_account_id: session.account.id,
      metadata: result.ok
        ? {
            paypal_order_id: result.paypalOrderId,
            capture_id: result.captureId,
            capture_status: result.status,
            source: "return_url",
          }
        : {
            reason: result.reason,
            http_status: result.httpStatus ?? null,
            source: "return_url",
          },
    });
  } catch { /* silent · audit trail is additive · never block the UX */ }

  if (!result.ok) {
    if (result.reason === "not_approved_yet") {
      return (
        <Stage>
          <section
            style={{
              background: PALETTE.cardBg,
              border: `1.5px solid ${PALETTE.warn}`,
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
                color: PALETTE.warn,
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              Not completed
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
              It looks like you didn't finish the payment at PayPal. Your
              order is still open · nothing has been charged.
            </p>
            <Link
              href={`/nex-native/orders/${orderId}/pay/paypal`}
              style={{
                alignSelf: "flex-start",
                padding: "10px 14px",
                borderRadius: 12,
                background: PALETTE.accent,
                color: "#0a1c14",
                textDecoration: "none",
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              Try again
            </Link>
          </section>
        </Stage>
      );
    }
    return (
      <Stage>
        <section
          style={{
            background: PALETTE.cardBg,
            border: `1.5px solid ${PALETTE.warn}`,
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
              color: PALETTE.warn,
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            PayPal couldn't confirm
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
            We received your return from PayPal but could not confirm the
            capture right now. If the payment succeeded, the order will
            update automatically within a few seconds when PayPal notifies
            us. Otherwise your order is still open · nothing is charged.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <Link
              href={`/nex-native/orders/${orderId}`}
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
              Open order
            </Link>
            <Link
              href={`/nex-native/orders/${orderId}/pay/paypal`}
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
              Retry PayPal
            </Link>
          </div>
        </section>
      </Stage>
    );
  }

  // Capture succeeded at PayPal. We do NOT flip order state here · the
  // webhook (PAYMENT.CAPTURE.COMPLETED) is the authoritative trigger
  // via commerce-service.markOrderPaid. Show a safe interim state.
  return (
    <Stage>
      <section
        style={{
          background: PALETTE.cardBg,
          border: `1.5px solid ${PALETTE.ok}`,
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
            color: PALETTE.ok,
            fontWeight: 900,
            textTransform: "uppercase",
          }}
        >
          Payment received
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
          Thank you · PayPal confirmed your capture. Your order will be
          marked paid once PayPal sends us the final confirmation. This
          usually happens within a few seconds.
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
          }}
        >
          Open order
        </Link>
      </section>
    </Stage>
  );
}
