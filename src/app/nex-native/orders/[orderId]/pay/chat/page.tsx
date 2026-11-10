// src/app/nex-native/orders/[orderId]/pay/chat/page.tsx
//
// Owner-sealed 2026-11-10 · chat-fallback landing page.
//
// Shown when the seller has NO automated payment gateway configured.
// The buyer and seller arrange payment in the existing NEX Chat
// conversation. NEX never touches the money and never claims to
// have verified a payment.
//
// Access rules (server-side):
//   · Session required.
//   · session.account.id must equal order.customer_account_id.
//   · Order state must be created or pending.

import type * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as orderService from "@/lib/nex-native/order-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

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

export default async function ChatFallbackPayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}): Promise<React.JSX.Element> {
  const { orderId } = await params;
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect(`/nex-native/sign-in?next=/nex-native/orders/${orderId}/pay/chat`);

  const order = await orderService.getOrderById(orderId);
  if (!order) notFound();
  if (order.customer_account_id !== session.account.id) notFound();
  if (!["created", "pending"].includes(order.state)) {
    redirect(`/nex-native/orders/${orderId}`);
  }

  const { data: biz } = await nexSupabaseAdmin
    .from("nex_business")
    .select("display_name, slug")
    .eq("id", order.business_id)
    .maybeSingle();
  const sellerName = (biz as { display_name: string | null } | null)?.display_name ?? "the seller";

  const chatHref = order.source_conversation_id
    ? `/nex-native/conversations/${order.source_conversation_id}`
    : `/nex-native/orders/${orderId}`;

  return (
    <>
      <style>{`html, body { background: ${PALETTE.bg}; }`}</style>
      <main
        data-nex-chat-fallback-pay
        data-order-id={order.id}
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
            <div style={{ fontSize: 12, color: PALETTE.textDim, marginTop: 6 }}>
              Order <span style={{ fontFamily: "ui-monospace, Consolas, monospace" }}>
                #{order.id.slice(0, 8).toUpperCase()}
              </span> · {sellerName}
            </div>
          </section>

          {/* Explainer */}
          <section
            data-nex-explainer
            style={{
              padding: 16,
              borderRadius: 14,
              background: PALETTE.cardBg,
              border: `1.5px solid ${PALETTE.cardBorder}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                color: PALETTE.accent,
                fontWeight: 900,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Arrange payment in chat
            </div>
            <p style={{ margin: 0, fontSize: 13, color: PALETTE.textMuted, lineHeight: 1.55 }}>
              <strong style={{ color: PALETTE.text }}>{sellerName}</strong> has not
              connected an automated payment method. You can chat with them
              directly to arrange how to pay — bank transfer, cash on
              delivery, in-person, or whatever works for both of you.
            </p>
            <ul style={{ margin: "10px 0 0 18px", padding: 0, fontSize: 12.5, color: PALETTE.textMuted, lineHeight: 1.6 }}>
              <li>Message the seller to agree payment details.</li>
              <li>The seller will mark the order paid once funds reach them.</li>
              <li>
                <strong style={{ color: PALETTE.text }}>NEX does not handle, hold, or verify this payment.</strong>
              </li>
            </ul>
          </section>

          {/* CTA · open chat */}
          <Link
            href={chatHref}
            data-nex-open-chat-cta
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
            Open chat with {sellerName}
          </Link>
        </div>
      </main>
    </>
  );
}
