"use client";

// src/components/nex-native/music/MusicPostShell.tsx
//
// Owner-authorised 2026-10-30 · "the page should be 100% same as
// hendra preview page music . exactly same with music player".
//
// The shell packages the sealed music-preview visuals (background +
// darken + top header + NexMusicPlayerOverlay + Up-Next banner +
// MusicLibraryOverlay + SiblingPreloader + keyframes) so both:
//   · `/nex-native/create/upload-music/preview/[trackId]` (author
//     preview — Edit / Live / MusicActionsStack chrome passed as
//     children)
//   · `/nex-native/nex-feed/[videoId]` music slide (viewer feed —
//     LiveViewerFooter / BroadcasterLibrarySheet / VideoCommentsOverlay
//     chrome passed as children)
// render one and the same player. Pure composition · owns no business
// logic (publish / edit / like / share / comment) — all behaviour is
// controlled from the parent via props.
//
// Not a drop-in replacement for MusicFeedCard — MusicFeedCard remains
// the grid primitive (small aspect-ratio tile for lists). MusicPostShell
// is the full-bleed single-post surface.

import * as React from "react";
import { useRouter } from "next/navigation";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";
import { NexMusicPlayerOverlay } from "@/components/nex-native/music/NexMusicPlayerOverlay";
import {
  MusicLibraryOverlay,
  type MusicLibraryTrack,
  type MusicLibraryCreatorPresence,
} from "@/components/nex-native/music/MusicLibraryOverlay";
import type { NexMusicTrackRow } from "@/lib/nex-native/music/types";
import {
  stripTrailingLiveSuffix,
  formatPlaysCount,
  MUSIC_POST_SHELL_KEYFRAMES,
} from "./music-post-shell-helpers";

const INK = "#F0F6FF";
const INK_DIM = "rgba(240, 246, 255, 0.7)";
const BG_DARK = "var(--nex-world-background-base, #020914)";

export type MusicPostPresence = "online" | "busy" | "offline" | null;

export interface MusicPostShellUpNext {
  readonly track: NexMusicTrackRow;
  readonly coverUrl: string | null;
  readonly backgroundUrl: string | null;
  /** Milliseconds remaining in the current track. Banner surfaces at
   *  ≤ 30 s remaining regardless · pass the live value from
   *  onPositionTick. */
  readonly remainingMs: number;
  readonly onOpenPlaylist: () => void;
}

export interface MusicPostShellSiblingHints {
  readonly prevTrackHref: string | null;
  readonly nextTrackHref: string | null;
  readonly prevCoverUrl: string | null;
  readonly prevBackgroundUrl: string | null;
  readonly nextCoverUrl: string | null;
  readonly nextBackgroundUrl: string | null;
  /** Owner-authorised 2026-10-31 · world-class gapless playback.
   *  Signed audio URL for the next/prev track so the preloader can
   *  warm the browser cache 5 s before the current track ends · the
   *  moment the user swipes, bytes are already fetched. */
  readonly prevAudioUrl?: string | null;
  readonly nextAudioUrl?: string | null;
}

export interface MusicPostShellLibrary {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly creatorName: string;
  readonly creatorNexHandle: string | null;
  readonly creatorAvatarUrl: string | null;
  readonly creatorPresence: MusicLibraryCreatorPresence;
  readonly tracks: readonly MusicLibraryTrack[];
  readonly onSelect: (trackId: string) => void;
  readonly onShare?: () => void;
  readonly onSendMessage?: (text: string) => void;
}

