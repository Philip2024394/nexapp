"use server";

// src/app/nex-native/[businessSlug]/_open-shop-chat-action.ts
//
// Owner-sealed 2026-11-13 · ShopChatFab server action · turns the
// floating 💬 button into the entry point for the business-scoped
// shop conversation (nex_conversation keyed by business_id).
//
// Flow:
//   1. Resolve viewer session (dev-override resolver per sealed
//      2026-11-12 parity rule). Signed-out → redirect to sign-in
//      with ?next=/<slug>?open-chat=1 (sealed return-flow already
//      handled by the shop page).
//   2. Resolve business from slug · reject if missing.
//   3. Refuse opening a shop chat with your OWN shop (nothing to
//      talk about).
//   4. getOrCreateBusinessConversation(customer, business, owner).
//   5. router.push /nex-native/conversations/<conversationId>.
//
// Preserves the sealed peer chat untouched · personal chats stay at
// /chat/peer/<accountId> · only the shop FAB flows here.

import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getBusinessBySlug } from "@/lib/nex-native/business-service";
import { getOrCreateBusinessConversation } from "@/lib/nex-native/business-message-service";

export async function openShopChatAction(
  slug: string,
): Promise<void> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(
      `/nex-native/sign-in?next=${encodeURIComponent(
        `/nex-native/${slug}?open-chat=1`,
      )}`,
    );
  }
  const business = await getBusinessBySlug(slug);
  if (!business) {
    redirect("/nex-native/contacts?e=shop_not_found");
  }
  if (session.account.id === business.owner_account_id) {
    // Owner viewing their own shop · drop them into their orders /
    // customers overview instead of a self-chat.
    redirect("/nex-native/manage/orders");
  }
  const conversationId = await getOrCreateBusinessConversation(
    session.account.id,
    business.id,
    business.owner_account_id,
  );
  redirect(`/nex-native/conversations/${conversationId}`);
}
