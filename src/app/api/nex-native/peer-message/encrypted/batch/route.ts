// src/app/api/nex-native/peer-message/encrypted/batch/route.ts
//
// NEX device-key chat · batched N-row encrypted send endpoint.
// Owner-authorised 2026-11-10 · integration layer.
// -----------------------------------------------------------------
// Companion to /api/nex-native/peer-message/encrypted/route.ts · the
// legacy single-group endpoint accepts a `{ message_group_id, rows }`
// body. This endpoint accepts the same shape but:
//
//   · validates every row's sender_account_id against the session,
//   · verifies every row's recipient_device_id belongs to one of the
//     conversation participants,
//   · inserts all N rows via sendEncryptedPeerMessages (sealed
//     service · writes atomically through PostgREST's single-insert
//     batch · returns ids or throws on partial failure),
//   · is idempotent on message_group_id · replays with the same id
//     return the existing row ids without inserting duplicates.
//
// Invariants preserved:
//   · I-1 · never reads or persists plaintext · ciphertext/nonce are
//     forwarded opaquely to the sealed service.
//   · I-2 · one POST = one logical send · no queue, no retry fan-out.
//   · I-3 · encrypted rows only · plaintext send path is unreachable
//     from this endpoint.
//   · I-4 · replay returns the same rows · delivery guarantees held.
//   · I-5 · a failed insert leaves zero rows · see Postgres atomic
//     multi-row insert semantics (the service's single
//     .insert(payload[]) call either writes all or writes none).
//   · I-6 · atomicity + consistency via the atomic multi-insert.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  sendEncryptedPeerMessages,
  type EncryptedPeerMessageInsert,
} from "@/lib/nex-native/peer-message-service";
import { getPeerConversationById } from "@/lib/nex-native/peer-conversation-service";
import { lookupActiveDeviceKeys } from "@/lib/nex-native/crypto/device-key-lookup";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 32; // ceiling · same as the legacy endpoint

interface InRow {
  conversation_id: string;
  sender_account_id: string;
  ciphertext_b64: string;
  nonce_b64: string;
  sender_public_key: string;
  sender_device_id: string;
  recipient_account_id: string;
  recipient_device_id: string;
  reply_to_id?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_meta?: unknown;
}

interface InBody {
  message_group_id: string;
  rows: InRow[];
}

type ExistingRow = {
  id: string;
  recipient_device_id: string | null;
  sender_device_id: string | null;
  conversation_id: string;
};