export interface MusicPostShellProps {
  // -- Media + identity ---------------------------------------------
  readonly track: NexMusicTrackRow;
  readonly audioUrl: string | null;
  readonly coverUrl: string | null;
  readonly backgroundUrl: string | null;
  readonly broadcasterDisplayName: string;
  readonly broadcasterNexHandle: string | null;
  readonly broadcasterAvatarUrl: string | null;
  readonly broadcasterPresence: MusicPostPresence;
  /** ISO country code used by the sealed "Live {country}" header line. */
  readonly broadcasterCountryCode: string | null;
  /** Owner-authorised 2026-10-30 · when set, the top-left identity
   *  block (avatar + name + handle + Live line) is wrapped in an
   *  `<a>` that routes to this href. The swipe pointer handlers
   *  already ignore `<a>` descendants, so wrapping doesn't disturb
   *  gesture capture. Omit on surfaces that don't want the identity
   *  to be a tap target (e.g. self-view where there's nowhere to
   *  go). */
  readonly identityHref?: string | null;

  // -- Player behaviour ---------------------------------------------
  readonly autoPlayOnMount?: boolean;
  readonly isLiked?: boolean;
  readonly onPlayStateChange?: (isPlaying: boolean) => void;
  readonly onPositionTick?: (positionMs: number, durationMs: number) => void;
  readonly onAudioEnded?: () => void;
  readonly onPrevTrack?: () => void;
  readonly onNextTrack?: () => void;

  // -- Sibling preloading -------------------------------------------
  readonly siblings?: MusicPostShellSiblingHints;
  /** The route base used to prefetch sibling trackIds. Default:
   *  `/nex-native/create/upload-music/preview/` (preview-page semantics).
   *  Pass `/nex-native/nex-feed/music-` for the feed slide. */
  readonly siblingPrefetchBasePath?: string;

  // -- Up-Next banner (last 30 s) -----------------------------------
  readonly upNext?: MusicPostShellUpNext | null;
  /** Owner-authorised 2026-10-30 · when `true` the Up-Next banner is
   *  suppressed even if `upNext` is provided. Callers use this to
   *  hide the banner while the description container is open so the
   *  two overlays don't compete for the same screen region. The
   *  banner returns automatically when this flips back to false (if
   *  the remaining time is still ≤ 30 s). */
  readonly suppressUpNext?: boolean;

  // -- Library overlay ----------------------------------------------
  readonly library?: MusicPostShellLibrary;

  // -- Header right slot (search / inbox / drawer) ------------------
  readonly headerRightSlot?: React.ReactNode;

  // -- Main-wrapper event handlers ----------------------------------
  readonly onPointerDown?: React.PointerEventHandler<HTMLElement>;
  readonly onPointerUp?: React.PointerEventHandler<HTMLElement>;
  readonly onPointerCancel?: React.PointerEventHandler<HTMLElement>;
  readonly onWheel?: React.WheelEventHandler<HTMLElement>;
  readonly touchAction?: React.CSSProperties["touchAction"];
  readonly dataAttrs?: Record<string, string | number | boolean | undefined>;

  // -- Chrome layered OVER the player (edit toolbar, Edit/Live
  //    buttons, MusicActionsStack, LiveViewerFooter, etc.) ----------
  readonly children?: React.ReactNode;
  // -- Topmost overlay layered OVER the library overlay (publish
  //    celebration, future takeover sheets). Rendered LAST so it wins
  //    the z-stack race regardless of z-index. --------------------
  readonly topmostOverlay?: React.ReactNode;
}

