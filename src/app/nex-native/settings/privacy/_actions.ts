// src/app/nex-native/settings/privacy/_actions.ts
//
// R10 Stage 5 · Privacy settings · server actions · 2026-10-15.
//
// Scoped actions · session-check happens here · delegates persistence
// to the sealed privacy-preferences-service.

"use server";

import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  updatePrivacyPreferences,
  type PrivacyPreferences,
  type ProfileVisibility,
  type WhoCanMessage,
} from "@/lib/nex-native/privacy-preferences-service";

export type UpdatePrivacyPrefResult =
  | { ok: true; prefs: PrivacyPreferences }
  | {
      ok: false;
      reason: "unauthorized" | "invalid_request" | "service_error";
      message?: string;
    };

const PROFILE_VISIBILITY_VALUES: readonly ProfileVisibility[] = [
  "public",
  "contacts",
  "private",
];
const WHO_CAN_MESSAGE_VALUES: readonly WhoCanMessage[] = [
  "everyone",
  "contacts",
];

function parseProfileVisibility(
  raw: FormDataEntryValue | null,
): ProfileVisibility | null {
  if (typeof raw !== "string") return null;
  return (PROFILE_VISIBILITY_VALUES as readonly string[]).includes(raw)
    ? (raw as ProfileVisibility)
    : null;
}

function parseWhoCanMessage(
  raw: FormDataEntryValue | null,
): WhoCanMessage | null {
  if (typeof raw !== "string") return null;
  return (WHO_CAN_MESSAGE_VALUES as readonly string[]).includes(raw)
    ? (raw as WhoCanMessage)
    : null;
}

export async function updateProfileVisibilityAction(
  formData: FormData,
): Promise<UpdatePrivacyPrefResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, reason: "unauthorized" };

  const value = parseProfileVisibility(formData.get("value"));
  if (!value) return { ok: false, reason: "invalid_request" };

  try {
    const prefs = await updatePrivacyPreferences(session.account.id, {
      profile_visibility: value,
    });
    revalidatePath("/nex-native/settings/privacy");
    return { ok: true, prefs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "service_error", message };
  }
}

export async function updateWhoCanMessageAction(
  formData: FormData,
): Promise<UpdatePrivacyPrefResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, reason: "unauthorized" };

  const value = parseWhoCanMessage(formData.get("value"));
  if (!value) return { ok: false, reason: "invalid_request" };

  try {
    const prefs = await updatePrivacyPreferences(session.account.id, {
      who_can_message: value,
    });
    revalidatePath("/nex-native/settings/privacy");
    return { ok: true, prefs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "service_error", message };
  }
}
