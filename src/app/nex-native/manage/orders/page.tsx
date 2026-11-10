// src/app/nex-native/manage/orders/page.tsx
//
// NEX Merchant-Owned Payments · P3 · seller orders list.
// Owner-sealed 2026-11-10.
//
// Scope: list every order for the signed-in seller's primary business.
// Reuses existing sealed order-service (searchOrders) and nex_order
// RLS · no new tables · no new migrations.
//
// Flow:
//   · No session → sign-in redirect.
//   · No business owned by the signed-in account → empty "start a
//     shop" placeholder.
//   · Business owned → list orders newest-first · status chips ·
//     click row to open detail at /manage/orders/[orderId].

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import * as orderService from "@/lib/nex-native/order-service";
import type { NexOrderRow } from "@/lib/nex-native/types";
import { OrdersListClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const PALETTE = {
  bg: "var(--nex-world-drawer-bg, #123D2B)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  accent: "var(--nex-world-secondary, #C6A15B)",
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
};

export default async function ManageOrdersPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/orders");
  }
  const businesses = await listBusinessesByOwner(session.account.id).catch(() => []);
  const primary = businesses[0] ?? null;

  let orders: NexOrderRow[] = [];
  if (primary) {
    try {
      orders = await orderService.searchOrders(primary.id, {
        sort: "newest",
        limit: 100,
      });
    } catch {
      orders = [];
    }
  }

  return (
    <>
      <style>{`html, body { background: ${PALETTE.bg}; }`}</style>
      <main
        data-nex-manage-orders
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
            gap: 16,
          }}
        >
          <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Link
              href="/nex-native/free-chat"
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
              ← Back
            </Link>
          </nav>

          <header>
            <span
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: 999,
                background: "rgba(198, 161, 91, 0.14)",
                border: `1px solid ${PALETTE.cardBorder}`,
                color: PALETTE.accent,
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Merchant
            </span>
            <h1
              style={{
                margin: "10px 0 4px",
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: "-0.015em",
              }}
            >
              My Orders
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: PALETTE.textMuted }}>
              {primary
                ? "Orders placed in your shop. Tap any row to review and manage payment."
                : "You don't have a shop yet. Set one up first and orders will land here."}
            </p>
          </header>

          {!primary ? (
            <section
              style={{
                padding: 22,
                borderRadius: 14,
                background: PALETTE.cardBg,
                border: `1.5px solid ${PALETTE.cardBorder}`,
              }}
            >
              <h2 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 800 }}>
                No shop found for your account
              </h2>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: PALETTE.textMuted,
                }}
              >
                Create your shop to start receiving orders from NEX buyers.
              </p>
              <Link
                href="/nex-native/manage/shop/start"
                style={{
                  display: "inline-block",
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: PALETTE.accent,
                  color: "#061710",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                }}
              >
                Start your NEX Shop →
              </Link>
            </section>
          ) : (
            <OrdersListClient
              initialOrders={orders}
              businessId={primary.id}
            />
          )}
        </div>
      </main>
    </>
  );
}
