// src/app/api/nex-native/notifications/list/route.ts
//
// NEX durable in-app notification list endpoint · owner directive
// 2026-11-23b · backs the drawer's authoritative read path.
//
// Response shape:
//   · 200 { rows, unread_count }        · success
//   · 200 { rows: [], unread_count: 0 } · anonymous viewer · honest
//                                          empty (no session → nothing
//                                          to return · not a leak)
//   · 503 { error: "unavailable" }      · underlying DB failure · the
//                                          client should keep its last
//                                          known state rather than
//                                          clearing to empty
//
// Honesty rules:
//   · Never coerce a DB error into a success empty list. Clearing the
//     drawer on a transient outage would be dishonest.
//   · Always scope by recipient_account_id from the resolved session.
//     This is the ONLY authorisation gate · a crafted query cannot
//     surface another recipient's rows.
//   · No caching (Cache-Control: no-store) · drawer should always see
//     the latest grouped/unread state.

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { listNotificationsForRecipient } from "@/lib/nex-native/notifications/nex-notification-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

export async function GET(): Promise<NextResponse> {
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
    return NextResponse.json(
      { rows: [], unread_count: 0 },
      { headers: NO_STORE },
    );
  }

  const result = await listNotificationsForRecipient(session.account.id);
  if (!result.ok) {
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }
  return NextResponse.json(
    { rows: result.rows, unread_count: result.unread_count },
    { headers: NO_STORE },
  );
}
