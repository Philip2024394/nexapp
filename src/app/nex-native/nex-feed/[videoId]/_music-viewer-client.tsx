"use client";

// src/app/nex-native/nex-feed/[videoId]/_music-viewer-client.tsx
//
// Owner-authorised 2026-10-30 (iteration C) · "the page should be 100%
// same as hendra preview page music" supersedes the four-item overlay
// list from iteration B · the LiveViewerFooter / BroadcasterLibrarySheet
// / VideoCommentsOverlay are intentionally NOT mounted here, because:
//   · The preview page does not have a bottom LiveViewerFooter — it uses
//     `MusicActionsStack` on the right rail for like + share. Mounting a
//     bottom composer broke visual parity (3-dot and heart appeared at
//     the top of the composer while the actual composer field + author
//     avatar were obscured by the music player overlay).
//   · BroadcasterLibrarySheet is video-shaped (duration, played-at,
//     play count). The music-native equivalent is `MusicLibraryOverlay`,
//     which the shell already mounts via its `library` prop.
//   · VideoCommentsOverlay has no DB fan-out yet; preview surface omits
//     it, so the feed slide matches.
//
// Chrome shipped (parity with preview page):
//   · Shell background + rotating-avatar top header + NexMusicPlayerOverlay
//     + Up-Next banner + MusicLibraryOverlay (via MusicPostShell).
//   · Right-rail MusicActionsStack with like + share wired to the sealed
//     `toggleMusicTrackLikeAction` / `recordMusicTrackShareAction`.
//   · Top-right LiveSideDrawer (same component the preview uses).
//   · Top-right search icon (opens CategoryGridSheet in viewer context —
//     intentional divergence from preview, which routes to the owner's
//     upload-music library; viewer category tiles fit this surface
//     better than an owner-only route).
//
// Sealed gates preserved:
//   · Gate 1 (pointer-swipe consistency) · pointer start/up/cancel +
//     horizontal-dominant guard + interactive-descendant guard + nav-
//     lock safety timer.
//   · Gate 2 (minimum wheel safety) · 120 ms settle + descendant guard.

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
// Owner-authorised 2026-11-01 · P0-1 · NEX Media Engine performance
// instrumentation. SHARED surface across Worldwide / Ireland /
// Indonesia / future country feeds. Privacy-safe · marks never record
// URLs, account IDs, or signed tokens.
import {
  startPerfSwipe,
  markPerfPhase,
  readSwipeContext,
  makeInitialLoadContext,
  type PerfMarkContext,
} from "@/lib/nex-native/media-engine/perf-marks";
import { NexPerfOverlay } from "@/components/nex-native/media-engine/NexPerfOverlay";
import { CategoryGridSheet } from "@/components/nex-native/live-commerce/CategoryGridSheet";
import { HendraMessageInbox } from "@/components/nex-native/live-commerce/HendraMessageInbox";
import { LiveSideDrawer } from "@/components/nex-native/live-commerce/LiveSideDrawer";
import { VideoShareSheet } from "@/components/nex-native/live-commerce/VideoShareSheet";
import { DevViewerBadge } from "@/components/nex-native/music/DevViewerBadge";
import { MusicActionsStack } from "@/components/nex-native/music/MusicActionsStack";
import { MusicDescriptionAffordance } from "@/components/nex-native/music/MusicDescriptionAffordance";
import { MusicPostShell } from "@/components/nex-native/music/MusicPostShell";
import { IrishShamrockBurst } from "@/components/nex-native/country-flare/IrishShamrockBurst";
import {
  toggleMusicTrackLikeAction,
  recordMusicTrackShareAction,
  recordMusicTrackPlayAction,
} from "@/app/nex-native/create/upload-music/_actions";
import type { MusicFeedEntry } from "@/lib/nex-native/music/active-music-feed-reader";
import type { NexMusicTrackRow } from "@/lib/nex-native/music/types";

const SWIPE_THRESHOLD_PX = 60;
const NAV_LOCK_SAFETY_MS = 1500;

export interface MusicViewerLibraryTrack {
  readonly id: string;
  readonly title: string;
  readonly artist: string | null;
  readonly coverUrl: string | null;
  readonly viewCount: number;
}

