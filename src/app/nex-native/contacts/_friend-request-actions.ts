"use server";

// src/app/nex-native/contacts/_friend-request-actions.ts
//
// Owner directive 2026-10-23 · server actions for the Contacts page
// pending-invite flow. Backs:
//   · Connect-by-NEX-ID form → createFriendRequestAction
//   · Pending outbound bin icon → cancelFriendRequestAction
//   · Inbound Save Contact modal → acceptFriendRequestAction
//
// Session enforced at every action · unauthenticated calls reject.
// Errors propagate as plain Error (clients surface via try/catch).
// Cooldown surfaces as a shaped result rather than throw so the
// client can render "You can try again in Xh".

import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  createInvite,
  acceptInvite,
  cancelInvite,
  FriendRequestCooldownError,
  UnknownHandleError,
  type FriendRequestCategory,
} from "@/lib/nex-native/friend-request-service";
import {
  writeContactRequestNotification,
  writeContactAcceptedNotification,
} from "@/lib/nex-native/notifications/nex-notification-writer";

// ─── Shared result shape ────────────────────────────────────────

export type FriendRequestActionResult =
  | { readonly kind: "ok"; readonly requestId: string }
  | { readonly kind: "ok-noop" }
  | { readonly kind: "cooldown"; readonly msRemaining: number; readonly cooldownEndsAt: string }
  | { readonly kind: "unknown-handle"; readonly handle: string }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "error"; readonly message: string };

// ─── Create ─────────────────────────────────────────────────────

export async function createFriendRequestAction(
  rawHandle: string,
  rawIntroNote?: string | null,
): Promise<FriendRequestActionResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { kind: "unauthenticated" };

  try {
    const { row } = await createInvite(
      session.account.id,
      rawHandle,
      rawIntroNote ?? null,
    );
    // Durable in-app row · owner directive 2026-11-23b. The actionable
    // surface remains /nex-native/contacts (where the recipient can
    // accept/reject); this row is a pointer in the drawer so a
    // push-disabled recipient still sees the request arrive. Only
    // written when the recipient account exists (handle-known path);
    // handle-unknown invites have no account to notify.
    if (row.recipient_account_id) {
      void writeContactRequestNotification({
        recipient_account_id: row.recipient_account_id,
        request_id: row.id,
        sender_account_id: session.account.id,
        sender_handle_or_name:
          session.account.chosen_handle ||
          session.account.nex_handle ||
          session.account.display_name ||
          "Someone",
        intro_note_or_blank: (rawIntroNote ?? "").trim(),
      }).catch(() => {
        /* non-fatal · writer already logs */
      });
    }
    revalidatePath("/nex-native/contacts");
    return { kind: "ok", requestId: row.id };
  } catch (err) {
    if (err instanceof FriendRequestCooldownError) {
      return {
        kind: "cooldown",
        msRemaining: err.msRemaining,
        cooldownEndsAt: err.cooldownEndsAt,
      };
    }
    if (err instanceof UnknownHandleError) {
      return { kind: "unknown-handle", handle: rawHandle.trim().toLowerCase() };
    }
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Accept ─────────────────────────────────────────────────────

export async function acceptFriendRequestAction(
  requestId: string,
  category: FriendRequestCategory,
): Promise<FriendRequestActionResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { kind: "unauthenticated" };

  try {
    const row = await acceptInvite(requestId, session.account.id, category);
    // Durable in-app row for the ORIGINAL SENDER · owner directive
    // 2026-11-23b. Lets the sender see "they accepted" in the drawer
    // even when push is disabled.
    if (row.sender_account_id) {
      void writeContactAcceptedNotification({
        recipient_account_id: row.sender_account_id,
        request_id: row.id,
        accepter_account_id: session.account.id,
        accepter_handle_or_name:
          session.account.chosen_handle ||
          session.account.nex_handle ||
          session.account.display_name ||
          "Someone",
        category,
      }).catch(() => {
        /* non-fatal · writer already logs */
      });
    }
    revalidatePath("/nex-native/contacts");
    return { kind: "ok", requestId: row.id };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Cancel ─────────────────────────────────────────────────────

export async function cancelFriendRequestAction(
  requestId: string,
): Promise<FriendRequestActionResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { kind: "unauthenticated" };

  try {
    const row = await cancelInvite(requestId, session.account.id);
    revalidatePath("/nex-native/contacts");
    return { kind: "ok", requestId: row.id };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
