"use client";

// src/app/nex-native/videos/[videoId]/_video-viewer-client.tsx
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
import { useRouter } from "next/navigation";
import {
  LiveViewerFooter,
  type ShareEvidence,
} from "@/components/nex-native/live-commerce/LiveViewerFooter";
import { MessagePanel } from "@/components/nex-native/live-commerce/MessagePanel";
import { getLiveInviteTargetAction } from "@/app/nex-native/live-commerce/_invite-target-action";
import type { InviteTarget } from "@/lib/nex-native/live-broadcast/invite-target";
import { VideoShareSheet } from "@/components/nex-native/live-commerce/VideoShareSheet";
import { CategoryGridSheet } from "@/components/nex-native/live-commerce/CategoryGridSheet";
import { LiveSideDrawer } from "@/components/nex-native/live-commerce/LiveSideDrawer";
import {
  VideoCommentsOverlay,
  type VideoComment,
} from "@/components/nex-native/live-commerce/VideoCommentsOverlay";
import { SatelliteIconWithPing } from "@/components/nex-native/live-commerce/LiveSignalBadge";
import { resolveMarketCta } from "@/lib/nex-native/live-broadcast/market-cta-resolver";
import type { UploadedVideoRow } from "@/lib/nex-native/live-broadcast/uploaded-video-service";

const NEX = {
  bg: "#020914",
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
  chainLabel,
  chainSlug,
  currentTopicLabel,
  forceBroadcasterPreview,
  devRoleBanner,
  likeCount,
  shareCount,
  saveCount,
}: {
  readonly video: UploadedVideoRow;
  readonly publicUrl: string;
  readonly siblingIds: readonly string[];
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
}): React.JSX.Element {
  const router = useRouter();
  const [isLiked, setIsLiked] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [categorySheetOpen, setCategorySheetOpen] = React.useState(false);
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
      `/nex-native/videos/${id}${chainQueryParam}`,
    [chainQueryParam],
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
  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      // Ignore starts on interactive descendants (buttons, links,
      // the composer). Only the raw viewer surface drives swipe.
      const target = e.target as HTMLElement | null;
      if (target && target.closest("button, a, textarea, input")) return;
      pointerStartRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [],
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
      if (dy < 0 && nextId) {
        router.push(videoHref(nextId));
      } else if (dy > 0 && prevId) {
        router.push(videoHref(prevId));
      }
    },
    [nextId, prevId, router, isMuted, tryUnmute],
  );
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
        router.push(videoHref(nextId));
      } else if (e.deltaY < 0 && prevId) {
        router.push(videoHref(prevId));
      }
    },
    [nextId, prevId, router],
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
        router.push(videoHref(nextId));
      } else if ((ev.key === "ArrowUp" || ev.key === "PageUp") && prevId) {
        ev.preventDefault();
        router.push(videoHref(prevId));
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    return undefined;
  }, [nextId, prevId, router]);

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
      ? `${window.location.origin}/nex-native/videos/${video.id}`
      : `/nex-native/videos/${video.id}`;

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
              <span
                data-nex-video-viewer-live-icon
                aria-hidden
                style={{
                  display: "inline-flex",
                  flexShrink: 0,
                  // Owner directive 2026-10-24 · "move tower over 3px
                  // and text" · nudge the icon 3px right so there's
                  // breathing room from the left container edge; the
                  // whole title row inherits the shift via inline-flex
                  // gap and the span's extra marginRight.
                  marginLeft: 3,
                  textShadow: "none",
                }}
              >
                {/* Owner directive 2026-10-25 · "ping in header only
                    ping lines change to white color · tower is red
                    remain" · split the single accent into tower +
                    ping. Tower + ball-dot stay in NEX dark red;
                    the 3 concentric ping-wave rings render WHITE. */}
                <SatelliteIconWithPing
                  accentColor="#B30000"
                  pingColor="#FFFFFF"
                />
              </span>
              <span data-nex-video-viewer-title-text>
                Live {countryLabel || video.country_of_origin || "NEX"}
              </span>
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
              {/* Owner directive 2026-10-25 · Migration 221 · when the
                  video's authoritative record carries `is_ai_generated
                  === true` the header appends a compact red "(AI)"
                  chip IMMEDIATELY after the broadcast date. Absence
                  of the chip does NOT imply human origin (NEX makes
                  no claim about unlabelled videos). The `?? false`
                  normalisation protects pre-migration rows where the
                  column is missing from the PostgREST read. */}
              {(video.is_ai_generated ?? false) && (
                <span
                  data-nex-video-viewer-ai-chip
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
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {/* Magnifying glass · bare white monochrome SVG · opens
                12-tile category sheet. Owner directive 2026-10-25
                removed the circular glass chip; only the icon shows. */}
            <button
              type="button"
              data-nex-video-viewer-search
              aria-label="Open categories"
              onClick={() => setCategorySheetOpen(true)}
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
            {/* Owner directive 2026-10-25 · persistent sound toggle.
                Shown ON = animated audio bars (currentColor white).
                Shown OFF = static speaker glyph with a red diagonal
                line (NEX red #FF3355). Mirrors the <video>.muted
                attribute via toggleSound; coexists with the floating
                "Tap for sound" chip which only shows on first-visit
                autoplay-blocked state. */}
            <button
              type="button"
              data-nex-video-viewer-sound-toggle
              data-nex-sound-on={isMuted ? "false" : "true"}
              aria-label={isMuted ? "Unmute sound" : "Mute sound"}
              aria-pressed={!isMuted}
              onClick={toggleSound}
              style={{
                width: 36,
                height: 36,
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
            {/* Owner directive 2026-10-25 · Live surfaces now mount
                their own `LiveSideDrawer` (same visual chrome as the
                sealed ControlDrawer, but Nex-Live header + 3 nav rows
                + home icon that routes to /contacts). The viewer's
                `data-nex-video-viewer-menu-trigger` marker stays as a
                wrapper data-attribute for test selectors. */}
            <div data-nex-video-viewer-menu-trigger>
              <LiveSideDrawer />
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
        authorDisplayName={video.title}
        authorIsLive={false}
        isBroadcaster={isBroadcasterPreview}
        broadcasterProducts={mockBroadcasterProducts}
        likeCount={likeCount}
        shareCount={shareCount}
        saveCount={saveCount}
      />
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
      <VideoCommentsOverlay comments={localComments} />
    </main>
    </>
  );
}
