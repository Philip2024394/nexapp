"use server";

// src/app/nex-native/settings/chat-font/_actions.ts
// Owner-sealed 2026-11-07 · Section 6 font picker actions.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  CHAT_FONT_FAMILIES,
  CHAT_FONT_SIZES,
  resetChatFont,
  updateChatViewPreferences,
  type ChatFontFamily,
  type ChatFontSize,
} from "@/lib/nex-native/chat-view-preferences-service";

const RETURN_PATH = "/nex-native/settings/chat-font";

function redirectBack(status: string): never {
  const qs = new URLSearchParams({ s: status });
  redirect(`${RETURN_PATH}?${qs.toString()}`);
}

function narrowFamily(raw: string): ChatFontFamily | null {
  for (const f of CHAT_FONT_FAMILIES) if (f.value === raw) return f.value;
  return null;
}
function narrowSize(raw: string): ChatFontSize | null {
  for (const f of CHAT_FONT_SIZES) if (f.value === raw) return f.value;
  return null;
}

export async function setChatFontFamilyAction(formData: FormData): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in?next=" + RETURN_PATH);
  const value = narrowFamily(String(formData.get("value") ?? ""));
  if (!value) redirectBack("err_bad_value");
  try {
    await updateChatViewPreferences(session.account.id, { chat_font_family: value });
  } catch (e) {
    const msg = (e as Error).message ?? "update";
    if (/migration 285/i.test(msg)) redirectBack("err_migration_285_unapplied");
    redirectBack(`err_${(e as Error).name ?? "update"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack(`ok_family_${value}`);
}

export async function setChatFontSizeAction(formData: FormData): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in?next=" + RETURN_PATH);
  const value = narrowSize(String(formData.get("value") ?? ""));
  if (!value) redirectBack("err_bad_value");
  try {
    await updateChatViewPreferences(session.account.id, { chat_font_size: value });
  } catch (e) {
    const msg = (e as Error).message ?? "update";
    if (/migration 285/i.test(msg)) redirectBack("err_migration_285_unapplied");
    redirectBack(`err_${(e as Error).name ?? "update"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack(`ok_size_${value}`);
}

export async function resetChatFontAction(): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in?next=" + RETURN_PATH);
  try {
    await resetChatFont(session.account.id);
  } catch (e) {
    const msg = (e as Error).message ?? "reset";
    if (/migration 285/i.test(msg)) redirectBack("err_migration_285_unapplied");
    redirectBack(`err_${(e as Error).name ?? "reset"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack("ok_reset");
}