export function MusicPostShell(props: MusicPostShellProps): React.JSX.Element {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = React.useState(false);

  const handlePlayStateChange = React.useCallback(
    (next: boolean): void => {
      setIsPlaying(next);
      props.onPlayStateChange?.(next);
    },
    [props],
  );

  const openLibrary = React.useCallback((): void => {
    props.library?.onOpenChange(true);
  }, [props.library]);

  const dataProps: Record<string, string | number | boolean | undefined> = {
    "data-nex-music-post-shell": true,
    ...props.dataAttrs,
  };

  return (
    <main
      {...dataProps}
      onPointerDown={props.onPointerDown}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerCancel}
      onWheel={props.onWheel}
      style={{
        position: "relative",
        width: "100%",
        // Owner-authorised 2026-10-29 · lock to one viewport height on
        // the preview page; the feed slide owns its own 100%-height
        // parent, so 100% is identical to 100dvh in that container.
        height: "100%",
        maxHeight: "100dvh",
        overflow: "hidden",
        color: INK,
        fontFamily: NEX_FONT_SANS,
        background: BG_DARK,
        touchAction: props.touchAction ?? "pan-y",
      }}
    >
      {/* Sibling preloader — invisible, warms images + route payloads
          for prev/next when the browser isn't on Save-Data / 2G. */}
      {props.siblings && (
        <MusicPostSiblingPreloader
          router={router}
          siblings={props.siblings}
          basePath={
            props.siblingPrefetchBasePath ??
            "/nex-native/create/upload-music/preview/"
          }
        />
      )}

      {/* Background · owner-amended 2026-10-30 (see
          `docs/doctrine/nex-universal-image-display-integrity-
          2026-10-30.md` §3.1a). cover + fetchPriority high; falls back
          to the sealed music-page gradient when no background exists. */}
      {props.backgroundUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={props.backgroundUrl}
          alt=""
          loading="eager"
          decoding="async"
          fetchPriority="high"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0,
          }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, #020914 0%, #06111F 50%, #0A1424 100%)",
            zIndex: 0,
          }}
        />
      )}

      {/* Darken for legibility */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(2, 9, 20, 0.3)",
          zIndex: 1,
        }}
      />

      {/* Top header · broadcaster block + injected right-side chrome */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          zIndex: 20,
          background:
            "linear-gradient(180deg, rgba(2,9,20,0.52) 0%, rgba(2,9,20,0) 100%)",
        }}
      >
        <MusicPostHeaderIdentity
          countryCode={props.broadcasterCountryCode}
          broadcasterAvatarUrl={props.broadcasterAvatarUrl}
          broadcasterName={props.broadcasterDisplayName}
          broadcasterNexHandle={props.broadcasterNexHandle}
          isPlaying={isPlaying}
          broadcasterPresence={props.broadcasterPresence}
          href={props.identityHref ?? null}
        />
        {props.headerRightSlot && (
          <div
            data-nex-music-post-shell-header-actions
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
            }}
          >
            {props.headerRightSlot}
          </div>
        )}
      </div>

      {/* The music overlay · same component as during Live */}
      <NexMusicPlayerOverlay
        track={props.track}
        coverUrl={props.coverUrl}
        audioSrcUrl={props.audioUrl}
        onMinimise={() => undefined}
        onClose={() => undefined}
        onPlayStateChange={handlePlayStateChange}
        isLiked={props.isLiked ?? false}
        onTrackCoverTap={props.library ? openLibrary : undefined}
        autoPlayOnMount={props.autoPlayOnMount ?? true}
        onPrevTrack={props.onPrevTrack}
        onNextTrack={props.onNextTrack}
        broadcasterCountry={props.broadcasterCountryCode}
        broadcastedAtIso={props.track.created_at}
        isAiGenerated={false}
        onPositionTick={props.onPositionTick}
        onAudioEnded={props.onAudioEnded}
      />

      {/* Up-Next banner · surfaces at ≤ 30 s remaining when a next
          track is supplied. */}
      {props.upNext && !props.suppressUpNext && (
        <MusicPostUpNextBanner
          nextTrack={props.upNext.track}
          nextCoverUrl={props.upNext.coverUrl}
          nextBackgroundUrl={props.upNext.backgroundUrl}
          remainingMs={props.upNext.remainingMs}
          onOpenPlaylist={props.upNext.onOpenPlaylist}
        />
      )}

      {/* App-level chrome (edit toolbar / Edit · Live buttons /
          MusicActionsStack / LiveViewerFooter / BroadcasterLibrarySheet /
          VideoCommentsOverlay). */}
      {props.children}

      {/* Keyframes required by the header avatar vinyl spin, the
          Edit/Live heartbeat, the header presence pulse, and the
          Up-Next slide-in. Mounted once, outside any conditional, so
          every animation has its keyframes available at first paint. */}
      <style>{MUSIC_POST_SHELL_KEYFRAMES}</style>

      {/* Library overlay · opens on cover tap. */}
      {props.library && (
        <MusicLibraryOverlay
          isOpen={props.library.isOpen}
          onClose={() => props.library!.onOpenChange(false)}
          creatorName={props.library.creatorName}
          creatorNexHandle={props.library.creatorNexHandle}
          creatorAvatarUrl={props.library.creatorAvatarUrl}
          creatorPresence={props.library.creatorPresence}
          tracks={props.library.tracks}
          onSelect={(id) => props.library!.onSelect(id)}
          onShare={props.library.onShare}
          onSendMessage={props.library.onSendMessage}
        />
      )}

      {/* Topmost overlay · wins the stack by DOM order (post-library). */}
      {props.topmostOverlay}
    </main>
  );
}

