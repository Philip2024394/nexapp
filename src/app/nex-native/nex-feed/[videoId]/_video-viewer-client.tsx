"use client";

// src/app/nex-native/nex-feed/[videoId]/_video-viewer-client.tsx
//
// Full-bleed uploaded-video viewer · swipeable (up/down) across
// sibling videos · reuses the Live viewer's Like/View Shop/Share/
// NEX-keypad footer so the UX matches the Live surface.
//
// Doctrine (sealed · never drifted):
//   · Uploaded video is NEVER labelled "Live". Chip reads "RECORDED".
//   · Comments overlay is NOT mounted here · uploaded videos have
//     no live comments stream (that's a Live-only chrome).
//   · Share evidence is captured but no server action fires in dev
//     mode · dev manifest doesn't persist to Supabase.

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
// Owner-authorised 2026-11-01 · P0-1 · NEX Media Engine perf marks.
// Privacy-safe · no URLs / account IDs / tokens recorded.
import {
  startPerfSwipe,
  markPerfPhase,
  readSwipeContext,
  makeInitialLoadContext,
  type PerfMarkContext,
} from "@/lib/nex-native/media-engine/perf-marks";
import {
  LiveViewerFooter,
  type ShareEvidence,
} from "@/components/nex-native/live-commerce/LiveViewerFooter";
import {
  BroadcasterLibrarySheet,
  type BroadcasterLibraryVideo,
} from "@/components/nex-native/live-commerce/BroadcasterLibrarySheet";
import { MessagePanel } from "@/components/nex-native/live-commerce/MessagePanel";
import { getLiveInviteTargetAction } from "@/app/nex-native/live-commerce/_invite-target-action";
import type { InviteTarget } from "@/lib/nex-native/live-broadcast/invite-target";
import { VideoShareSheet } from "@/components/nex-native/live-commerce/VideoShareSheet";
import { CategoryGridSheet } from "@/components/nex-native/live-commerce/CategoryGridSheet";
// Owner directive 2026-11-05 iter 23 · retire LiveSideDrawer · the
// NEX Live viewer now mounts the global ControlDrawer (same `+`
// trigger + right-side slide panel as the chat header) so every
// NEX surface uses ONE drawer vocabulary. LiveSideDrawer source
// file is left intact for any other caller.
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";
// Owner directive 2026-11-05 iter 24 · magnifier scope correction ·
// the NEX Live search dropdown is a FEED affordance (hidden on chat
// surfaces · iter 24). Feed viewers mount the same component next
// to the `+` drawer so search is reachable from inside the reel.
import { NexLiveSearchButton } from "@/components/nex-native/chat-chrome/nex-live-search-button";
// Owner directive 2026-11-05 iter 25 · shoppable-card overlay · when
// a nex_product row references this video via background_video_id,
// a floating product card renders above the video chrome. Portaled
// so the sealed viewer tree is untouched.
import { ProductCardOverlayClient } from "./_product-card-overlay-client";
import {
  VideoCommentsOverlay,
  type VideoComment,
} from "@/components/nex-native/live-commerce/VideoCommentsOverlay";
import { SatelliteIconWithPing } from "@/components/nex-native/live-commerce/LiveSignalBadge";
import { resolveMarketCta } from "@/lib/nex-native/live-broadcast/market-cta-resolver";
import type { UploadedVideoRow } from "@/lib/nex-native/live-broadcast/uploaded-video-service";
import {
  attachHlsPlayer,
  isHlsSource,
} from "@/lib/nex-native/video-playback/attach-hls-player";
import { DevViewerBadge } from "@/components/nex-native/music/DevViewerBadge";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  text: "#F2F5F8",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  red: "#FF3355",
} as const;

/** Owner spec 2026-10-24 · "Posted 24 Jan" format in the viewer's
 *  locale. Uses Intl.DateTimeFormat so the day/month ordering adapts
 *  (24 Jan in en-GB, Jan 24 in en-US). Short month, no year unless
 *  the post is from a different year. */
function formatPostedDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameYear = d.getUTCFullYear() === now.getUTCFullYear();
  const fmt = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });
  return fmt.format(d);
}

