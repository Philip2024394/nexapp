// src/app/nex-native/dev/live-seller/page.tsx
//
// Dev-only · stable URL that always renders the Live viewer in the
// SELLER (broadcaster) role. Products pill + picker + featured-card
// slot all mount regardless of `?preview=` query params.
//
// Owner directive 2026-10-25 · "we need 2 url pages for dev purpose -
// 1 is the live for the seller what seller see's logged in can be
// mock products - and the other url is the user logged in what they
// see when logged in". This file is the SELLER URL · the companion
// `/dev/live-viewer` is the USER URL.
//
// NOT a production surface. Loads `dev-video-3` from the dev manifest
// so the owner always sees the same reproducible video. Real broad-
// caster-identity gating (session.user.id === video.owner_account_id)
// remains a separate wiring slice.

import { notFound } from "next/navigation";
import {
  getDevUploadedVideoById,
  isDevManifestActive,
  devVideoPublicUrl,
  DEV_VIDEO_MANIFEST,
  listDevUploadedVideos,
} from "@/lib/nex-native/live-broadcast/dev-video-manifest";
import { VideoViewerClient } from "@/app/nex-native/videos/[videoId]/_video-viewer-client";

const DEV_SELLER_VIDEO_ID = "dev-video-3";

export const metadata = {
  title: "NEX · Live · Seller preview (dev)",
  description: "Dev-only preview of the Live viewer in the seller role.",
};

export const dynamic = "force-dynamic";

export default async function DevLiveSellerPage(): Promise<React.JSX.Element> {
  if (!isDevManifestActive()) {
    notFound();
  }
  const row = getDevUploadedVideoById(DEV_SELLER_VIDEO_ID);
  const entry = DEV_VIDEO_MANIFEST.find((e) => e.id === DEV_SELLER_VIDEO_ID);
  if (!row || !entry) notFound();
  const siblings = listDevUploadedVideos({ limit: 100 }).map((r) => r.id);
  return (
    <VideoViewerClient
      video={row}
      publicUrl={devVideoPublicUrl(entry)}
      siblingIds={siblings}
      forceBroadcasterPreview={true}
      devRoleBanner="seller"
      /* Owner directive 2026-10-25 · dev-only mock counts so the
         broadcaster can see what their own metrics look like.
         Shows 0 to the broadcaster per sealed rule · use realistic
         non-zero defaults for a healthy preview. */
      likeCount={237}
      shareCount={42}
      saveCount={18}
    />
  );
}
