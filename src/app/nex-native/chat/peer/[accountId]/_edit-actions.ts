"use server";

// src/app/nex-native/chat/peer/[accountId]/_edit-actions.ts
//
// Owner-authorised 2026-11-05 later-same-day iter 10 · server action
// surface for editing a sent peer message.
//
// Called directly from the BubbleActionMenuClient's edit modal (client
// → server action via fn-reference prop). Enforces viewer identity
// server-side via resolveSessionWithDevOverride · never trusts the
// client's claim of senderAccountId.
//
// Depends on migration 279 (nex-supabase/migrations/279_peer_message_
// edit.sql) · the service maps column-missing errors to a friendly
// "schema-unapplied" reason so the UI can degrade gracefully until
// the migration is approved + applied.

import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  editPeerMessage,
  type EditPeerMessageResult,
} from "@/lib/nex-native/peer-message-service";
import { revalidatePath } from "next/cache";

export async function editPeerMessageAction(
  messageId: string,
  newBody: string,
): Promise<EditPeerMessageResult> {
  const session = await resolveSessionWithDevOverride().catch(() => null);
  if (!session) return { ok: false, reason: "not-sender" };

  const result = await editPeerMessage({
    messageId,
    senderAccountId: session.account.id,
    newBody,
  });
  if (result.ok) {
    // Revalidate any peer chat path the viewer might see the edit on.
    // Blanket invalidation is fine here · peer chat is force-dynamic.
    revalidatePath("/nex-native/chat/peer", "layout");
  }
  return result;
}
