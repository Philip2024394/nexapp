"use server";

// src/app/nex-native/settings/chat-settings/_actions.ts
//
// NEX Chat settings · server actions · owner-authorised 2026-11-07.
// -----------------------------------------------------------------------------
// Thin wrappers around the sealed chat-preferences-service. Every
// action enforces session → account match before writing. Coming-soon
// controls do NOT have actions here · they're inert in the UI until a
// backend lands.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  updateChatPreferences,
  type VisibilityLevel,
} from "@/lib/nex-native/chat-preferences-service";

type ReturnPath = "/nex-native/settings/chat-settings";
const RETURN_PATH: ReturnPath = "/nex-native/settings/chat-settings";

function redirectBack(status: string): never {
  const qs = new URLSearchParams({ s: status });
  redirect(`${RETURN_PATH}?${qs.toString()}`);
}

async function requireSession(): Promise<{ accountId: string }> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/settings/chat-settings");
  }
  return { accountId: session.account.id };
}

/** Toggle read receipts. Reciprocal · OFF suppresses the signal both ways. */
export async function setReadReceiptsAction(formData: FormData): Promise<never> {
  const { accountId } = await requireSession();
  const raw = String(formData.get("enabled") ?? "");
  const next = raw === "on" || raw === "true" || raw === "1";
  try {
    await updateChatPreferences(accountId, { read_receipts_enabled: next });
  } catch (e) {
    redirectBack(`err_${(e as Error).name ?? "update"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack(`ok_receipts_${next ? "on" : "off"}`);
}

/** Toggle typing indicator. 1:1 only in this release (groups deferred). */
export async function setTypingIndicatorAction(formData: FormData): Promise<never> {
  const { accountId } = await requireSession();
  const raw = String(formData.get("enabled") ?? "");
  const next = raw === "on" || raw === "true" || raw === "1";
  try {
    await updateChatPreferences(accountId, { typing_indicator_enabled: next });
  } catch (e) {
    redirectBack(`err_${(e as Error).name ?? "update"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack(`ok_typing_${next ? "on" : "off"}`);
}

/** Set last-seen visibility · everyone / contacts / nobody. */
export async function setLastSeenVisibilityAction(formData: FormData): Promise<never> {
  const { accountId } = await requireSession();
  const raw = String(formData.get("value") ?? "");
  const value = narrowVisibility(raw);
  try {
    await updateChatPreferences(accountId, { last_seen_visibility: value });
  } catch (e) {
    redirectBack(`err_${(e as Error).name ?? "update"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack(`ok_lastseen_${value}`);
}

/** Set online-status visibility · everyone / contacts / nobody. */
export async function setOnlineStatusVisibilityAction(formData: FormData): Promise<never> {
  const { accountId } = await requireSession();
  const raw = String(formData.get("value") ?? "");
  const value = narrowVisibility(raw);
  try {
    await updateChatPreferences(accountId, { online_status_visibility: value });
  } catch (e) {
    redirectBack(`err_${(e as Error).name ?? "update"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack(`ok_online_${value}`);
}

/** Reset Section 1 (visibility) to sealed defaults · receipts+typing ON,
 *  last-seen=nobody, online=nobody per DEFAULT_CHAT_PREFS. */
export async function resetVisibilitySectionAction(): Promise<never> {
  const { accountId } = await requireSession();
  try {
    await updateChatPreferences(accountId, {
      read_receipts_enabled: true,
      typing_indicator_enabled: true,
      last_seen_visibility: "nobody",
      online_status_visibility: "nobody",
    });
  } catch (e) {
    redirectBack(`err_${(e as Error).name ?? "reset"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack("ok_reset_visibility");
}

function narrowVisibility(raw: string): VisibilityLevel {
  if (raw === "everyone" || raw === "contacts" || raw === "nobody") return raw;
  return "nobody";
}
