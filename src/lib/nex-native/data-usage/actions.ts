// src/app/nex-native/settings/data-usage/_actions.ts
//
// R14 Stage 6 · Data-usage settings · server actions · 2026-10-15.

"use server";

import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  getDataUsagePreferencesSafe,
  updateDataUsagePreferences,
  DEFAULT_DATA_USAGE_PREFS,
  type DataUsagePreferences,
  type AutoDownloadPolicy,
  type UploadQuality,
} from "@/lib/nex-native/data-usage-preferences-service";

export type UpdateDataUsageResult =
  | { ok: true; prefs: DataUsagePreferences }
  | {
      ok: false;
      reason: "unauthorized" | "invalid_request" | "service_error";
      message?: string;
    };

type DownloadField =
  | "auto_download_images"
  | "auto_download_videos"
  | "auto_download_audio";

const DOWNLOAD_FIELDS: readonly DownloadField[] = [
  "auto_download_images",
  "auto_download_videos",
  "auto_download_audio",
];
const POLICY_VALUES: readonly AutoDownloadPolicy[] = [
  "always",
  "wifi_only",
  "never",
];
const QUALITY_VALUES: readonly UploadQuality[] = ["standard", "hd"];

function parseField(raw: FormDataEntryValue | null): DownloadField | null {
  if (typeof raw !== "string") return null;
  return (DOWNLOAD_FIELDS as readonly string[]).includes(raw)
    ? (raw as DownloadField)
    : null;
}

function parsePolicy(
  raw: FormDataEntryValue | null,
): AutoDownloadPolicy | null {
  if (typeof raw !== "string") return null;
  return (POLICY_VALUES as readonly string[]).includes(raw)
    ? (raw as AutoDownloadPolicy)
    : null;
}

function parseQuality(raw: FormDataEntryValue | null): UploadQuality | null {
  if (typeof raw !== "string") return null;
  return (QUALITY_VALUES as readonly string[]).includes(raw)
    ? (raw as UploadQuality)
    : null;
}

export async function updateAutoDownloadAction(
  formData: FormData,
): Promise<UpdateDataUsageResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, reason: "unauthorized" };

  const field = parseField(formData.get("field"));
  const value = parsePolicy(formData.get("value"));
  if (!field || !value) return { ok: false, reason: "invalid_request" };

  try {
    const prefs = await updateDataUsagePreferences(session.account.id, {
      [field]: value,
    } as Partial<DataUsagePreferences>);
    revalidatePath("/nex-native/settings/data-usage");
    return { ok: true, prefs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "service_error", message };
  }
}

export async function updateUploadQualityAction(
  formData: FormData,
): Promise<UpdateDataUsageResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, reason: "unauthorized" };

  const value = parseQuality(formData.get("value"));
  if (!value) return { ok: false, reason: "invalid_request" };

  try {
    const prefs = await updateDataUsagePreferences(session.account.id, {
      upload_quality: value,
    });
    revalidatePath("/nex-native/settings/data-usage");
    return { ok: true, prefs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "service_error", message };
  }
}

/**
 * R14 Stage 6b (code-only · 2026-10-16) · lightweight read action for
 * client components that need to apply the viewer's data-usage prefs
 * on upload (encrypted-attachment-upload compresses to the viewer's
 * `upload_quality` tier). Fail-safe · returns the sealed defaults
 * when the session is absent or when migration 201 is not yet applied
 * (DEFAULT_DATA_USAGE_PREFS.upload_quality === "standard" matches the
 * sealed service default). Never throws · callers can treat a null
 * `ok` as "assume standard" and still get safe behaviour.
 */
export async function getMyDataUsagePrefsAction(): Promise<{
  ok: true;
  prefs: DataUsagePreferences;
  signed_in: boolean;
}> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return { ok: true, prefs: DEFAULT_DATA_USAGE_PREFS, signed_in: false };
  }
  const prefs = await getDataUsagePreferencesSafe(session.account.id);
  return { ok: true, prefs, signed_in: true };
}
