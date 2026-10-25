// src/app/nex-native/dev/live-viewer/page.tsx
//
// Dev-only · stable URL that always renders the Live viewer in the
// USER (viewer) role. Products pill + picker + featured-card slot
// are HIDDEN regardless of `?preview=` query params. This is what a
// signed-in viewer who is NOT the broadcaster sees.
//
// Owner directive 2026-10-25 · "the other url is the user logged in
// what they see when logged in". Companion to `/dev/live-seller`.
//
// NOT a production surface. Loads `dev-video-3` for a 1:1 parity
// with the seller URL · the only difference between the two routes
// is the role flag + dev banner colour.

import { notFound } from "next/navigation";
import {
  getDevUploadedVideoById,
  isDevManifestActive,
  devVideoPublicUrl,
  DEV_VIDEO_MANIFEST,
  listDevUploadedVideos,
} from "@/lib/nex-native/live-broadcast/dev-video-manifest";
import { VideoViewerClient } from "@/app/nex-native/videos/[videoId]/_video-viewer-client";

const DEV_VIEWER_VIDEO_ID = "dev-video-3";

export const metadata = {
  title: "NEX · Live · User preview (dev)",
  description: "Dev-only preview of the Live viewer in the user (non-broadcaster) role.",
};

export const dynamic = "force-dynamic";

export default async function DevLiveViewerPage(): Promise<React.JSX.Element> {
  if (!isDevManifestActive()) {
    notFound();
  }
  const row = getDevUploadedVideoById(DEV_VIEWER_VIDEO_ID);
  const entry = DEV_VIDEO_MANIFEST.find((e) => e.id === DEV_VIEWER_VIDEO_ID);
  if (!row || !entry) notFound();
  const siblings = listDevUploadedVideos({ limit: 100 }).map((r) => r.id);
  return (
    <VideoViewerClient
      video={row}
      publicUrl={devVideoPublicUrl(entry)}
      siblingIds={siblings}
      forceBroadcasterPreview={false}
      devRoleBanner="viewer"
      /* Owner directive 2026-10-25 · mock counts for the user
         (viewer) role · same numbers the broadcaster sees because
         these are public engagement metrics. Save defaults to 0
         so a viewer sees NO Save count (sealed zero-hide rule). */
      likeCount={237}
      shareCount={42}
      saveCount={0}
    />
  );
}
