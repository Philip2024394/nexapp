// src/app/api/nex-native/peer-message/delivered/route.ts
//
// Bridge 76 / 78 · Recipient client acks a successful decrypt.
// Sets delivered_at on the encrypted row so the Bridge 78 purge
// job can drop the ciphertext ≥ 7 days later.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { markPeerMessageDelivered } from "@/lib/nex-native/peer-message-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  let body: { id?: string };
  try {
    body = (await req.json()) as { id?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }
  try {
    // R9 Stage 4 (2026-10-15) · pass the viewer's account id so the
    // sealed service can gate on the recipient's read_receipts_enabled
    // preference. The route is authenticated · the session owner IS
    // the recipient (they're the ones acking a successful decrypt).
    await markPeerMessageDelivered(id, session.account.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
