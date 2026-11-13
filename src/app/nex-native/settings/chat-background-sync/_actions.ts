"use server";

// src/app/nex-native/settings/chat-background-sync/_actions.ts
// Owner-sealed 2026-11-07 · Section 7 bg sync toggle actions.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  resetChatBackgroundSync,
  updateChatViewPreferences,
} from "@/lib/nex-native/chat-view-preferences-service";

const RETURN_PATH = "/nex-native/settings/chat-background-sync";

function redirectBack(status: string): never {
  const qs = new URLSearchParams({ s: status });
  redirect(`${RETURN_PATH}?${qs.toString()}`);
}

export async function setChatBgFromShopCoverAction(
  formData: FormData,
): Promise<never> {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in?next=" + RETURN_PATH);
  const raw = String(formData.get("enabled") ?? "");
  const on = raw === "on" || raw === "true" || raw === "1";
  try {
    await updateChatViewPreferences(session.account.id, {
      chat_bg_from_shop_cover: on,
    });
  } catch (e) {
    const msg = (e as Error).message ?? "update";
    if (/migration 285/i.test(msg)) redirectBack("err_migration_285_unapplied");
    redirectBack(`err_${(e as Error).name ?? "update"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack(`ok_chat_bg_${on ? "on" : "off"}`);
}

export async function setShopCoverFromChatThemeAction(
  formData: FormData,
): Promise<never> {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in?next=" + RETURN_PATH);
  const raw = String(formData.get("enabled") ?? "");
  const on = raw === "on" || raw === "true" || raw === "1";
  try {
    await updateChatViewPreferences(session.account.id, {
      shop_cover_from_chat_theme: on,
    });
  } catch (e) {
    const msg = (e as Error).message ?? "update";
    if (/migration 285/i.test(msg)) redirectBack("err_migration_285_unapplied");
    redirectBack(`err_${(e as Error).name ?? "update"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack(`ok_shop_cover_${on ? "on" : "off"}`);
}

export async function resetChatBackgroundSyncAction(): Promise<never> {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in?next=" + RETURN_PATH);
  try {
    await resetChatBackgroundSync(session.account.id);
  } catch (e) {
    const msg = (e as Error).message ?? "reset";
    if (/migration 285/i.test(msg)) redirectBack("err_migration_285_unapplied");
    redirectBack(`err_${(e as Error).name ?? "reset"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack("ok_reset");
}
