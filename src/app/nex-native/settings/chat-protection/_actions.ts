"use server";

// src/app/nex-native/settings/chat-protection/_actions.ts
// Owner-sealed 2026-11-07 · screenshot + copy protection toggle action.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  resetChatProtection,
  updateChatViewPreferences,
} from "@/lib/nex-native/chat-view-preferences-service";

const RETURN_PATH = "/nex-native/settings/chat-protection";

function redirectBack(status: string): never {
  const qs = new URLSearchParams({ s: status });
  redirect(`${RETURN_PATH}?${qs.toString()}`);
}

export async function setChatProtectionAction(formData: FormData): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in?next=" + RETURN_PATH);
  const raw = String(formData.get("enabled") ?? "");
  const on = raw === "on" || raw === "true" || raw === "1";
  try {
    await updateChatViewPreferences(session.account.id, {
      screenshot_copy_protection_enabled: on,
    });
  } catch (e) {
    const msg = (e as Error).message ?? "update";
    if (/migration 285/i.test(msg)) redirectBack("err_migration_285_unapplied");
    redirectBack(`err_${(e as Error).name ?? "update"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack(`ok_${on ? "on" : "off"}`);
}

export async function resetChatProtectionAction(): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in?next=" + RETURN_PATH);
  try {
    await resetChatProtection(session.account.id);
  } catch (e) {
    const msg = (e as Error).message ?? "reset";
    if (/migration 285/i.test(msg)) redirectBack("err_migration_285_unapplied");
    redirectBack(`err_${(e as Error).name ?? "reset"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack("ok_reset");
}
