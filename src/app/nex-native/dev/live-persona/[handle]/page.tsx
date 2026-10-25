// src/app/nex-native/dev/live-persona/[handle]/page.tsx
//
// Dev-only · opens the Live viewer with a seeded mock persona in the
// author chrome (name, avatar, "live" ping). Owner directive
// 2026-10-26 · "now I want 1 male guy and url to open live".
//
// URL shape · /nex-native/dev/live-persona/<alpha-handle>
// Example   · /nex-native/dev/live-persona/bayu
//
// What it does:
//   1. Resolves the persona from the local manifest by its alpha
//      handle (bayu, dewi, melati, …).
//   2. Loads a dev-manifest video to use as the Live content so
//      playback works without touching the real `nex_uploaded_video`
//      storage path.
//   3. Mounts VideoViewerClient with persona identity injected into
//      authorDisplayName + authorAvatarUrl + authorIsLive props so
//      the viewer header reads as if Bayu (or whichever handle) is
//      broadcasting.
//
// NOT a production surface · NOT the real Live session plumbing ·
// `nex_live_session` wiring is a separate slice when the owner asks
// for it. This page lets the owner see how a persona Live preview
// LOOKS before any real-time broadcast infra lands.

import { notFound } from "next/navigation";
import {
  getDevUploadedVideoById,
  isDevManifestActive,
  devVideoPublicUrl,
  DEV_VIDEO_MANIFEST,
  listDevUploadedVideos,
} from "@/lib/nex-native/live-broadcast/dev-video-manifest";
import { VideoViewerClient } from "@/app/nex-native/videos/[videoId]/_video-viewer-client";
import { PERSONAS } from "../../../../../../scripts/mock-personas/persona-manifest.mjs";

export const dynamic = "force-dynamic";

// Which dev video to borrow per handle · defaults to dev-video-7 for
// anyone not explicitly mapped. Owner can change these mappings as
// personas get their own real uploads.
const PERSONA_VIDEO_MAP: Record<string, string> = {
  bayu: "dev-video-7",
  made: "dev-video-9",
  rizky: "dev-video-2",
  dimas: "dev-video-6",
  hendra: "dev-video-14",
  yudi: "dev-video-11",
  agus: "dev-video-4",
  rangga: "dev-video-16",
  haikal: "dev-video-18",
  rahman: "dev-video-19",
  ketut: "dev-video-21",
};

interface Persona {
  readonly handle: string;
  readonly displayName: string;
  readonly city: string;
  readonly profession: string;
  readonly avatarFile: string;
}

const SUPABASE_BUCKET_URL =
  "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-mock-personas";

export const metadata = {
  title: "NEX · Live persona preview (dev)",
  description: "Dev-only preview of a seeded mock persona broadcasting Live.",
};

export default async function DevLivePersonaPage(props: {
  params: Promise<{ handle: string }>;
}): Promise<React.JSX.Element> {
  const { handle } = await props.params;
  if (!isDevManifestActive()) notFound();
  const persona = (PERSONAS as readonly Persona[]).find(
    (p) => p.handle === handle,
  );
  if (!persona) notFound();

  const videoId = PERSONA_VIDEO_MAP[handle] ?? "dev-video-7";
  const row = getDevUploadedVideoById(videoId);
  const entry = DEV_VIDEO_MANIFEST.find((e) => e.id === videoId);
  if (!row || !entry) notFound();

  const siblings = listDevUploadedVideos({ limit: 100 }).map((r) => r.id);
  const avatarUrl = `${SUPABASE_BUCKET_URL}/${persona.avatarFile}`;

  return (
    <VideoViewerClient
      video={row}
      publicUrl={devVideoPublicUrl(entry)}
      siblingIds={siblings}
      forceBroadcasterPreview={false}
      devRoleBanner="viewer"
      /* Owner directive 2026-10-26 · inject the persona's identity
         into the composer header so the viewer reads as if that
         persona is broadcasting. Avatar comes from the sealed
         `nex-mock-personas` Supabase bucket. authorIsLive=true
         fires the sealed red ping dot on the avatar. */
      authorDisplayNameOverride={persona.displayName}
      authorAvatarUrlOverride={avatarUrl}
      authorIsLiveOverride={true}
    />
  );
}
