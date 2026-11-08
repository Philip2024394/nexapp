// src/lib/nex-native/hq-direct-channel/hq-direct-service.ts
//
// NEX HQ Direct Channel · server-only service for the HQ→user
// direct-message pipeline (migration 301). Owner-authorised 2026-11-08.
// -----------------------------------------------------------------------------
// Doctrine
//   · Server-only · "server-only" import at the top. No client mirror.
//   · HQ authorisation is the CALLER'S job · this module trusts its
//     inputs. The route handler runs requireHqAdmin BEFORE invoking any
//     function here. See account-deletion-recovery-service.ts for the
//     identical discipline.
//   · Delivery runs through the sealed nex_peer_conversation +
//     nex_peer_message plumbing · zero branching in chat UI. The
//     message is marked "nex_hq_origin" in attachment_meta so the
//     consumer can style it as from the official "Nex" account.
//   · Insert-only · the sealed migration 218 trigger prevents UPDATE
//     of body/attachment_meta/sent_at/sender. HQ cannot edit a sent
//     message · only send a follow-up.
//   · Chat content is NEVER written to the audit log. The audit
//     metadata catalog only permits target_account_id + body_length.
//   · Fail-open audit · a send that lands in nex_peer_message with a
//     failed audit write is better than a failed send with a successful
//     audit · HQ UX takes precedence over the audit trail completeness
//     for this specific surface. (Compare account-deletion.attempted
//     which is fail-loud · deletion is destructive · a send is not.)

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import { recordAuditEvent } from "../security-audit-service";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The sealed sentinel "Nex" account id · migration 301. Never
 *  reused · never regenerated. */
export const NEX_HQ_SENTINEL_ACCOUNT_ID =
  "11111111-aaaa-aaaa-aaaa-111111111111";

// ─── Error type ──────────────────────────────────────────────────────

export type HqDirectErrorCode =
  | "invalid_target"
  | "invalid_body"
  | "target_not_found"
  | "upsert_failed"
  | "send_failed";

export class HqDirectError extends Error {
  readonly code: HqDirectErrorCode;
  readonly detail?: string;
  constructor(code: HqDirectErrorCode, detail?: string) {
    super(`hq-direct: ${code}${detail ? ` · ${detail}` : ""}`);
    this.name = "HqDirectError";
    this.code = code;
    this.detail = detail;
  }
}

export function isHqDirectError(e: unknown): e is HqDirectError {
  return e instanceof HqDirectError;
}

// ─── openChannelForMember ────────────────────────────────────────────

/** Idempotent · ensures a tracker row exists in nex_hq_direct_channel
 *  for the target. Returns the channel id. Does NOT send a message. */
export async function openChannelForMember(
  hqAccountId: string,
  targetAccountId: string,
): Promise<{ readonly channelId: string }> {
  if (!UUID_SHAPE.test(hqAccountId)) {
    throw new HqDirectError("invalid_target", "hqAccountId must be a UUID");
  }
  if (!UUID_SHAPE.test(targetAccountId)) {
    throw new HqDirectError("invalid_target", "targetAccountId must be a UUID");
  }
  if (targetAccountId.toLowerCase() === NEX_HQ_SENTINEL_ACCOUNT_ID) {
    throw new HqDirectError(
      "invalid_target",
      "target cannot be the HQ sentinel account",
    );
  }

  const { data, error } = await nexSupabaseAdmin.rpc(
    "nex_hq_direct_channel_upsert",
    {
      _target_account_id: targetAccountId,
      _hq_account_id: hqAccountId,
    },
  );
  if (error) {
    throw new HqDirectError("upsert_failed", error.message);
  }
  const channelId = typeof data === "string" ? data : null;
  if (!channelId) {
    throw new HqDirectError("upsert_failed", "no channel id returned");
  }
  return { channelId };
}

// ─── sendHqMessage ───────────────────────────────────────────────────

export interface SendHqMessageInput {
  readonly hqAccountId: string;
  readonly targetAccountId: string;
  readonly body: string;
}

export interface SendHqMessageResult {
  readonly messageId: string;
}

/** Validate inputs + call the SECURITY DEFINER send RPC. Emits
 *  security.hq.direct_message.completed on success (fail-open) and
 *  security.hq.direct_message.failed on RPC error (fail-open). */
