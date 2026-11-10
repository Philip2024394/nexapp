// src/app/nex-native/manage/orders/[orderId]/page.tsx
//
// NEX Merchant-Owned Payments · P3 · seller order detail.
// Owner-sealed 2026-11-10.
//
// Server page · resolves session · verifies the signed-in account owns
// the business the order belongs to (defence in depth · the action
// also re-checks) · hydrates the order + full event log + the
// originating cart snapshot from the sealed peer-message JSONB (per
// condition #5 · we preserve the sealed chat/order architecture and
// do NOT fabricate a normalized nex_order_item table).

import type * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import * as orderService from "@/lib/nex-native/order-service";
import { OrderDetailClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const PALETTE = {
  bg: "var(--nex-world-drawer-bg, #123D2B)",
  text: "#F2F5F8",
  accent: "var(--nex-world-secondary, #C6A15B)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}): Promise<React.JSX.Element> {
  const { orderId } = await params;
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(`/nex-native/sign-in?next=/nex-native/manage/orders/${orderId}`);
  }

  const order = await orderService.getOrderById(orderId);
  if (!order) notFound();

  // Ownership check · service-role read of nex_business.owner_account_id.
  const { data: biz } = await nexSupabaseAdmin
    .from("nex_business")
    .select("id, owner_account_id, display_name, slug")
    .eq("id", order.business_id)
    .maybeSingle();
  const ownerId = (biz as { owner_account_id: string } | null)?.owner_account_id;
  if (!ownerId || ownerId !== session.account.id) {
    notFound();
  }

  const events = await orderService.listOrderEvents(orderId).catch(() => []);

  // Cart snapshot · sealed condition #5 · read the originating
  // peer-message cart_order attachment from the source conversation.
  // Null if the order was created outside the chat flow.
  let cartSnapshot: Record<string, unknown> | null = null;
  if (order.source_conversation_id) {
    const { data: msg } = await nexSupabaseAdmin
      .from("nex_peer_message")
      .select("attachment_meta")
      .eq("source_conversation_id", order.source_conversation_id)
      .eq("attachment_type", "cart_order")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const meta = (msg as { attachment_meta: Record<string, unknown> | null } | null)
      ?.attachment_meta;
    if (meta && typeof meta === "object") {
      cartSnapshot = meta as Record<string, unknown>;
    }
  }

  const business = biz as {
    display_name: string | null;
    slug: string | null;
  } | null;

  return (
    <>
      <style>{`html, body { background: ${PALETTE.bg}; }`}</style>
      <main
        data-nex-order-detail
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
            maxWidth: 560,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <nav>
            <Link
              href="/nex-native/manage/orders"
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
              ← All orders
            </Link>
          </nav>
          <OrderDetailClient
            initialOrder={order}
            initialEvents={events}
            cartSnapshot={cartSnapshot}
            shopDisplayName={business?.display_name ?? null}
            shopSlug={business?.slug ?? null}
          />
        </div>
      </main>
    </>
  );
}
