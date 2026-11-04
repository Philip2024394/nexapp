"use server";

// src/app/nex-native/free-chat/_shop-share-pending-action.ts
//
// Owner-authorised 2026-11-05 later-same-day iter 14 · stub share
// action for the /free-chat ShopDrawer.
//
// /free-chat is the viewer's home-chat surface · there's no peer to
// send a product to. When the owner shares a product from here, we
// stash the product id in a short-lived cookie and bounce them to
// /nex-native/contacts to pick a recipient. Contacts picker (future
// work) reads the cookie on tap · routes to /chat/peer/<destId>
// with the product pre-queued in the composer's hidden pending-
// product input.
//
// This commit ships only the STASH side · the contacts-picker
// consumption is a separate authorised ship. Until it lands, the
// viewer lands on /contacts and manually opens a chat.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const PENDING_COOKIE = "nex-shop-share-pending-product-id";

export async function freeChatShopSharePendingAction(
  formData: FormData,
): Promise<void> {
  const productId = formData.get("product_id");
  if (typeof productId === "string" && productId.length > 0) {
    const jar = await cookies();
    jar.set(PENDING_COOKIE, productId, {
      path: "/",
      maxAge: 60 * 15, // 15 minutes · short-lived intent, not state.
      sameSite: "lax",
      httpOnly: false, // consumable by client contacts picker
    });
  }
  redirect("/nex-native/contacts?share=pending");
}
