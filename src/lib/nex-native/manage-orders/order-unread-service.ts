// src/lib/nex-native/manage-orders/order-unread-service.ts
//
// Seller-side order unread count · Stream B · 2026-11-16.
// ----------------------------------------------------------------
// Returns the total number of orders in the "needs seller attention"
// state across every business the signed-in seller owns.
//
// Interim unread model (owner-sealed · seller_viewed_at column not yet
// authorised at the DB layer):
//
//   An order counts as UNREAD when state = 'created'.
//     · 'created' is the initial state the buyer-side checkout writes.
//     · The seller transitions out of 'created' (→ 'pending' / 'paid' /
//       'cancelled') via the sealed /manage/orders/_actions.ts flow.
//     · The moment any seller action advances the state, the row stops
//       counting as unread · no explicit "mark read" needed.
//
// Why NOT the richer `updated_at >= last_seen_at` model today:
//   · There is no per-seller `seller_viewed_at` column on nex_order yet
//     (verified against sandbox 2026-11-16 · see
//     evidence/stream-b/bucket-inventory.json → has_seller_viewed_at:false).
//   · `nex_account` has no `last_seen_at` column either on this schema.
//   · Introducing either requires a migration · the owner has NOT
//     authorised DDL on this stream. The companion
//     `322_nex_order_seller_viewed_at_PROPOSAL.sql` captures the
//     recommended shape for a future authorisation.
//
// Device-switch safety:
//   · The count is derived purely from `nex_order.state`, which lives
//     in Supabase · identical on any device the same seller signs into.
//     No localStorage read-marker · opening the app never silently
//     advances state · the count only drops when the seller confirms
//     or cancels an order (deliberate action).
//
// Honest-zero vs error:
//   · Returns `null` on DB failure · the API route maps that to a 503
//     so the client-side badge keeps its last value (no fake clear).
//   · Returns `0` when the seller owns no businesses OR none of their
//     businesses have any `state='created'` orders · that IS a correct
//     zero and clearing the badge is honest.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";

/**
 * Count orders awaiting seller action for a given account.
 * Returns `null` on database error so the caller can preserve the
 * last known badge (owner directive 2026-10-16 · honest-null).
 */
export async function countSellerUnreadOrders(
  accountId: NexUuid,
): Promise<number | null> {
  // 1 · list owned business ids.
  const { data: owned, error: ownedErr } = await nexSupabaseAdmin
    .from("nex_business")
    .select("id")
    .eq("owner_account_id", accountId);
  if (ownedErr) {
    // eslint-disable-next-line no-console
    console.warn("[order-unread-service] owned businesses query failed", ownedErr.message);
    return null;
  }
  const businessIds = (owned ?? []).map((b: { id: string }) => b.id);
  if (businessIds.length === 0) return 0;

  // 2 · count orders in the "needs seller attention" state.
  const { count, error: countErr } = await nexSupabaseAdmin
    .from("nex_order")
    .select("id", { count: "exact", head: true })
    .in("business_id", businessIds)
    .eq("state", "created");
  if (countErr) {
    // eslint-disable-next-line no-console
    console.warn("[order-unread-service] order count query failed", countErr.message);
    return null;
  }
  return count ?? 0;
}
