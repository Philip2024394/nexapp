// src/app/api/nex-native/unread-count/route.ts
//
// NEX home-screen app-badge count endpoint · owner directive 2026-10-16.
// Corrective pass 2026-10-16 · distinguish genuine zero from DB error.
// --------------------------------------------------------------------
// Returns the signed-in viewer's TOTAL unread peer-message count
// across every NORMAL (non-Vault) conversation they participate in.
// The client-side badge-sync component (`_app-badge-sync-client.tsx`)
// calls this endpoint on mount, on `visibilitychange` (tab foreground),
// and periodically while visible, then calls `navigator.setAppBadge`
// where supported.
//
// Response shape:
//   · 200 { count: number }  · success · integer >= 0 · sync badge
//   · 200 { count: 0 }       · anonymous viewer · correct zero (not a
//                              leak · no session, no data to count)
//   · 503 { error: "unavailable" } · underlying DB failure · the
//                              CLIENT MUST preserve the last known
//                              badge value (its `if (!res.ok) return;`
//                              guard already does this)
//
// Honesty rules enforced:
//   · Never fabricate · a database error is NEVER coerced into a
//     success zero. A transient outage would otherwise clear a user's
//     badge even when they had unread messages.
//   · Never leak Vault-conversation metadata · the aggregate count
//     excludes vaulted conversations entirely (sealed
//     `listVaultedConversationIds` is applied inside
//     `countTotalUnreadPeerMessages`).
//   · No caching · Cache-Control: no-store so a quick open-then-read
//     always sees fresh state.
//
// Does NOT · provide per-conversation breakdown (that lives in the
// chat surface via the sealed `countUnreadPeerMessages` helper) ·
// trigger a push · modify any row · touch any Vault content · expose
// another user's count (session resolver scopes to the signed-in
// account; anonymous returns zero).

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { countTotalUnreadPeerMessages } from "@/lib/nex-native/peer-message-service";

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
    return NextResponse.json({ count: 0 }, { headers: NO_STORE });
  }
  try {
    const count = await countTotalUnreadPeerMessages(session.account.id);
    return NextResponse.json({ count }, { headers: NO_STORE });
  } catch {
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
}
