"use server";

// src/app/nex-native/contacts/_picker-actions.ts
//
// Server actions for the Contact-picker sheet · owner-authorised
// 2026-10-23 wiring pass. Keeps the picker's data layer self-contained
// so the sealed shared _actions.ts stays untouched.
//
// Two actions:
//   · fetchContactPickerRowsAction()
//     Resolves the current session + returns the viewer's picker rows.
//     Returns an empty array for unauthenticated callers so the UI
//     can render an honest "sign in to see your contacts" fallback
//     without surfacing an error.
//
//   · startPeerChatWithContactAction(inviteeId)
//     Resolves session, calls getOrCreatePeerConversationAsSender
//     (which already enforces the recipient's who_can_message gate
//     sealed R10 Stage 5), and returns a routing payload for the
//     client to navigate to /nex-native/chat/peer/[inviteeId].
//     Never throws for the "recipient prefers contacts-only + viewer
//     is not a friend" case · returns { ok:false, reason } so the UI
//     can show a localised explanation.

// Owner fix 2026-11-05 · dev-impersonation parity · the enclosing page
// uses resolveSessionWithDevOverride so the picker action must honour
// the same NEX_DEV_IMPERSONATE_HANDLE path · otherwise founder (nex-99901)
// sees "Sign in to see your NEX contacts" on their OWN picker.
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  listContactPickerRowsForViewer,
  type ContactPickerRow,
} from "@/lib/nex-native/contact-picker-service";
import { getOrCreatePeerConversationAsSender } from "@/lib/nex-native/peer-conversation-service";

export interface FetchContactPickerRowsResult {
  readonly ok: boolean;
  readonly reason: null | "unauthenticated" | "service_error";
  readonly rows: ReadonlyArray<ContactPickerRow>;
}

export async function fetchContactPickerRowsAction(): Promise<FetchContactPickerRowsResult> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return { ok: false, reason: "unauthenticated", rows: [] };
  }
  try {
    const rows = await listContactPickerRowsForViewer(session.account.id);
    return { ok: true, reason: null, rows };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("fetchContactPickerRowsAction · service error:", err);
    return { ok: false, reason: "service_error", rows: [] };
  }
}

export interface StartPeerChatResult {
  readonly ok: boolean;
  readonly reason:
    | null
    | "unauthenticated"
    | "self_invite"
    | "recipient_contacts_only"
    | "service_error";
  readonly conversationId: string | null;
  readonly redirectTo: string | null;
}

export async function startPeerChatWithContactAction(
  inviteeId: string,
): Promise<StartPeerChatResult> {
  if (typeof inviteeId !== "string" || inviteeId.length === 0) {
    return {
      ok: false,
      reason: "service_error",
      conversationId: null,
      redirectTo: null,
    };
  }
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return {
      ok: false,
      reason: "unauthenticated",
      conversationId: null,
      redirectTo: null,
    };
  }
  if (session.account.id === inviteeId) {
    return {
      ok: false,
      reason: "self_invite",
      conversationId: null,
      redirectTo: null,
    };
  }
  try {
    const conv = await getOrCreatePeerConversationAsSender(
      session.account.id,
      inviteeId,
    );
    return {
      ok: true,
      reason: null,
      conversationId: conv.id,
      redirectTo: `/nex-native/chat/peer/${inviteeId}`,
    };
  } catch (err) {
    const msg = (err as Error).message ?? "";
    // getOrCreatePeerConversationAsSender surfaces the privacy-gate
    // reason inside its error message · map it to a UI-friendly code
    // without leaking service internals.
    if (msg.includes("recipient_contacts_only")) {
      return {
        ok: false,
        reason: "recipient_contacts_only",
        conversationId: null,
        redirectTo: null,
      };
    }
    // eslint-disable-next-line no-console
    console.warn("startPeerChatWithContactAction · service error:", err);
    return {
      ok: false,
      reason: "service_error",
      conversationId: null,
      redirectTo: null,
    };
  }
}
