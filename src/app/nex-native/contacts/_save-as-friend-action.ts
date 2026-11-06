"use server";

// src/app/nex-native/contacts/_save-as-friend-action.ts
//
// Save-as-friend action · promote a business contact to personal.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Context: when an owner messages with a customer through their shop,
// that customer sits in the "business contacts" bucket (derived from
// nex_conversation_participant.side='customer'). If the owner decides
// the person is also a friend, this action promotes them by sending a
// friend invite (sealed nex_friend_edge path · canonical a<b pair ·
// idempotent on existing edges).
//
// The customer appears in both buckets afterwards:
//   · Business contact history keeps the shop conversation record
//   · Friend edge turns their contacts card into a Personal / All row
//
// If the customer accepts the invite via the existing invite flow,
// the edge flips pending → accepted and the friendship is mutual.
// Owner can walk this back via respondToInvite(actor=self, declined)
// — out of scope for this action.

import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as friendService from "@/lib/nex-native/friend-service";
import { revalidatePath } from "next/cache";

export type SaveAsFriendResult =
  | { ok: true; status: "pending" | "accepted" }
  | { ok: false; error: string };

export async function saveAsFriendAction(
  contactAccountId: string,
): Promise<SaveAsFriendResult> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, error: "not-authenticated" };
  if (session.account.id === contactAccountId) {
    return { ok: false, error: "cannot-invite-self" };
  }
  try {
    const edge = await friendService.sendInvite(
      session.account.id,
      contactAccountId,
    );
    revalidatePath("/nex-native/contacts");
    return {
      ok: true,
      status: edge.status === "accepted" ? "accepted" : "pending",
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
