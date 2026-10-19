"use server";

// src/app/nex-native/settings/intro-video/_actions.ts
//
// Intro video + chat screen image server actions · owner-authorised
// 2026-10-20 · bridges the client UI to the sealed intro-settings
// service + storage buckets.
// =============================================================================
//
// Three actions:
//   · updateIntroSettingsAction  · scalar + text columns · fast
//   · uploadIntroVideoAction     · stage video + persist URL
//   · uploadWallpaperAction      · stage wallpaper + persist URL
//
// Each action resolves the session server-side and uses the account
// ID from auth · never trusts a client-supplied account ID.

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  clearIntroVideo,
  clearWallpaper,
  getIntroSettings,
  updateIntroSettings,
  uploadIntroVideo,
  uploadWallpaper,
  type IntroSettings,
  type IntroTitleAlign,
  type IntroTitleFont,
  type IntroTitlePosition,
  type IntroTitleSize,
} from "@/lib/nex-native/intro-settings-service";

export interface ActionResult<T> {
  ok: boolean;
  error?: string;
  data?: T;
}

/** Non-destructive save · scalar + text columns only · never touches
 *  storage · fast enough to call on every Save tap. */
export async function updateIntroSettingsAction(formData: FormData): Promise<
  ActionResult<IntroSettings>
> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) return { ok: false, error: "Not signed in" };
    const accountId = session.account.id;

    const read = (k: string): string | null => {
      const v = formData.get(k);
      return typeof v === "string" ? v : null;
    };
    const readBool = (k: string): boolean | undefined => {
      const v = read(k);
      if (v === null) return undefined;
      return v === "true" || v === "1";
    };
    const readToken = <T extends string>(
      k: string,
      allowed: readonly T[],
    ): T | null | undefined => {
      const v = read(k);
      if (v === null) return undefined;
      if (v === "") return null;
      return allowed.includes(v as T) ? (v as T) : undefined;
    };

    const settings = await updateIntroSettings(accountId, {
      enabled: readBool("enabled"),
      title_text: read("title_text") === null ? undefined : (read("title_text") || null),
      title_position: readToken<IntroTitlePosition>("title_position", [
        "hero",
        "center",
        "footer",
      ]),
      title_font: readToken<IntroTitleFont>("title_font", [
        "classic",
        "elegant",
        "strong",
        "casual",
        "neon",
      ]),
      title_size: readToken<IntroTitleSize>("title_size", ["s", "m", "l", "xl"]),
      title_color: read("title_color") === null
        ? undefined
        : /^#[0-9A-Fa-f]{6}$/.test(read("title_color") ?? "")
          ? read("title_color")
          : null,
      title_align: readToken<IntroTitleAlign>("title_align", [
        "left",
        "center",
        "right",
      ]),
      title_highlight: readBool("title_highlight"),
    });
    return { ok: true, data: settings };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown save error",
    };
  }
}

/** Stage the intro video file (already client-validated for size +
 *  duration + ratio) · upload to nex-user-intros · persist URL on
 *  nex_account. Returns the fresh settings so the client can
 *  swap its state atomically. */
export async function uploadIntroVideoAction(
  formData: FormData,
): Promise<ActionResult<IntroSettings>> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) return { ok: false, error: "Not signed in" };
    const accountId = session.account.id;
    const file = formData.get("file");
    const durationMsRaw = formData.get("durationMs");
    if (!(file instanceof File)) {
      return { ok: false, error: "No file supplied" };
    }
    const durationMs = Number(durationMsRaw);
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      return { ok: false, error: "Invalid duration" };
    }
    const { publicUrl } = await uploadIntroVideo({
      accountId,
      file,
      mimeType: file.type,
      durationMs,
    });
    const settings = await updateIntroSettings(accountId, {
      video_url: publicUrl,
      video_duration_ms: Math.round(durationMs),
    });
    return { ok: true, data: settings };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Upload failed",
    };
  }
}

export async function uploadWallpaperAction(
  formData: FormData,
): Promise<ActionResult<IntroSettings>> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) return { ok: false, error: "Not signed in" };
    const accountId = session.account.id;
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "No file supplied" };
    }
    const { publicUrl } = await uploadWallpaper({
      accountId,
      file,
      mimeType: file.type,
    });
    const settings = await updateIntroSettings(accountId, {
      wallpaper_url: publicUrl,
    });
    return { ok: true, data: settings };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Upload failed",
    };
  }
}

export async function clearIntroVideoAction(): Promise<ActionResult<IntroSettings>> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) return { ok: false, error: "Not signed in" };
    await clearIntroVideo(session.account.id);
    const settings = await getIntroSettings(session.account.id);
    return { ok: true, data: settings };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Clear failed" };
  }
}

export async function clearWallpaperAction(): Promise<ActionResult<IntroSettings>> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) return { ok: false, error: "Not signed in" };
    await clearWallpaper(session.account.id);
    const settings = await getIntroSettings(session.account.id);
    return { ok: true, data: settings };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Clear failed" };
  }
}

/** Full reset · for the "Use theme original" toggle commit. Clears
 *  video + wallpaper + all title/typography columns · fast single-
 *  statement update that leaves the account rows in the sealed
 *  theme-default state. */
export async function resetIntroToThemeDefaultsAction(): Promise<
  ActionResult<IntroSettings>
> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) return { ok: false, error: "Not signed in" };
    const accountId = session.account.id;
    const settings = await updateIntroSettings(accountId, {
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
    });
    return { ok: true, data: settings };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Reset failed" };
  }
}
