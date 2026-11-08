// src/app/api/nex-native/calls/incoming-group/route.ts
//
// Owner-authorised 2026-11-08 (round 27) · incoming-group-call
// inbox API. Powers the polling IncomingGroupCallHub (sealed
// service_role-only RLS on nex_group_call_* precludes anon
// Realtime · poll is the right primary).
// -----------------------------------------------------------------------------
// Contract
//   GET → { invites: IncomingGroupInvite[] }
//   · Resolves the viewer's session server-side via the sealed
//     resolveSessionWithDevOverride · anon → 401.
//   · Returns pending-invited rows for THIS account only · never
//     another viewer's inbox.
//   · 15s client-poll cadence is set by the hub · route is
//     stateless + cheap · no per-request cost model needed.
//   · Fail-soft · unresolved profile / DB error returns an empty
//     array, not a 5xx · the hub overlay stays quiet.

import { NextResponse } from "next/server";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { fetchPendingGroupInvites } from "@/lib/nex-native/calls/invite-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await resolveSessionWithDevOverride().catch(() => null);
  if (!session) {
    return NextResponse.json(
      { invites: [], error: "unauthenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const invites = await fetchPendingGroupInvites(session.account.id);
    return NextResponse.json(
      { invites },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    // Fail-soft · never leak a 5xx to the hub (would amplify the
    // polling loop into an error-retry storm).
    return NextResponse.json(
      { invites: [] },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
