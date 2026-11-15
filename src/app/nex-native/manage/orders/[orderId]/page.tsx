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
  // peer-message cart_order attachment and surface the items.
  //
  // 2026-11-15 · CP1 reader fix. Two sealed-schema realities make the
  // prior query impossible to satisfy:
  //   1. `nex_peer_message` has column `conversation_id` · NOT
  //      `source_conversation_id` (migration 047).
  //   2. `nex_order.source_conversation_id` FK targets
  //      `nex_conversation.id` · but cart peer messages live on
  //      `nex_peer_conversation.id`. The IDs come from different id
  //      spaces · a direct join by that column cannot match.
  //
  // The sealed cart flow writes ONLY a `nex_peer_message` (per the
  // Path A sealed 2026-11-09 doctrine · `nex_order` is not populated
  // by sendCartOrderAction yet). So we key the snapshot lookup on the
  // ONE pair of identifiers that is reliable in the current schema
  // and populated at write time: (buyer = sender, shop = business).
  // The `attachment_meta.cart.shop_id` JSON path pins the message to
  // THIS business and `sender_account_id` pins it to THIS customer.
  // D2 (2026-11-15) already switched the sealed stamp to put every
  // cart snapshot under `attachment_meta.cart`.
  //
  // Caveat documented inline: if the same customer placed multiple
  // orders with the same shop and one order's cart snapshot is still
  // the most-recent in the conversation, every order detail page for
  // that pair resolves to that same most-recent snapshot. A proper
  // per-order link (order_id written INTO the cart snapshot OR a
  // nex_peer_message.id back-pointer on nex_order) requires either a
  // schema addition OR a write-path change to sendCartOrderAction
  // (which currently has no nex_order.id to carry · the order row is
  // not created in that code path). This is tracked separately from
  // CP1; the current fix is strictly the smallest-coherent reader fix.
  //
  // D2 attachment-meta-based filter preserved verbatim.
  //
  // Per-order disambiguation (2026-11-15 CP1 + GAP1): if the same
  // customer placed multiple orders with the same shop — especially
  // for the SAME product at different quantities/prices — the pair
  // `(sender_account_id, attachment_meta.cart.shop_id)` is NOT a
  // unique key. "items-contains-product + newest" alone would resolve
  // EVERY order for that (customer, shop, product) triple to the one
  // most-recent cart message, silently losing older orders' original
  // cart snapshots.
  //
  // Strongest zero-schema-change disambiguator: `nex_order.price_pence`
  // (the ORDER's total · see order-service.createOrder which snapshots
  // product.price_pence) vs. `attachment_meta.cart.subtotal_pence` (the
  // CART's total · confirmed by D2 probe). When `subtotal_pence`
  // matches `order.price_pence` AND `items[]` includes
  // `order.product_id`, we have a strong (price + anchor) match. If
  // multiple snapshots match that pair, prefer the one whose `sent_at`
  // is closest to `order.created_at` (the sealed cart flow writes the
  // cart message within seconds of the order row being created, so
  // ±5 minutes is a strong heuristic · we don't hard-bound it, we just
  // sort by |sent_at - created_at|).
  //
  // Preference order (highest → lowest confidence):
  //   1. subtotal_pence === order.price_pence  AND
  //      items[] contains order.product_id
  //      → pick the one closest in time to order.created_at.
  //   2. items[] contains order.product_id (legacy / historical rows
  //      where the price-match signal isn't available)
  //      → preserves prior CP1 behaviour so existing tests don't
  //        regress; newest wins.
  //   3. most-recent cart snapshot for the (customer, shop) pair
  //      → final graceful-degrade fallback so the Items card doesn't
  //        render empty for a schema-mismatched historical order.
  //
  // HONEST LIMIT (code-only · do NOT remove this comment): this is
  // still a HEURISTIC. If a buyer somehow placed two orders at the
  // EXACT same total with IDENTICAL items within the same minute, the
  // reader cannot distinguish them without a true order↔message
  // back-pointer (which requires a schema change · either an
  // `order_id` field INSIDE `attachment_meta.cart` written at send
  // time, or a `nex_peer_message_id` column on `nex_order`). In that
  // tie-break case we pick the latest matching snapshot and this
  // comment is the designated place the owner reads to decide
  // whether to approve that schema change. Do NOT silently guess.
  let cartSnapshot: Record<string, unknown> | null = null;
  // #14 Tier 0 · deterministic exact-UUID match on
  // `attachment_meta.cart.order_id === order.id`. Sealed 2026-11-15 ·
  // owner-authorised JSON-metadata approach. When sendCartOrderAction
  // minted the future order UUID BEFORE the peer-message insert AND a
  // downstream cart→order code path passed that same UUID into
  // createOrder({ id }), this query returns exactly one snapshot and
  // we skip every heuristic tier. Legacy cart messages written before
  // 2026-11-15 do not carry `order_id` · they fall through to the
  // existing Tier 1-3 heuristics (preserved verbatim below).
  let cartSnapshotMatchTierDeterministic = false;
  {
    const { data: det } = await nexSupabaseAdmin
      .from("nex_peer_message")
      .select("attachment_meta")
      .filter("attachment_meta->cart->>order_id", "eq", order.id)
      // Defence in depth · also confirm the cart's shop_id matches the
      // order's business_id. A stray `order_id` collision (e.g. a
      // malicious client stamping another order's UUID) still fails
      // the shop_id check and falls to the heuristic tier where the
      // existing account/ownership guards apply.
      .filter("attachment_meta->cart->>shop_id", "eq", order.business_id)
      .limit(1)
      .maybeSingle();
    const detMeta = (det as { attachment_meta: Record<string, unknown> | null } | null)
      ?.attachment_meta;
    if (detMeta && typeof detMeta === "object") {
      cartSnapshot = detMeta;
      cartSnapshotMatchTierDeterministic = true;
    }
  }

  const { data: candidates } = cartSnapshotMatchTierDeterministic
    ? { data: [] as Array<{ attachment_meta: Record<string, unknown> | null; sent_at: string | null }> }
    : await nexSupabaseAdmin
        .from("nex_peer_message")
        .select("attachment_meta, sent_at")
        .eq("sender_account_id", order.customer_account_id)
        .filter("attachment_meta->cart->>shop_id", "eq", order.business_id)
        .not("attachment_meta->cart", "is", null)
        // `nex_peer_message` uses `sent_at` as its wall-clock column
        // (there is no `created_at` on this table · migration 047).
        .order("sent_at", { ascending: false })
        .limit(20);
  const rows =
    (candidates as Array<{
      attachment_meta: Record<string, unknown> | null;
      sent_at: string | null;
    }> | null) ?? [];
  const targetProductId = order.product_id;
  const targetPricePence = order.price_pence;
  const orderCreatedMs = new Date(order.created_at).getTime();

  type Candidate = {
    meta: Record<string, unknown>;
    cart: { items?: Array<{ id?: unknown }>; subtotal_pence?: unknown };
    sentAtMs: number;
  };
  const containsProduct: Candidate[] = [];
  const priceAndProductMatch: Candidate[] = [];
  for (const row of rows) {
    const meta = row.attachment_meta;
    if (!meta || typeof meta !== "object") continue;
    const cart = (meta as { cart?: unknown }).cart as
      | { items?: Array<{ id?: unknown }>; subtotal_pence?: unknown }
      | null
      | undefined;
    if (!cart || !Array.isArray(cart.items)) continue;
    const hasProduct = cart.items.some(
      (it) => typeof it?.id === "string" && it.id === targetProductId,
    );
    if (!hasProduct) continue;
    const sentAtMs = row.sent_at ? new Date(row.sent_at).getTime() : NaN;
    const cand: Candidate = {
      meta: meta as Record<string, unknown>,
      cart,
      sentAtMs,
    };
    containsProduct.push(cand);
    if (
      typeof cart.subtotal_pence === "number" &&
      cart.subtotal_pence === targetPricePence
    ) {
      priceAndProductMatch.push(cand);
    }
  }

  const pickClosestInTime = (arr: Candidate[]): Candidate | null => {
    if (arr.length === 0) return null;
    if (!Number.isFinite(orderCreatedMs)) return arr[0] ?? null;
    let best: Candidate | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const c of arr) {
      if (!Number.isFinite(c.sentAtMs)) continue;
      const delta = Math.abs(c.sentAtMs - orderCreatedMs);
      if (delta < bestDelta) {
        best = c;
        bestDelta = delta;
      }
    }
    return best ?? arr[0] ?? null;
  };

  // 2026-11-15 · #14 deterministic-ambiguity detection. The sealed
  // code-only reader cannot deterministically link an order to its
  // originating cart message without a schema change (either an
  // `order_id` field inside `attachment_meta.cart` written at send
  // time, or a `nex_peer_message_id` column on `nex_order`; both
  // require explicit owner approval). The heuristic below handles
  // the DISTINGUISHABLE cases correctly, but refuses to silently
  // guess when two cart messages are indistinguishable for THIS
  // order's identity signal. "Ambiguous" renders an explicit
  // unavailable state rather than another order's items.
  let cartSnapshotAmbiguous = false;
  let cartSnapshotMatchTier:
    | "deterministic_order_id"
    | "price_and_product"
    | "product_only"
    | "most_recent"
    | "none" = "none";

  // Tier 0 · deterministic exact-UUID match via
  // `attachment_meta.cart.order_id === order.id`. If the upstream
  // mint + downstream createOrder({ id }) contract both ran, this is
  // the canonical link · all heuristic tiers are skipped. Legacy
  // messages without `order_id` fall through to the tiers below.
  if (cartSnapshotMatchTierDeterministic) {
    cartSnapshotMatchTier = "deterministic_order_id";
  } else if (priceAndProductMatch.length >= 1) {
    // Tier 1 · price + product match (highest confidence).
    cartSnapshotMatchTier = "price_and_product";
    const picked = pickClosestInTime(priceAndProductMatch);
    if (picked) cartSnapshot = picked.meta;
    // Ambiguity test: if more than one tier-1 candidate exists AND
    // the two closest candidates are within 2 minutes of each other
    // AND of the order, we cannot tell them apart deterministically.
    if (priceAndProductMatch.length >= 2 && Number.isFinite(orderCreatedMs)) {
      const deltas = priceAndProductMatch
        .map((c) => Math.abs(c.sentAtMs - orderCreatedMs))
        .filter((d) => Number.isFinite(d))
        .sort((a, b) => a - b);
      const [best, next] = [deltas[0] ?? Infinity, deltas[1] ?? Infinity];
      if (next - best <= 2 * 60 * 1000) {
        cartSnapshotAmbiguous = true;
      }
    }
  } else if (containsProduct.length > 0) {
    // Tier 2 · product match only (legacy fallback · preserves CP1
    // behaviour so existing tests don't regress).
    cartSnapshotMatchTier = "product_only";
    cartSnapshot = containsProduct[0]!.meta;
  } else if (rows.length > 0) {
    // Tier 3 · most-recent snapshot for the (customer, shop) pair ·
    // explicitly the LOWEST confidence. If this tier fires AND there
    // are multiple candidates, treat as ambiguous — we have no
    // reason to prefer one over another.
    cartSnapshotMatchTier = "most_recent";
    const first = rows[0]?.attachment_meta;
    if (first && typeof first === "object") {
      cartSnapshot = first as Record<string, unknown>;
    }
    if (rows.length >= 2) cartSnapshotAmbiguous = true;
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
        data-nex-order-cart-match-tier={cartSnapshotMatchTier}
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
            cartSnapshot={cartSnapshotAmbiguous ? null : cartSnapshot}
            shopDisplayName={business?.display_name ?? null}
            shopSlug={business?.slug ?? null}
          />
          {cartSnapshotAmbiguous ? (
            <div
              data-nex-order-cart-ambiguous
              data-nex-order-cart-match-tier={cartSnapshotMatchTier}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px dashed ${PALETTE.cardBorder}`,
                background: "rgba(0, 0, 0, 0.18)",
                color: PALETTE.text,
                fontSize: 12.5,
                lineHeight: 1.55,
              }}
            >
              <strong style={{ color: PALETTE.accent, fontWeight: 800 }}>
                Items for this order are not reliably identifiable.
              </strong>
              <br />
              Two or more cart messages from this customer for this shop
              could match this order within the acceptance window, and no
              deterministic order→message link exists in the current data
              model. We refuse to display another order&apos;s items.
              Confirm the items directly with the buyer via chat, or ask
              the owner to approve adding a deterministic link
              (<code>attachment_meta.cart.order_id</code> at send time or
              a <code>nex_peer_message_id</code> column on{" "}
              <code>nex_order</code>).
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
