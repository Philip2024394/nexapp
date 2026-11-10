// src/lib/nex-native/intro-video/_actions.ts
//
// Server-action stubs for the intro-video client · owner-sealed
// 2026-11-10 build cycle.
//
// Background: intro-video-client.tsx (3248 lines) imports six server
// actions from `./_actions`. The file was never created · the client's
// upload/settings panel code paths were orphaned mid-refactor. Only
// the TitleOverlay component + segmentsToAttrs utility are actually
// consumed by the current app (via chat-standard/_standard-intro-
// overlay.tsx). The upload/settings panel surfaces are not reachable
// from any route today.
//
// These stubs:
//   · Make the build succeed.
//   · Return an honest "intro-video management surface is not wired
//     in this environment" result when any action is invoked.
//   · Never call Supabase, storage, or any mutation path.
//
// If the intro-video management surface is revived later, replace
// these stubs with real server actions.

"use server";

// Shape widened to match the unwired consumer in intro-video-client.tsx
// which reads `.data` and `.error`. Stubs always return error.
export interface IntroActionResult {
  readonly ok: false;
  readonly reason: "intro_video_management_not_wired";
  readonly detail: string;
  readonly data: {
    readonly video_url: string | null;
    readonly wallpaper_url: string | null;
    readonly [key: string]: unknown;
  };
  readonly error: string;
}

const UNWIRED: IntroActionResult = {
  ok: false,
  reason: "intro_video_management_not_wired",
  detail:
    "The intro-video management surface is not wired in this environment. " +
    "Revive the real server actions before enabling the upload panel.",
  data: { video_url: null, wallpaper_url: null },
  error: "intro_video_management_not_wired",
};

export async function uploadIntroVideoAction(
  _fd: FormData,
): Promise<IntroActionResult> {
  return UNWIRED;
}

export async function uploadWallpaperAction(
  _fd: FormData,
): Promise<IntroActionResult> {
  return UNWIRED;
}

export async function clearIntroVideoAction(): Promise<IntroActionResult> {
  return UNWIRED;
}

export async function clearWallpaperAction(): Promise<IntroActionResult> {
  return UNWIRED;
}

export async function resetIntroToThemeDefaultsAction(): Promise<IntroActionResult> {
  return UNWIRED;
}

export async function updateIntroSettingsAction(
  _input: unknown,
): Promise<IntroActionResult> {
  return UNWIRED;
}
