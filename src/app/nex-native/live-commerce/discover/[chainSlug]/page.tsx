// src/app/nex-native/live-commerce/discover/[chainSlug]/page.tsx
//
// NEX Live · chain-entry redirect. Opened when the viewer taps a
// tile in the 12-tile category sheet.
// -----------------------------------------------------------------------------
// Owner directive 2026-10-24:
//   "the live search category will play that category of video or
//    banner images and when completed will move to next category".
//
// Flow:
//   1. Viewer taps "Travel" (slug=travel) in the category sheet.
//   2. Client routes to /nex-native/live-commerce/discover/travel.
//   3. THIS page runs server-side:
//        · resolves the chain
//        · builds the queue from the full video list
//        · redirects to /nex-native/videos/{firstQueueId}?chain=travel
//      If the queue is EMPTY (no videos tagged with any chain topic),
//      we redirect to the Live feed with a non-revealing marker, so
//      the viewer sees "no videos yet for this category" instead of a
//      404.
//
// Honest non-claim:
//   This is a thin resolver. It does NOT execute any session,
//   create any state, or write to any DB.

import { redirect } from "next/navigation";
import {
  listPublishedUploadedVideos,
} from "@/lib/nex-native/live-broadcast/uploaded-video-service";
import {
  listDevUploadedVideos,
  isDevManifestActive,
} from "@/lib/nex-native/live-broadcast/dev-video-manifest";
import {
  getCategoryChain,
  buildCategoryQueue,
  type CategoryQueueVideoLike,
} from "@/lib/nex-native/live-broadcast/category-chain";

export const dynamic = "force-dynamic";

export default async function DiscoverChainEntryPage({
  params,
}: {
  params: Promise<{ chainSlug: string }>;
}): Promise<React.JSX.Element> {
  const { chainSlug } = await params;
  const chain = getCategoryChain(chainSlug);
  if (!chain) {
    // Unknown slug · bounce back to the feed landing.
    redirect("/nex-native/live-commerce/feed?chain-unknown=1");
  }

  const rows = isDevManifestActive()
    ? listDevUploadedVideos({ limit: 100 })
    : await listPublishedUploadedVideos({ limit: 50 });
  const videosForQueue: readonly CategoryQueueVideoLike[] = rows.map((r) => ({
    id: r.id,
    topic_tags: r.topic_tags,
  }));
  const queue = buildCategoryQueue(chain, videosForQueue);

  if (queue.length === 0) {
    // No videos yet in this chain. Honest fallback: back to the feed
    // landing with a marker the UI can surface as "No {chain.label}
    // content yet". The feed page can read `?empty-chain={slug}`.
    redirect(
      `/nex-native/live-commerce/feed?empty-chain=${encodeURIComponent(chainSlug)}`,
    );
  }

  const firstId = queue[0];
  redirect(`/nex-native/videos/${firstId}?chain=${chainSlug}`);
}
