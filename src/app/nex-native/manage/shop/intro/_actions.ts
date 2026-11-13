"use server";

// src/app/nex-native/manage/shop/intro/_actions.ts
//
// NEX Shop · intro-message server action · owner-sealed 2026-11-13.
// -----------------------------------------------------------------------------
// Persists nex_business.shop_intro_message for the authenticated owner's
// first business. Empty string clears the custom value (falls back to the
// default template). Uses `resolveSessionWithDevOverride` on BOTH the page
// AND the action per the sealed 2026-11-12 dev-impersonation parity rule.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as businessService from "@/lib/nex-native/business-service";
import { SHOP_INTRO_MESSAGE_MAX } from "@/lib/nex-native/business-service";

export async function saveShopIntroMessageAction(
  formData: FormData,
): Promise<void> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/shop/intro");
  }

  const raw = String(formData.get("intro") ?? "");
  // Clamp at the DB CHECK · if the viewer somehow submits a longer
  // string we silently truncate rather than 500 · the UI textarea
  // mirrors this limit so this is a defence-in-depth clamp.
  const bounded = raw.length > SHOP_INTRO_MESSAGE_MAX
    ? raw.slice(0, SHOP_INTRO_MESSAGE_MAX)
    : raw;

  const businesses = await businessService.listBusinessesByOwner(
    session.account.id,
  );
  const business = businesses[0];
  if (!business) {
    redirect("/nex-native/manage/shop/setup");
  }

  try {
    await businessService.updateShopIntroMessage(business.id, bounded);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const qs = new URLSearchParams({ e: "save_failed", m: message });
    redirect(`/nex-native/manage/shop/intro?${qs.toString()}`);
  }

  revalidatePath("/nex-native/manage/shop/intro");
  revalidatePath(`/nex-native/${business.slug}`);
  redirect("/nex-native/manage/shop/intro?s=saved");
}
