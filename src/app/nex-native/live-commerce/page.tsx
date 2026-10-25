// src/app/nex-native/live-commerce/page.tsx
//
// NEX Live landing · owner directive 2026-10-24.
// -----------------------------------------------------------------------------
// "the live link from side drawer should showing the live screen
// playing video and the buttons in footer area".
//
// This route is the drawer's "Nex Live" target. It picks the FIRST
// candidate the viewer should see and redirects to the appropriate
// viewer surface:
//
//   1 · If any Live session is currently open AND the viewer should
//       see it, redirect to the Live viewer at `/live-commerce/[sessionId]`
//       (full-bleed WebRTC + swipe nav across sibling Live sessions).
//
//   2 · Else if any uploaded video is published (dev manifest OR real
//       DB), redirect to the uploaded-video viewer at
//       `/videos/[videoId]` (full-bleed `<video>` + swipe nav across
//       sibling uploaded videos).
//
//   3 · Else render the empty-state feed page (/feed) so the viewer
//       sees honest "no live content" with Go Live affordance.
//
// Nothing is rendered inline · this is pure routing.

import { redirect } from "next/navigation";
import { listOpenSessionsPublic } from "@/lib/nex-native/live-broadcast/live-session-service";
import { listPublishedUploadedVideos } from "@/lib/nex-native/live-broadcast/uploaded-video-service";
import {
  listDevUploadedVideos,
  isDevManifestActive,
} from "@/lib/nex-native/live-broadcast/dev-video-manifest";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "NEX · Live",
  description: "Watch live on NEX.",
};

export default async function LiveLandingPage(): Promise<never> {
  // 1 · prefer an open Live session · the WebRTC experience is the
  //     purest form of "the live screen playing".
  //     Plan v4 · AC-1 · request-scoped nowMs.
  const nowMs = Date.now();
  try {
    const openSessions = await listOpenSessionsPublic({ limit: 1, nowMs });
    if (openSessions.length > 0) {
      redirect(`/nex-native/live-commerce/${openSessions[0]!.id}`);
    }
  } catch {
    // Fail-open · fall through to uploaded-video selection.
  }

  // 2 · uploaded video · dev manifest OR real DB.
  const uploaded = isDevManifestActive()
    ? listDevUploadedVideos({ limit: 1 })
    : await listPublishedUploadedVideos({ limit: 1 }).catch(() => []);
  if (uploaded.length > 0) {
    redirect(`/nex-native/videos/${uploaded[0]!.id}`);
  }

  // 3 · nothing live, nothing uploaded · show the honest empty feed.
  redirect("/nex-native/live-commerce/feed");
}
