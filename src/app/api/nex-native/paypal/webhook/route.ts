// src/app/api/nex-native/paypal/webhook/route.ts
//
// Owner-sealed 2026-11-10 (REVISED) · PayPal webhook endpoint.
//
// Doctrine (sealed 2026-11-10 gateway ownership matrix):
//   · PayPal handles shop-owner commerce. This webhook is the ONE
//     authoritative path that flips nex_order.state to `paid` /
//     `refunded`. The return URL is NOT trusted for state change.
//
// Flow:
//   1. Read raw body (byte-exact · PayPal signature requires exact bytes).
//   2. Pull the 5 signature headers.
//   3. Verify via live PayPal `/v1/notifications/verify-webhook-signature`.
//      · credentials_missing → 503
//      · signature_invalid   → 400 (log, do NOT retry-friendly 5xx)
//      · paypal_unavailable  → 503 (PayPal will retry)
//      · oauth_failed        → 503
//      · ok=true             → continue
//   4. Parse into a narrow PaypalWebhookEvent.
//   5. Idempotency · check if we've already recorded an order_event
//      with metadata.paypal_event_id == event.id · if yes, 200 replay.
//   6. Dispatch:
//      · PAYMENT.CAPTURE.COMPLETED → commerce-service.markOrderPaid +
//                                     recordOrderEvent (idempotent)
//      · PAYMENT.CAPTURE.REFUNDED  → commerce-service.refundOrder +
//                                     recordOrderEvent
//      · PAYMENT.CAPTURE.DENIED    → recordOrderEvent only (no state
//                                     change · order stays pending)
//      · CHECKOUT.ORDER.APPROVED   → recordOrderEvent only (log, next
//                                     step is capture which fires its
//                                     own event)
//      · unhandled                 → 200 with no-op record
//
// Payee cross-check · we verify `event.payeeMerchantId` matches the
// seller's `paypal_merchant_id` on nex_business. Mismatch returns 403.

import { NextResponse, type NextRequest } from "next/server";
import {
  verifyPaypalWebhookSignature,
  parsePaypalWebhookEvent,
  extractNexOrderIdFromPaypal,
  NEX_PAYPAL_SYSTEM_ACTOR_ID,
  type PaypalWebhookEvent,
} from "@/lib/nex-native/payments/paypal-webhook-service";
import * as orderService from "@/lib/nex-native/order-service";
import * as commerceService from "@/lib/nex-native/commerce-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  ensureDurablePaidOrderRow,
  notifySellerPaidOrder,
} from "@/lib/nex-native/manage-orders/order-notification-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function alreadyProcessed(paypalEventId: string): Promise<boolean> {
  try {
    const { data } = await nexSupabaseAdmin
      .from("nex_order_event")
      .select("id")
      .contains("metadata", { paypal_event_id: paypalEventId })
      .limit(1);
    return Array.isArray(data) && data.length > 0;
  } catch {
    // Fail-safe · if the idempotency probe errors, re-dispatch. Dispatch
    // itself is idempotent at the commerce-service layer (markOrderPaid
    // is idempotent via state-machine · refundOrder detects already-
    // refunded orders).
    return false;
  }
}

async function readSellerPaypalMerchantId(businessId: string): Promise<string | null> {
  try {
    const { data } = await nexSupabaseAdmin
      .from("nex_business")
      .select("paypal_merchant_id")
      .eq("id", businessId)
      .maybeSingle();
    const row = data as { paypal_merchant_id: string | null } | null;
    return row?.paypal_merchant_id ?? null;
  } catch {
    return null;
  }
}

