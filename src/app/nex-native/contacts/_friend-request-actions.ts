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