export interface MusicViewerClientProps {
  readonly entry: MusicFeedEntry;
  readonly trackRow: NexMusicTrackRow | null;
  readonly libraryTracks: readonly MusicViewerLibraryTrack[];
  readonly feedEntryId: string;
  readonly siblingIds: readonly string[];
  readonly nextId: string | null;
  readonly prevId: string | null;
  /** Server-resolved viewer id. When equal to the track owner the
   *  message icon is hidden ("can't message yourself"). Null = guest
   *  or unresolved session · the icon still renders and the invite-
   *  target action handles the honest guest + self cases on submit. */
  readonly viewerAccountId: string | null;
  /** Owner-authorised 2026-11-01 · Batch E.2 · viewer's current feed
   *  mode label ("Live Ireland", "Live World"). Replaces the
   *  broadcaster-country header line under the broadcaster's name.
   *  Server-resolved from `resolveCountryFeedMode(?country)`. */
  readonly feedModeLabel: string;
  /** Owner-authorised 2026-11-01 · Social Commerce Phase 8 follow-up
   *  · broadcaster's shop href (/profile/<handle>) when they have an
   *  active shop (same gate as the Phase 8 right-rail shop drawer).
   *  Null hides the "Visit Shop" header pill. */
  readonly shopHref: string | null;
  /** Owner-authorised 2026-10-30 · Stage 1 Follow SSR seed. Server-
   *  resolved from `getFollowState` so the person-plus icon paints
   *  the correct state on first render. Always false for guests
   *  (not signed in) and owner self-view (no self-follow). */
  readonly initialFollowed: boolean;
  /** Owner-authorised 2026-10-30 · Stage 2 follower count seed.
   *  Server-resolved via `readFollowCounts(entry.ownerAccountId)`
   *  so the person-plus icon's CountLabel paints real numbers on
   *  first render. Null when the fetch fails · the stack hides
   *  the label rather than render stale zeros. */
  readonly initialFollowerCount: number | null;
  /** Owner-authorised 2026-10-30 · broadcaster country for the
   *  "Live {country}" header line. Resolved server-side from
   *  nex_account.phone_country_code via dialCodeToIsoCountry.
   *  ISO 3166-1 alpha-2 (e.g., "ID", "IE", "US") or null when the
   *  dial code is unknown or malformed; null falls through to the
   *  sealed "Live NEX" fallback in MusicPostShell. */
  readonly broadcasterCountryCode: string | null;
  /** Owner-authorised 2026-10-30 · when true, Save / Follow taps
   *  fire the IrishShamrockBurst overlay. Resolved server-side via
   *  isIrishAccount(phone_country_code === '+353'). Scoped to Phase 1
   *  hard-coded Ireland-only per sealed owner decision. */
  readonly isIrishBroadcaster: boolean;
  /** Owner-authorised 2026-10-30 · prev/next track ids within the
   *  creator's own chronological music cycle. Used by the in-player
   *  prev/next arrows so they walk the creator's songs (not the mixed
   *  feed). Null when the creator has only one eligible track. */
  readonly prevOwnerTrackId: string | null;
  readonly nextOwnerTrackId: string | null;
  /** Owner-authorised 2026-10-30 · next-track metadata for the
   *  Up-Next banner. Rendered when ≥ 30 s remain in the current
   *  song (parity with preview page). All three can be null when
   *  the owner has only one eligible track. */
  readonly nextOwnerTrack: NexMusicTrackRow | null;
  readonly nextOwnerCoverUrl: string | null;
  readonly nextOwnerBackgroundUrl: string | null;
  /** Owner-authorised 2026-10-31 · world-class gapless · signed audio
   *  URL for the next owner-track so MusicPostShell's preloader can
   *  warm the browser cache before the current track ends. */
  readonly nextOwnerAudioUrl: string | null;
  /** Owner-authorised 2026-10-30 · dev-only session chip. Null in
   *  production. "owner" → yellow · "viewer" → blue. */
  readonly devViewerBadge: "owner" | "viewer" | null;
  /** Owner-authorised 2026-11-01 · Batch E.1 · My Live Music target.
   *  Href the owner's "My Live Music" icon (viewer right rail, owner
   *  self-view only) + "My Music" drawer row (always for owner) route
   *  to. Null when the signed-in viewer has no eligible shared_live
   *  track · the icon + row are both hidden. */
  readonly myMusicHref: string | null;
}

