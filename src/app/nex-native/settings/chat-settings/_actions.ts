// src/app/nex-native/settings/chat-settings/_actions.ts
//
// R9 Stage 4 · Chat settings · server actions · 2026-10-15.
//
// Scoped actions · isolated from the top-level `src/app/nex-native/
// _actions.ts` (same discipline as Stage 1 Blocked + Stage 3
// Notifications). Session authentication happens here · the sealed
// chat-preferences-service trusts the caller to pass the correct
// account_id.

"use server";

import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  updateChatPreferences,
  type ChatPreferences,
  type VisibilityLevel,
} from "@/lib/nex-native/chat-preferences-service";

export type UpdateChatPrefResult =
  | { ok: true; prefs: ChatPreferences }
  | {
      ok: false;
      reason: "unauthorized" | "invalid_request" | "service_error";
      message?: string;
    };

type BooleanField = "read_receipts_enabled" | "typing_indicator_enabled";
type VisibilityField = "last_seen_visibility" | "online_status_visibility";

const BOOLEAN_FIELDS: readonly BooleanField[] = [
  "read_receipts_enabled",
  "typing_indicator_enabled",
];
const VISIBILITY_FIELDS: readonly VisibilityField[] = [
  "last_seen_visibility",
  "online_status_visibility",
];
const VISIBILITY_VALUES: readonly VisibilityLevel[] = [
  "everyone",
  "contacts",
  "nobody",
];

function parseBooleanField(raw: FormDataEntryValue | null): BooleanField | null {
  if (typeof raw !== "string") return null;
  return (BOOLEAN_FIELDS as readonly string[]).includes(raw)
    ? (raw as BooleanField)
    : null;
}

function parseVisibilityField(
  raw: FormDataEntryValue | null,
): VisibilityField | null {
  if (typeof raw !== "string") return null;
  return (VISIBILITY_FIELDS as readonly string[]).includes(raw)
    ? (raw as VisibilityField)
    : null;
}

function parseBoolean(raw: FormDataEntryValue | null): boolean | null {
  if (typeof raw !== "string") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

function parseVisibilityLevel(
  raw: FormDataEntryValue | null,
): VisibilityLevel | null {
  if (typeof raw !== "string") return null;
  return (VISIBILITY_VALUES as readonly string[]).includes(raw)
    ? (raw as VisibilityLevel)
    : null;
}

export async function updateChatBooleanAction(
  formData: FormData,
): Promise<UpdateChatPrefResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, reason: "unauthorized" };

  const field = parseBooleanField(formData.get("field"));
  const value = parseBoolean(formData.get("value"));
  if (!field || value === null) {
    return { ok: false, reason: "invalid_request" };
  }

  try {
    const prefs = await updateChatPreferences(session.account.id, {
      [field]: value,
    } as Partial<ChatPreferences>);
    revalidatePath("/nex-native/settings/chat-settings");
    return { ok: true, prefs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "service_error", message };
  }
}

export async function updateChatVisibilityAction(
  formData: FormData,
): Promise<UpdateChatPrefResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, reason: "unauthorized" };

  const field = parseVisibilityField(formData.get("field"));
  const value = parseVisibilityLevel(formData.get("value"));
  if (!field || !value) {
    return { ok: false, reason: "invalid_request" };
  }

  try {
    const prefs = await updateChatPreferences(session.account.id, {
      [field]: value,
    } as Partial<ChatPreferences>);
    revalidatePath("/nex-native/settings/chat-settings");
    return { ok: true, prefs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "service_error", message };
  }
}
