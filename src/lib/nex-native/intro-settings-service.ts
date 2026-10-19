// src/lib/nex-native/intro-settings-service.ts
//
// Intro video + chat screen image settings · sealed CRUD · owner-
// authorised 2026-10-20.
// =============================================================================
// Backs the /nex-native/settings/intro-video surface. Reads + writes
// the 11 intro_* columns on nex_account (migration 209) and uploads
// user binaries to the two private-with-public-read buckets
// nex-user-intros + nex-user-wallpapers (migration 210).
//
// Mirrors the sealed theme-emoji-service pattern:
//   · "server-only" guard · never bundled client-side
//   · nexSupabaseAdmin for RLS-bypassing writes + bucket ops
//   · honest typed row shape · consumer uses getPublicUrl value
//   · fail-soft reads · break-loud writes

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";

// ─── Upload limits · mirror the client guards exactly so the server
// rejects anything the client somehow lets through. ────────────────

export const INTRO_VIDEO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const INTRO_VIDEO_MAX_DURATION_MS = 8250; // 8s + 250ms tolerance
export const INTRO_VIDEO_MIME_ALLOWED = new Set<string>(["video/mp4"]);

export const WALLPAPER_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const WALLPAPER_MIN_WIDTH = 720;
export const WALLPAPER_MIN_HEIGHT = 1280;
export const WALLPAPER_RATIO_TARGET = 9 / 16;
export const WALLPAPER_RATIO_TOLERANCE = 0.08;
export const WALLPAPER_MIME_ALLOWED = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const INTRO_VIDEO_BUCKET = "nex-user-intros";
const WALLPAPER_BUCKET = "nex-user-wallpapers";

// ─── Fixed vocabulary that mirrors the DB CHECK constraints ────────

export type IntroTitlePosition = "hero" | "center" | "footer";
export type IntroTitleFont =
  | "classic"
  | "elegant"
  | "strong"
  | "casual"
  | "neon";
export type IntroTitleSize = "s" | "m" | "l" | "xl";
export type IntroTitleAlign = "left" | "center" | "right";

export interface IntroSettings {
  enabled: boolean;
  video_url: string | null;
  video_duration_ms: number | null;
  title_text: string | null;
  title_position: IntroTitlePosition | null;
  title_font: IntroTitleFont | null;
  title_size: IntroTitleSize | null;
  title_color: string | null;
  title_align: IntroTitleAlign | null;
  title_highlight: boolean;
  wallpaper_url: string | null;
}

const EMPTY_INTRO_SETTINGS: IntroSettings = {
  enabled: true,
  video_url: null,
  video_duration_ms: null,
  title_text: null,
  title_position: null,
  title_font: null,
  title_size: null,
  title_color: null,
  title_align: null,
  title_highlight: false,
  wallpaper_url: null,
};

/** Fetch the saved intro + wallpaper settings for an account.
 *  Fail-soft · the composer always has to render something, so a DB
 *  hiccup returns the empty-defaults shape rather than throwing. */
export async function getIntroSettings(
  accountId: string,
): Promise<IntroSettings> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select(
      "intro_enabled, intro_video_url, intro_video_duration_ms, intro_title_text, intro_title_position, intro_title_font, intro_title_size, intro_title_color, intro_title_align, intro_title_highlight, intro_wallpaper_url",
    )
    .eq("id", accountId)
    .maybeSingle();
  if (error || !data) {
    if (error) {
      console.error(
        `intro-settings-service.getIntroSettings(${accountId}): ${error.message}`,
      );
    }
    return EMPTY_INTRO_SETTINGS;
  }
  return {
    enabled: data.intro_enabled ?? true,
    video_url: data.intro_video_url ?? null,
    video_duration_ms: data.intro_video_duration_ms ?? null,
    title_text: data.intro_title_text ?? null,
    title_position:
      (data.intro_title_position as IntroTitlePosition | null) ?? null,
    title_font: (data.intro_title_font as IntroTitleFont | null) ?? null,
    title_size: (data.intro_title_size as IntroTitleSize | null) ?? null,
    title_color: data.intro_title_color ?? null,
    title_align: (data.intro_title_align as IntroTitleAlign | null) ?? null,
    title_highlight: data.intro_title_highlight ?? false,
    wallpaper_url: data.intro_wallpaper_url ?? null,
  };
}

export interface UpdateIntroSettingsInput {
  enabled?: boolean;
  title_text?: string | null;
  title_position?: IntroTitlePosition | null;
  title_font?: IntroTitleFont | null;
  title_size?: IntroTitleSize | null;
  title_color?: string | null;
  title_align?: IntroTitleAlign | null;
  title_highlight?: boolean;
  // Pass null to clear the pointer (restores theme default).
  video_url?: string | null;
  video_duration_ms?: number | null;
  wallpaper_url?: string | null;
}

/** Update the scalar + text columns. File uploads are a separate
 *  concern (uploadIntroVideo / uploadWallpaper) so this call never
 *  touches storage. */
