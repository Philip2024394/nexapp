// src/app/api/nex-native/calls/confirm-room-join/route.ts
//
// NEX Gate A Connected Matrix §16.48.25 · Lane 2 · 2026-11-20
//
// Sole trusted writer of nex_group_call_participant.joined_at.
//
// Contract
//   POST { sessionId: string }
//   → 200 { ok: true, updatedRowCount: number }
//   → 401 { ok: false, reason: "unauthenticated" }
//   → 404 { ok: false, reason: "session_not_found" }
//   → 403 { ok: false, reason: "not_member" }
//   → 500 { ok: false, reason: "error" }
//
// Intended caller
// ---------------
// group-peer.ts `onconnectionstatechange` handler at line ~224, only on
// the `pc.connectionState === "connected"` transition. Preview page
// load, accept URL, engine mount, and `enable()` explicitly do NOT
// count as "connected" (owner directive 2026-11-20). Not wired yet —
// wiring is a follow-up change inside group-peer.ts.
//
// Caller identity is resolved server-side via the sealed session
// resolver; the request body carries only `sessionId`.

import { NextResponse } from "next/server";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { confirmRoomJoin } from "@/lib/nex-native/calls/confirm-room-join";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request): Promise<NextResponse> {
  const session = await resolveSessionWithDevOverride().catch(() => null);
  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "unauthenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "error" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const sessionId =
    body && typeof body === "object" && "sessionId" in body
      ? (body as { sessionId: unknown }).sessionId
      : null;
  if (typeof sessionId !== "string" || !UUID_SHAPE.test(sessionId)) {
    return NextResponse.json(
      { ok: false, reason: "error" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Cast nexSupabaseAdmin to the structural shape confirmRoomJoin needs.
  // The real client satisfies the narrower interface at runtime.
  const admin = nexSupabaseAdmin as unknown as Parameters<
    typeof confirmRoomJoin
  >[0]["admin"];

  const result = await confirmRoomJoin({
    callerAccountId: session.account.id,
    sessionId,
    admin,
  });

  if (result.ok) {
    return NextResponse.json(
      { ok: true, updatedRowCount: result.updatedRowCount },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  const statusByReason: Record<string, number> = {
    unauthenticated: 401,
    session_not_found: 404,
    not_member: 403,
    error: 500,
  };
  return NextResponse.json(
    { ok: false, reason: result.reason },
    {
      status: statusByReason[result.reason] ?? 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
