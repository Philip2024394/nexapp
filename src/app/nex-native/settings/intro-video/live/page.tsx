// src/app/nex-native/settings/intro-video/live/page.tsx
//
// NEX · My Intro Video · live preview surface · owner-authorised
// 2026-10-20.
// -----------------------------------------------------------------------------
// Full-screen dry-run of the visitor-landing experience · plays the
// user's SAVED intro video + title overlay + wallpaper, then lands
// on /nex-native/profile/me (the visitor-view of their canonical
// profile).
//
// Reached by the "View Live Now" footer button on
// /nex-native/settings/intro-video · the button auto-saves pending
// edits first, so this page can safely trust `getIntroSettings`
// returning the current committed state.
//
// Honest fallbacks:
//   · No session               → /sign-in with return_to
//   · Session but no video_url
//     AND no wallpaper_url     → bounce back to the editor · nothing
//                                to "preview live" without at least
//                                one of these set
//   · intro.enabled === false  → bounce back to the editor · the
//                                user explicitly muted their intro,
//                                so a "live" preview would misrepresent
//                                what visitors actually see

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getIntroSettings } from "@/lib/nex-native/intro-settings-service";
import { isLiveWorldId } from "@/app/nex-native/chat-standard/_live-worlds";
import { LiveIntroClient } from "./_live-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function IntroVideoLivePage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(
      "/nex-native/sign-in?next=" +
        encodeURIComponent("/nex-native/settings/intro-video/live"),
    );
  }

  const intro = await getIntroSettings(session.account.id);
  /* Owner directive 2026-10-20 · "Play wallpaper-only intro" · the
     live preview must run when the user has ANY of: a saved video, a
     wallpaper, or title text. Only bounce back to the editor when
     intro is explicitly disabled OR there is literally nothing to
     show. The _live-client already handles the "no video" case
     (wallpaper + title + 3s auto-advance). */
  const hasAnythingToShow =
    intro.enabled &&
    (intro.video_url !== null ||
      intro.wallpaper_url !== null ||
      (intro.title_text ?? "").trim().length > 0);
  if (!hasAnythingToShow) {
    redirect("/nex-native/settings/intro-video");
  }

  /* Owner directive 2026-10-20 · after the intro plays, land on the
     user's current chat theme preview · it's the honest "visitor
     experience" (intro + chat together). Fall back to the chat inbox
     when the user has no active chat_theme or the stored id is not a
     recognised live world (e.g. legacy DB-driven id). */
  const themeId = session.account.chat_theme;
  const destinationHref =
    themeId && isLiveWorldId(themeId)
      ? `/nex-native/themes/${themeId}`
      : "/nex-native/chat";

  return <LiveIntroClient intro={intro} destinationHref={destinationHref} />;
}
