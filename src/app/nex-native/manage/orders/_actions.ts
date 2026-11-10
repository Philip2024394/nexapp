// src/app/nex-native/manage/orders/_actions.ts
//
// NEX Merchant-Owned Payments · P3 · seller order-management actions.
// Owner-sealed 2026-11-10 (condition #4: no auto-paid · manual confirm
// must be deliberate · condition #9: preserve sealed auth + RLS).
//
// Every action:
//   1. Resolves the signed-in seller via resolveSessionWithDevOverride.
//   2. Loads the order via order-service.
//   3. Verifies the seller OWNS the business the order belongs to
//      (nex_business.owner_account_id = session account id).
//   4. Delegates state transitions to commerce-service · which wraps
//      the sealed order-service state machine + ledger posting.
//   5. Writes rich metadata to nex_order_event so the audit trail
//      names the seller + the manual-confirm intent.
//
// Honest scope:
//   · Manual-confirm is EXPLICITLY the only way a seller marks a
//     QR / offline order paid in this phase (P5 QR flow builds on
//     this action).
//   · Stripe/PayPal/QRIS auto-confirmation flows are OUT OF SCOPE
//     for P3 · they belong in P2/P6/P7 and will reuse the same
//     commerce-service.markOrderPaid composition.

"use server";

import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import * as orderService from "@/lib/nex-native/order-service";
import * as commerceService from "@/lib/nex-native/commerce-service";
import {
  notifyBuyerOrderCancelled,
  notifyBuyerPaymentConfirmed,
} from "@/lib/nex-native/manage-orders/order-notification-service";
import type { NexOrderRow } from "@/lib/nex-native/types";

export type ManageOrderActionReason =
  | "not_authenticated"
  | "not_owner"
  | "not_found"
  | "invalid_state_transition"
  | "db_unavailable"
  | "server_error"
  /** P5 · a sub-60s manual confirm must carry a free-form note from
   *  the seller justifying why they already know the payment landed.
   *  Reduces click-through fraud. */
  | "note_required_fast_confirm";

/** P5 · sellers must attach a note when they confirm payment less
 *  than this many milliseconds after the buyer arrived on the
 *  payment page (nex_order.updated_at becomes the awaiting_manual_
 *  payment event timestamp). */
export const FAST_CONFIRM_THRESHOLD_MS = 60_000;

export type ManageOrderActionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: ManageOrderActionReason };

function fail<T>(reason: ManageOrderActionReason): ManageOrderActionResult<T> {
  return { ok: false, reason };
}
function ok<T>(value: T): ManageOrderActionResult<T> {
  return { ok: true, value };
}

function mapError(e: unknown): ManageOrderActionReason {
  const m = e instanceof Error ? e.message : String(e);
  if (/invalid_state_transition|state machine/i.test(m)) return "invalid_state_transition";
  if (/not_found|not found/i.test(m)) return "not_found";
  if (/db_unavailable|connect|timeout/i.test(m)) return "db_unavailable";
  return "server_error";
}

/**
 * Loads the order + verifies the signed-in seller owns the business
 * the order belongs to. Returns the order on success, or an action
 * reason on any failure.
 */
async function requireOrderOwnership(orderId: string): Promise<
  | { ok: true; accountId: string; order: NexOrderRow }
  | { ok: false; reason: ManageOrderActionReason }
> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, reason: "not_authenticated" };
  let order: NexOrderRow | null;
  try {
    order = await orderService.getOrderById(orderId);
  } catch (e) {
    return { ok: false, reason: mapError(e) };
  }
  if (!order) return { ok: false, reason: "not_found" };
  const { data: biz } = await nexSupabaseAdmin
    .from("nex_business")
    .select("owner_account_id")
    .eq("id", order.business_id)
    .maybeSingle();
  const ownerId = (biz as { owner_account_id: string } | null)?.owner_account_id;
  if (!ownerId || ownerId !== session.account.id) {
    return { ok: false, reason: "not_owner" };
  }
  return { ok: true, accountId: session.account.id, order };
}

/**
 * Seller manually confirms payment for an order (QR / COD / escrow).
 * Transitions state → `paid` + posts the ledger entry via
 * commerce-service.markOrderPaid (idempotent). Writes a
 * `manual_payment_confirmed` event row with the confirming seller id
 * + a free-form note so the audit trail is human-readable.
 */
export async function sellerMarkOrderPaidAction(args: {
  readonly orderId: string;
  readonly note?: string;
}): Promise<ManageOrderActionResult<{ order: NexOrderRow }>> {
  const guard = await requireOrderOwnership(args.orderId);
  if (!guard.ok) return fail(guard.reason);

  // P5 · fast-confirm note gate. The buyer transitions the order to
  // `pending` the moment they land on the /pay page. If the seller
  // flips to `paid` within FAST_CONFIRM_THRESHOLD_MS of that, require
  // a note — the seller must justify how they already know the money
  // landed. nex_order.updated_at carries that latest transition time
  // (set by transitionOrderState in order-service).
  const trimmedNote = (args.note ?? "").trim();
  if (guard.order.state === "pending") {
    const sincePendingMs = Date.now() - new Date(guard.order.updated_at).getTime();
    if (sincePendingMs < FAST_CONFIRM_THRESHOLD_MS && trimmedNote.length === 0) {
      return fail("note_required_fast_confirm");
    }
  }

  try {
    const { order } = await commerceService.markOrderPaid(
      args.orderId,
      guard.accountId,
    );
    // Rich audit event · separate from the state-transition event so
    // the "why did this flip to paid?" story is first-class.
    await orderService.recordOrderEvent({
      order_id: args.orderId,
      event: "manual_payment_confirmed",
      actor_account_id: guard.accountId,
      metadata: {
        note: trimmedNote.slice(0, 500) || null,
        from_state: guard.order.state,
        fast_confirm: guard.order.state === "pending"
          && (Date.now() - new Date(guard.order.updated_at).getTime()) < FAST_CONFIRM_THRESHOLD_MS,
      },
    });
    // P4 · notify buyer. Fail-soft · a notification outage must never
    // roll back a confirmed payment.
    try {
      await notifyBuyerPaymentConfirmed(order);
    } catch { /* silent · logged by the service */ }
    return ok({ order });
  } catch (e) {
    return fail(mapError(e));
  }
}

export async function sellerMarkOrderCompletedAction(args: {
  readonly orderId: string;
}): Promise<ManageOrderActionResult<{ order: NexOrderRow }>> {
  const guard = await requireOrderOwnership(args.orderId);
  if (!guard.ok) return fail(guard.reason);
  try {
    const order = await commerceService.markOrderCompleted(
      args.orderId,
      guard.accountId,
    );
    return ok({ order });
  } catch (e) {
    return fail(mapError(e));
  }
}

export async function sellerCancelOrderAction(args: {
  readonly orderId: string;
  readonly reason?: string;
}): Promise<ManageOrderActionResult<{ order: NexOrderRow }>> {
  const guard = await requireOrderOwnership(args.orderId);
  if (!guard.ok) return fail(guard.reason);
  try {
    const order = await commerceService.cancelOrder(
      args.orderId,
      guard.accountId,
      args.reason,
    );
    // P4 · notify buyer. Fail-soft.
    try {
      await notifyBuyerOrderCancelled(order);
    } catch { /* silent */ }
    return ok({ order });
  } catch (e) {
    return fail(mapError(e));
  }
}
