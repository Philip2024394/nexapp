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
import { VideoViewerClient } from "@/app/nex-native/nex-feed/[videoId]/_video-viewer-client";
// computePresence intentionally not imported · see "remove green dot"
// edit below. Re-add when real presence/live wiring returns.
import type { BroadcasterLibraryVideo } from "@/components/nex-native/live-commerce/BroadcasterLibrarySheet";
// Owner directive 2026-10-26 · collapsible watch-description overlay
// over Hendra's video. Dev-only · reads watch metadata from the
// current DEV_VIDEO_MANIFEST entry (watchBrand / watchHeadline /
// watchDescription). Mounted as a sibling of VideoViewerClient so
// VideoViewerClient itself is untouched.
import { WatchOverlayCaption } from "@/components/nex-native/live-commerce/WatchOverlayCaption";
// Owner directive 2026-10-26 (Round 3e) · broadcaster-only message
// inbox · dev mock · persists in sessionStorage only. Flagged as such
// in the panel. Production wire-up is Amendment 2 §12 Live Message
// Container (still gated on multiple Round-2 decisions).
import { HendraMessageInbox } from "@/components/nex-native/live-commerce/HendraMessageInbox";
// Owner directive 2026-10-26 (Round 3f) · floating yellow Buy Now
// pill under the broadcaster header · renders only when the current
// manifest entry carries `buyNowPriceIdr`. Self-hides when the
// product panel is expanded (sealed body data-attribute CSS).
import { BuyNowButton } from "@/components/nex-native/live-commerce/BuyNowButton";
// Owner directive 2026-10-26 (Round 3i) · heart / like button with
// persistence, toggle unlike, and floating-heart animation when
// co-watchers are at the same timestamp. Lives on the right rail,
// stacked above the broadcaster/footer chrome. Dev-only until the
// production like service is wired.
import { VideoLikeButton } from "@/components/nex-native/live-commerce/VideoLikeButton";
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
  // Owner directive 2026-10-26 · Hendra opens on his flagship Rolex
  // Daytona listing (dev-video-hendra-01) so the first-paint carries
  // the watch overlay he just uploaded.
  hendra: "dev-video-hendra-01",
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
  // Owner directive 2026-10-26 · 9 real watch-content uploads supplied
  // by the owner. Order newest-first · varied cadence from "just now"
  // to "1 month ago". Each videoId references a `dev-video-hendra-NN`
  // entry in DEV_VIDEO_MANIFEST which carries the watchBrand +
  // watchHeadline + watchDescription read by WatchOverlayCaption.
  { videoId: "dev-video-hendra-15", title: "Yellow Gold Chronograph · Green Dial · Open-Heart",   postedAtIso: "2026-10-28T08:25:00Z", viewCount: 2340,  likeCount: 186,  shareCount: 29  },
  { videoId: "dev-video-hendra-14", title: "Yellow Gold Cushion Chronograph · Blue Dial",         postedAtIso: "2026-10-28T08:20:00Z", viewCount: 1215,  likeCount: 94,   shareCount: 15  },
  { videoId: "dev-video-hendra-13", title: "Rose Gold Pavé Diamond Chronograph · Skeleton",       postedAtIso: "2026-10-28T08:15:00Z", viewCount: 4120,  likeCount: 338,  shareCount: 61  },
  { videoId: "dev-video-hendra-12", title: "Jewelry Watch · Green MOP · 12 Gem Markers",          postedAtIso: "2026-10-28T08:10:00Z", viewCount: 1560,  likeCount: 124,  shareCount: 19  },
  { videoId: "dev-video-hendra-11", title: "Nordgreen Infinity Petite · Blue",                    postedAtIso: "2026-10-28T08:05:00Z", viewCount: 385,   likeCount: 28,   shareCount: 3   },
  { videoId: "dev-video-hendra-10", title: "Dual-Time Watch · World Map + Classic",               postedAtIso: "2026-10-28T08:00:00Z", viewCount: 1050,  likeCount: 82,   shareCount: 12  },
  { videoId: "dev-video-hendra-01", title: "Rolex Cosmograph Daytona · Two-tone",                 postedAtIso: "2026-10-26T06:40:00Z", viewCount: 1842,  likeCount: 142,  shareCount: 23  },
  { videoId: "dev-video-hendra-04", title: "Rolex Collection · 15-watch showcase",                postedAtIso: "2026-10-25T14:12:00Z", viewCount: 12480, likeCount: 1104, shareCount: 182 },
  { videoId: "dev-video-hendra-05", title: "Omega Speedmaster · Silver Snoopy 50th Anniversary",  postedAtIso: "2026-10-24T09:30:00Z", viewCount: 3215,  likeCount: 268,  shareCount: 41  },
  { videoId: "dev-video-hendra-09", title: "Patek Philippe Grandmaster Chime Ref. 6300",          postedAtIso: "2026-10-22T16:00:00Z", viewCount: 5620,  likeCount: 433,  shareCount: 68  },
  { videoId: "dev-video-hendra-07", title: "Hublot Big Bang MP-09 · Tourbillon Bi-Axis 11/50",    postedAtIso: "2026-10-19T11:45:00Z", viewCount: 2041,  likeCount: 189,  shareCount: 27  },
  { videoId: "dev-video-hendra-06", title: "Jacob & Co. Astronomia · The Godfather / Casino",     postedAtIso: "2026-10-14T13:20:00Z", viewCount: 892,   likeCount: 71,   shareCount: 8   },
  { videoId: "dev-video-hendra-08", title: "Jacob & Co. Bugatti Chiron Tourbillon · W16",         postedAtIso: "2026-10-08T10:00:00Z", viewCount: 1328,  likeCount: 97,   shareCount: 14  },
  { videoId: "dev-video-hendra-02", title: "Gold automatic chronograph · leather strap",          postedAtIso: "2026-10-04T18:10:00Z", viewCount: 487,   likeCount: 34,   shareCount: 3   },
  { videoId: "dev-video-hendra-03", title: "Open-heart automatic · green dial",                   postedAtIso: "2026-09-26T09:15:00Z", viewCount: 612,   likeCount: 48,   shareCount: 5   },
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
  // Owner directive 2026-10-27 · "real video instead of image on the
  // cards" · thread `videoUrl` through to BroadcasterLibrarySheet so
  // each card can autoplay a muted preview. We look up the manifest
  // entry by id to get the filename, which `devVideoPublicUrl` turns
  // into the public path.
  const libraryVideos: readonly BroadcasterLibraryVideo[] = persona.handle === "hendra"
    ? HENDRA_MOCK_LIBRARY.map((e) => {
        const vrow = getDevUploadedVideoById(e.videoId);
        const manifestEntry = DEV_VIDEO_MANIFEST.find((x) => x.id === e.videoId);
        return {
          id: e.videoId,
          title: e.title,
          postedAtIso: e.postedAtIso,
          posterUrl: devPosterUrl(e.videoId),
          videoUrl: manifestEntry ? devVideoPublicUrl(manifestEntry) : null,
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
        videoUrl: devVideoPublicUrl(e),
        durationSeconds: e.durationSeconds,
        viewCount: seededIntBetween(`v:${e.id}`, 120, 48_000),
        likeCount: seededIntBetween(`l:${e.id}`, 8, 2_400),
        shareCount: seededIntBetween(`s:${e.id}`, 1, 180),
      }));

  return (
    <>
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
      /* Owner authorisation 2026-10-26 (⋮ panel restoration) · for the
         Hendra dev persona, pass the actual 9-watch library through
         to the ⋮ Products pill so the broadcaster picker (and the
         viewer browse sheet) reads Hendra's real catalogue instead
         of the generic Jakarta-market mock. Other personas fall back
         to the generic mock inside VideoViewerClient. */
      broadcasterProductsOverride={
        persona.handle === "hendra"
          ? HENDRA_MOCK_LIBRARY.map((e) => {
              const m = DEV_VIDEO_MANIFEST.find((x) => x.id === e.videoId);
              const priceLabel =
                m?.buyNowPriceIdr && m.buyNowPriceIdr > 0
                  ? `Rp ${m.buyNowPriceIdr.toLocaleString("id-ID")}`
                  : "On request";
              return {
                id: e.videoId,
                name: m?.watchHeadline ?? e.title,
                priceLabel,
                imageUrl: devPosterUrl(e.videoId),
                subtitle: m?.watchBrand ?? null,
                href: `/nex-native/dev/live-persona/${persona.handle}?v=${e.videoId}`,
              };
            })
          : undefined
      }
      /* Owner directive 2026-10-26 · inject the persona's identity
         into the composer header so the viewer reads as if that
         persona is broadcasting. Avatar comes from the sealed
         `nex-mock-personas` Supabase bucket. authorIsLive=true
         fires the sealed red ping dot on the avatar. */
      authorDisplayNameOverride={persona.displayName}
      authorAvatarUrlOverride={avatarUrl}
      authorIsLiveOverride={false}
      /* Owner directive 2026-10-26 (Round 3e) · "remove the green dot
         from hendra image". Presence prop intentionally omitted so no
         green/orange/red ping renders on the avatar frame. Will be
         reintroduced when real live/presence wiring arrives. */
      /* Preserve persona identity on swipe · the client appends
         encodeURIComponent(nextVideoId) to this prefix so swipe-nav
         stays on this persona's dev page. Passed as a plain string
         (functions can't cross the server→client boundary). */
      videoHrefPrefix={`/nex-native/dev/live-persona/${persona.handle}?v=`}
    />
    {/* Owner directive 2026-10-26 · collapsed watch pill over Hendra's
        video · tap to expand upward and read the full description.
        Only renders when the current manifest entry carries watch
        metadata (brand/headline/description) · generic clips are
        unaffected. */}
    <WatchOverlayCaption
      headline={entry.watchHeadline}
      description={entry.watchDescription}
      brand={entry.watchBrand}
      sellerDisplayName={persona.displayName}
      sellerHandle={`nex-${persona.handle}`}
      /* Owner directive 2026-10-26 · Hendra persona points at his
         dev shop URL. Production will carry the real nex_business
         slug once Hendra is seeded as a real account (Round 3b §3f
         gap item 4). */
      shopHref={
        persona.handle === "hendra"
          ? `/nex-native/dev/live-persona/${persona.handle}/shop`
          : undefined
      }
      shopLabel="Shop"
      /* Owner directive 2026-10-26 (Round 3d) · yellow numbered dev
         annotation badges on every section so the owner can reference
         sections by number during review. Dev route only · never on
         a production viewer surface. */
      devAnnotate={true}
      bottomOffsetPx={persona.handle === "hendra" ? 100 : 88}
      /* Owner directive 2026-10-26 (Round 3f) · brand per-thumb is
         pre-computed on the otherVideos map above (Next.js RSC rule:
         no function props across the server→client boundary). */
      /* Owner directive 2026-10-26 · "Other videos" grid feeds from
         Hendra's library · excludes the current video so the viewer
         only sees NEW watches. */
      otherVideos={
        // Owner directive 2026-10-26 (Round 3e) · Video Center shows
        // ALL 9 of Hendra's videos (not filtered) so the owner sees
        // the full library from the overlay.
        // Round 3f · each thumb carries its own `brand` string so the
        // card renders the right brand UNDER the 9:16 mini-screen
        // without needing a server→client function prop (Next.js RSC).
        persona.handle === "hendra"
          ? HENDRA_MOCK_LIBRARY.map((e) => {
              const m = DEV_VIDEO_MANIFEST.find((x) => x.id === e.videoId);
              return {
                id: e.videoId,
                headline: m?.watchHeadline ?? e.title,
                posterUrl: devPosterUrl(e.videoId),
                href: `/nex-native/dev/live-persona/${persona.handle}?v=${e.videoId}`,
                brand: m?.watchBrand,
                // Owner directive 2026-10-26 (Round 3i) · Video Center
                // now shows the VIDEO (muted + looped preview), not the
                // static poster.
                videoUrl: m ? devVideoPublicUrl(m) : undefined,
              };
            })
          : undefined
      }
      specs={{
        caseDiameterMm: entry.caseDiameterMm,
        caseThicknessMm: entry.caseThicknessMm,
        lugToLugMm: entry.lugToLugMm,
        movement: entry.movement,
        movementCaliber: entry.movementCaliber,
        waterResistanceM: entry.waterResistanceM,
        caseMaterial: entry.caseMaterial,
        strapMaterial: entry.strapMaterial,
        strapWidthMm: entry.strapWidthMm,
        strapLengthMm: entry.strapLengthMm,
        madeIn: entry.madeIn,
        condition: entry.condition,
        fullSet: entry.fullSet,
        packaging: entry.packaging,
        authenticity: entry.authenticity,
        warrantyNote: entry.warrantyNote,
        shippingScope: entry.shippingScope,
        pricingModes: entry.pricingModes,
        priceNote: entry.priceNote,
        productionYear: entry.productionYear,
        dialColor: entry.dialColor,
        complications: entry.complications,
      }}
    />
    {/* Owner directive 2026-10-26 (Round 3e) · broadcaster inbox is
        Hendra-only · the floating 💬 button + inbox panel are hidden
        on every other persona route. */}
    {persona.handle === "hendra" ? (
      <HendraMessageInbox ownerDisplayName={persona.displayName} />
    ) : null}
    {/* Owner directive 2026-10-26 (Round 3f) · floating yellow Buy Now
        pill · renders only when the current entry has a price. Both
        the pill and the overlay self-hide via sealed CSS when the
        product panel is expanded. */}
    <BuyNowButton
      priceIdr={entry.buyNowPriceIdr}
      productLabel={entry.watchHeadline ?? entry.title}
      sellerLabel={persona.displayName}
    />
    {/* Owner directive 2026-10-26 (Round 3i) · heart on the right rail.
        · Persists across swipe + return via localStorage.
        · First-tap floating-heart animation when co-watchers exist.
        · Co-watchers count is seeded deterministically per video id
          so the owner sees the SAME number on refresh (no fake
          randomness between loads). */}
    <div
      data-nex-live-like-rail
      style={{
        position: "fixed",
        right: 14,
        bottom: 180,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 36,
        pointerEvents: "none",
      }}
    >
      <VideoLikeButton
        videoId={entry.id}
        categoryId={entry.watchBrand ? "watches" : "general"}
        broadcasterLabel={persona.displayName}
        coWatchersAtTimestamp={seededIntBetween(entry.id + "@cowatch", 1, 7)}
        /* Round 3i-hardening · explicit opt-in · this is the dev
           persona route (/nex-native/dev/live-persona/<handle>) · the
           chip renders with a visible DEMO label. Production surfaces
           must leave `simulated` undefined/false, in which case the
           chip does not render at all. */
        simulated={true}
      />
    </div>
    </>
  );
}