// -----------------------------------------------------------------------------
// MusicPostHeaderIdentity · broadcaster avatar + name + handle + "Live {C}"
// -----------------------------------------------------------------------------
// Rotating-avatar + presence-rim + three-line text block that forms the
// left side of the music post's top header. Previously inlined in
// `_preview-client.tsx` as `PreviewHeaderLiveCountryBlock`; now the
// single source of truth for both the preview + the feed music slide.

function MusicPostHeaderIdentity(props: {
  readonly countryCode: string | null;
  readonly broadcasterAvatarUrl: string | null;
  readonly broadcasterName: string;
  readonly broadcasterNexHandle: string | null;
  readonly isPlaying: boolean;
  readonly broadcasterPresence: MusicPostPresence;
  /** When present, the identity block is wrapped in an `<a>` that
   *  routes to this href (owner profile · owner-authorised
   *  2026-10-30). Swipe handlers skip starts on `<a>` so gesture
   *  capture is unchanged. */
  readonly href: string | null;
}): React.JSX.Element {
  const [countryLabel, setCountryLabel] = React.useState<string>("");
  React.useEffect(() => {
    if (!props.countryCode) {
      setCountryLabel("");
      return;
    }
    try {
      const names = new Intl.DisplayNames(undefined, { type: "region" });
      const resolved = names.of(props.countryCode);
      setCountryLabel(
        resolved && resolved !== props.countryCode ? resolved : "",
      );
    } catch {
      setCountryLabel("");
    }
  }, [props.countryCode]);

  const presenceColor =
    props.broadcasterPresence === "online"
      ? "#16D66B"
      : props.broadcasterPresence === "busy"
        ? "#FF7200"
        : props.broadcasterPresence === "offline"
          ? "#A60000"
          : null;
  const rimAnimates =
    props.broadcasterPresence === "online" ||
    props.broadcasterPresence === "busy";
  const borderStyle = presenceColor
    ? `2px solid ${presenceColor}`
    : "1.5px solid rgba(255, 255, 255, 0.6)";

  const wrapperStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
    flex: 1,
    color: INK,
    textShadow: "0 1px 3px rgba(0,0,0,0.55)",
    textDecoration: "none",
    cursor: props.href ? "pointer" : "default",
  };
  const WrapperTag = props.href ? "a" : "div";
  const wrapperProps = props.href
    ? ({
        href: props.href,
        "aria-label": `Open ${props.broadcasterName}'s profile`,
        "data-nex-music-shell-identity-link": true,
      } as const)
    : ({} as const);
  return (
    <WrapperTag {...wrapperProps} style={wrapperStyle}>
      <span
        style={{
          position: "relative",
          width: 42,
          height: 42,
          flexShrink: 0,
          alignSelf: "center",
          display: "block",
        }}
      >
        {props.broadcasterAvatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={props.broadcasterAvatarUrl}
            alt=""
            aria-hidden
            style={{
              width: 42,
              height: 42,
              objectFit: "cover",
              borderRadius: "50%",
              border: borderStyle,
              filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.65))",
              animation: props.isPlaying
                ? "nex-music-page-vinyl-spin 4s linear infinite"
                : "none",
              willChange: props.isPlaying ? "transform" : "auto",
              display: "block",
            }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              display: "grid",
              placeItems: "center",
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "rgba(10, 27, 51, 0.65)",
              border: borderStyle,
              color: INK,
              fontSize: 15,
              fontWeight: 800,
              animation: props.isPlaying
                ? "nex-music-page-vinyl-spin 4s linear infinite"
                : "none",
              willChange: props.isPlaying ? "transform" : "auto",
            }}
          >
            {props.broadcasterName.slice(0, 1).toUpperCase()}
          </span>
        )}
        {presenceColor && rimAnimates && (
          <span
            aria-label={`${props.broadcasterPresence}`}
            style={{
              position: "absolute",
              inset: -3,
              borderRadius: "50%",
              border: `2px solid ${presenceColor}`,
              animation:
                "nex-music-header-heartbeat 1200ms cubic-bezier(0.4,0,0.2,1) infinite",
              pointerEvents: "none",
            }}
          />
        )}
      </span>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          flex: 1,
          gap: 1,
        }}
      >
        {/* Owner directive 2026-10-30 · clamp long names so they don't
            run under the right-side header icons · `minWidth: 0` on
            the parent + `overflow + text-overflow: ellipsis` here is
            the standard flex-child truncation pattern. Keeps the
            icon row at its sealed vertical position. */}
        <span
          style={{
            fontSize: 15,
            fontWeight: 800,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
            display: "block",
          }}
        >
          {props.broadcasterName}
        </span>
        {props.broadcasterNexHandle && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(240, 246, 255, 0.75)",
              letterSpacing: "0.03em",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
              display: "block",
            }}
          >
            {props.broadcasterNexHandle}
          </span>
        )}
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#D9E6F5",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
            display: "block",
          }}
        >
          Live {countryLabel || props.countryCode || "NEX"}
        </span>
      </div>
    </WrapperTag>
  );
}