export async function sendHqMessage(
  input: SendHqMessageInput,
): Promise<SendHqMessageResult> {
  const { hqAccountId, targetAccountId, body } = input;

  if (!UUID_SHAPE.test(hqAccountId)) {
    throw new HqDirectError("invalid_target", "hqAccountId must be a UUID");
  }
  if (!UUID_SHAPE.test(targetAccountId)) {
    throw new HqDirectError("invalid_target", "targetAccountId must be a UUID");
  }
  if (targetAccountId.toLowerCase() === NEX_HQ_SENTINEL_ACCOUNT_ID) {
    throw new HqDirectError(
      "invalid_target",
      "target cannot be the HQ sentinel account",
    );
  }
  if (typeof body !== "string") {
    throw new HqDirectError("invalid_body", "body must be a string");
  }
  const trimmed = body.trim();
  if (trimmed.length < 1) {
    throw new HqDirectError("invalid_body", "body must be 1..4000 chars");
  }
  if (body.length > 4000) {
    // Length check against raw body (DB check also compares raw).
    throw new HqDirectError("invalid_body", "body must be 1..4000 chars");
  }

  const { data, error } = await nexSupabaseAdmin.rpc("nex_hq_direct_send", {
    _target_account_id: targetAccountId,
    _hq_account_id: hqAccountId,
    _body: body,
  });
  if (error) {
    const msg = error.message ?? "unknown";
    // Target-not-found surfaces as a PG RAISE · classify so the caller
    // can return 404 instead of 500.
    const isTargetMissing = /target account not found or deleted/i.test(msg);
    // Fail-open audit · never block the HQ response path on an audit
    // write. Metadata keys are narrow by catalog · no chat body.
    void recordAuditEvent({
      event: "security.hq.direct_message.failed",
      outcome: "failed",
      actorAccountId: hqAccountId,
      actorIdentity: `acct:${hqAccountId}`,
      targetType: "nex_account",
      targetId: targetAccountId,
      metadata: {
        error_code: isTargetMissing ? "target_not_found" : msg.slice(0, 200),
        target_account_id: targetAccountId,
      },
    }).catch(() => undefined);
    if (isTargetMissing) {
      throw new HqDirectError("target_not_found", msg);
    }
    throw new HqDirectError("send_failed", msg);
  }
  const messageId = typeof data === "string" ? data : null;
  if (!messageId) {
    // Treat an empty RPC response as a send failure · same audit path.
    void recordAuditEvent({
      event: "security.hq.direct_message.failed",
      outcome: "failed",
      actorAccountId: hqAccountId,
      actorIdentity: `acct:${hqAccountId}`,
      targetType: "nex_account",
      targetId: targetAccountId,
      metadata: {
        error_code: "no_message_id_returned",
        target_account_id: targetAccountId,
      },
    }).catch(() => undefined);
    throw new HqDirectError("send_failed", "no message id returned");
  }

  // Completion audit · fail-open. Body length only · never the body.
  void recordAuditEvent({
    event: "security.hq.direct_message.completed",
    outcome: "completed",
    actorAccountId: hqAccountId,
    actorIdentity: `acct:${hqAccountId}`,
    targetType: "nex_account",
    targetId: targetAccountId,
    metadata: {
      target_account_id: targetAccountId,
      body_length: body.length,
    },
  }).catch(() => undefined);

  return { messageId };
}

// ─── fetchHqChannelMessages ──────────────────────────────────────────

export interface HqChannelMessageRow {
  readonly id: string;
  readonly conversation_id: string;
  readonly sender_account_id: string;
  readonly body: string;
  readonly sent_at: string;
  readonly authored_by_hq_account_id: string | null;
}

/** Read recent peer messages sent by the HQ sentinel to a given target.
 *  Service-role read · bypasses RLS. Caller must be HQ-gated. */
export async function fetchHqChannelMessages(
  targetAccountId: string,
  limit = 50,
): Promise<readonly HqChannelMessageRow[]> {
  if (!UUID_SHAPE.test(targetAccountId)) {
    throw new HqDirectError("invalid_target", "targetAccountId must be a UUID");
  }
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 500);

  // Find the canonical conversation. The sentinel UUID starts with
  // '11111111' so for most real targets sentinel < target lexically,
  // but we tolerate both orderings for completeness.
  const conv = await nexSupabaseAdmin
    .from("nex_peer_conversation")
    .select("id")
    .or(
      `and(participant_a_id.eq.${NEX_HQ_SENTINEL_ACCOUNT_ID},participant_b_id.eq.${targetAccountId}),` +
        `and(participant_a_id.eq.${targetAccountId},participant_b_id.eq.${NEX_HQ_SENTINEL_ACCOUNT_ID})`,
    )
    .maybeSingle();
  if (conv.error || !conv.data) {
    return [];
  }
  const conversationId = (conv.data as { id: string }).id;

  const msgs = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("id, conversation_id, sender_account_id, body, sent_at, attachment_meta")
    .eq("conversation_id", conversationId)
    .eq("sender_account_id", NEX_HQ_SENTINEL_ACCOUNT_ID)
    .order("sent_at", { ascending: false })
    .limit(safeLimit);
  if (msgs.error || !msgs.data) {
    return [];
  }
  type Row = {
    id: string;
    conversation_id: string;
    sender_account_id: string;
    body: string;
    sent_at: string;
    attachment_meta: { nex_hq_origin?: boolean; authored_by_hq_account_id?: string } | null;
  };
  return (msgs.data as Row[]).map((r) => ({
    id: r.id,
    conversation_id: r.conversation_id,
    sender_account_id: r.sender_account_id,
    body: r.body,
    sent_at: r.sent_at,
    authored_by_hq_account_id: r.attachment_meta?.authored_by_hq_account_id ?? null,
  }));
}
