// src/app/nex-native/settings/notifications/_actions.ts
//
// NEX Settings · Notifications · server actions · Stage 3 sealed
// 2026-10-15.
//
// Scoped actions file for the Notifications settings page. Isolated
// from the top-level `src/app/nex-native/_actions.ts` so this Settings
// batch does not touch unrelated dirty work in that file (same pattern
// as Stage 1 Blocked contacts).
//
// Authorisation lives here (session check) · the preferences service
// trusts callers to pass the correct account_id. Form-posted booleans
// are explicitly re-derived from `session.account.id` to prevent a
// malicious client from passing an attacker-controlled account_id.

"use server";

import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  updateNotificationPrefs,
  type NotificationCategory,
  type NotificationPrefs,
} from "@/lib/nex-native/notification-preferences-service";

export type UpdatePrefResult =
  | { ok: true; prefs: NotificationPrefs }
  | {
      ok: false;
      reason: "unauthorized" | "invalid_request" | "service_error";
      message?: string;
    };

const KNOWN_CATEGORIES: readonly NotificationCategory[] = [
  "message",
  "call",
  "reaction",
  "mention",
  "marketing",
];

function parseCategory(raw: FormDataEntryValue | null): NotificationCategory | null {
  if (typeof raw !== "string") return null;
  return (KNOWN_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as NotificationCategory)
    : null;
}

function parseBoolean(raw: FormDataEntryValue | null): boolean | null {
  if (typeof raw !== "string") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

function categoryFieldKey(
  category: NotificationCategory,
): keyof NotificationPrefs {
  switch (category) {
    case "message":
      return "message_enabled";
    case "call":
      return "call_enabled";
    case "reaction":
      return "reaction_enabled";
    case "mention":
      return "mention_enabled";
    case "marketing":
      return "marketing_enabled";
  }
}

/**
 * Toggle one notification category for the current session's account.
 * The target account_id is ALWAYS session.account.id · never form data.
 */
export async function updateNotificationPrefAction(
  formData: FormData,
): Promise<UpdatePrefResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return { ok: false, reason: "unauthorized" };
  }

  const category = parseCategory(formData.get("category"));
  const enabled = parseBoolean(formData.get("enabled"));
  if (!category || enabled === null) {
    return { ok: false, reason: "invalid_request" };
  }

  const patch: Partial<NotificationPrefs> = {
    [categoryFieldKey(category)]: enabled,
  };

  try {
    const prefs = await updateNotificationPrefs(session.account.id, patch);
    revalidatePath("/nex-native/settings/notifications");
    return { ok: true, prefs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "service_error", message };
  }
}