// -----------------------------------------------------------------------------
// MusicPostUpNextBanner · 92px horizontal banner, surfaces at ≤ 30 s left
// -----------------------------------------------------------------------------
// Owner-authorised 2026-10-29 (banner reshape) · cover 56 + text + bottom-
// right Playlist button. Full image background with dim overlay; previously
// inlined in `_preview-client.tsx` as `NextSongCard`.

function MusicPostUpNextBanner(props: {
  readonly nextTrack: NexMusicTrackRow;
  readonly nextCoverUrl: string | null;
  readonly nextBackgroundUrl: string | null;
  readonly remainingMs: number;
  readonly onOpenPlaylist: () => void;
}): React.JSX.Element {
  const secondsLeft = Math.max(0, Math.ceil(props.remainingMs / 1000));
  return (
    <div
      data-nex-music-next-song-card
      aria-label={`Up next · ${props.nextTrack.title}`}
      style={{
        position: "absolute",
        left: 10,
        right: 10,
        // Owner-authorised 2026-10-30 · nudged up 15px (95 → 80)
        // · applies universally to every music surface that mounts
        //   MusicPostUpNextBanner · preview, feed, Live.
        top: "calc(env(safe-area-inset-top, 0px) + 80px)",
        height: 92,
        borderRadius: 14,
        overflow: "hidden",
        border: `3px solid #000000`,
        boxShadow: "0 4px 18px rgba(0, 0, 0, 0.5)",
        zIndex: 11,
        isolation: "isolate",
        animation: "nex-music-next-card-in 220ms ease-out",
        display: "flex",
        alignItems: "stretch",
      }}
    >
      {props.nextBackgroundUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={props.nextBackgroundUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 40%",
            backgroundColor: "var(--nex-world-background-base, #020914)",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #020914 0%, #0A1424 100%)",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(2,9,20,0.75) 0%, rgba(2,9,20,0.45) 100%)",
        }}
      />
      {props.nextCoverUrl ? (
        <div
          style={{
            position: "relative",
            flexShrink: 0,
            width: 56,
            margin: 8,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
          }}
        >
          <div
            style={{
              position: "relative",
              width: 56,
              height: 56,
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid rgba(255, 255, 255, 0.6)",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={props.nextCoverUrl}
              alt=""
              loading="eager"
              decoding="async"
              fetchPriority="low"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div
            aria-label={`${props.nextTrack.view_count} plays`}
            style={{
              padding: "1px 6px",
              borderRadius: 999,
              background: "rgba(0, 0, 0, 0.72)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              color: "#FFFFFF",
              fontSize: 9,
              fontWeight: 800,
              lineHeight: 1.2,
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.75)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={8}
              height={8}
              fill="currentColor"
              aria-hidden
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            {formatPlaysCount(props.nextTrack.view_count)}
          </div>
        </div>
      ) : (
        <div style={{ width: 8, flexShrink: 0 }} />
      )}
      <div
        style={{
          position: "relative",
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          paddingTop: 8,
          paddingRight: 8,
          gap: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              padding: "2px 6px",
              borderRadius: 999,
              background: "rgba(255, 215, 0, 0.95)",
              color: "#1A1200",
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            Up next
          </span>
          <span
            aria-live="polite"
            style={{
              padding: "2px 5px",
              borderRadius: 6,
              background: "rgba(2, 9, 20, 0.72)",
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 800,
              textShadow: "0 1px 2px rgba(0,0,0,0.6)",
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {secondsLeft}s
          </span>
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 900,
            color: "#FFFFFF",
            textShadow: "0 1px 3px rgba(0, 0, 0, 0.75)",
            // Owner directive 2026-10-30 · "up next container if
            // track name is long it does not show,,, but the track
            // name can be under the above track name if long". Up
            // to 2 lines of title before clipping · line 2 wraps
            // under line 1 instead of being truncated with "...".
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            whiteSpace: "normal",
            wordBreak: "break-word",
            lineHeight: 1.2,
          }}
        >
          {stripTrailingLiveSuffix(props.nextTrack.title)}
        </div>
        {props.nextTrack.artist && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.85)",
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.75)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              lineHeight: 1.2,
            }}
          >
            {props.nextTrack.artist}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={props.onOpenPlaylist}
        aria-label="Open playlist"
        style={{
          position: "absolute",
          right: 8,
          bottom: 6,
          height: 30,
          padding: "0 12px",
          borderRadius: 999,
          border: "1px solid rgba(255, 255, 255, 0.5)",
          background: "rgba(2, 9, 20, 0.78)",
          color: "#FFFFFF",
          fontSize: 11,
          fontWeight: 800,
          fontFamily: "inherit",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 1,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={12}
          height={12}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="4" cy="6" r="1.4" fill="currentColor" />
          <circle cx="4" cy="12" r="1.4" fill="currentColor" />
          <circle cx="4" cy="18" r="1.4" fill="currentColor" />
        </svg>
        Playlist
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MusicPostSiblingPreloader · Save-Data-respecting prev/next cache warmer
// -----------------------------------------------------------------------------
// Previously inlined in `_preview-client.tsx`. Behaviour unchanged ·
// basePath is now a prop so the feed slide can prefetch the
// `/nex-native/nex-feed/music-<trackId>` paths instead of the preview-
// page paths.

function MusicPostSiblingPreloader(props: {
  readonly router: ReturnType<typeof useRouter>;
  readonly siblings: MusicPostShellSiblingHints;
  readonly basePath: string;
}): React.JSX.Element | null {
  const {
    prevTrackHref,
    nextTrackHref,
    prevCoverUrl,
    prevBackgroundUrl,
    nextCoverUrl,
    nextBackgroundUrl,
    prevAudioUrl,
    nextAudioUrl,
  } = props.siblings;
  const basePath = props.basePath;
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    type NetworkInformationLike = {
      saveData?: boolean;
      effectiveType?: string;
    };
    const navWithConn = navigator as Navigator & {
      connection?: NetworkInformationLike;
    };
    const conn = navWithConn.connection;
    if (conn) {
      if (conn.saveData === true) return;
      if (conn.effectiveType === "2g" || conn.effectiveType === "slow-2g") {
        return;
      }
    }
    const linkEls: HTMLLinkElement[] = [];
    const injectPreload = (url: string): void => {
      const el = document.createElement("link");
      el.rel = "preload";
      el.as = "image";
      el.href = url;
      try {
        (el as HTMLLinkElement & { fetchPriority?: string }).fetchPriority =
          "low";
      } catch {
        /* ignore */
      }
      document.head.appendChild(el);
      linkEls.push(el);
    };
    if (prevCoverUrl) injectPreload(prevCoverUrl);
    if (prevBackgroundUrl) injectPreload(prevBackgroundUrl);
    if (nextCoverUrl) injectPreload(nextCoverUrl);
    if (nextBackgroundUrl) injectPreload(nextBackgroundUrl);
    // Owner-authorised 2026-10-31 · world-class gapless · also preload
    // next/prev audio bytes. Hidden <audio preload="auto"> is more
    // reliable across browsers than <link rel="preload" as="audio">
    // (Firefox+Safari treat as="audio" inconsistently). The element
    // stays attached while the slide is mounted; its bytes land in
    // the browser cache so the next slide's playback starts instant.
    const audioEls: HTMLAudioElement[] = [];
    const injectAudioPreload = (url: string): void => {
      const el = document.createElement("audio");
      el.src = url;
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      el.muted = true;
      el.style.display = "none";
      // Explicitly do not add to any playback graph. The DOM presence
      // alone + preload="auto" is enough to warm the HTTP cache.
      document.body.appendChild(el);
      try { el.load(); } catch { /* ignore */ }
      audioEls.push(el);
    };
    if (nextAudioUrl) injectAudioPreload(nextAudioUrl);
    if (prevAudioUrl) injectAudioPreload(prevAudioUrl);
    // The feed slide passes full hrefs (already encoded by the server
    // shell); the preview page passes trackIds. We treat the two the
    // same by expecting the parent to pass "track href" values that
    // start with the basePath. If a passed value already begins with
    // `/`, use it directly; otherwise append it to the basePath (back-
    // compat with the preview page which was passing bare trackIds).
    const toHref = (v: string): string =>
      v.startsWith("/") ? v : `${basePath}${encodeURIComponent(v)}`;
    if (nextTrackHref) {
      try {
        props.router.prefetch(toHref(nextTrackHref));
      } catch {
        /* ignore */
      }
    }
    if (prevTrackHref) {
      try {
        props.router.prefetch(toHref(prevTrackHref));
      } catch {
        /* ignore */
      }
    }
    return () => {
      for (const el of linkEls) {
        try {
          el.parentNode?.removeChild(el);
        } catch {
          /* ignore */
        }
      }
      for (const el of audioEls) {
        try {
          el.pause();
          el.removeAttribute("src");
          el.load();
          el.parentNode?.removeChild(el);
        } catch {
          /* ignore */
        }
      }
    };
  }, [
    basePath,
    prevTrackHref,
    nextTrackHref,
    prevCoverUrl,
    prevBackgroundUrl,
    nextCoverUrl,
    nextBackgroundUrl,
    prevAudioUrl,
    nextAudioUrl,
    props.router,
  ]);
  return null;
}

/** Re-exported so the preview page's manual INK_DIM references continue
 *  to resolve during the transition period. Can be inlined by the caller
 *  once the preview-client refactor is also wired through the shell. */
export { INK_DIM as MUSIC_POST_SHELL_INK_DIM };
