"use server";

// src/app/nex-native/_share-drawer-actions.ts
//
// Owner directive 2026-11-23 · server actions backing the notifications
// drawer's TWO quick-share buttons (QR and Bank details). Context-aware:
// when the drawer is opened WHILE a peer chat is active, tapping the
// button sends a card into that chat; when no chat is active the client
// is told to route to the standalone share / setup surface.
//
// Scope deliberately narrow:
//   · QR share  · sends a `document`-typed peer message whose
//                 attachment_url is the signed-in user's canonical
//                 profile/shop URL (api.qrserver.com renders the QR from
//                 this URL on the recipient's own device). We do NOT
//                 mislabel this as a payment QR · attachment_meta.filename
//                 is explicitly "Profile QR · @handle".
//   · Bank share · sends a `document`-typed peer message carrying the
//                  OWNER-configured `payment_instructions` text. Bank
//                  details are "deliberately configured receiving
//                  details, not credentials" (owner directive 2026-11-23)
//                  so storing them in attachment_meta on the message row
//                  is consistent with existing product/menu snapshots
//                  that also sit in attachment_meta. Returns
//                  `not_configured` when no text is saved · the client
//                  then navigates to /nex-native/settings/payments.
//
// Hard invariants:
//   · Session resolved on EVERY call · guest calls reject.
//   · Server-side recipient authorization · we never trust the client's
//     peerAccountId as a shortcut; we call the sealed
//     `getOrCreatePeerConversationAsSender` which applies the same
//     contacts-only / blocklist gates the normal chat send uses.
//   · Never flips any order state · no call to markOrderPaid, no write
//     to nex_order_event. Sharing is a chat primitive, not a commerce
//     primitive.
//   · No new attachment_type · reuses the existing `document` kind.
//   · No new schema · no migration required for this action.

import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as peerMessageService from "@/lib/nex-native/peer-message-service";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  bankDetailsAreConfigured,
  decodeBankDetails,
  renderBankDetailsPreview,
} from "@/lib/nex-native/manage-share/bank-details-codec";

// ─── Shared result shapes ───────────────────────────────────────

export type ShareDrawerResult =
  | { readonly kind: "ok"; readonly messageId: string }
  | { readonly kind: "not_configured" }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "self_send_rejected" }
  | { readonly kind: "recipient_blocked"; readonly reason: string }
  | { readonly kind: "error"; readonly message: string };

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_NEX_APP_BASE_URL?.replace(/\/+$/, "") ??
  "https://nexapp.app";

function handleLabel(session: {
  account: {
    chosen_handle: string | null;
    nex_handle: string | null;
    display_name: string | null;
  };
}): string {
  return (
    session.account.chosen_handle ||
    session.account.nex_handle ||
    session.account.display_name ||
    "profile"
  );
}

function normalisePeerId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  // Rough UUID shape guard · the privacy gate below is still the real
  // authorization. This just rejects obvious junk early.
  if (!/^[0-9a-fA-F-]{8,}$/.test(t)) return null;
  return t;
}

async function readPrimaryBusinessFor(
  ownerAccountId: string,
): Promise<{ slug: string | null; payment_instructions: string | null }> {
  try {
    const businesses = await listBusinessesByOwner(ownerAccountId);
    // Match the existing /nex-native/manage/share surface · take the
    // most-recent business row as "primary" (same ordering as
    // listBusinessesByOwner: created_at DESC).
    const first = businesses[0] ?? null;
    if (!first) return { slug: null, payment_instructions: null };
    const slug = typeof first.slug === "string" ? first.slug : null;
    const payment_instructions =
      typeof (first as { payment_instructions?: string | null }).payment_instructions ===
      "string"
        ? (first as { payment_instructions?: string | null }).payment_instructions ?? null
        : null;
    return { slug, payment_instructions };
  } catch {
    return { slug: null, payment_instructions: null };
  }
}

// ─── Share action 1 · profile/shop QR ──────────────────────────

