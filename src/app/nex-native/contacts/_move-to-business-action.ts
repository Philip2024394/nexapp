"use server";

// src/app/nex-native/contacts/_move-to-business-action.ts
//
// Demote-friend-to-business action · the symmetric counterpart of
// saveAsFriendAction.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// When the owner decides a "saved as friend" customer should go back
// to the Business bucket (relationship cooled, they're a buyer again
// not a friend), this flips the canonical nex_friend_edge row's
// status to 'declined'. The customer-shop conversation history is
// untouched · only the friend categorisation changes.
//
// Idempotent · calling on a non-existent / already-declined edge is
// a soft success. Self-action blocked (you can't demote yourself).

import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { canonicalPair } from "@/lib/nex-native/friend-service";
import { revalidatePath } from "next/cache";

export type MoveToBusinessResult =
  | { ok: true }
  | { ok: false; error: string };

export async function moveToBusinessAction(
  contactAccountId: string,
): Promise<MoveToBusinessResult> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, error: "not-authenticated" };
  if (session.account.id === contactAccountId) {
    return { ok: false, error: "cannot-demote-self" };
  }
  try {
    const [a, b] = canonicalPair(session.account.id, contactAccountId);
    // Flip the edge to declined · idempotent on edges that don't
    // exist (zero rows affected · no error · soft success).
    const { error } = await nexSupabaseAdmin
      .from("nex_friend_edge")
      .update({
        status: "declined",
        updated_at: new Date().toISOString(),
      })
      .eq("a_account_id", a)
      .eq("b_account_id", b)
      .in("status", ["pending", "accepted"]);
    if (error) {
      return { ok: false, error: error.message };
    }
    revalidatePath("/nex-native/contacts");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
