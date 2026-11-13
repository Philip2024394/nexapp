// src/app/api/nex-native/chat/encrypted/since/route.ts
//
// Owner-sealed 2026-11-13 · incremental fetch for the business-scoped
// shop chat. Called by the client after a `nex:messages:<conv>`
// arrival nudge · returns every nex_message row in the conversation
// with created_at > watermark, scoped to this conversation only.
//
// Server never decrypts · payload is the raw row shape (ciphertext,
// nonce, sender_public_key, etc.) · plaintext column `body` is NULL
// for encrypted rows. Clients decrypt locally.
//
// Guards:
//   · Caller must be signed in.
//   · Caller must be a participant of the conversation (service-layer
//     ensureSenderIsParticipant via listBusinessMessages).

import { NextResponse, type NextRequest } from "next/server";
import { resolveSessionWithDevOverride as resolveNexAppSessionFromContext } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessMessages } from "@/lib/nex-native/business-message-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "not_signed_in" },
      { status: 401 },
    );
  }
  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversationId");
  const watermark = url.searchParams.get("since");
  if (!conversationId || conversationId.length < 32) {
    return NextResponse.json(
      { ok: false, error: "missing_conversation_id" },
      { status: 400 },
    );
  }
  try {
    const all = await listBusinessMessages(conversationId, session.account.id);
    const filtered = watermark
      ? all.filter((m) => m.created_at > watermark)
      : all;
    return NextResponse.json({
      ok: true,
      messages: filtered,
      // Echo the server's "now" so the client has a safe watermark
      // for the NEXT since call · using the latest created_at avoids
      // clock-skew surprises.
      watermark:
        filtered.length > 0
          ? filtered[filtered.length - 1]!.created_at
          : watermark ?? new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("only conversation participants") ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
