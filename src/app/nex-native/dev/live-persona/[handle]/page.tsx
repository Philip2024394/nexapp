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
import { computePresence } from "@/lib/nex-native/mock-persona-presence";
import type { BroadcasterLibraryVideo } from "@/components/nex-native/live-commerce/BroadcasterLibrarySheet";
import { PERSONAS } from "../../../../../../scripts/mock-personas/persona-manifest.mjs";

/** Deterministic FNV-1a 32-bit hash · pure, no imports. Used to seed
 *  stable fake metrics per video id so the owner sees the SAME
 *  numbers between page loads (no SSR/client hydration flicker). */
function fnvHash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function seededIntBetween(seed: string, lo: number, hi: number): number {
  const h = fnvHash(seed);
  const span = hi - lo + 1;
  return lo + (h % span);
}

export const dynamic = "force-dynamic";

type DevPersonaSearchParams = { readonly v?: string };

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

// Owner directive 2026-10-26 · "can we show some mock cards for
// hendra". Hendra is a Watch Seller (Bogor) · this curated library
// gives his profile the look of a real small-shop seller with 8
// recent posts, varied realistic metrics, and poster thumbnails
// deterministic per id. Each entry's `id` is tied to a REAL dev
// video id so tap-to-play lands on a video that actually renders;
// title + metrics + poster are presentation overrides for the
// library sheet only.
interface PersonaMockLibraryEntry {
  readonly videoId: string;      // must exist in DEV_VIDEO_MANIFEST
  readonly title: string;
  readonly postedAtIso: string;
  readonly viewCount: number;
  readonly likeCount: number;
  readonly shareCount: number;
}

const HENDRA_MOCK_LIBRARY: readonly PersonaMockLibraryEntry[] = [
  // Order newest-first · varied cadence from "just now" to "3w ago".
  { videoId: "dev-video-14", title: "Rolex Submariner 16610 · Just arrived",       postedAtIso: "2026-10-26T06:40:00Z", viewCount: 1842, likeCount: 142, shareCount: 23 },
  { videoId: "dev-video-11", title: "Tudor Black Bay 58 · Hands-on review",         postedAtIso: "2026-10-25T14:12:00Z", viewCount: 3215, likeCount: 268, shareCount: 41 },
  { videoId: "dev-video-7",  title: "Omega Seamaster 300m · Blue dial close-up",    postedAtIso: "2026-10-24T09:30:00Z", viewCount: 892,  likeCount: 71,  shareCount: 8  },
  { videoId: "dev-video-19", title: "Patek Nautilus 5711 · Rare steel on display",  postedAtIso: "2026-10-22T16:00:00Z", viewCount: 12480, likeCount: 1104, shareCount: 182 },
  { videoId: "dev-video-9",  title: "Grand Seiko SBGA413 · Spring Drive explained", postedAtIso: "2026-10-19T11:45:00Z", viewCount: 2041, likeCount: 189, shareCount: 27 },
  { videoId: "dev-video-16", title: "AP Royal Oak 15202 · Dial authentication",     postedAtIso: "2026-10-14T13:20:00Z", viewCount: 5620, likeCount: 433, shareCount: 68 },
  { videoId: "dev-video-4",  title: "Vintage GMT Master Pepsi · Service return",    postedAtIso: "2026-10-08T10:00:00Z", viewCount: 1328, likeCount: 97,  shareCount: 14 },
  { videoId: "dev-video-2",  title: "Daily carry rotation · October picks",         postedAtIso: "2026-10-04T18:10:00Z", viewCount: 487,  likeCount: 34,  shareCount: 3  },
];

/** Deterministic poster URL · uses picsum.photos with the videoId as
 *  the seed so each card has a stable thumbnail across refreshes.
 *  Real surface will carry owner-authored posters. */