export function VideoViewerClient({
  video,
  publicUrl,
  siblingIds,
  nextPublicUrl = null,
  prevPublicUrl = null,
  chainLabel,
  chainSlug,
  currentTopicLabel,
  forceBroadcasterPreview,
  devRoleBanner,
  likeCount,
  shareCount,
  saveCount,
  authorDisplayNameOverride,
  authorAvatarUrlOverride,
  authorIsLiveOverride,
  authorIsOnlineOverride,
  authorPresence,
  videoHrefPrefix,
  libraryVideos,
  broadcasterProductsOverride,
  devViewerBadge,
  feedModeLabel,
  drawerSession,
  drawerVisitor,
  product,
}: {
  readonly video: UploadedVideoRow;
  readonly publicUrl: string;
  readonly siblingIds: readonly string[];
  /** Owner directive 2026-10-27 · S2 streaming hardening · the
   *  server resolves the public URL of the swipe-next and swipe-
   *  prev videos so this client can mount hidden `<video
   *  preload="auto">` elements for them. Both are null at the
   *  boundaries of the chain (first / last video), or when the
   *  neighbour row couldn't be loaded. */
  readonly nextPublicUrl?: string | null;
  readonly prevPublicUrl?: string | null;
  /** Owner directive 2026-10-24 · optional category-chain context.
   *  Non-null when the viewer arrived via a category tile tap · the
   *  siblingIds are already filtered to the chain queue by the server
   *  component · so swipe-next naturally advances through the chain. */
  readonly chainLabel?: string | null;
  readonly chainSlug?: string | null;
  readonly currentTopicLabel?: string | null;
  /** Owner directive 2026-10-25 · dev-route override for the broadcaster
   *  preview flag. When `true` the Products pill / picker / featured-
   *  card slot ALL mount regardless of the `?preview=broadcaster` query
   *  param. When `false` they NEVER mount. Omit on real routes so the
   *  query-param gate is honoured. Used by `/nex-native/dev/live-seller`
   *  and `/nex-native/dev/live-viewer`. */
  readonly forceBroadcasterPreview?: boolean;
  /** Owner directive 2026-10-25 · dev-only role banner anchored at the
   *  top of the viewport. Makes it unmistakable which role the current
   *  page represents. Non-rendered on real routes. */
  readonly devRoleBanner?: "seller" | "viewer";
  /** Owner directive 2026-10-25 · engagement counts forwarded to the
   *  LiveViewerFooter so Like / Share / Save tiles render their count
   *  labels. Hiding at 0 is handled inside the footer based on the
   *  effective broadcaster flag. Omitting hides counts entirely. */
  readonly likeCount?: number;
  readonly shareCount?: number;
  readonly saveCount?: number;
  /** Owner directive 2026-10-26 · dev-route overrides for the
   *  author chrome. When provided, these win over the default
   *  (`authorDisplayName = video.title`, no avatar, not live) so a
   *  dev page can mount the viewer with a seeded persona's identity
   *  in the composer header + the sealed red "live" ping dot. */
  readonly authorDisplayNameOverride?: string;
  readonly authorAvatarUrlOverride?: string;
  readonly authorIsLiveOverride?: boolean;
  /** Owner directive 2026-10-26 · green "online" ping on the
   *  composer avatar (separate from the red live ping). Dev
   *  routes pass this to indicate the persona is online but
   *  not actively broadcasting. */
  readonly authorIsOnlineOverride?: boolean;
  /** Owner directive 2026-10-26 · three-state presence · wins over
   *  `authorIsOnlineOverride` when provided · forwarded straight
   *  to the LiveViewerFooter composer avatar. */
  readonly authorPresence?: "online" | "busy" | "offline";
  /** Owner directive 2026-10-26 · "I have just scrolled or swiped
   *  another video and lost my hendra · hendra should always appear
   *  as I swipe". Dev routes mounting the viewer for a specific
   *  persona pass a serialisable URL prefix (e.g.
   *  `/nex-native/dev/live-persona/hendra?v=`) and the client
   *  appends `encodeURIComponent(nextVideoId)`. Passed as a plain
   *  string so the server/client boundary stays serialisable
   *  (functions can't cross that boundary in Next.js). */
  readonly videoHrefPrefix?: string;
  /** Owner directive 2026-10-26 · "when hendra will press on his own
   *  profile image his library of posts … will show on the screen
   *  above". When this prop is non-empty AND the viewer is in
   *  broadcaster mode, tapping the author avatar opens the
   *  BroadcasterLibrarySheet. Omit on viewer routes. */
  readonly libraryVideos?: readonly BroadcasterLibraryVideo[];
  /** Owner authorisation 2026-10-26 (⋮ panel restoration) · when a
   *  caller supplies its own list of broadcaster products, use that
   *  instead of the generic Jakarta-market mock defined inside this
   *  file. The Hendra dev persona passes its 9-watch library so the
   *  Products pill in the ⋮ panel browses that catalogue · for both
   *  viewer and broadcaster paths. */
  readonly broadcasterProductsOverride?: ReadonlyArray<import("@/components/nex-native/live-commerce/LiveViewerFooter").FooterFeaturedProduct>;
  /** Owner-authorised 2026-10-30 · dev-only session chip. Null in
   *  production. "owner" → yellow · "viewer" → blue. Matches the
   *  music surface so dev can tell at a glance who's watching. */
  readonly devViewerBadge?: "owner" | "viewer" | null;
  /** Owner-authorised 2026-11-01 · Batch E.2 · viewer's current feed
   *  mode label ("Live Ireland", "Live World"). Replaces the
   *  "Live {country of origin}" title line so the header reflects the
   *  POOL the viewer is in, not the video's country of origin. */
  readonly feedModeLabel: string;
  /** Owner directive 2026-11-05 iter 23 · drives the new `+` control
   *  drawer that replaces the retired LiveSideDrawer. Null when the
   *  viewer is a guest · drawer renders the sealed sign-in prompt. */
  readonly drawerSession?: {
    readonly displayName: string;
    readonly nexHandle: string | null;
    readonly isBisnis: boolean;
  } | null;
  /** Owner directive 2026-11-05 iter 27 · commit 3 · provisional
   *  visitor identity · shown by the drawer's IdentityBar when
   *  drawerSession is null but a nex_session cookie resolved. */
  readonly drawerVisitor?: {
    readonly accountId: string;
    readonly nexHandle: string;
    readonly displayName: string;
  } | null;
  /** Owner directive 2026-11-05 iter 25 · shoppable-card overlay.
   *  When a `nex_product` row references this video via
   *  background_video_id (migration 280), the overlay renders on top
   *  of the video as a clickable product card. */
  readonly product?: {
    readonly productId: string;
    readonly businessId: string;
    readonly title: string;
    readonly pricePence: number | null;
    readonly currency: string | null;
    readonly imageUrl: string | null;
    readonly shopSlug: string | null;
  } | null;
}): React.JSX.Element {
  const router = useRouter();
  const [isLiked, setIsLiked] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [categorySheetOpen, setCategorySheetOpen] = React.useState(false);
  // Owner directive 2026-10-26 · Broadcaster Library sheet state.
  // In-memory pending set so the 5-sec undo window can restore
  // without any server round-trip. Dev-only semantics · real
  // surface will chain through the softRemoveUploadedVideo service.
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const [pendingDeletedIds, setPendingDeletedIds] = React.useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [lastDeleted, setLastDeleted] = React.useState<BroadcasterLibraryVideo | null>(null);
  // Owner directive 2026-10-24 · "live post feed should be active
  // for user to post to screen overlay like tiktok with profile
  // image and name" · client-only comments list for the current
  // viewer session. Not persisted; no multi-viewer fan-out.
  const [localComments, setLocalComments] = React.useState<
    readonly VideoComment[]
  >([]);
  // Owner directive 2026-10-24 · "add mock post and user to live
  // feed" · pre-seeded streaming mock comments so the overlay shows
  // visible activity while real multi-viewer fan-out is not wired.
  // Each entry is a tuple of [delayMs, displayName, text]. Mock
  // IDs use a `mock-` prefix so test selectors can distinguish from
  // user-posted comments.
  const MOCK_SCRIPT: ReadonlyArray<readonly [number, string, string]> =
    React.useMemo(
      () => [
        [1800,  "Maya",   "Is this available in black? 🖤"],
        [4200,  "Rizky",  "Looks amazing 🔥"],
        [7600,  "Dewi",   "How much is this?"],
        [11000, "Arief",  "Where in Bali?"],
        [14500, "Siti",   "Love the vibe ✨"],
        [18200, "Budi",   "Does it come in medium?"],
        [22100, "Tari",   "Can you ship to Jakarta?"],
        [26400, "Dika",   "Just subscribed 👋"],
      ],
      [],
    );
  React.useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const [delay, name, text] of MOCK_SCRIPT) {
      timers.push(
        setTimeout(() => {
          setLocalComments((prev) => {
            const next: VideoComment = {
              id: `mock-${delay}-${Math.random().toString(36).slice(2, 6)}`,
              authorDisplayName: name,
              text,
            };
            return prev.length > 48 ? [...prev.slice(-48), next] : [...prev, next];
          });
        }, delay),
      );
    }
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [MOCK_SCRIPT]);
  // Hydration-safe locale-aware country name resolution. Server
  // renders empty string; client fills in after mount so SSR
  // and hydration match regardless of host locale.
  const [countryLabel, setCountryLabel] = React.useState<string>("");
  React.useEffect(() => {
    if (!video.country_of_origin) {
      setCountryLabel("");
      return;
    }
    try {
      const names = new Intl.DisplayNames(undefined, { type: "region" });
      const resolved = names.of(video.country_of_origin);
      setCountryLabel(resolved && resolved !== video.country_of_origin ? resolved : "");
    } catch {
      setCountryLabel("");
    }
  }, [video.country_of_origin]);
  // Owner directive 2026-10-24 · preserve ?chain=slug across all
  // navigation (swipe · wheel · keyboard). Without this, the first
  // swipe strips the chain context and the server rebuilds siblingIds
  // as the unfiltered list — the chain chip vanishes and the chain
  // walk breaks.
  const chainQueryParam = chainSlug ? `?chain=${chainSlug}` : "";
  const videoHref = React.useCallback(
    (id: string): string =>
      videoHrefPrefix
        ? `${videoHrefPrefix}${encodeURIComponent(id)}`
        : `/nex-native/nex-feed/${id}${chainQueryParam}`,
    [chainQueryParam, videoHrefPrefix],
  );

  // Owner spec 2026-10-24 · landscape fallback. Portrait videos use
  // objectFit:cover for immersive full-bleed. Landscape (and other
  // odd ratios) switch to contain + blurred-fill background so the
  // video is NEVER stretched or distorted.
  const [isLandscape, setIsLandscape] = React.useState(false);
  // Hydration-safe locale formatting · 2026-10-24 fix.
  // `Intl.DateTimeFormat(undefined, …)` resolves to the Node process
  // locale server-side and to the browser locale client-side · they
  // differ ("Oct 25" vs "25 Oct") → React hydration mismatch. We
  // compute the locale-aware label ONLY on the client inside an
  // effect, so SSR renders the empty-string placeholder and the
  // user sees the correct locale as the first visible value.
  const [postedLabel, setPostedLabel] = React.useState<string>("");
  React.useEffect(() => {
    setPostedLabel(formatPostedDate(video.published_at ?? video.created_at));
  }, [video.published_at, video.created_at]);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  // Owner directive 2026-10-27 · S5 streaming foundation · attach
  // hls.js when the source is an HLS manifest. No-op for MP4 · so
  // existing content is unaffected until the HLS pipeline lands.
  // The dynamic import keeps hls.js out of the first-paint bundle.
  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (!isHlsSource(publicUrl)) return;
    let detach: (() => void) | null = null;
    let cancelled = false;
    attachHlsPlayer(el, publicUrl).then((d) => {
      if (cancelled) {
        d();
        return;
      }
      detach = d;
    });
    return () => {
      cancelled = true;
      detach?.();
    };
  }, [publicUrl]);
  // Owner directive 2026-10-25 · playback-progress 0..100 for the
  // thin cyan progress bar under the composer. Updated on
  // loadedmetadata + timeupdate · 0 until duration is known.
  const [videoProgress, setVideoProgress] = React.useState<number>(0);
  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const tick = () => {
      const d = el.duration;
      if (!Number.isFinite(d) || d <= 0) {
        setVideoProgress(0);
        return;
      }
      setVideoProgress(Math.max(0, Math.min(100, (el.currentTime / d) * 100)));
    };
    el.addEventListener("loadedmetadata", tick);
    el.addEventListener("timeupdate", tick);
    el.addEventListener("ended", tick);
    tick();
    return () => {
      el.removeEventListener("loadedmetadata", tick);
      el.removeEventListener("timeupdate", tick);
      el.removeEventListener("ended", tick);
    };
  }, [video.id]);
  // Owner directive 2026-10-25 (Phase B · recorded viewer wiring) ·
  // Message panel state + lazy InviteTarget resolution for the
  // video's owner_account_id. Dev-manifest videos use fake owner
  // UUIDs so the resolver returns null · the panel honestly renders
  // "This broadcaster has no public NEX handle · a connection
  // invitation cannot be sent yet" instead of a wiring-missing alert.
  const [messagePanelOpen, setMessagePanelOpen] = React.useState(false);
  const [inviteTarget, setInviteTarget] = React.useState<InviteTarget | null>(
    null,
  );
  const inviteTargetFetchedRef = React.useRef<string | null>(null);

  // Owner directive 2026-10-24 · "sound is auto playing with each
  // video live and always playing for live unless user will mute".
  // Default is UNMUTED · we try to play with sound on mount and
  // fall back to muted + "Tap for sound" ONLY if the browser blocks
  // the unmuted autoplay (first-visit origin without prior
  // activation). Once the user has engaged (tap/swipe/keyboard)
  // every subsequent video plays with sound immediately.
  const [isMuted, setIsMuted] = React.useState(false);
  const hasEverUnmutedRef = React.useRef(false);

  const tryUnmute = React.useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    el.volume = 1;
    hasEverUnmutedRef.current = true;
    setIsMuted(false);
    void el.play().catch(() => {});
  }, []);

  // Owner directive 2026-10-25 · persistent sound toggle in the header
  // right-cluster. Mirrors the video element's muted state in both
  // directions: unmute when muted, mute when unmuted.
  const toggleSound = React.useCallback(() => {
    const el = videoRef.current;
    if (!el) {
      setIsMuted((v) => !v);
      return;
    }
    const next = !el.muted;
    el.muted = next;
    if (!next) {
      el.volume = 1;
      hasEverUnmutedRef.current = true;
      void el.play().catch(() => {});
    }
    setIsMuted(next);
  }, []);

  // On mount (and whenever we switch video.id) · attempt to play
  // UNMUTED. Browsers may reject with NotAllowedError if the origin
  // has no user-activation. Catch that, fall back to muted play, and
  // the "Tap for sound" chip prompts the user. Any user interaction
  // flips `hasEverUnmutedRef` so later videos skip the fallback.
  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    el.volume = 1;
    void el.play().then(
      () => {
        setIsMuted(false);
      },
      () => {
        // Browser blocked unmuted autoplay · fallback to muted so
        // the viewer still sees motion, and surface the chip.
        el.muted = true;
        setIsMuted(true);
        void el.play().catch(() => {});
      },
    );
  }, [video.id]);

  // Swipe navigation across the sibling list · same gesture rules
  // as the Live viewer (60px threshold · horizontal-dominant guard).
  const currentIndex = React.useMemo(() => {
    const idx = siblingIds.indexOf(video.id);
    return idx === -1 ? 0 : idx;
  }, [siblingIds, video.id]);
  const nextId = currentIndex < siblingIds.length - 1
    ? siblingIds[currentIndex + 1]
    : null;
  const prevId = currentIndex > 0 ? siblingIds[currentIndex - 1] : null;

  // Owner directive 2026-10-27 · S3 streaming hardening ·
  // router.prefetch warms the Next.js route tree + bundle for the
  // neighbour clips. Pairs with S2's hidden <video preload="auto">:
  //   S2 warms the ASSET (video chunks).
  //   S3 warms the ROUTE (React tree + any lazy chunks).
  // Together, swipe transitions avoid both the "fetch bytes" and
  // the "render page" cold starts. Prefetch is cheap · Next.js
  // dedupes concurrent requests and respects the user's data-saver
  // preference automatically.
  React.useEffect(() => {
    if (nextId) router.prefetch(videoHref(nextId));
    if (prevId) router.prefetch(videoHref(prevId));
  }, [nextId, prevId, router]);

  // Owner directive 2026-10-24 · "swipe must be screen same as tiktok
  // not button . but also active swipe up or down with mouse on
  // computer". Pointer events unify touch (phone) and mouse (desktop)
  // swipe so the SAME code path drives both. The pills are gone ·
  // the whole screen is the swipe surface.
  //
  // Behaviour contract:
  //   · Any gesture on the viewer surface is a user interaction →
  //     unmute if still muted (TikTok-style first-gesture-grants-sound)
  //   · Threshold = 60px vertical / horizontal-dominant guard
  //   · Mouse DOWN → DRAG → UP works on desktop (mouse-wheel optional,
  //     added separately below)
  //   · Pointer events capture even if cursor leaves the surface
  //     mid-drag (setPointerCapture)
  //   · Touch is preserved via the same pointer-events pipeline (iOS
  //     Safari 13+, Android Chrome 55+)
  const pointerStartRef = React.useRef<
    { x: number; y: number; id: number } | null
  >(null);
  // Owner-authorised 2026-11-01 · P0-1 · video perf marks. Reads
  // feed mode + country from URL so every mark carries honest context.
  const videoSearchParams = useSearchParams();
  const videoSwipeCorrelationIdRef = React.useRef<string | null>(null);
  const videoPerfContext = React.useCallback((): Omit<PerfMarkContext, "swipeCorrelationId"> => {
    const country = videoSearchParams?.get("country")?.toUpperCase();
    return {
      feedKind: "video",
      feedMode: country ? "country" : "worldwide",
      countryCode: country || undefined,
    };
  }, [videoSearchParams]);

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      // Ignore starts on interactive descendants (buttons, links,
      // the composer). Only the raw viewer surface drives swipe.
      const target = e.target as HTMLElement | null;
      if (target && target.closest("button, a, textarea, input")) return;
      pointerStartRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      // Perf mark · swipe gesture begins · correlation ID persisted.
      const ctx = videoPerfContext();
      videoSwipeCorrelationIdRef.current = startPerfSwipe(
        ctx.feedKind,
        ctx.feedMode,
        ctx.countryCode,
      );
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [videoPerfContext],
  );
  // Owner directive 2026-10-27 · S4-light · "swipe prepaint" ·
  // before `router.push` fires, we imperatively point the current
  // <video> element at the preloaded neighbour src and call .play().
  // The R5c hidden preload warmed the browser cache, so the new
  // frame paints near-instantly. router.push catches up in the
  // background and the remounted element serves from the same
  // cache. For swipes beyond the preloaded set (`nextPublicUrl` /
  // `prevPublicUrl` null) we fall back to vanilla router.push.
  const navigateWithPrepaint = React.useCallback(
    (direction: "next" | "prev") => {
      const targetId = direction === "next" ? nextId : prevId;
      if (!targetId) return;
      const targetUrl = direction === "next" ? nextPublicUrl : prevPublicUrl;
      const el = videoRef.current;
      if (targetUrl && el) {
        // Hot-swap the current element so the viewer sees the next
        // frame immediately. The upcoming remount re-creates the
        // element with the same src from props · browser serves
        // the chunks from HTTP cache so playback continues cleanly.
        try {
          el.src = targetUrl;
          el.load();
          // Autoplay policies honour muted · the user's unmute
          // state is already handled by the component on mount.
          void el.play();
        } catch {
          /* non-fatal · router.push below still navigates */
        }
      }
      // Perf mark · nav-begin · fires just before router.push.
      const corr = videoSwipeCorrelationIdRef.current;
      if (corr) {
        const ctx = videoPerfContext();
        markPerfPhase("nav-begin", { ...ctx, swipeCorrelationId: corr });
      }
      router.push(videoHref(targetId));
    },
    [nextId, prevId, nextPublicUrl, prevPublicUrl, router, videoPerfContext],
  );

  const handlePointerUp = React.useCallback(
    (e: React.PointerEvent) => {
      const start = pointerStartRef.current;
      if (!start || start.id !== e.pointerId) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      pointerStartRef.current = null;
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      // Any gesture = user interaction · unmute first time.
      if (isMuted) tryUnmute();
      if (Math.abs(dx) > Math.abs(dy)) return;
      if (Math.abs(dy) < 60) return;
      // Perf mark · pointer released + swipe committed.
      const corr = videoSwipeCorrelationIdRef.current;
      if (corr) {
        const ctx = videoPerfContext();
        markPerfPhase("pointerup", { ...ctx, swipeCorrelationId: corr });
      }
      if (dy < 0 && nextId) {
        navigateWithPrepaint("next");
      } else if (dy > 0 && prevId) {
        navigateWithPrepaint("prev");
      }
    },
    [nextId, prevId, navigateWithPrepaint, isMuted, tryUnmute, videoPerfContext],
  );

  // Owner-authorised 2026-11-01 · P0-1 · video post-nav perf marks.
  // Reads swipe context persisted by the previous slide and fires
  // nav-complete + slide-visible + poster-loaded + video-loadeddata +
  // video-first-frame + buffer-stall marks for this mounted slide.
  // Null-op when no swipe context exists (fresh load / direct URL).
  React.useEffect(() => {
    // Owner-authorised 2026-11-01 (P0-1 amendment) · fire video
    // lifecycle marks for initial load too, using a synthetic context
    // when no swipe context exists.
    let ctx = readSwipeContext();
    const isInitialLoad = ctx === null;
    if (ctx && ctx.feedKind !== "video") {
      // Context exists but was persisted by the music viewer (mode
      // mismatch) · treat as initial load so marks still fire against
      // a clean video correlation.
      ctx = null;
    }
    if (!ctx) {
      ctx = makeInitialLoadContext(
        "video",
        videoSearchParams?.get("country")?.toUpperCase() ? "country" : "worldwide",
        videoSearchParams?.get("country")?.toUpperCase() || undefined,
      );
    }

    if (!isInitialLoad) {
      markPerfPhase("nav-complete", ctx);
    }
    let slideVisibleFired = false;
    const slideVisibleRaf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        slideVisibleFired = true;
        markPerfPhase("slide-visible", ctx);
      });
    });

    // Poster image · video elements can carry `poster` attribute · we
    // observe its load/decode via a temporary Image() mirror. If the
    // element doesn't advertise a poster, skip silently.
    const vid = videoRef.current;
    if (vid && vid.poster) {
      const posterImg = new Image();
      posterImg.src = vid.poster;
      if (posterImg.complete) {
        markPerfPhase("poster-loaded", ctx);
        posterImg
          .decode()
          .then(() => markPerfPhase("poster-decoded", ctx))
          .catch(() => {});
      } else {
        posterImg.onload = () => {
          markPerfPhase("poster-loaded", ctx);
          posterImg
            .decode()
            .then(() => markPerfPhase("poster-decoded", ctx))
            .catch(() => {});
        };
      }
    }

    // Video media events. Attach as one-shot listeners; the sealed
    // viewer owns the `<video>` ref so we just read it here.
    const detaches: Array<() => void> = [];
    if (vid) {
      const onLoadedData = () => {
        markPerfPhase("video-loadeddata", ctx);
      };
      const onPlaying = () => {
        markPerfPhase("video-playback-start", ctx);
        // First-frame proxy · onPlaying fires AFTER buffered frame is
        // ready and playback is actually advancing. More portable
        // than requestVideoFrameCallback (Safari 15.4+ only).
        markPerfPhase("video-first-frame", ctx);
      };
      let stallActive = false;
      const onWaiting = () => {
        if (!stallActive) {
          stallActive = true;
          markPerfPhase("video-buffer-stall-start", ctx);
        }
      };
      const onPlayingAfterStall = () => {
        if (stallActive) {
          stallActive = false;
          markPerfPhase("video-buffer-stall-end", ctx);
        }
      };
      vid.addEventListener("loadeddata", onLoadedData, { once: true });
      vid.addEventListener("playing", onPlaying, { once: true });
      vid.addEventListener("waiting", onWaiting);
      vid.addEventListener("playing", onPlayingAfterStall);
      detaches.push(() => {
        vid.removeEventListener("loadeddata", onLoadedData);
        vid.removeEventListener("playing", onPlaying);
        vid.removeEventListener("waiting", onWaiting);
        vid.removeEventListener("playing", onPlayingAfterStall);
      });
    }

    return () => {
      if (!slideVisibleFired) cancelAnimationFrame(slideVisibleRaf);
      for (const d of detaches) d();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);
  const handlePointerCancel = React.useCallback((e: React.PointerEvent) => {
    if (pointerStartRef.current?.id === e.pointerId) {
      pointerStartRef.current = null;
    }
  }, []);

  // Mouse wheel on desktop · each scroll tick past a threshold
  // navigates (debounced so a single trackpad flick doesn't skip
  // multiple videos).
  const wheelCooldownRef = React.useRef(0);
  const handleWheel = React.useCallback(
    (e: React.WheelEvent) => {
      // Ignore wheel over the composer so textarea scroll still works.
      const target = e.target as HTMLElement | null;
      if (target && target.closest("textarea, input, button, a")) return;
      if (Math.abs(e.deltaY) < 20) return;
      const now = Date.now();
      if (now < wheelCooldownRef.current) return;
      wheelCooldownRef.current = now + 700;
      if (e.deltaY > 0 && nextId) {
        navigateWithPrepaint("next");
      } else if (e.deltaY < 0 && prevId) {
        navigateWithPrepaint("prev");
      }
    },
    [nextId, prevId, navigateWithPrepaint],
  );

  // Keyboard mirror · same rules as the Live viewer. Skipped when
  // a composer textarea/input is focused.
  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) {
        return;
      }
      if ((ev.key === "ArrowDown" || ev.key === "PageDown") && nextId) {
        ev.preventDefault();
        navigateWithPrepaint("next");
      } else if ((ev.key === "ArrowUp" || ev.key === "PageUp") && prevId) {
        ev.preventDefault();
        navigateWithPrepaint("prev");
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    return undefined;
  }, [nextId, prevId, navigateWithPrepaint]);

  // Owner directive 2026-10-25 · broadcaster-preview flag.
  // Reading `?preview=broadcaster` from the URL opens the
  // Products pill + picker + featured-card slot in dev. Real
  // broadcaster-identity (session.user.id === video.owner_
  // account_id) is a separate wiring slice · we gate strictly
  // on the query flag for now so no viewer sees broadcaster
  // chrome by accident. Reading `window.location` inside a
  // state initialiser is SSR-safe because this file is marked
  // `"use client"` and the initial render happens after mount.
  const [isBroadcasterPreview, setIsBroadcasterPreview] = React.useState(
    forceBroadcasterPreview === true,
  );
  React.useEffect(() => {
    // Dev-route override wins over the query-param flag · the two
    // dedicated dev routes (`/dev/live-seller` and `/dev/live-viewer`)
    // pin the role regardless of URL params.
    if (typeof forceBroadcasterPreview === "boolean") {
      setIsBroadcasterPreview(forceBroadcasterPreview);
      return;
    }
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setIsBroadcasterPreview(sp.get("preview") === "broadcaster");
  }, [forceBroadcasterPreview]);

  // Owner directive 2026-10-25 · dev-only mock products shown
  // in the picker overlay. Real catalog wiring is a follow-up
  // slice (session.user → shop → products). Deterministic IDs
  // for test selection.
  const mockBroadcasterProducts = React.useMemo(
    () => [
      { id: "mock-product-1", name: "Teak Carved Elephant",   priceLabel: "Rp 285,000" },
      { id: "mock-product-2", name: "Batik Scarf · Yogya",     priceLabel: "Rp 125,000" },
      { id: "mock-product-3", name: "Hand-rolled Clove Cigars", priceLabel: "Rp 48,000" },
      { id: "mock-product-4", name: "Volcanic Stone Mortar",   priceLabel: "Rp 320,000" },
      { id: "mock-product-5", name: "Rattan Fruit Basket",     priceLabel: "Rp 95,000" },
    ],
    [],
  );
  // Owner authorisation 2026-10-26 (⋮ panel restoration) · when the
  // caller supplies a persona-specific list (e.g. the Hendra dev
  // page's 9-watch library), that list wins over the generic mock.
  const effectiveBroadcasterProducts = broadcasterProductsOverride ?? mockBroadcasterProducts;

  // Footer handlers · same contract as the Live viewer footer.
  // Owner directive 2026-10-25 · "user can only like a video one
  // time". One-way like · the first tap sets isLiked=true · subsequent
  // taps are no-ops. The count display adds +1 locally when isLiked
  // becomes true (optimistic UI · server source of truth stays in
  // the `likeCount` prop · a server action will replace this when
  // the sandbox lands).
  const handleLike = React.useCallback(() => {
    setIsLiked((prev) => (prev ? prev : true));
  }, []);
  const handleComment = React.useCallback((text: string) => {
    // Owner directive 2026-10-24 · "live post feed should be active
    // for user to post to screen overlay like tiktok with profile
    // image and name" · client-only append · overlay auto-expires.
    const next: VideoComment = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      authorDisplayName: "You",
      text,
    };
    setLocalComments((prev) =>
      prev.length > 48 ? [...prev.slice(-48), next] : [...prev, next],
    );
  }, []);
  const handleShareEvidence = React.useCallback(
    (evidence: ShareEvidence) => {
      if (typeof document !== "undefined") {
        document.body.dataset.nexVideoLastShareEvidence = evidence;
      }
    },
    [],
  );

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/nex-native/nex-feed/${video.id}`
      : `/nex-native/nex-feed/${video.id}`;

  return (
    <>
    <main
      data-nex-video-viewer
      data-nex-video-viewer-id={video.id}
      data-nex-video-viewer-swipe-prev={prevId ?? ""}
      data-nex-video-viewer-swipe-next={nextId ?? ""}
      data-nex-video-viewer-index={currentIndex}
      data-nex-video-viewer-sibling-count={siblingIds.length}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onWheel={handleWheel}
      style={{
        // Owner directive 2026-10-24 · "footer buttons and video not
        // fitting mobile screen" · the previous `100vw`/`100dvh` broke
        // out of the mobile phone frame on desktop preview (nex-native
        // layout clamps to 420×909 on viewports ≥500px via `.nex-native-
        // frame`). Switch to `100%` so the viewer fills the frame
        // exactly · on real mobile phones the frame is `100%` width /
        // `100dvh` height so the behaviour is identical.
        height: "100%",
        width: "100%",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        touchAction: "pan-y",
      }}
    >
      {/* Full-bleed video surface */}
      <div
        style={{
          flex: 1,
          position: "relative",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Owner spec 2026-10-24 · "For landscape or other aspect
            ratios, avoid stretching or distorting the video. Choose
            a suitable fit or background treatment." The blurred-fill
            background renders ONLY when the video is landscape · it
            duplicates the video with scale-up + strong blur so the
            immersive feel is preserved without cropping the subject
            or stretching the pixels. */}
        {isLandscape && (
          <video
            data-nex-video-viewer-bg-fill
            src={publicUrl}
            autoPlay
            loop
            muted
            playsInline
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(32px) brightness(0.5)",
              transform: "scale(1.15)",
              pointerEvents: "none",
            }}
          />
        )}
        <video
          ref={videoRef}
          data-nex-video-viewer-element
          data-nex-video-viewer-landscape={isLandscape ? "true" : "false"}
          src={publicUrl}
          autoPlay
          loop
          muted={isMuted}
          playsInline
          controls={false}
          /* Owner directive 2026-10-27 · S1 streaming hardening ·
             `preload="auto"` tells the browser to fetch video chunks
             the moment the element mounts, not wait for play(). Takes
             the ~5s "feels slow" cold-start off the first frame on
             good networks. Harmless on 3G (the browser throttles its
             own fetch rate) · pairs with S2 neighbour-preload below. */
          preload="auto"
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            // Guard against zero-dim races on some browsers.
            if (el.videoWidth > 0 && el.videoHeight > 0) {
              setIsLandscape(el.videoWidth > el.videoHeight);
            }
          }}
          onClick={() => {
            // Tap on video = unmute if still muted · otherwise toggle
            // mute (second tap re-mutes). TikTok-style quick toggle.
            if (isMuted) tryUnmute();
            else {
              const el = videoRef.current;
              if (!el) return;
              el.muted = true;
              setIsMuted(true);
            }
          }}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            // Owner spec 2026-10-24 · cover for portrait (immersive
            // full-bleed, 9:16 feel), contain for landscape (no
            // stretching · blurred fill behind avoids black bars).
            objectFit: isLandscape ? "contain" : "cover",
            zIndex: 1,
          }}
        />
        {/* Owner directive 2026-10-27 · S2 streaming hardening ·
            hidden <video preload="auto"> elements for the swipe-
            next and swipe-prev clips. They never paint (0×0, zero
            opacity, pointer-events none) · their sole job is to
            make the browser's network layer start fetching chunks
            so the next clip's first frame is already decoded by
            the time the user swipes. `muted` + `playsInline`
            satisfy mobile autoplay policies, but `autoPlay` is
            OFF · we only want the bytes, not the playback. */}
        {nextPublicUrl ? (
          <video
            data-nex-video-viewer-prefetch="next"
            src={nextPublicUrl}
            preload="auto"
            muted
            playsInline
            aria-hidden
            tabIndex={-1}
            style={{
              position: "absolute",
              width: 0,
              height: 0,
              opacity: 0,
              pointerEvents: "none",
              zIndex: -1,
            }}
          />
        ) : null}
        {prevPublicUrl ? (
          <video
            data-nex-video-viewer-prefetch="prev"
            src={prevPublicUrl}
            preload="auto"
            muted
            playsInline
            aria-hidden
            tabIndex={-1}
            style={{
              position: "absolute",
              width: 0,
              height: 0,
              opacity: 0,
              pointerEvents: "none",
              zIndex: -1,
            }}
          />
        ) : null}
        {/* Owner directive 2026-10-24 · header row with:
              [🔍 left] · [Live {Country} · Broadcasted {date}] · [⋮ right]
            zIndex: 2 so the title stays above the video's zIndex: 1
            (fixing the "disappearing after first paint" bug). The
            standalone LiveSignalBadge is retired · the "Live {Country}"
            text carries the surface identity. */}
        <div
          data-nex-video-viewer-header
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0px) + 10px)",
            left: 10,
            right: 10,
            display: "grid",
            // Owner directive 2026-10-24 · title on the left, both
            // icons grouped on the right (search + 3-dot).
            gridTemplateColumns: "1fr auto",
            gap: 10,
            alignItems: "center",
            zIndex: 2,
          }}
        >
          {/* Title · "Live {Country}" + "Broadcasted {date}" + chain chip */}
          <div
            data-nex-video-viewer-title
            style={{
              minWidth: 0,
              // Owner directive 2026-10-24 · "remove the container
              // from live indonesia". The blurred-navy panel is
              // retired; text floats directly over the video with a
              // text-shadow for legibility (same approach as the
              // broadcaster header).
              textShadow: "0 1px 4px rgba(0,0,0,0.65)",
            }}
          >
            <div
              data-nex-video-viewer-title-primary
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: NEX.text,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              {/* Owner directive 2026-10-24 · satellite-tower icon
                  with ping-wave effect inline left of "Live". White
                  monochrome · same organic scan the Live chrome used
                  before the recent header rewrite. */}
              {/* Owner directive 2026-11-02 · satellite tower + ping
               *  retired from the video-viewer header. The icon mount
               *  (and its earlier Change B unification with the music
               *  header) are no longer rendered · the feed-mode label
               *  text ("Live Ireland" / "Live World") stands alone.
               *  Matches the identical retirement on the music
               *  header in the same commit. */}
              <span data-nex-video-viewer-title-text>
                {feedModeLabel}
              </span>
              {/* Owner directive 2026-11-01 · "when video is ai the ai
                  small badge will show after live world or live
                  ireland". Second mount of the sealed AI chip (the
                  first mount after "Broadcasted X" is retained
                  unchanged) so viewers see the AI signal in the
                  primary title context too. Same style tokens as the
                  sealed Migration-221 chip at line 1072+. Reads the
                  same `video.is_ai_generated` source · same null-safe
                  normalisation (?? false). */}
              {(video.is_ai_generated ?? false) && (
                <span
                  data-nex-video-viewer-ai-chip-title
                  aria-label="AI-generated video"
                  style={{
                    display: "inline-block",
                    marginLeft: 6,
                    padding: "0 5px",
                    borderRadius: 4,
                    background: "rgba(255, 51, 85, 0.14)",
                    border: `1px solid ${NEX.red}`,
                    color: NEX.red,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.03em",
                    lineHeight: 1.4,
                    verticalAlign: "baseline",
                  }}
                >
                  AI
                </span>
              )}
            </div>
            <div
              data-nex-video-viewer-title-secondary
              data-nex-video-viewer-posted-date={video.published_at ?? ""}
              style={{
                marginTop: 2,
                fontSize: 11,
                color: "#D9E6F5",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {postedLabel ? `Broadcasted ${postedLabel}` : ""}
              {/* Owner directive 2026-11-01 · supersedes Migration 221
                  2026-10-25 Broadcasted-X chip position. "remove 1 of
                  the ai badges from header" · the owner's current
                  single-source AI signal is the chip placed
                  IMMEDIATELY after the feedModeLabel ("Live Ireland" /
                  "Live World") at line 1055+ in this file. Keeping two
                  chips in the header is redundant · this sealed
                  Broadcasted-X chip is retired. The data attribute
                  `data-nex-video-viewer-ai-chip-title` on the retained
                  chip is what the AI-video signal binds to going
                  forward. Migration 221's `?? false` null-safety and
                  the doctrine "absence does not imply human origin"
                  are preserved on the retained chip. */}
              {devRoleBanner && (
                /* Owner directive 2026-10-25 · "badge must displaying
                   for dev seller and dev user under broadcasting" ·
                   render under the "Broadcasted {date}" line, inside
                   the header. Never renders on real routes. */
                <span
                  data-nex-video-viewer-dev-banner
                  data-nex-video-viewer-dev-banner-role={devRoleBanner}
                  style={{
                    display: "block",
                    marginTop: 3,
                    padding: "2px 7px",
                    borderRadius: 999,
                    width: "fit-content",
                    background:
                      devRoleBanner === "seller"
                        ? "rgba(255, 193, 7, 0.95)"
                        : "rgba(0, 175, 255, 0.95)",
                    color: "#0A0F1E",
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    lineHeight: 1.4,
                    boxShadow: "0 1px 3px -1px rgba(0,0,0,0.55)",
                  }}
                >
                  DEV · {devRoleBanner === "seller" ? "Seller" : "User"}
                </span>
              )}
            </div>
            {/* Owner directive 2026-10-24 · chain-context chip ·
                visible when the viewer arrived via a category tile.
                Shows the chain label + the current sub-topic so the
                user understands why "swipe up" goes to the next
                related topic (e.g. Temple → Volcano → Beach). */}
            {chainLabel && (
              <div
                data-nex-video-viewer-chain-chip
                data-nex-video-viewer-chain-slug={chainSlug ?? ""}
                style={{
                  marginTop: 4,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "2px 7px",
                  borderRadius: 6,
                  background: "rgba(0, 175, 255, 0.18)",
                  border: "1px solid rgba(0, 175, 255, 0.42)",
                  fontSize: 10,
                  fontWeight: 800,
                  color: NEX.cyan,
                  letterSpacing: "0.02em",
                  lineHeight: 1,
                }}
              >
                <span aria-hidden>▸</span>
                <span>{chainLabel}</span>
                {currentTopicLabel && (
                  <>
                    <span style={{ opacity: 0.6 }}>·</span>
                    <span data-nex-video-viewer-chain-topic>
                      {currentTopicLabel}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          {/* Owner directive 2026-10-25 · header right-icon group ·
              magnifying glass (bare icon · no bg chip) + sound toggle
              (bars when on · speaker-muted with red line when off) +
              3-dot drawer. Drawer keeps its own chrome. */}
          <div
            data-nex-video-viewer-header-actions
            style={{
              // Owner directive 2026-10-27 · "leave space between them
              // so user can select with phone touch screen" · gap
              // bumped 4 → 10 so touch targets never visually bleed.
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {/* Magnifying glass · bare white monochrome SVG · opens
                12-tile category sheet. Owner directive 2026-10-25
                removed the circular glass chip; only the icon shows. */}
            <button
              type="button"
              data-nex-video-viewer-search
              aria-label="Open categories"
              onClick={() => {
                // Owner directive 2026-10-26 · mutual exclusion ·
                // category tiles and library sheet never co-open.
                // Closing the library first keeps the transition
                // clean (library's fade-out starts, then category
                // tiles fade in).
                if (libraryOpen) setLibraryOpen(false);
                setCategorySheetOpen(true);
              }}
              style={{
                width: 44,
                height: 44,
                background: "transparent",
                border: "none",
                color: "#FFFFFF",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
                filter:
                  "drop-shadow(0 1px 1px rgba(0,0,0,0.6)) drop-shadow(0 0 2px rgba(0,0,0,0.4))",
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
            {/* Owner directive 2026-10-27 · "move message icon and
                pill to right side of magnifying glass in header" ·
                this slot is a React-portal target for the Hendra
                inbox 💬 trigger (HendraMessageInbox mounts into it
                via createPortal). The slot sits between the search
                icon and the 3-dot drawer, so the message chip reads
                as part of the header icon row. On non-Hendra routes
                the slot stays empty and the row collapses around it. */}
            <div
              data-nex-video-viewer-header-messages-slot
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 0,
                minHeight: 44,
              }}
            />
            {/* The retired persistent sound toggle lived here · its
                functionality moved to the ⋮ panel's Sound pill. The
                non-rendering <button> below is kept as a schema stub
                so any dangling test selector still resolves to an
                element; `display: none` guarantees zero paint. */}
            <button
              type="button"
              data-nex-video-viewer-sound-toggle
              data-nex-sound-on={isMuted ? "false" : "true"}
              aria-label={isMuted ? "Unmute sound" : "Mute sound"}
              aria-pressed={!isMuted}
              aria-hidden
              hidden
              onClick={toggleSound}
              style={{
                display: "none",
              }}
            >
              {isMuted ? (
                /* Muted speaker · speaker glyph + red diagonal line */
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path
                    d="M3 9v6h4l5 4V5l-5 4H3z"
                    fill="currentColor"
                    stroke="currentColor"
                  />
                  <line
                    x1="4"
                    y1="4"
                    x2="20"
                    y2="20"
                    stroke={NEX.red}
                    strokeWidth="2.4"
                  />
                </svg>
              ) : (
                /* Playing · animated audio bars (SMIL) */
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <rect
                    x="4"
                    y="8"
                    width="3"
                    height="8"
                    rx="1.5"
                    fill="currentColor"
                  >
                    <animate
                      attributeName="height"
                      values="8;3;13;8"
                      dur="0.9s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="y"
                      values="8;10.5;5.5;8"
                      dur="0.9s"
                      repeatCount="indefinite"
                    />
                  </rect>
                  <rect
                    x="10.5"
                    y="4"
                    width="3"
                    height="16"
                    rx="1.5"
                    fill="currentColor"
                  >
                    <animate
                      attributeName="height"
                      values="16;7;12;16"
                      dur="0.9s"
                      begin="0.22s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="y"
                      values="4;8.5;6;4"
                      dur="0.9s"
                      begin="0.22s"
                      repeatCount="indefinite"
                    />
                  </rect>
                  <rect
                    x="17"
                    y="6"
                    width="3"
                    height="12"
                    rx="1.5"
                    fill="currentColor"
                  >
                    <animate
                      attributeName="height"
                      values="12;5;14;12"
                      dur="0.9s"
                      begin="0.45s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="y"
                      values="6;9.5;5;6"
                      dur="0.9s"
                      begin="0.45s"
                      repeatCount="indefinite"
                    />
                  </rect>
                </svg>
              )}
            </button>
            {/* Owner directive 2026-11-05 iter 23 · the retired
                LiveSideDrawer is replaced by the global ControlDrawer
                (same `+` trigger and right-slide panel as the chat
                header) so every NEX surface uses ONE drawer vocab.
                `data-nex-video-viewer-menu-trigger` wrapper preserved
                for sealed test selectors. */}
            <div
              data-nex-video-viewer-menu-trigger
              style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
            >
              <NexLiveSearchButton />
              <ControlDrawer
                session={(drawerSession ?? null) as ControlDrawerSession | null}
                triggerIcon="plus"
                currentSurface="live"
                drawerVisitor={drawerVisitor ?? null}
                triggerStyle={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#000000",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  color: "#FFFFFF",
                  boxShadow:
                    "0 6px 18px rgba(0,0,0,0.55), inset 0 0 0 1px color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 24%, transparent)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
      {/* Tap to unmute chip · owner directive "sound must be active"
          · browsers block autoplay with sound so we start muted and
          prompt the user. One tap anywhere (video, swipe gesture,
          this chip) unmutes · chip disappears afterward. */}
      {isMuted && (
        <button
          type="button"
          data-nex-video-viewer-unmute
          aria-label="Tap to unmute sound"
          onClick={tryUnmute}
          style={{
            position: "absolute",
            left: "50%",
            top: "calc(env(safe-area-inset-top, 0px) + 68px)",
            transform: "translateX(-50%)",
            padding: "8px 14px",
            borderRadius: 999,
            background: "rgba(2, 9, 20, 0.72)",
            border: "1px solid rgba(255,255,255,0.26)",
            color: "#FFFFFF",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.04em",
            cursor: "pointer",
            zIndex: 3,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <span aria-hidden style={{ fontSize: 14 }}>🔇</span>
          Tap for sound
        </button>
      )}

      {/* Owner directive 2026-10-24 · "swipe must be screen same as
          tiktok not button". The whole viewer surface is the swipe
          target (see onPointerDown/Up on <main>) · no on-screen
          affordance. Mouse-drag on desktop + touch on mobile share
          the same pointer-event pipeline. Mouse-wheel also navigates
          with a 700ms cooldown. */}
      {/* Footer · Like / View Shop / Share / NEX keypad composer.
          For an uploaded video, View Shop opens the owner's shop. */}
      {/* Owner directive 2026-10-24 · "View Shop" vs "View Market"
          decided by resolveMarketCta(video) · uploaded videos with no
          business attachment land on the Search Directory (category-
          filtered when topic_tags map to a known category). */}
      <LiveViewerFooter
        viewShopHref={resolveMarketCta(video).href}
        viewTargetLabel={resolveMarketCta(video).label}
        viewTargetAriaLabel={resolveMarketCta(video).ariaLabel}
        viewTargetKind={resolveMarketCta(video).kind}
        shareUrl={shareUrl}
        shareTitle={video.title}
        onLike={handleLike}
        onComment={handleComment}
        onShareRequested={() => setShareOpen(true)}
        onShareEvidence={handleShareEvidence}
        isLiked={isLiked}
        disabled={false}
        /* Owner directive 2026-10-27 · "move the sound off from
           header to the container" · wire the sealed `isMuted`
           state + `toggleSound` callback through so the ⋮ panel's
           Sound pill mirrors (and toggles) the <video>.muted
           attribute. The header-side toggle is removed in this
           same pass. */
        isMuted={isMuted}
        onToggleSound={toggleSound}
        /* Owner directive 2026-10-25 (Phase B) · Message pill opens
           the sealed connection-invitation flow (reuses
           createFriendRequestAction). We lazily resolve the video
           owner's InviteTarget on first open · dev-manifest videos
           use fake UUIDs so the resolver returns null and the panel
           shows the honest "not invitable" state. */
        onMessagePressed={() => {
          setMessagePanelOpen(true);
          const ownerId = video.owner_account_id;
          if (
            typeof ownerId === "string"
            && ownerId.length > 0
            && inviteTargetFetchedRef.current !== ownerId
          ) {
            inviteTargetFetchedRef.current = ownerId;
            void getLiveInviteTargetAction(ownerId).then((result) => {
              if (result.kind === "ok") setInviteTarget(result.target);
              else setInviteTarget(null);
            });
          }
        }}
        /* Owner directive 2026-10-25 (revised) · playback progress
           for the recorded video. The parent updates `videoProgress`
           from the <video> element's `timeupdate` so the scrub bar
           reflects live playback. `onSeek` lets the viewer drag the
           white dot to scrub back/forward · we set `video.currentTime`
           and the next `timeupdate` reconciles the state. */
        videoProgressPercent={videoProgress}
        onSeek={(pct) => {
          const el = videoRef.current;
          if (!el) return;
          const d = el.duration;
          if (!Number.isFinite(d) || d <= 0) return;
          el.currentTime = Math.max(0, Math.min(d, (pct / 100) * d));
        }}
        /* Owner directive 2026-10-25 · composer-header author
           identity. Uploaded video → use the video's title as the
           display name until a real author join (owner_account_id →
           display_name/avatar_url) lands. Recorded content is not
           currently live so authorIsLive stays false (no red ping). */
        authorDisplayName={authorDisplayNameOverride ?? video.title}
        authorAvatarUrl={authorAvatarUrlOverride ?? null}
        authorIsLive={authorIsLiveOverride ?? false}
        authorIsOnline={authorIsOnlineOverride ?? false}
        authorPresence={authorPresence}
        isBroadcaster={isBroadcasterPreview}
        broadcasterProducts={effectiveBroadcasterProducts}
        likeCount={likeCount}
        shareCount={shareCount}
        saveCount={saveCount}
        onAuthorAvatarPress={
          libraryVideos && libraryVideos.length > 0 && isBroadcasterPreview
            ? () => {
                // Owner directive 2026-10-26 · mutual exclusion ·
                // close categories first if open · then open library.
                if (categorySheetOpen) setCategorySheetOpen(false);
                setLibraryOpen(true);
              }
            : undefined
        }
        hiddenForOverlay={libraryOpen}
      />
      {/* Owner directive 2026-10-26 · Broadcaster library sheet ·
          opens when the broadcaster taps their own avatar frame.
          Pure UI · the dev route feeds the library list via the
          `libraryVideos` prop. Delete uses an in-memory pending
          set for the 5-sec undo window (dev-only semantics · the
          real surface will route through the `softRemoveUploadedVideo`
          service and the restore call). */}
      {libraryVideos && libraryVideos.length > 0 && (
        <BroadcasterLibrarySheet
          open={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          videos={libraryVideos.filter((v) => !pendingDeletedIds.has(v.id))}
          broadcasterAvatarUrl={authorAvatarUrlOverride ?? null}
          broadcasterDisplayName={authorDisplayNameOverride ?? video.title}
          // Owner directive 2026-10-26 · Creator Loop trio ·
          // Live routes to the sealed Live-welcome flow (same path
          // the ⋮ "Live" tile uses). Record is an honest stub
          // until the record UI lands · logs intent so we see it
          // fires. Both callbacks close the sheet so Hendra lands
          // on the next surface without a stale overlay behind.
          // Owner directive 2026-10-27 · Live Library tiles reshaped
          // from 4 (Live/Record/Draft/Insights) to 3 (Go Live/Create/
          // Studio). Each handler closes the library sheet and routes
          // to a real surface:
          //   · Go Live → /nex-native/live-commerce/welcome (sealed)
          //   · Create  → /nex-native/manage/watches/new (Stage A
          //                redesign 2026-10-28: category picker +
          //                colour variants + watch spec sheet)
          //   · Studio  → /nex-native/live-commerce/studio (Insights,
          //                Followers, Shop hub)
          onLive={() => {
            setLibraryOpen(false);
            router.push("/nex-native/live-commerce/welcome");
          }}
          onCreate={() => {
            // Owner directive 2026-10-28 · Gate 7 Option 1 · Create tile
            // opens the 5-card NEX Create entry page. Only Card A
            // (Go Live) is functional in this phase · Cards B-E render
            // as Coming soon placeholders. The Watches route remains
            // reachable via /nex-native/manage/watches/new (unchanged).
            setLibraryOpen(false);
            router.push("/nex-native/create");
          }}
          onStudio={() => {
            setLibraryOpen(false);
            router.push("/nex-native/live-commerce/studio");
          }}
          onPlay={(v) => {
            setLibraryOpen(false);
            router.push(videoHref(v.id));
          }}
          onShareToContact={(v) => {
            // Reuses the sealed VideoShareSheet · hand it the id so
            // the share sheet surfaces this specific post's shortcut.
            setLibraryOpen(false);
            setShareOpen(true);
            void v;
          }}
          onDelete={(v) => {
            setPendingDeletedIds((prev) => {
              const next = new Set(prev);
              next.add(v.id);
              return next;
            });
            setLastDeleted(v);
            // 5-second undo window. Real surface would also call
            // softRemoveUploadedVideo here · we keep the pending
            // state only so the owner can see the pattern.
            window.setTimeout(() => {
              setLastDeleted((cur) => (cur?.id === v.id ? null : cur));
            }, 5000);
          }}
        />
      )}
      {/* Undo toast · surfaces for 5 s after a soft-delete. */}
      {lastDeleted && (
        <div
          data-nex-broadcaster-library-undo
          role="status"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 90,
            background: "rgba(10,15,30,0.98)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "10px 14px",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 10px 30px -10px rgba(0,0,0,0.6)",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "#F2F5F8" }}>
            Post removed · you have 5 s to undo
          </span>
          <button
            type="button"
            onClick={() => {
              setPendingDeletedIds((prev) => {
                const next = new Set(prev);
                next.delete(lastDeleted.id);
                return next;
              });
              setLastDeleted(null);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#00AFFF",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            UNDO
          </button>
        </div>
      )}
      {messagePanelOpen && (
        <MessagePanel
          open={messagePanelOpen}
          onClose={() => setMessagePanelOpen(false)}
          target={inviteTarget}
          isGuest={false}
          signInHref={
            typeof window !== "undefined"
              ? `/nex-native/sign-in?returnTo=${encodeURIComponent(
                  window.location.pathname + window.location.search,
                )}`
              : "/nex-native/sign-in"
          }
        />
      )}
      {/* Owner spec 2026-10-24 · 3-option share bottom sheet. Owned
          by the viewer parent so it overlays the WHOLE viewer, not
          just the footer. See VideoShareSheet.tsx. */}
      <VideoShareSheet
        open={shareOpen}
        shareUrl={shareUrl}
        shareTitle={video.title}
        onClose={() => setShareOpen(false)}
        onShared={(evidence) => handleShareEvidence(evidence)}
      />
      {/* Owner directive 2026-10-24 · magnifying-glass opens a 12-tile
          category grid overlay. Tiles are placeholders · final labels
          + routing deferred to the Discovery system. */}
      <CategoryGridSheet
        open={categorySheetOpen}
        onClose={() => setCategorySheetOpen(false)}
        onCategoryPick={(tile) => {
          // Owner directive 2026-10-24 · route into the chain-entry
          // resolver · it computes the queue server-side and 302s to
          // the first video with ?chain=slug attached. From there,
          // swipe-up walks the chain (temple→volcano→beach) because
          // the server rebuilds siblingIds as the queue.
          router.push(`/nex-native/live-commerce/discover/${tile.slug}`);
        }}
      />
      {/* ViewerMenuSheet retired · ControlDrawer (mounted in the
          header icon group above) is now the right-side drawer, same
          as on /contacts. */}
      {/* Owner directive 2026-10-24 · TikTok-style floating comments
          driven by the composer's send action. Client-only, no DB,
          no real-time fan-out. */}
      {/* Owner directive 2026-10-26 · "when the category buttons are
          active the feed posting must not show in the back ground
          until closed" · hide the live comments feed while the
          category tiles are open · also hide while the broadcaster
          library is open (same rationale · dedicated surface should
          own the screen). */}
      {!categorySheetOpen && !libraryOpen && (
        <VideoCommentsOverlay comments={localComments} />
      )}
    </main>
    {devViewerBadge && <DevViewerBadge kind={devViewerBadge} />}
    {/* Owner directive 2026-11-05 iter 25 · shoppable-card overlay ·
        null-safe · renders a fixed-bottom-left card above the viewer
        when a nex_product row references this video as its
        background. Zero intrusion into the sealed viewer tree. */}
    <ProductCardOverlayClient product={product ?? null} />
    </>
  );
}