export async function updateIntroSettings(
  accountId: string,
  input: UpdateIntroSettingsInput,
): Promise<IntroSettings> {
  const patch: Record<string, unknown> = {};
  if (input.enabled !== undefined) patch.intro_enabled = input.enabled;
  if (input.title_text !== undefined) patch.intro_title_text = input.title_text;
  if (input.title_position !== undefined)
    patch.intro_title_position = input.title_position;
  if (input.title_font !== undefined) patch.intro_title_font = input.title_font;
  if (input.title_size !== undefined) patch.intro_title_size = input.title_size;
  if (input.title_color !== undefined)
    patch.intro_title_color = input.title_color;
  if (input.title_align !== undefined)
    patch.intro_title_align = input.title_align;
  if (input.title_highlight !== undefined)
    patch.intro_title_highlight = input.title_highlight;
  if (input.video_url !== undefined) patch.intro_video_url = input.video_url;
  if (input.video_duration_ms !== undefined)
    patch.intro_video_duration_ms = input.video_duration_ms;
  if (input.wallpaper_url !== undefined)
    patch.intro_wallpaper_url = input.wallpaper_url;

  if (Object.keys(patch).length === 0) {
    return getIntroSettings(accountId);
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_account")
    .update(patch)
    .eq("id", accountId);
  if (error) {
    throw new Error(
      `intro-settings-service.updateIntroSettings: ${error.message}`,
    );
  }
  return getIntroSettings(accountId);
}

/** Upload a user's intro video to the nex-user-intros bucket. One
 *  object per account · overwrites on new upload · public URL is
 *  returned so the caller can persist it on nex_account.intro_video_url. */
export async function uploadIntroVideo(input: {
  accountId: string;
  file: File;
  mimeType: string;
  durationMs: number;
}): Promise<{ publicUrl: string; durationMs: number }> {
  if (!INTRO_VIDEO_MIME_ALLOWED.has(input.mimeType)) {
    throw new Error(
      `Mime "${input.mimeType}" not accepted · video/mp4 only.`,
    );
  }
  if (input.file.size > INTRO_VIDEO_MAX_BYTES) {
    throw new Error(
      `Video is ${(input.file.size / 1024 / 1024).toFixed(2)} MB · max 10 MB.`,
    );
  }
  if (input.durationMs > INTRO_VIDEO_MAX_DURATION_MS) {
    throw new Error(
      `Video is ${(input.durationMs / 1000).toFixed(1)}s · max 8 seconds.`,
    );
  }
  const bucket = nexSupabaseAdmin.storage.from(INTRO_VIDEO_BUCKET);
  // One object per account · deterministic path so a replace is
  // literally an overwrite · no orphan files to garbage collect.
  const objectPath = `${input.accountId}/intro.mp4`;
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const { error: upErr } = await bucket.upload(objectPath, buffer, {
    contentType: input.mimeType,
    upsert: true,
    cacheControl: "3600",
  });
  if (upErr) {
    throw new Error(
      `intro-settings-service.uploadIntroVideo: ${upErr.message}`,
    );
  }
  const { data: pub } = bucket.getPublicUrl(objectPath);
  return { publicUrl: pub.publicUrl, durationMs: input.durationMs };
}

/** Upload a user's chat wallpaper to the nex-user-wallpapers bucket.
 *  Same one-object-per-account overwrite pattern as the intro video.
 *  Dimension + ratio validation happens in the server action BEFORE
 *  this is called (sharp-based). */
export async function uploadWallpaper(input: {
  accountId: string;
  file: File;
  mimeType: string;
}): Promise<{ publicUrl: string }> {
  if (!WALLPAPER_MIME_ALLOWED.has(input.mimeType)) {
    throw new Error(
      `Mime "${input.mimeType}" not accepted · PNG · JPG · WebP only.`,
    );
  }
  if (input.file.size > WALLPAPER_MAX_BYTES) {
    throw new Error(
      `Wallpaper is ${(input.file.size / 1024 / 1024).toFixed(2)} MB · max 5 MB.`,
    );
  }
  const bucket = nexSupabaseAdmin.storage.from(WALLPAPER_BUCKET);
  // Preserve the original mime via the extension so the browser
  // Content-Type matches on retrieval.
  const ext =
    input.mimeType === "image/png"
      ? "png"
      : input.mimeType === "image/webp"
        ? "webp"
        : "jpg";
  const objectPath = `${input.accountId}/wallpaper.${ext}`;
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const { error: upErr } = await bucket.upload(objectPath, buffer, {
    contentType: input.mimeType,
    upsert: true,
    cacheControl: "3600",
  });
  if (upErr) {
    throw new Error(
      `intro-settings-service.uploadWallpaper: ${upErr.message}`,
    );
  }
  const { data: pub } = bucket.getPublicUrl(objectPath);
  return { publicUrl: pub.publicUrl };
}

/** Clear the user's custom video pointer. The actual object in
 *  storage is left in place (occupies 10 MB max) so a subsequent
 *  re-enable without re-upload still works · a nightly janitor can
 *  prune bucket objects whose matching account column is null. */
export async function clearIntroVideo(accountId: string): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_account")
    .update({ intro_video_url: null, intro_video_duration_ms: null })
    .eq("id", accountId);
  if (error) {
    throw new Error(
      `intro-settings-service.clearIntroVideo: ${error.message}`,
    );
  }
}

export async function clearWallpaper(accountId: string): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_account")
    .update({ intro_wallpaper_url: null })
    .eq("id", accountId);
  if (error) {
    throw new Error(
      `intro-settings-service.clearWallpaper: ${error.message}`,
    );
  }
}