function devPosterUrl(videoId: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(videoId)}/320/180`;
}

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
  searchParams: Promise<DevPersonaSearchParams>;
}): Promise<React.JSX.Element> {
  const { handle } = await props.params;
  const { v: videoOverride } = await props.searchParams;
  if (!isDevManifestActive()) notFound();
  const persona = (PERSONAS as readonly Persona[]).find(
    (p) => p.handle === handle,
  );
  if (!persona) notFound();

  // Owner directive 2026-10-26 · "I have just scrolled or swiped
  // another video and lost my hendra · hendra should always appear
  // as I swipe". Swipe-nav routes back to this same persona page
  // with `?v=<nextVideoId>` so the persona identity is preserved.
  // Default = the persona's canonical video from PERSONA_VIDEO_MAP.
  const videoId = videoOverride ?? PERSONA_VIDEO_MAP[handle] ?? "dev-video-7";
  const row = getDevUploadedVideoById(videoId);
  const entry = DEV_VIDEO_MANIFEST.find((e) => e.id === videoId);
  if (!row || !entry) notFound();

  const siblings = listDevUploadedVideos({ limit: 100 }).map((r) => r.id);
  // Owner directive 2026-10-26 · Supabase storage URLs don't change
  // when an image is overwritten · the browser keeps serving the
  // disk-cached copy. Appending a per-request cache-buster forces
  // the browser to fetch the current PNG every time. Dev-only route
  // so the extra fetch cost is irrelevant.
  const avatarUrl = `${SUPABASE_BUCKET_URL}/${persona.avatarFile}?v=${Date.now()}`;

  // Owner directive 2026-10-26 · broadcaster library · in the dev
  // route the persona IS the broadcaster. Hendra gets a curated
  // Watch-Seller library (8 posts, owner-authored titles + varied
  // cadence) · every other handle falls back to the full dev-video
  // manifest with id-seeded fake metrics. Real surface would call
  // `listMyUploadedVideos(ownerAccountId)` instead.
  const libraryVideos: readonly BroadcasterLibraryVideo[] = persona.handle === "hendra"
    ? HENDRA_MOCK_LIBRARY.map((e) => {
        const vrow = getDevUploadedVideoById(e.videoId);
        return {
          id: e.videoId,
          title: e.title,
          postedAtIso: e.postedAtIso,
          posterUrl: devPosterUrl(e.videoId),
          durationSeconds: vrow?.duration_seconds ?? null,
          viewCount: e.viewCount,
          likeCount: e.likeCount,
          shareCount: e.shareCount,
        };
      })
    : DEV_VIDEO_MANIFEST.map((e) => ({
        id: e.id,
        title: e.title,
        postedAtIso: e.publishedAtIso,
        posterUrl: devPosterUrl(e.id),
        durationSeconds: e.durationSeconds,
        viewCount: seededIntBetween(`v:${e.id}`, 120, 48_000),
        likeCount: seededIntBetween(`l:${e.id}`, 8, 2_400),
        shareCount: seededIntBetween(`s:${e.id}`, 1, 180),
      }));

  return (
    <VideoViewerClient
      video={row}
      publicUrl={devVideoPublicUrl(entry)}
      siblingIds={siblings}
      // Owner directive 2026-10-26 · the dev persona IS the broadcaster
      // in this route · unlocks the broadcaster-only avatar press that
      // opens the library sheet (plus the sealed Products pill in ⋮).
      forceBroadcasterPreview={true}
      devRoleBanner="seller"
      libraryVideos={libraryVideos}
      /* Owner directive 2026-10-26 · inject the persona's identity
         into the composer header so the viewer reads as if that
         persona is broadcasting. Avatar comes from the sealed
         `nex-mock-personas` Supabase bucket. authorIsLive=true
         fires the sealed red ping dot on the avatar. */
      authorDisplayNameOverride={persona.displayName}
      authorAvatarUrlOverride={avatarUrl}
      authorIsLiveOverride={false}
      /* Owner directive 2026-10-26 (revised) · three-state
         presence from the sealed contacts-profile convention.
         online · green pulse · online + available
         busy   · orange pulse · siesta or ramp-up/down
         offline · red STATIC dot · asleep / Sunday off */
      authorPresence={computePresence(persona.handle).presence}
      /* Preserve persona identity on swipe · the client appends
         encodeURIComponent(nextVideoId) to this prefix so swipe-nav
         stays on this persona's dev page. Passed as a plain string
         (functions can't cross the server→client boundary). */
      videoHrefPrefix={`/nex-native/dev/live-persona/${persona.handle}?v=`}
    />
  );
}
