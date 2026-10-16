// src/lib/nex-native/data-usage-preferences-service.ts
//
// R14 Stage 6 · Data-usage preferences service · 2026-10-15.
// --------------------------------------------------------------
// Reads data-usage preferences from nex_account (columns added by
// migration 201 · NOT YET APPLIED). The sealed encrypted-attachment-
// upload + encrypted-receive paths consult this module via prop
// pass-through (client-side) to decide compression + fetch policy.
//
// Doctrine (owner-approved 2026-10-15):
//   · Permissive defaults match current product behaviour · do NOT
//     silently restrict existing users.
//   · Wi-Fi detection is BEST-EFFORT · the UI surfaces this
//     limitation honestly.
//   · Row absence or service error · returns SEALED DEFAULTS. Media
//     preferences are UX, not privacy · fail-closed to privacy-maximum
//     would silently break media delivery for users who expect it.
//     Same discipline-pattern as DEFAULT_PREFS in R8.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export type AutoDownloadPolicy = "always" | "wifi_only" | "never";
export type UploadQuality = "standard" | "hd";

export interface DataUsagePreferences {
  readonly auto_download_images: AutoDownloadPolicy;
  readonly auto_download_videos: AutoDownloadPolicy;
  readonly auto_download_audio: AutoDownloadPolicy;
  readonly upload_quality: UploadQuality;
}

export const DEFAULT_DATA_USAGE_PREFS: DataUsagePreferences = {
  auto_download_images: "always",
  auto_download_videos: "wifi_only",
  auto_download_audio: "always",
  upload_quality: "standard",
};

function narrowPolicy(raw: unknown): AutoDownloadPolicy {
  if (raw === "always" || raw === "wifi_only" || raw === "never") return raw;
  return "always";
}

function narrowQuality(raw: unknown): UploadQuality {
  if (raw === "standard" || raw === "hd") return raw;
  return "standard";
}

export async function getDataUsagePreferences(
  accountId: NexUuid,
): Promise<DataUsagePreferences> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select(
      "auto_download_images, auto_download_videos, auto_download_audio, upload_quality",
    )
    .eq("id", accountId)
    .maybeSingle();
  if (error) {
    throw new Error(`data-usage-preferences-service.get: ${error.message}`);
  }
  if (!data) {
    return DEFAULT_DATA_USAGE_PREFS;
  }
  const row = data as {
    auto_download_images: unknown;
    auto_download_videos: unknown;
    auto_download_audio: unknown;
    upload_quality: unknown;
  };
  return {
    auto_download_images: narrowPolicy(row.auto_download_images),
    auto_download_videos: narrowPolicy(row.auto_download_videos),
    auto_download_audio: narrowPolicy(row.auto_download_audio),
    upload_quality: narrowQuality(row.upload_quality),
  };
}

export async function getDataUsagePreferencesSafe(
  accountId: NexUuid,
): Promise<DataUsagePreferences> {
  try {
    return await getDataUsagePreferences(accountId);
  } catch {
    return DEFAULT_DATA_USAGE_PREFS;
  }
}

export async function updateDataUsagePreferences(
  accountId: NexUuid,
  patch: Partial<DataUsagePreferences>,
): Promise<DataUsagePreferences> {
  const current = await getDataUsagePreferences(accountId);
  const next: DataUsagePreferences = {
    auto_download_images:
      patch.auto_download_images ?? current.auto_download_images,
    auto_download_videos:
      patch.auto_download_videos ?? current.auto_download_videos,
    auto_download_audio:
      patch.auto_download_audio ?? current.auto_download_audio,
    upload_quality: patch.upload_quality ?? current.upload_quality,
  };
  const { error } = await nexSupabaseAdmin
    .from("nex_account")
    .update(next)
    .eq("id", accountId);
  if (error) {
    throw new Error(`data-usage-preferences-service.update: ${error.message}`);
  }
  return next;
}
