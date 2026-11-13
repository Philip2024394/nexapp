// src/app/api/nex-native/chat/encrypted/route.ts
//
// Owner-sealed 2026-11-13 · encrypted send endpoint for shop/business
// conversations.
// -----------------------------------------------------------------------------
// Companion to /api/nex-native/peer-message/encrypted. Takes a JSON
// body that mirrors sendEncryptedBusinessMessages' insert shape but
// uses base64 strings for ciphertext/nonce so the wire payload stays
// plain JSON. Writes atomically · all per-device rows share the same
// message_group_id.
//
// The server verifies the caller is a participant of the conversation
// (via business-message-service.ensureSenderIsParticipant) · never
// sees plaintext · trusts the client to have grouped the rows for one
// logical send. Mirrors the sealed Bridge 76 posture for peer chat.
//
// Requires mig 345 (nex_message E2E crypto columns) applied · writes
// without it fail with a shape CHECK violation (correct · guards
// against plaintext slipping in).

import { NextResponse, type NextRequest } from "next/server";
// Owner directive 2026-11-13 · dev-override resolver so dev-impersonated
// 99901 can authenticate here · same contract as the peer encrypted
// endpoint · production unaffected.
import { resolveSessionWithDevOverride as resolveNexAppSessionFromContext } from "@/lib/nex-native/app/dev-impersonation";
import {
  sendEncryptedBusinessMessages,
  type EncryptedBusinessMessageInsert,
} from "@/lib/nex-native/business-message-service";
// Owner directive 2026-11-13 (iter 2) · reuse the sealed Bridge 73
// broadcast nudge · fire-and-forget after the DB insert so receivers
// on the same conversation_id channel pull new rows via /since. The
// payload is routing metadata ONLY (conversation_id, message_group_id,
// sent_at) · zero plaintext + zero ciphertext travels over the
// broadcast channel.
import { emitMessageArrival } from "@/lib/nex-native/realtime/message-arrival";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  conversation_id: string;
  ciphertext_b64: string;
  nonce_b64: string;
  sender_public_key: string;
  sender_device_id: string;
  recipient_device_id: string;
  reply_to_id?: string | null;
  attachment_type?:
    | "image"
    | "video"
    | "audio"
    | "document"
    | "product"
    | null;
  attachment_meta?: unknown;
}

interface Body {
  message_group_id: string;
  rows: Row[];
}

function decodeBase64(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  throw new Error("no base64 decoder available");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "not_signed_in" },
      { status: 401 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 },
    );
  }
  if (typeof body.message_group_id !== "string" || body.message_group_id.length < 32) {
    return NextResponse.json(
      { ok: false, error: "missing_message_group_id" },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no_rows" },
      { status: 400 },
    );
  }

  // Shape all rows. Enforce single conversation_id so the service
  // guard check (ensureSenderIsParticipant) only hits the DB once.
  const conversationIds = new Set(body.rows.map((r) => r.conversation_id));
  if (conversationIds.size !== 1) {
    return NextResponse.json(
      { ok: false, error: "mixed_conversation_ids" },
      { status: 400 },
    );
  }

  const inserts: EncryptedBusinessMessageInsert[] = [];
  for (const r of body.rows) {
    if (
      typeof r.ciphertext_b64 !== "string" ||
      typeof r.nonce_b64 !== "string" ||
      typeof r.sender_public_key !== "string" ||
      typeof r.sender_device_id !== "string" ||
      typeof r.recipient_device_id !== "string"
    ) {
      return NextResponse.json(
        { ok: false, error: "invalid_row_shape" },
        { status: 400 },
      );
    }
    inserts.push({
      conversation_id: r.conversation_id,
      sender_account_id: session.account.id,
      ciphertext: decodeBase64(r.ciphertext_b64),
      nonce: decodeBase64(r.nonce_b64),
      sender_public_key: r.sender_public_key,
      sender_device_id: r.sender_device_id,
      recipient_device_id: r.recipient_device_id,
      message_group_id: body.message_group_id,
      reply_to_id: r.reply_to_id ?? null,
      attachment_type: r.attachment_type ?? null,
      attachment_meta:
        (r.attachment_meta ?? null) as
          | Record<string, unknown>
          | null,
    });
  }

  try {
    const ids = await sendEncryptedBusinessMessages(inserts);
    // Fire-and-forget arrival nudge · reuses the sealed Bridge 73
    // broadcast · payload is conversation_id + group_id + timestamp
    // only (no row data, no ciphertext). Receivers pull from /since.
    const sentAtIso = new Date().toISOString();
    void emitMessageArrival({
      conversationId: inserts[0]!.conversation_id,
      messageGroupId: body.message_group_id,
      sentAtIso,
    });
    return NextResponse.json({ ok: true, ids });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status =
      msg.includes("only conversation participants") ? 403 :
      msg.includes("conversation not found") ? 404 :
      500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