export function MusicViewerClient(
  props: MusicViewerClientProps,
): React.JSX.Element {
  const router = useRouter();

  // ----- vertical swipe (sealed Gate 1) ---------------------------
  const pointerStartRef = React.useRef<
    { x: number; y: number; id: number } | null
  >(null);
  const inFlightNavRef = React.useRef<boolean>(false);
  const inFlightTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Owner directive 2026-11-01 (follow-up) · preserve the current
  // searchParams on swipe-navigation URLs so Ireland feed users
  // (?country=IE) keep walking the Ireland pool instead of silently
  // falling into Worldwide mode on each swipe. Any other query params
  // (chain, future flags) are preserved too — the current URL state
  // IS the context, so carrying it forward is correct for every mode.
  const searchParams = useSearchParams();
  const searchParamsSuffix = React.useMemo((): string => {
    if (!searchParams) return "";
    const s = searchParams.toString();
    return s.length > 0 ? `?${s}` : "";
  }, [searchParams]);
  // Owner-authorised 2026-11-01 · P0-1 · perf marks. Reads the current
  // feed mode + country from URL state so every mark carries honest
  // context (worldwide / IE / ID / …). Correlation ID is a per-swipe
  // random UUID generated in startPerfSwipe · it does NOT reveal
  // account ID, track ID, or any content identifier (privacy-safe).
  // Declared BEFORE navigate/handlePointerDown/handlePointerUp so
  // their useCallback deps arrays can reference it.
  const swipeCorrelationIdRef = React.useRef<string | null>(null);
  const currentPerfContext = React.useCallback((): Omit<PerfMarkContext, "swipeCorrelationId"> => {
    const country = searchParams?.get("country")?.toUpperCase();
    return {
      feedKind: "music",
      feedMode: country ? "country" : "worldwide",
      countryCode: country || undefined,
    };
  }, [searchParams]);

  const nextHref = React.useMemo(
    (): string | null =>
      props.nextId
        ? `/nex-native/nex-feed/${props.nextId}${searchParamsSuffix}`
        : null,
    [props.nextId, searchParamsSuffix],
  );
  const prevHref = React.useMemo(
    (): string | null =>
      props.prevId
        ? `/nex-native/nex-feed/${props.prevId}${searchParamsSuffix}`
        : null,
    [props.prevId, searchParamsSuffix],
  );

  const navigate = React.useCallback(
    (direction: "next" | "prev"): void => {
      if (inFlightNavRef.current) return;
      const href = direction === "next" ? nextHref : prevHref;
      if (!href) return;
      inFlightNavRef.current = true;
      if (inFlightTimerRef.current) clearTimeout(inFlightTimerRef.current);
      inFlightTimerRef.current = setTimeout(() => {
        inFlightNavRef.current = false;
        inFlightTimerRef.current = null;
      }, NAV_LOCK_SAFETY_MS);
      // Perf mark · navigation begins (before router.push fires the
      // client-side route transition). Fires only when a correlation
      // ID exists (i.e. this nav originated from a swipe · in-player
      // arrow navigations don't persist a swipe context so skip the
      // mark · they're measured in a different pipeline).
      const corr = swipeCorrelationIdRef.current;
      if (corr) {
        const ctx = currentPerfContext();
        markPerfPhase("nav-begin", { ...ctx, swipeCorrelationId: corr });
      }
      router.push(href);
    },
    [router, nextHref, prevHref, currentPerfContext],
  );

  // Owner-authorised 2026-11-01 · P0-1 · post-nav perf marks.
  // Reads the swipe context persisted by the previous slide's
  // pointerDown handler, then fires nav-complete + slide-visible on
  // mount. Also attaches one-shot listeners on the cover <img> + the
  // music <audio> element so cover-loaded / cover-decoded /
  // audio-canplay / audio-first-audible marks fire with the SAME
  // correlation ID as the originating swipe.
  //
  // When no swipe context exists (fresh page load, direct URL,
  // in-player arrow navigation), the effect no-ops · the viewer
  // still runs normally, we just skip the measurement for that mount.
  React.useEffect(() => {
    // Owner-authorised 2026-11-01 (P0-1 amendment) · lifecycle marks
    // must fire for BOTH swipe-driven navigation AND initial cold
    // page load. If no swipe context exists, synthesise an
    // initial-load context so the first slide's visibility + cover +
    // audio marks are still measurable.
    let ctx = readSwipeContext();
    const isInitialLoad = ctx === null;
    if (!ctx) {
      ctx = makeInitialLoadContext(
        "music",
        searchParams?.get("country")?.toUpperCase() ? "country" : "worldwide",
        searchParams?.get("country")?.toUpperCase() || undefined,
      );
    }

    // Only fire nav-complete for swipe-driven mounts (initial loads
    // never had a nav-begin to pair with).
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

    // Hook cover <img> load + decode. The cover sits inside the
    // sealed `[data-nex-music-cover-frame]` wrapper in NexMusicPlayer-
    // Overlay. We query AFTER mount · if the overlay hasn't rendered
    // yet, retry a few frames.
    let coverPollTries = 0;
    const coverPoll = () => {
      const coverImg = document.querySelector<HTMLImageElement>(
        "[data-nex-music-cover-frame] img",
      );
      if (coverImg) {
        if (coverImg.complete && coverImg.naturalWidth > 0) {
          markPerfPhase("cover-loaded", ctx);
          coverImg.decode().then(
            () => markPerfPhase("cover-decoded", ctx),
            () => {},
          );
        } else {
          const onLoad = () => {
            markPerfPhase("cover-loaded", ctx);
            coverImg.decode().then(
              () => markPerfPhase("cover-decoded", ctx),
              () => {},
            );
            coverImg.removeEventListener("load", onLoad);
          };
          coverImg.addEventListener("load", onLoad, { once: true });
        }
        return;
      }
      if (coverPollTries++ < 60) {
        requestAnimationFrame(coverPoll);
      }
    };
    requestAnimationFrame(coverPoll);

    // Hook <audio> canplay + first-audible-playback. The sealed
    // player mounts an <audio> element at the document level · we
    // poll briefly for it, then attach one-shot listeners.
    let audioPollTries = 0;
    const audioListeners: Array<() => void> = [];
    const audioPoll = () => {
      const audio = document.querySelector<HTMLAudioElement>("audio");
      if (audio) {
        const onCanPlay = () => {
          markPerfPhase("audio-canplay", ctx);
          audio.removeEventListener("canplay", onCanPlay);
        };
        const onTimeUpdate = () => {
          if (audio.currentTime > 0 && !audio.muted && !audio.paused) {
            markPerfPhase("audio-first-audible", ctx);
            audio.removeEventListener("timeupdate", onTimeUpdate);
          }
        };
        audio.addEventListener("canplay", onCanPlay);
        audio.addEventListener("timeupdate", onTimeUpdate);
        audioListeners.push(() => {
          audio.removeEventListener("canplay", onCanPlay);
          audio.removeEventListener("timeupdate", onTimeUpdate);
        });
        return;
      }
      if (audioPollTries++ < 60) {
        requestAnimationFrame(audioPoll);
      }
    };
    requestAnimationFrame(audioPoll);

    return () => {
      if (!slideVisibleFired) cancelAnimationFrame(slideVisibleRaf);
      for (const detach of audioListeners) detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.feedEntryId]); // re-run only when the slide changes

  React.useEffect(() => {
    return () => {
      if (inFlightTimerRef.current) {
        clearTimeout(inFlightTimerRef.current);
        inFlightTimerRef.current = null;
      }
    };
  }, []);

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLElement>): void => {
      const target = e.target as HTMLElement | null;
      // Owner-authorised 2026-10-30 · "the music feed dot user should
      // be able to pull left or right to move forward or backwards
      // on the song". The scrub bar renders `role="slider"` and
      // handles its own pointer drag · leaving it out of this ignore
      // list caused the shell's swipe-nav to capture the pointer and
      // kill the seek drag. Same slider guard matches the preview
      // page's `_preview-client.tsx` pointer handler.
      if (
        target &&
        target.closest(
          'button, a, textarea, input, [role="slider"]',
        )
      )
        return;
      pointerStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        id: e.pointerId,
      };
      // Perf mark · swipe gesture begins. Correlation ID stored in
      // ref AND persisted to sessionStorage (via startPerfSwipe) so
      // the next slide's mount effect can read it after router.push.
      const ctx = currentPerfContext();
      swipeCorrelationIdRef.current = startPerfSwipe(
        ctx.feedKind,
        ctx.feedMode,
        ctx.countryCode,
      );
      try {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [currentPerfContext],
  );

  const handlePointerUp = React.useCallback(
    (e: React.PointerEvent<HTMLElement>): void => {
      const start = pointerStartRef.current;
      if (!start || start.id !== e.pointerId) return;
      pointerStartRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) > Math.abs(dy)) return;
      if (Math.abs(dy) < SWIPE_THRESHOLD_PX) return;
      // Perf mark · pointer released + swipe gesture committed.
      const corr = swipeCorrelationIdRef.current;
      if (corr) {
        const ctx = currentPerfContext();
        markPerfPhase("pointerup", { ...ctx, swipeCorrelationId: corr });
      }
      if (dy < 0) navigate("next");
      else navigate("prev");
    },
    [navigate, currentPerfContext],
  );

  const handlePointerCancel = React.useCallback(
    (e: React.PointerEvent<HTMLElement>): void => {
      if (pointerStartRef.current?.id === e.pointerId) {
        pointerStartRef.current = null;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  // ----- wheel (sealed Gate 2) ------------------------------------
  const wheelAccumRef = React.useRef<number>(0);
  const wheelTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleWheel = React.useCallback(
    (e: React.WheelEvent<HTMLElement>): void => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest(
          'textarea, input, button, a, [role="slider"]',
        )
      )
        return;
      wheelAccumRef.current += e.deltaY;
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => {
        const dy = wheelAccumRef.current;
        wheelAccumRef.current = 0;
        if (dy > SWIPE_THRESHOLD_PX) navigate("next");
        else if (dy < -SWIPE_THRESHOLD_PX) navigate("prev");
      }, 120);
    },
    [navigate],
  );

  // ----- actions + library + search overlay state -----------------
  const [liked, setLiked] = React.useState(false);
  const [likeCount, setLikeCount] = React.useState<number>(
    props.entry.likeCount,
  );
  const [shareCount, setShareCount] = React.useState<number>(
    props.entry.shareCount,
  );
  const [categorySheetOpen, setCategorySheetOpen] = React.useState(false);
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const [shareSheetOpen, setShareSheetOpen] = React.useState(false);
  // Owner-authorised 2026-10-30 · the description panel's open state
  // is lifted to this client so the shell can suppress the Up-Next
  // banner while the description is up.
  const [descriptionOpen, setDescriptionOpen] = React.useState(false);
  // Owner-authorised 2026-10-30 · plays-counter dedup. On the first
  // isPlaying=true for this track mount, fire recordMusicTrackPlayAction
  // once and never again for the same mount. Prevents the player's
  // natural play/pause toggling from double-counting. Phase 2 will
  // replace this with per-event ingestion against valid-play criteria;
  // for Phase 1 this is the honest counter driver.
  const playBumpedRef = React.useRef(false);
  // Owner-authorised 2026-10-30 · shamrock burst trigger for Irish
  // broadcasters. Increments on each Save or Follow tap; the
  // IrishShamrockBurst component watches this and spawns a fresh
  // overlay per bump. No-op when the owner is not Irish.
  const [shamrockTrigger, setShamrockTrigger] = React.useState(0);
  const fireShamrockBurst = React.useCallback(() => {
    if (!props.isIrishBroadcaster) return;
    setShamrockTrigger((n) => n + 1);
  }, [props.isIrishBroadcaster]);
  // Owner-authorised 2026-10-30 · Up-Next banner surfaces at
  // ≤ 30 s remaining in the current song. The overlay publishes
  // position + duration via `onPositionTick`; we store the remaining
  // ms and let the shell decide whether to render the banner.
  const NEXT_SONG_CARD_THRESHOLD_MS = 30_000;
  const [remainingMs, setRemainingMs] = React.useState<number | null>(null);
  const showUpNextBanner =
    props.nextOwnerTrack !== null &&
    remainingMs !== null &&
    remainingMs <= NEXT_SONG_CARD_THRESHOLD_MS;

  // Owner-authorised 2026-10-31 · world-class gapless · belt-and-braces
  // backup to the <audio preload="auto"> element in the sibling
  // preloader. When ≤ 5 s remain, kick an explicit `fetch()` so the
  // next track's bytes are in the browser HTTP cache before the user
  // sees the Up-Next card. The preloader's hidden element already
  // starts fetching on mount; this is defensive for lazy browsers +
  // slow starts. Fires exactly once per slide via a ref flag.
  const GAPLESS_PRELOAD_THRESHOLD_MS = 5_000;
  const gaplessWarmedRef = React.useRef<boolean>(false);

  const isSelfViewing =
    props.viewerAccountId !== null &&
    props.viewerAccountId === props.entry.ownerAccountId;

  // Prefetch neighbour feed entries so swipe remounts land warm.
  React.useEffect(() => {
    if (nextHref) router.prefetch(nextHref);
    if (prevHref) router.prefetch(prevHref);
  }, [router, nextHref, prevHref]);

  // Keyboard navigation parity with VideoViewerClient.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        navigate("next");
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        navigate("prev");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [navigate]);

  // The MusicPostShell needs a full NexMusicTrackRow. If the server
  // shell couldn't resolve the track row we synthesise a minimal
  // placeholder from the feed entry so the overlay still mounts.
  const trackForShell: NexMusicTrackRow = React.useMemo(() => {
    if (props.trackRow) return props.trackRow;
    const nowIso = new Date().toISOString();
    return {
      id: props.entry.trackId,
      owner_account_id: props.entry.ownerAccountId,
      title: props.entry.title,
      artist: props.entry.artist,
      source_url: props.entry.sourceUrl,
      media_url: null,
      cover_image_url: null,
      background_image_url: null,
      visibility: "shared_live",
      rights_declaration: "owner_content",
      source_type: "uploaded_audio",
      like_count: props.entry.likeCount,
      share_count: props.entry.shareCount,
      view_count: 0,
      duration_seconds: null,
      created_at: new Date(props.entry.publishedAtMs).toISOString(),
      updated_at: nowIso,
    } as unknown as NexMusicTrackRow;
  }, [props.trackRow, props.entry]);

  // Preview-page header-right slot shape (search + inbox placeholder +
  // LiveSideDrawer). The search icon opens CategoryGridSheet (viewer
  // discovery) rather than the owner's upload-music library.
  const headerRightSlot = (
    <>
      <button
        type="button"
        data-nex-music-feed-header-search
        aria-label="Browse categories"
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
      <div data-nex-music-feed-menu-trigger>
        <LiveSideDrawer myMusicHref={props.myMusicHref} />
      </div>
    </>
  );

  const currentIndex = props.siblingIds.indexOf(props.feedEntryId);

  return (
    <>
      <MusicPostShell
        track={trackForShell}
        audioUrl={props.entry.audioSignedUrl}
        coverUrl={props.entry.coverSignedUrl}
        backgroundUrl={props.entry.backgroundSignedUrl}
        // Owner-authorised 2026-10-31 · world-class gapless. Siblings
        // activates the MusicPostSiblingPreloader on this surface so
        // the next/prev track's audio + cover + background bytes
        // land in the browser cache before the user swipes. Previous
        // state: feed surface had no preloader; only the preview page
        // did. Now both surfaces are symmetric.
        siblings={{
          prevTrackHref: props.prevOwnerTrackId
            ? `/nex-native/nex-feed/music-${props.prevOwnerTrackId}`
            : null,
          nextTrackHref: props.nextOwnerTrackId
            ? `/nex-native/nex-feed/music-${props.nextOwnerTrackId}`
            : null,
          prevCoverUrl: null,
          prevBackgroundUrl: null,
          prevAudioUrl: null,
          nextCoverUrl: props.nextOwnerCoverUrl,
          nextBackgroundUrl: props.nextOwnerBackgroundUrl,
          nextAudioUrl: props.nextOwnerAudioUrl,
        }}
        siblingPrefetchBasePath="/nex-native/nex-feed/"
        broadcasterDisplayName={props.entry.ownerDisplayName}
        broadcasterNexHandle={props.entry.ownerNexHandle}
        broadcasterAvatarUrl={props.entry.ownerAvatarUrl}
        broadcasterPresence="online"
        broadcasterCountryCode={props.broadcasterCountryCode}
        feedModeLabel={props.feedModeLabel}
        shopHref={props.shopHref}
        autoPlayOnMount={true}
        isLiked={liked}
        // Owner directive 2026-10-30 · track remaining time so the
        // Up-Next banner surfaces at ≤ 30 s. Position tick comes
        // from the player's <audio>.timeupdate.
        onPositionTick={(positionMs, durationMs) => {
          if (durationMs > 0) {
            const remaining = Math.max(0, durationMs - positionMs);
            setRemainingMs(remaining);
            // Owner-authorised 2026-10-31 · gapless backup fetch. One
            // shot per slide. Primary preload is the hidden <audio>
            // element in MusicPostSiblingPreloader; this is defence.
            if (
              !gaplessWarmedRef.current &&
              remaining <= GAPLESS_PRELOAD_THRESHOLD_MS &&
              props.nextOwnerAudioUrl
            ) {
              gaplessWarmedRef.current = true;
              const url = props.nextOwnerAudioUrl;
              fetch(url, { method: "GET", cache: "force-cache" }).catch(
                () => {
                  /* non-fatal · preload remains as the primary path */
                },
              );
            }
          }
        }}
        // Owner-authorised 2026-10-30 · universal plays-counter
        // trigger. First isPlaying=true per mount bumps the track's
        // view_count via recordMusicTrackPlayAction. Server-side
        // enforces signed-in only (guest plays excluded per sealed
        // §12.4). Fire-and-forget · the counter is a weak signal, a
        // failed bump must not block playback.
        onPlayStateChange={(isPlaying) => {
          if (isPlaying && !playBumpedRef.current) {
            playBumpedRef.current = true;
            void recordMusicTrackPlayAction({ trackId: props.entry.trackId }).catch(() => undefined);
          }
        }}
        // Owner-authorised 2026-10-30 · auto-advance on song end ·
        // parity with the sealed preview-page behaviour at
        // _preview-client.tsx:377-386. When the audio ends, if the
        // owner's chrono cycle has a next track AND no navigation
        // is already in flight AND the library overlay is closed,
        // router.push to the next track's feed URL. Reuses the
        // sealed inFlightNavRef pattern + NAV_LOCK_SAFETY_MS to
        // guard against double-nav from rapid state transitions.
        onAudioEnded={() => {
          if (libraryOpen) return;
          if (inFlightNavRef.current) return;
          if (!props.nextOwnerTrackId) return;
          inFlightNavRef.current = true;
          if (inFlightTimerRef.current) {
            clearTimeout(inFlightTimerRef.current);
          }
          inFlightTimerRef.current = setTimeout(() => {
            inFlightNavRef.current = false;
            inFlightTimerRef.current = null;
          }, NAV_LOCK_SAFETY_MS);
          router.push(
            `/nex-native/nex-feed/music-${props.nextOwnerTrackId}`,
          );
        }}
        upNext={
          showUpNextBanner && props.nextOwnerTrack
            ? {
                track: props.nextOwnerTrack,
                coverUrl: props.nextOwnerCoverUrl,
                backgroundUrl: props.nextOwnerBackgroundUrl,
                remainingMs: remainingMs ?? 0,
                onOpenPlaylist: () => setLibraryOpen(true),
              }
            : undefined
        }
        suppressUpNext={descriptionOpen}
        identityHref={
          props.entry.ownerNexHandle
            ? `/nex-native/profile/${encodeURIComponent(
                props.entry.ownerNexHandle,
              )}`
            : null
        }
        headerRightSlot={headerRightSlot}
        // Owner directive 2026-10-30 · the in-player prev/next arrows
        // walk the CREATOR's music cycle (same chronological order the
        // preview page uses), not the mixed music+video feed. Vertical
        // swipe + wheel still move through the full feed. Wrap at
        // the ends is preserved by the server shell.
        onPrevTrack={
          props.prevOwnerTrackId
            ? () => {
                if (inFlightNavRef.current) return;
                inFlightNavRef.current = true;
                if (inFlightTimerRef.current) {
                  clearTimeout(inFlightTimerRef.current);
                }
                inFlightTimerRef.current = setTimeout(() => {
                  inFlightNavRef.current = false;
                  inFlightTimerRef.current = null;
                }, NAV_LOCK_SAFETY_MS);
                router.push(
                  `/nex-native/nex-feed/music-${props.prevOwnerTrackId}`,
                );
              }
            : undefined
        }
        onNextTrack={
          props.nextOwnerTrackId
            ? () => {
                if (inFlightNavRef.current) return;
                inFlightNavRef.current = true;
                if (inFlightTimerRef.current) {
                  clearTimeout(inFlightTimerRef.current);
                }
                inFlightTimerRef.current = setTimeout(() => {
                  inFlightNavRef.current = false;
                  inFlightTimerRef.current = null;
                }, NAV_LOCK_SAFETY_MS);
                router.push(
                  `/nex-native/nex-feed/music-${props.nextOwnerTrackId}`,
                );
              }
            : undefined
        }
        library={
          props.libraryTracks.length > 0
            ? {
                isOpen: libraryOpen,
                onOpenChange: setLibraryOpen,
                creatorName: props.entry.ownerDisplayName,
                creatorNexHandle: props.entry.ownerNexHandle,
                creatorAvatarUrl: props.entry.ownerAvatarUrl,
                creatorPresence: "online",
                tracks: props.libraryTracks.map((t) => ({
                  ...t,
                  isCurrent: t.id === props.entry.trackId,
                })),
                onSelect: (trackId) => {
                  setLibraryOpen(false);
                  if (trackId === props.entry.trackId) return;
                  router.push(`/nex-native/nex-feed/music-${trackId}`);
                },
              }
            : undefined
        }
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onWheel={handleWheel}
        touchAction="none"
        dataAttrs={{
          "data-nex-music-viewer": true,
          "data-nex-music-viewer-track-id": props.entry.trackId,
          "data-nex-music-viewer-swipe-prev": props.prevId ?? "",
          "data-nex-music-viewer-swipe-next": props.nextId ?? "",
          "data-nex-music-viewer-index": currentIndex,
          "data-nex-music-viewer-sibling-count": props.siblingIds.length,
        }}
      >
        {/* Owner-authorised 2026-10-30 · description pill + frosted
            sheet (parity with the preview page). Self-renders null
            when the track has no description, so no visual noise on
            tracks without one. Open state lifted here so the shell
            can suppress the Up-Next banner while the panel is up. */}
        <MusicDescriptionAffordance
          description={trackForShell.description}
          open={descriptionOpen}
          onOpenChange={setDescriptionOpen}
        />

        {/* Right-rail actions · preview-page parity · like + share
            + optional message. Save + follow are session-only visual
            stubs (no backend) consistent with the sealed preview
            behaviour. Message icon hidden when the viewer owns the
            track (can't message yourself). */}
        <MusicActionsStack
          track={trackForShell}
          initiallyLiked={liked}
          likeCount={likeCount}
          shareCount={shareCount}
          isOwnerView={isSelfViewing}
          // Owner-authorised 2026-10-30 · Stage 1 Follow wiring per
          // Stage 1 preparation §13.6. Pass the owner account id and
          // the viewer's initial follow state so the stack's person-
          // plus icon fires the real followAction / unfollowAction.
          // Initial state is NOT currently SSR-fetched (Stage 2
          // enhancement); the stack starts "not followed" and
          // reconciles on tap. Non-owner viewers only · owner view
          // suppresses the follow icon entirely per §16 scope.
          followeeId={isSelfViewing ? null : props.entry.ownerAccountId}
          initialFollowed={props.initialFollowed}
          initialFollowerCount={
            props.initialFollowerCount === null
              ? undefined
              : props.initialFollowerCount
          }
          onEdit={
            isSelfViewing
              ? () =>
                  router.push(
                    `/nex-native/create/upload-music/preview/${encodeURIComponent(
                      props.entry.trackId,
                    )}?edit=1`,
                  )
              : undefined
          }
          onLikeToggle={async () => {
            const r = await toggleMusicTrackLikeAction({
              trackId: props.entry.trackId,
            });
            if (!r.ok) return null;
            setLiked(r.data.liked);
            setLikeCount(r.data.likeCount);
            return { liked: r.data.liked, likeCount: r.data.likeCount };
          }}
          onShare={async () => {
            // Owner directive 2026-10-30 · Share icon now opens the
            // sealed VideoShareSheet (NEX contact / WhatsApp / Copy
            // link). The actual share event + count-bump fires when
            // the user picks an option (via onShared below), not on
            // icon tap · aborted shares don't inflate the counter.
            setShareSheetOpen(true);
            return null;
          }}
          // Owner-authorised 2026-10-30 · Save + Follow taps fire the
          // IrishShamrockBurst for Irish-broadcaster accounts (hard-
          // coded per sealed owner decision). fireShamrockBurst
          // internally short-circuits when the broadcaster is not
          // Irish, so these callbacks are no-ops for non-Irish owners.
          onSave={fireShamrockBurst}
          onFollow={fireShamrockBurst}
          // Owner-authorised 2026-11-01 · Batch E.1 · My Live Music.
          // Rendered inside MusicActionsStack ONLY when isOwnerView
          // is true (self-view) AND props.myMusicHref is non-null.
          // Visitors never see the icon.
          onMyLiveMusic={
            isSelfViewing && props.myMusicHref
              ? () => router.push(props.myMusicHref!)
              : undefined
          }
        />
        {/* Owner-authorised 2026-10-30 · hollywood-grade shamrock
            fall on Save/Follow of Irish-attributed tracks. Mounts
            only when the broadcaster is Irish (zero cost for
            non-Irish surfaces · no DOM overhead). */}
        {props.isIrishBroadcaster && (
          <IrishShamrockBurst trigger={shamrockTrigger} />
        )}

        {/* Owner-only inbox slot · HendraMessageInbox portals its
            💬 trigger + unread-count pill into this slot (sealed
            selector list). Non-owner viewers never mount this ·
            they reach the creator via the header avatar →
            profile → Message button. Positioned above the
            MusicActionsStack so it reads as part of the right rail. */}
        {isSelfViewing && (
          <div
            data-nex-music-right-rail-inbox-slot
            style={{
              position: "absolute",
              right: 10,
              // Owner self-view stack = Edit + Share + share-count
              // starting at bottom 270. Stack height ≈ 116 px · inbox
              // sits above with a 10 px gap · bottom 400. Keeps all
              // three owner icons as one visual column.
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 400px)",
              zIndex: 24,
              pointerEvents: "auto",
            }}
          />
        )}
      </MusicPostShell>

      <CategoryGridSheet
        open={categorySheetOpen}
        onClose={() => setCategorySheetOpen(false)}
        onCategoryPick={(tile) => {
          router.push(`/nex-native/live-commerce/discover/${tile.slug}`);
        }}
      />

      {/* Sealed 3-option share sheet · NEX contact / WhatsApp /
          Copy link · owner directive 2026-10-30. Share count bumps
          only when the user picks an option (not on icon tap). */}
      <VideoShareSheet
        open={shareSheetOpen}
        shareUrl={
          typeof window !== "undefined"
            ? `${window.location.origin}/nex-native/nex-feed/${props.feedEntryId}`
            : `/nex-native/nex-feed/${props.feedEntryId}`
        }
        shareTitle={props.entry.title}
        onClose={() => setShareSheetOpen(false)}
        onShared={async () => {
          const r = await recordMusicTrackShareAction({
            trackId: props.entry.trackId,
          });
          if (r.ok) setShareCount(r.data.shareCount);
          // Owner-authorised 2026-11-01 · Share-completed also fires
          // the Irish shamrock burst (completes the Save+Follow+Share
          // Ireland-flare set). fireShamrockBurst() short-circuits
          // when the broadcaster is not Irish, so this is a no-op for
          // non-Irish shares.
          fireShamrockBurst();
        }}
      />

      {props.devViewerBadge && (
        <DevViewerBadge kind={props.devViewerBadge} />
      )}

      {/* Owner directive 2026-10-30 · owner-only message center · the
          inbox 💬 chip + unread-count pill portal into the header's
          `data-nex-music-feed-header-messages-slot` only when the
          current viewer owns the track. A non-owner viewer sees the
          OUTBOUND message icon in the right rail (via MusicActions-
          Stack); the owner sees the INBOUND inbox in the header. */}
      {isSelfViewing && (
        <HendraMessageInbox ownerDisplayName={props.entry.ownerDisplayName} />
      )}

    </>
  );
}