async function dispatchEvent(
  event: PaypalWebhookEvent,
  isReplay: boolean,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (event.type === "unhandled") {
    return {
      status: 200,
      body: { ok: true, outcome: "unhandled", type: event.originalType },
    };
  }

  const nexOrderId = extractNexOrderIdFromPaypal(event);
  if (!nexOrderId) {
    return {
      status: 400,
      body: { ok: false, error: "missing_nex_order_id" },
    };
  }

  const order = await orderService.getOrderById(nexOrderId);
  if (!order) {
    return { status: 404, body: { ok: false, error: "order_not_found" } };
  }

  // Payee cross-check · webhook payee.merchant_id MUST match the seller
  // row's paypal_merchant_id · otherwise the event is for someone else's
  // merchant on the same platform and we should refuse.
  if (event.payeeMerchantId) {
    const expected = await readSellerPaypalMerchantId(order.business_id);
    if (expected && expected !== event.payeeMerchantId) {
      await orderService
        .recordOrderEvent({
          order_id: nexOrderId,
          event: "paypal.payee_mismatch",
          actor_account_id: NEX_PAYPAL_SYSTEM_ACTOR_ID,
          metadata: {
            paypal_event_id: event.id,
            paypal_event_type: event.type,
            expected_merchant_present: true,
            observed_merchant_present: true,
          },
        })
        .catch(() => undefined);
      return { status: 403, body: { ok: false, error: "payee_mismatch" } };
    }
  }

  const baseMeta = {
    paypal_event_id: event.id,
    paypal_event_type: event.type,
    paypal_resource_id: event.resourceId,
    payee_merchant_present: Boolean(event.payeeMerchantId),
  };

  if (event.type === "PAYMENT.CAPTURE.COMPLETED") {
    // First-delivery runs the state transition + audit row. Replay
    // skips both (they already ran on an earlier delivery) and goes
    // straight to the idempotent reconciliation steps.
    let orderForDispatch = order;
    if (!isReplay) {
      const result = await commerceService.markOrderPaid(
        nexOrderId,
        NEX_PAYPAL_SYSTEM_ACTOR_ID,
      );
      await orderService
        .recordOrderEvent({
          order_id: nexOrderId,
          event: "paypal.capture.completed",
          actor_account_id: NEX_PAYPAL_SYSTEM_ACTOR_ID,
          metadata: {
            ...baseMeta,
            amount: event.amount,
            ledger_entry_id: result.ledgerEntryId,
          },
        })
        .catch(() => undefined);
      orderForDispatch = result.order;
    }

    // Durable in-app row · exactly-once-created via preserve_read_state
    // ON CONFLICT DO NOTHING. First-delivery inserts; replay no-ops
    // safely without reviving a read alert as new activity.
    try {
      await ensureDurablePaidOrderRow(orderForDispatch);
    } catch (ensureErr) {
      console.error(
        "[nex-paypal/webhook] ensureDurablePaidOrderRow failed:",
        ensureErr instanceof Error ? ensureErr.message : String(ensureErr),
      );
    }

    // Owner directive 2026-11-23 · seller-facing "paid order" push
    // fires ONLY after verified settlement. Marker-gated · push is at-
    // least-once, not exactly-once. Multiple PAYMENT.CAPTURE.COMPLETED
    // events (e.g. multi-capture flows) will not re-notify.
    try {
      const priorEvents = await orderService.listOrderEvents(nexOrderId);
      const alreadyNotifiedPaid = priorEvents.some(
        (e) => e.event === "seller_notified_paid",
      );
      if (!alreadyNotifiedPaid) {
        const dispatch = await notifySellerPaidOrder(orderForDispatch);
        if (dispatch.attempted > 0) {
          await orderService
            .recordOrderEvent({
              order_id: nexOrderId,
              event: "seller_notified_paid",
              actor_account_id: NEX_PAYPAL_SYSTEM_ACTOR_ID,
              metadata: {
                source: isReplay
                  ? "paypal.capture.completed.replay_recovery"
                  : "paypal.capture.completed",
                paypal_event_id: event.id,
                attempted: dispatch.attempted,
                delivered: dispatch.delivered,
                failed: dispatch.failed,
                ...(dispatch.skipped_reason
                  ? { skipped_reason: dispatch.skipped_reason }
                  : {}),
              },
            })
            .catch(() => undefined);
        }
      }
    } catch (notifyErr) {
      console.error(
        "[nex-paypal/webhook] seller paid-order notify failed:",
        notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
      );
    }

    return {
      status: 200,
      body: { ok: true, outcome: isReplay ? "order_paid_replay_recovered" : "order_paid" },
    };
  }

  if (event.type === "PAYMENT.CAPTURE.REFUNDED") {
    if (isReplay) {
      return { status: 200, body: { ok: true, outcome: "replay_ignored_refund" } };
    }
    const result = await commerceService.refundOrder(
      nexOrderId,
      NEX_PAYPAL_SYSTEM_ACTOR_ID,
      "paypal.capture.refunded",
    );
    await orderService
      .recordOrderEvent({
        order_id: nexOrderId,
        event: "paypal.capture.refunded",
        actor_account_id: NEX_PAYPAL_SYSTEM_ACTOR_ID,
        metadata: {
          ...baseMeta,
          amount: event.amount,
          reversal_entry_id: result.reversalEntryId,
        },
      })
      .catch(() => undefined);
    return { status: 200, body: { ok: true, outcome: "order_refunded" } };
  }

  if (event.type === "PAYMENT.CAPTURE.DENIED") {
    if (isReplay) {
      return { status: 200, body: { ok: true, outcome: "replay_ignored_denied" } };
    }
    await orderService
      .recordOrderEvent({
        order_id: nexOrderId,
        event: "paypal.capture.denied",
        actor_account_id: NEX_PAYPAL_SYSTEM_ACTOR_ID,
        metadata: { ...baseMeta, amount: event.amount },
      })
      .catch(() => undefined);
    return { status: 200, body: { ok: true, outcome: "capture_denied_recorded" } };
  }

  // CHECKOUT.ORDER.APPROVED · no state change · just log.
  if (isReplay) {
    return { status: 200, body: { ok: true, outcome: "replay_ignored_approval" } };
  }
  await orderService
    .recordOrderEvent({
      order_id: nexOrderId,
      event: "paypal.order.approved",
      actor_account_id: NEX_PAYPAL_SYSTEM_ACTOR_ID,
      metadata: baseMeta,
    })
    .catch(() => undefined);
  return { status: 200, body: { ok: true, outcome: "approval_recorded" } };
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed" },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  const headers = {
    "paypal-auth-algo": req.headers.get("paypal-auth-algo"),
    "paypal-cert-url": req.headers.get("paypal-cert-url"),
    "paypal-transmission-id": req.headers.get("paypal-transmission-id"),
    "paypal-transmission-sig": req.headers.get("paypal-transmission-sig"),
    "paypal-transmission-time": req.headers.get("paypal-transmission-time"),
  };

  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const verify = await verifyPaypalWebhookSignature(rawBody, headers, webhookId);

  if (!verify.ok) {
    if (verify.reason === "credentials_missing") {
      return NextResponse.json(
        { ok: false, error: "credentials_missing" },
        { status: 503 },
      );
    }
    if (verify.reason === "signature_invalid") {
      return NextResponse.json(
        { ok: false, error: "invalid_signature" },
        { status: 400 },
      );
    }
    // paypal_unavailable + oauth_failed · 503 so PayPal retries.
    return NextResponse.json(
      { ok: false, error: verify.reason },
      { status: 503 },
    );
  }

  const event = parsePaypalWebhookEvent(rawBody);
  if (!event) {
    return NextResponse.json(
      { ok: false, error: "unparseable_body" },
      { status: 400 },
    );
  }

  // Replay-with-recovery · owner directive 2026-11-23c. A prior
  // nex_order_event carrying this paypal_event_id means we reached the
  // record step on some earlier delivery. Rather than silently
  // suppressing further work (which can leave the durable inbox row
  // missing if the first delivery crashed between record + inbox write),
  // we flag the replay and let dispatchEvent run its idempotent
  // reconciliation path · ensureDurablePaidOrderRow + marker-check.
  let isReplay = false;
  try {
    isReplay = await alreadyProcessed(event.id);
  } catch {
    // never block handling on dedup-probe failure
  }

  const { status, body } = await dispatchEvent(event, isReplay);
  return NextResponse.json(body, { status });
}
