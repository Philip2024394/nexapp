// src/app/nex-native/settings/intro-video/page.tsx
//
// NEX · My Intro Video settings · owner-authorised 2026-10-19.
// -----------------------------------------------------------------------------
// User-facing surface for recording / uploading / previewing a personal
// intro video that plays over any live-world chat theme in place of the
// theme's own packaged intro. World-class design decisions sealed by
// the owner in this session:
//
//   · Max 8 seconds (hard client-side cap · ffmpeg-trim-to-8s on save)
//   · 9:16 portrait only · landscape rejects with "re-record vertically"
//   · H.264 mp4 · ≤10MB · Supabase bucket `nex-user-intros` (one object
//     per account id · overwrites on new upload)
//   · Record is the primary CTA · Upload is secondary (matches owner's
//     "they are recommended to record" directive)
//   · Title overlay with 3 positions: Hero · Center · Footer · white
//     text + gradient scrim for legibility over any video
//   · Explicit "Turn off intro" toggle at the top · wins over every
//     other setting so the user can mute all intros instantly
//
// Server-side pipeline (follows the sealed uploadThemeEmoji pattern at
// src/lib/nex-native/theme-emoji-service.ts):
//   · `uploadUserIntroVideoAction(formData)` validates mime + size +
//     duration via ffprobe (ffprobe-static already in package.json) +
//     writes to Supabase storage then upserts `nex_account.intro_video_url`
//   · `updateIntroSettingsAction(formData)` upserts
//     `intro_title_text` + `intro_title_position` + `intro_enabled`
//
// Preview-honest state TODAY (owner-approved per this session):
//   · The UI shell + validation + preview + title overlay are LIVE
//   · File upload stages the preview locally via URL.createObjectURL
//   · The Save button writes to a cookie-backed per-session preview
//     store (`consumeIntroPreviewSettings`) so the owner can test the
//     end-to-end UX on `/nex-native/themes/<id>` without a DB migration
//   · The real server-action + migration + storage bucket land in a
//     separate owner-authorised commit under the Safety Constitution
//     §5 deployment gate.

import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { effectiveTier } from "@/lib/nex-native/account-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
import {
  isLiveWorldId,
  LIVE_WORLD_PACKAGES,
} from "@/app/nex-native/chat-standard/_live-worlds";
import type { ControlDrawerSession } from "@/components/nex-native/control-drawer/control-drawer-client";
import { IntroVideoSettingsClient } from "./_intro-video-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function IntroVideoSettingsPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    // Guests are routed to sign-in · the drawer row's `locked: true`
    // already wraps the href with /sign-in?next= so this is a
    // belt-and-braces check matching the sealed settings-page pattern.
    redirect(
      "/nex-native/sign-in?next=" +
        encodeURIComponent("/nex-native/settings/intro-video"),
    );
  }
  if (!session.account.nex_handle) {
    // Should never happen (handle is allocated on first login) but
    // bail honestly if it does.
    notFound();
  }

  /* Owner directive 2026-10-19 · "this should have the video that is
     playing now on chat theme intro" · when the user has no uploaded
     intro, the preview area shows the current active theme's packaged
     intro video so the user can see what plays today. Resolved from
     `session.account.chat_theme` against the live-world registry ·
     DB-driven themes may not have an intro video (null) and the
     client falls back to its empty-state message. */
  const activeThemeId: string | undefined =
    session.account.chat_theme ?? undefined;
  let activeThemeIntroUrl: string | null = null;
  let activeThemeName: string | null = null;
  let activeThemeWallpaperUrl: string | null = null;
  if (activeThemeId && isLiveWorldId(activeThemeId)) {
    const pkg = LIVE_WORLD_PACKAGES[activeThemeId];
    activeThemeIntroUrl = pkg.intro?.videoUrl ?? null;
    activeThemeName = pkg.identity.name;
    /* Owner directive 2026-10-19 · "must show the original image in
       the container window" · the chat theme's packaged wallpaper is
       what plays today in chat · surface it as the default preview
       so the user sees exactly what their background currently looks
       like before they decide to replace it. */
    activeThemeWallpaperUrl = pkg.wallpaperUrl ?? null;
  }

  /* Owner directive 2026-10-19 · header gains NEX avatar on the left +
     3-dot drawer trigger on the right · remove the handle/name text
     block. Resolve the viewer's avatar from `nex_account_profile` ·
     fail soft when the row is absent (empty-state fallback). The
     drawer session is derived the same way `/nex-native/directory`
     and other sealed surfaces resolve it. */
  const profile = await getProfileByAccountId(session.account.id).catch(
    () => null,
  );
  const viewerAvatarUrl = profile?.avatar_url ?? null;
  const drawerSession: ControlDrawerSession = {
    displayName: session.account.display_name,
    nexHandle: session.account.nex_handle,
    isBisnis: effectiveTier(session.account) === "bisnis",
  };

  return (
    <IntroVideoSettingsClient
      displayName={session.account.display_name}
      nexHandle={session.account.nex_handle}
      viewerAvatarUrl={viewerAvatarUrl}
      drawerSession={drawerSession}
      activeThemeIntroUrl={activeThemeIntroUrl}
      activeThemeName={activeThemeName}
      activeThemeWallpaperUrl={activeThemeWallpaperUrl}
    />
  );
}
