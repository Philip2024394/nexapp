// src/app/api/nex-native/peer-message/encrypted/route.ts
//
// Bridge 76 · Endpoint for the encrypted send path.
// --------------------------------------------------
// Server Actions can't cleanly transport raw ciphertext + nonce
// + multi-device fan-out arrays (FormData is text-first). This
// endpoint takes a JSON body that mirrors sendEncryptedPeerMessages'
// EncryptedPeerMessageInsert shape but uses base64 strings for the
// ciphertext/nonce bytes so JSON stays plain-text.
//
// The server verifies the caller is a participant in the conversation
// (redundant with RLS + service check, but a clear early return keeps
// error messages precise). It never sees plaintext · that's the whole
// point of E2E · we only trust the client to have grouped the rows
// correctly for one logical "send."

import { NextResponse, type NextRequest } from "next/server";
// Owner directive 2026-11-13 URGENT · dev-override resolver so
// dev-impersonated 99901 can authenticate against this E2E send
// endpoint. The legacy resolver returned null for impersonated
// callers → 401 before write → zero messages ever delivered.
// Production unaffected · falls through to the real resolver when
// NEX_DEV_IMPERSONATE_HANDLE is unset.
import { resolveSessionWithDevOverride as resolveNexAppSessionFromContext } from "@/lib/nex-native/app/dev-impersonation";
import {
  sendEncryptedPeerMessages,
  type EncryptedPeerMessageInsert,
} from "@/lib/nex-native/peer-message-service";
import { getPeerConversationById } from "@/lib/nex-native/peer-conversation-service";
// R1 · universal live-messaging arrival nudge. Fire-and-forget AFTER
// the canonical DB write succeeds · broadcast failure MUST NOT flip
// a successful send into a failed send.
import { emitMessageArrival } from "@/lib/nex-native/realtime/message-arrival";
// R8 Stage 3b (2026-10-16) · fan a push notification to the recipient
// AFTER the encrypted insert succeeds. The dispatch service enforces
// recipient-pref + Vault boundary + fail-closed. Preview is strictly
// generic · the route never sees plaintext and MUST NOT surface
// ciphertext in a push payload.
import { dispatchPushNotification } from "@/lib/nex-native/notification-dispatch-service";
import { getAccountById } from "@/lib/nex-native/account-service";
import { resolveAccountLocale, t as tI18n } from "@/lib/nex/i18n/server";

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
  attachment_url?: string | null;
  attachment_type?:
    | "image" | "video" | "audio"
    | "product" | "menu_item" | "cart_order" | "product_share"
    | null;
  attachment_meta?: unknown;
}

interface Body {
  message_group_id: string;
  rows: Row[];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (
    !body ||
    typeof body.message_group_id !== "string" ||
    !Array.isArray(body.rows) ||
    body.rows.length === 0
  ) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  if (body.rows.length > 32) {
    // Ceiling on fan-out · 32 devices per (sender+recipient) is far
    // beyond any realistic count and guards against a malicious client
    // trying to write bulk garbage.
    return NextResponse.json({ ok: false, error: "too_many_rows" }, { status: 400 });
  }

  const inserts: EncryptedPeerMessageInsert[] = [];
  for (const r of body.rows) {
    if (
      typeof r.conversation_id !== "string" ||
      typeof r.ciphertext_b64 !== "string" ||
      typeof r.nonce_b64 !== "string" ||
      typeof r.sender_public_key !== "string" ||
      typeof r.sender_device_id !== "string" ||
      typeof r.recipient_device_id !== "string"
    ) {
      return NextResponse.json({ ok: false, error: "row_shape" }, { status: 400 });
    }
    // Decode base64 back to bytes for the service (it re-encodes to
    // base64 on the way to Postgres · we don't shortcut that so the
    // service stays the single source of encoding truth).
    inserts.push({
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
      attachment_type: r.attachment_type ?? null,
      attachment_meta: (r.attachment_meta as EncryptedPeerMessageInsert["attachment_meta"]) ?? null,
    });
  }

  try {
    const ids = await sendEncryptedPeerMessages(inserts);
    // R1 · emit exactly ONE logical arrival · the Bridge 76 fan-out
    // produced N physical rows that share this message_group_id ·
    // subscribers dedup by the group id so one event is enough and
    // one is correct. Fire-and-forget · never await errors.
    void emitMessageArrival({
      conversationId: inserts[0]!.conversation_id,
      messageGroupId: body.message_group_id,
      sentAtIso: new Date().toISOString(),
    });

    // R8 Stage 3b (encrypted-path extension) · fan a SINGLE push to the
    // recipient's registered devices. The N inserted rows correspond to
    // N device-copies for ONE logical message · subscribers dedup via
    // the push `tag`, so emitting one dispatch here matches R1 semantics.
    // Generic preview strings only, localised in the RECIPIENT's saved
    // nex_account.locale. Never ciphertext. Never plaintext · the server
    // literally cannot decrypt. The dispatch service enforces recipient
    // category pref + Vault boundary + fail-closed on error.
    // Fire-and-forget · a push failure MUST NOT flip a successful send.
    void (async () => {
      try {
        const conversationId = inserts[0]!.conversation_id;
        const conv = await getPeerConversationById(conversationId);
        if (!conv) return;
        const recipient =
          session.account.id === conv.participant_a_id
            ? conv.participant_b_id
            : conv.participant_a_id;
        if (!recipient || recipient === session.account.id) return;
        const recipientAccount = await getAccountById(recipient);
        const recipientLocale = resolveAccountLocale(recipientAccount?.locale);
        const firstAttachmentType = inserts[0]!.attachment_type;
        const previewKey =
          firstAttachmentType === "image"
            ? "push.body.sentYouAPhoto"
            : firstAttachmentType === "video"
              ? "push.body.sentYouAVideo"
              : firstAttachmentType === "audio"
                ? "push.body.sentYouAVoiceNote"
                : "push.body.sentYouAMessage";
        const preview = tI18n(previewKey, recipientLocale);
        await dispatchPushNotification(recipient, "message", {
          kind: "conversation",
          conversationId,
          title: session.account.display_name || "Someone",
          body: preview,
          data: {
            type: "peer_message_encrypted",
            conversationId,
            messageGroupId: body.message_group_id,
            senderAccountId: session.account.id,
            // Push `tag` collapses duplicates across the N device rows
            // · browsers show at most one notification per tag.
            tag: `nex-msg-${body.message_group_id}`,
          },
        });
      } catch {
        /* fire-and-forget · errors swallowed by design */
      }
    })();

    return NextResponse.json({ ok: true, ids });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

function base64ToBuffer(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}
