// src/app/nex-native/videos/[videoId]/page.tsx
//
// NEX uploaded-video viewer · full-bleed · swipeable · footer buttons.
// -----------------------------------------------------------------------------
// Owner directive 2026-10-24 · "the live link from side drawer
// should showing the live screen playing video and the buttons in
// footer area".
//
// Server component shell · all interactive logic in
// `_video-viewer-client.tsx`. Loads the current video + sibling
// video ids (for swipe navigation) from the dev manifest OR the
// real `listPublishedUploadedVideos` service (one env flag away).

import { notFound } from "next/navigation";
import {
  listPublishedUploadedVideos,
  getUploadedVideoById,
  type UploadedVideoRow,
} from "@/lib/nex-native/live-broadcast/uploaded-video-service";
import {
  listDevUploadedVideos,
  getDevUploadedVideoById,
  isDevManifestActive,
  devVideoPublicUrl,
  DEV_VIDEO_MANIFEST,
} from "@/lib/nex-native/live-broadcast/dev-video-manifest";
import {
  getCategoryChain,
  buildCategoryQueue,
  resolveCurrentTopic,
  formatTopicLabel,
  type CategoryQueueVideoLike,
} from "@/lib/nex-native/live-broadcast/category-chain";
import { VideoViewerClient } from "./_video-viewer-client";

export const metadata = {
  title: "NEX · Live",
  description: "Watch on NEX.",
};

export const dynamic = "force-dynamic";

async function resolveCurrentVideo(
  videoId: string,
): Promise<{ video: UploadedVideoRow; publicUrl: string } | null> {
  if (isDevManifestActive()) {
    const row = getDevUploadedVideoById(videoId);
    if (!row) return null;
    const manifestEntry = DEV_VIDEO_MANIFEST.find((e) => e.id === videoId);
    if (!manifestEntry) return null;
    return { video: row, publicUrl: devVideoPublicUrl(manifestEntry) };
  }
  // Real-DB path · Migration 223 must be applied + storage bucket
  // must exist · public URL assembled from storage_object_path.
  const row = await getUploadedVideoById(videoId);
  if (!row) return null;
  // Caller must have the Supabase client configured · we emit a
  // storage.public URL assuming the bucket is public. If the bucket
  // is private this needs a signed URL · owner-decidable.
  const url = `${process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? ""}/storage/v1/object/public/${row.storage_bucket}/${row.storage_object_path}`;
  return { video: row, publicUrl: url };
}

/** All videos the viewer can swipe through. Pre-chain filtering. */
async function listAllVideos(): Promise<
  readonly { id: string; topic_tags: readonly string[] }[]
> {
  if (isDevManifestActive()) {
    const rows = listDevUploadedVideos({ limit: 100 });
    return rows.map((r) => ({ id: r.id, topic_tags: r.topic_tags }));
  }
  const rows = await listPublishedUploadedVideos({ limit: 50 });
  return rows.map((r) => ({ id: r.id, topic_tags: r.topic_tags }));
}

export default async function VideoViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<{ chain?: string }>;
}): Promise<React.JSX.Element> {
  const { videoId } = await params;
  const { chain: chainSlugRaw } = await searchParams;
  const resolved = await resolveCurrentVideo(videoId);
  if (!resolved) {
    notFound();
  }

  // Owner directive 2026-10-24 · chain playback. If the viewer arrived
  // via a category tile, filter the sibling-id list to the chain queue
  // so swipe-up advances through temple→volcano→beach (etc).
  const allVideos = await listAllVideos();
  const chain = chainSlugRaw ? getCategoryChain(chainSlugRaw) : null;
  let siblingIds: readonly string[];
  let chainLabel: string | null = null;
  let currentTopicLabel: string | null = null;

  if (chain) {
    const queue = buildCategoryQueue(
      chain,
      allVideos as readonly CategoryQueueVideoLike[],
    );
    // If the current video is in the queue, use the queue. If not,
    // the viewer arrived at a non-chain video via some other path · do
    // not corrupt the sibling list.
    if (queue.includes(videoId)) {
      siblingIds = queue;
      chainLabel = chain.label;
      const topic = resolveCurrentTopic(chain, {
        id: resolved.video.id,
        topic_tags: resolved.video.topic_tags,
      });
      currentTopicLabel = topic ? formatTopicLabel(topic) : null;
    } else {
      siblingIds = allVideos.map((v) => v.id);
    }
  } else {
    siblingIds = allVideos.map((v) => v.id);
  }

  // Owner directive 2026-10-27 · S2 streaming hardening · resolve
  // the public URLs for the swipe-next AND swipe-prev neighbours so
  // the viewer can mount hidden `<video preload="auto">` elements
  // for both. Starting the fetch during the current playback means
  // the first frame of the next clip is already decoded by the time
  // the user swipes. Null when the neighbour doesn't exist (end /
  // start of the chain) or resolves to not-found.
  const currentIndex = siblingIds.indexOf(videoId);
  const nextId = currentIndex >= 0 && currentIndex < siblingIds.length - 1
    ? siblingIds[currentIndex + 1]
    : null;
  const prevId = currentIndex > 0 ? siblingIds[currentIndex - 1] : null;
  const [nextResolved, prevResolved] = await Promise.all([
    nextId ? resolveCurrentVideo(nextId) : Promise.resolve(null),
    prevId ? resolveCurrentVideo(prevId) : Promise.resolve(null),
  ]);
  const nextPublicUrl = nextResolved?.publicUrl ?? null;
  const prevPublicUrl = prevResolved?.publicUrl ?? null;

  return (
    <VideoViewerClient
      video={resolved.video}
      publicUrl={resolved.publicUrl}
      siblingIds={siblingIds}
      chainLabel={chainLabel}
      chainSlug={chain ? chain.slug : null}
      currentTopicLabel={currentTopicLabel}
      nextPublicUrl={nextPublicUrl}
      prevPublicUrl={prevPublicUrl}
    />
  );
}