async function findExistingByGroup(
  messageGroupId: string,
): Promise<ExistingRow[] | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("id,recipient_device_id,sender_device_id,conversation_id")
    .eq("message_group_id", messageGroupId);
  if (error) return null;
  return (data as ExistingRow[]) ?? [];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "not_signed_in" },
      { status: 401 },
    );
  }

  let body: InBody;
  try {
    body = (await req.json()) as InBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  if (
    !body ||
    typeof body.message_group_id !== "string" ||
    body.message_group_id.length < 8 ||
    !Array.isArray(body.rows) ||
    body.rows.length === 0
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 },
    );
  }

  if (body.rows.length > MAX_ROWS) {
    return NextResponse.json(
      { ok: false, error: "too_many_rows" },
      { status: 400 },
    );
  }

  // Idempotency probe · if any row with this group id already exists,
  // return those rows without inserting.
  const existing = await findExistingByGroup(body.message_group_id);
  if (existing && existing.length > 0) {
    return NextResponse.json({
      ok: true,
      message_group_id: body.message_group_id,
      rows_written: 0,
      ids: existing.map((r) => r.id),
      replayed: true,
    });
  }

  // Shape check + sender identity check.
  for (const r of body.rows) {
    if (
      typeof r.conversation_id !== "string" ||
      typeof r.sender_account_id !== "string" ||
      typeof r.ciphertext_b64 !== "string" ||
      typeof r.nonce_b64 !== "string" ||
      typeof r.sender_public_key !== "string" ||
      typeof r.sender_device_id !== "string" ||
      typeof r.recipient_account_id !== "string" ||
      typeof r.recipient_device_id !== "string"
    ) {
      return NextResponse.json(
        { ok: false, error: "row_shape" },
        { status: 400 },
      );
    }
    if (r.sender_account_id !== session.account.id) {
      return NextResponse.json(
        { ok: false, error: "sender_mismatch" },
        { status: 400 },
      );
    }
  }

  // All rows must share one conversation + one sender_device_id.
  const convIds = new Set(body.rows.map((r) => r.conversation_id));
  if (convIds.size !== 1) {
    return NextResponse.json(
      { ok: false, error: "conversation_mismatch" },
      { status: 400 },
    );
  }
  const senderDeviceIds = new Set(body.rows.map((r) => r.sender_device_id));
  if (senderDeviceIds.size !== 1) {
    return NextResponse.json(
      { ok: false, error: "sender_device_mismatch" },
      { status: 400 },
    );
  }

  const conversationId = body.rows[0]!.conversation_id;
  const conv = await getPeerConversationById(conversationId);
  if (!conv) {
    return NextResponse.json(
      { ok: false, error: "conversation_not_found" },
      { status: 404 },
    );
  }
  if (
    session.account.id !== conv.participant_a_id &&
    session.account.id !== conv.participant_b_id
  ) {
    return NextResponse.json(
      { ok: false, error: "not_a_participant" },
      { status: 403 },
    );
  }

  // Participant device-id verification. Each row's recipient_device_id
  // must belong to one of the two conversation participants. We fetch
  // the active device-key list for both participants once and check
  // row-by-row.
  const [lookA, lookB] = await Promise.all([
    lookupActiveDeviceKeys(conv.participant_a_id),
    lookupActiveDeviceKeys(conv.participant_b_id),
  ]);
  if (!lookA.ok || !lookB.ok) {
    return NextResponse.json(
      { ok: false, error: "device_key_lookup_failed" },
      { status: 500 },
    );
  }
  const participantDeviceIds = new Map<string, string>(); // device_id → account_id
  for (const d of lookA.devices) {
    participantDeviceIds.set(d.device_id, conv.participant_a_id);
  }
  for (const d of lookB.devices) {
    participantDeviceIds.set(d.device_id, conv.participant_b_id);
  }
  for (const r of body.rows) {
    const owner = participantDeviceIds.get(r.recipient_device_id);
    if (!owner) {
      return NextResponse.json(
        { ok: false, error: "participant_mismatch" },
        { status: 403 },
      );
    }
    if (owner !== r.recipient_account_id) {
      return NextResponse.json(
        { ok: false, error: "participant_mismatch" },
        { status: 403 },
      );
    }
  }

  // Decode + delegate to sealed service.
  const inserts: EncryptedPeerMessageInsert[] = body.rows.map((r) => ({
    conversation_id: r.conversation_id,
    sender_account_id: session.account.id,
    ciphertext: base64ToBuffer(r.ciphertext_b64),
    nonce: base64ToBuffer(r.nonce_b64),
    sender_public_key: r.sender_public_key,
    sender_device_id: r.sender_device_id,
    recipient_device_id: r.recipient_device_id,
    message_group_id: body.message_group_id,
    reply_to_id: r.reply_to_id ?? null,
    attachment_url: r.attachment_url ?? null,
    attachment_type:
      (r.attachment_type as EncryptedPeerMessageInsert["attachment_type"]) ??
      null,
    attachment_meta:
      (r.attachment_meta as EncryptedPeerMessageInsert["attachment_meta"]) ??
      null,
  }));

  let ids: string[];
  try {
    ids = await sendEncryptedPeerMessages(inserts);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "insert_failed", detail: msg },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message_group_id: body.message_group_id,
    rows_written: ids.length,
    ids,
  });
}

function base64ToBuffer(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}
