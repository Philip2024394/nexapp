// src/app/api/nex-native/unread-count/route.ts
//
// NEX home-screen app-badge count endpoint · owner directive 2026-10-16.
// Corrective pass 2026-10-16 · distinguish genuine zero from DB error.
// Stream B extension 2026-11-16 · add per-channel breakdown so sellers
// returning to the app see a reconciled order-notification indicator
// in the top header + an entry in the existing left drawer.
// --------------------------------------------------------------------
// Returns the signed-in viewer's TOTAL unread peer-message count
// across every NORMAL (non-Vault) conversation they participate in,
// plus (for seller accounts) the number of orders in the "needs
// seller attention" state (nex_order.state = 'created').
//
// Response shape:
//   · 200 { count, chat, orders } · success · integers >= 0
//     - count    · chat + orders summed · back-compat with the existing
//                  app-badge polling client (which reads `.count`)
//     - chat     · peer-message unread count across non-Vault threads
//     - orders   · merchant order queue awaiting seller action
//   · 200 { count: 0, chat: 0, orders: 0 } · anonymous viewer · honest
//     zero (not a leak · no session, no data to count).
//   · 503 { error: "unavailable" } · underlying DB failure · the CLIENT
//     MUST preserve the last known badge value (its `if (!res.ok) return;`
//     guard already does this).
//
// Honesty rules enforced:
//   · Never fabricate · a database error is NEVER coerced into a
//     success zero. A transient outage would otherwise clear a user's
//     badge even when they had unread messages / unseen orders.
//   · Never leak Vault-conversation metadata · the chat aggregate
//     excludes vaulted conversations entirely.
//   · Orders count derives purely from server-side nex_order state ·
//     device-switch consistent · opening the app does NOT silently
//     mark orders read.
//   · No caching · Cache-Control: no-store so a quick open-then-read
//     always sees fresh state.
//
// Does NOT · provide per-conversation / per-order breakdown · trigger a
// push · modify any row · touch any Vault content · expose another
// user's count (session resolver scopes to the signed-in account;
// anonymous returns zero).

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { countTotalUnreadPeerMessages } from "@/lib/nex-native/peer-message-service";
import { countSellerUnreadOrders } from "@/lib/nex-native/manage-orders/order-unread-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

export async function GET(): Promise<NextResponse> {
  // Session resolution outside the inner try: a session-resolve
  // failure is still "unknown viewer" semantics · treat it like a DB
  // failure so we don't clear the badge of a real user whose cookie
  // happened to miss a transient refresh.
  let session;
  try {
    session = await resolveNexAppSessionFromContext();
  } catch {
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }
  if (!session) {
    // Anonymous viewer · correct zero · no account to associate.
    return NextResponse.json(
      { count: 0, chat: 0, orders: 0 },
      { headers: NO_STORE },
    );
  }

  // Run the two counts in parallel. Each may fail independently ·
  // we preserve honest-null semantics:
  //   · if BOTH fail → 503 (client keeps last badge)
  //   · if only one fails → 503 (same reason; mixing a fresh zero in
  //     with a stale value would be misleading)
  //   · if both succeed → sum them for the back-compat `count` field
  //     and surface per-channel breakdown.
  let chatUnread: number | null = null;
  let ordersUnread: number | null = null;
  try {
    const [chatResult, orderResult] = await Promise.all([
      (async () => {
        try {
          return await countTotalUnreadPeerMessages(session.account.id);
        } catch {
          return null;
        }
      })(),
      countSellerUnreadOrders(session.account.id),
    ]);
    chatUnread = chatResult;
    ordersUnread = orderResult;
  } catch {
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }

  if (chatUnread === null || ordersUnread === null) {
    // Owner directive 2026-10-16 (corrective pass) · a DB error must
    // return a non-2xx response so the client's `!res.ok` guard
    // preserves the last known badge. We deliberately do NOT return
    // { count: 0 } here · that would clear the badge on a transient
    // outage.
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }

  const total = chatUnread + ordersUnread;
  return NextResponse.json(
    { count: total, chat: chatUnread, orders: ordersUnread },
    { headers: NO_STORE },
  );
}