export async function shareProfileQrIntoChatAction(
  rawPeerAccountId: string,
): Promise<ShareDrawerResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { kind: "unauthenticated" };

  const peerId = normalisePeerId(rawPeerAccountId);
  if (!peerId) return { kind: "error", message: "invalid peer id" };
  if (peerId === session.account.id) return { kind: "self_send_rejected" };

  const { slug } = await readPrimaryBusinessFor(session.account.id);
  if (!slug) return { kind: "not_configured" };

  // Authorise · getOrCreatePeerConversationAsSender runs the same
  // contacts-only / blocklist gate that the normal peer-send uses.
  let conversation;
  try {
    conversation = await peerConversationService.getOrCreatePeerConversationAsSender(
      session.account.id,
      peerId,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("recipient_contacts_only")) {
      return { kind: "recipient_blocked", reason: "recipient_contacts_only" };
    }
    return { kind: "error", message: msg };
  }

  const profileUrl = `${APP_BASE_URL}/nex-native/${slug}`;
  const handle = handleLabel(session);

  try {
    const row = await peerMessageService.sendPeerMessage({
      conversation_id: conversation.id,
      sender_account_id: session.account.id,
      body: "", // no plaintext body · attachment-only send
      attachment_type: "document",
      attachment_url: profileUrl,
      attachment_meta: {
        filename: `Profile QR · @${handle}`,
        mime: "text/vnd.nex-profile-share",
      },
    });
    return { kind: "ok", messageId: row.id };
  } catch (e) {
    return {
      kind: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

// ─── Share action 2 · saved bank details ───────────────────────

export async function shareBankDetailsIntoChatAction(
  rawPeerAccountId: string,
): Promise<ShareDrawerResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { kind: "unauthenticated" };

  const peerId = normalisePeerId(rawPeerAccountId);
  if (!peerId) return { kind: "error", message: "invalid peer id" };
  if (peerId === session.account.id) return { kind: "self_send_rejected" };

  const { slug, payment_instructions } = await readPrimaryBusinessFor(
    session.account.id,
  );
  // Parse via the same codec used by the setup form so the share send
  // emits structured fields the recipient-side renderer can read, not
  // just an opaque filename chip. Legacy free-form text surfaces as
  // `extra` and still ships readable content.
  const fields = decodeBankDetails(payment_instructions);
  if (!slug || !bankDetailsAreConfigured(fields)) {
    return { kind: "not_configured" };
  }

  let conversation;
  try {
    conversation = await peerConversationService.getOrCreatePeerConversationAsSender(
      session.account.id,
      peerId,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("recipient_contacts_only")) {
      return { kind: "recipient_blocked", reason: "recipient_contacts_only" };
    }
    return { kind: "error", message: msg };
  }

  const handle = handleLabel(session);
  const profileUrl = `${APP_BASE_URL}/nex-native/${slug}`;
  const previewText = renderBankDetailsPreview(fields);

  // Build a readable multi-line filename within the 256-char budget
  // (peer-message-service enforces filename ≤ 256). This is what the
  // existing document chip renders today when the recipient-side
  // bank-card renderer isn't present · so even on legacy clients the
  // peer sees the actual bank text, not an inaccessible filename.
  let chipText = `Bank details · @${handle}\n${previewText}`;
  if (chipText.length > 250) {
    chipText = chipText.slice(0, 247) + "…";
  }

  try {
    const row = await peerMessageService.sendPeerMessage({
      conversation_id: conversation.id,
      sender_account_id: session.account.id,
      body: "",
      attachment_type: "document",
      attachment_url: profileUrl,
      attachment_meta: {
        filename: chipText,
        mime: "text/vnd.nex-bank-details",
        size_bytes: Buffer.byteLength(previewText, "utf8"),
        // Structured snapshot · lets the recipient-side renderer show
        // a proper bank-card bubble (minimal renderer) + is independent
        // of the filename chip truncation above.
        bank_details: {
          from_handle: handle,
          bank_name: fields.bank_name,
          account_holder: fields.account_holder,
          account_number: fields.account_number,
          extra: fields.extra,
        },
      },
    });
    return { kind: "ok", messageId: row.id };
  } catch (e) {
    return {
      kind: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
