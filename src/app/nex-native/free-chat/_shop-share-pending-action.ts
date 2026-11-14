"use server";

// src/app/nex-native/free-chat/_shop-share-pending-action.ts
//
// Owner directive 2026-11-14 · pending_product share-to-chat flow
// retired. The prior cookie-stash + /contacts?share=pending redirect
// (2026-11-05 iter 14) is removed. The /free-chat ShopDrawer still
// mounts the share form (the drawer's shareAction prop is required),
// but tapping a product card now simply bounces the viewer to
// /contacts with no product carry-over.

import { redirect } from "next/navigation";

export async function freeChatShopSharePendingAction(
  _formData: FormData,
): Promise<void> {
  redirect("/nex-native/contacts");
}
