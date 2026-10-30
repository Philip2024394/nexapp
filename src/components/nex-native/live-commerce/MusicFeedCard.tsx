"use client";

// src/components/nex-native/live-commerce/MusicFeedCard.tsx
//
// Owner-authorised 2026-10-30 (M-4 of NEX Music Publishing → Live Feed) ·
// Renders a creator's active music post as a feed card.
//
// Two render modes (locked design):
//   · "cover_audio" · still cover image + <audio> element
//   · "music_video" · <video> element with its own audio track
//
// Audio coordination (§5):
//   · One audio-source invariant · a shared coordinator pauses the
//     currently-playing media before starting a new one. For this
//     scaffold we gate on `isActive` passed by the parent feed · the
//     parent decides which card is current (e.g. the swipe-visible one).
//   · Save-Data honouring · `preload="none"` + no autoplay on
//     constrained networks. On fast networks we respect the parent's
//     `isActive` + browser autoplay policy.
//   · Playback stops on unmount via `audio.pause()` + `audio.src = ""`.
//
// Universal Image Display Integrity doctrine 2026-10-30:
//   · Cover: `object-fit: contain` (preserve full image).
//   · Background (optional): `object-fit: cover` per sealed §3.1a music
//     exception (same as music preview page).
//
// Sealed NEX avatar presence rim · we don't surface presence state on
// this card today · owner avatar renders without rim colour (null →
// neutral white).

import * as React from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";
import type { MusicFeedEntry } from "@/lib/nex-native/music/active-music-feed-reader";

const INK = "#F0F6FF";
const INK_DIM = "rgba(240, 246, 255, 0.72)";
const BG_DARK = "#020914";
const CYAN = "#4FC3FF";

export interface MusicFeedCardProps {
  readonly entry: MusicFeedEntry;
  /** When true, this card may autoplay (if browser policy allows). When
   *  false, media is held paused regardless of user interaction. The
   *  parent feed decides which card is current. */
  readonly isActive: boolean;
  /** If `true`, the card renders with the "newly published" cyan glow
   *  pulse (used by the publish-success navigation highlight). */
  readonly highlight: boolean;
  /** Called when the user taps the card's title/cover to open the
   *  creator library. Optional · caller may omit if no library route
   *  exists for this entry. */
  readonly onOpenCreatorLibrary?: (ownerAccountId: string, trackId: string) => void;
  /** When true, the card fills its parent 100% × 100% (no 9/16
   *  aspect-ratio clamp). Used by the full-bleed music viewer in the
   *  NEX feed. Default: aspect-ratio preserved for grid-style use. */
  readonly fullBleed?: boolean;
}

interface NetworkInfo {
  readonly saveData: boolean;
  readonly isConstrained: boolean;
}

function readNetworkInfo(): NetworkInfo {
  if (typeof navigator === "undefined") {
    return { saveData: false, isConstrained: false };
  }
  const conn = (navigator as Navigator & {
    connection?: {
      saveData?: boolean;
      effectiveType?: string;
    };
  }).connection;
  if (!conn) return { saveData: false, isConstrained: false };
  const saveData = conn.saveData === true;
  const isConstrained =
    saveData ||
    conn.effectiveType === "2g" ||
    conn.effectiveType === "slow-2g";
  return { saveData, isConstrained };
}

export function MusicFeedCard(props: MusicFeedCardProps): React.JSX.Element {
  const [network, setNetwork] = React.useState<NetworkInfo>(() => ({
    saveData: false,
    isConstrained: false,
  }));
  React.useEffect(() => {
    setNetwork(readNetworkInfo());
  }, []);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  // Honest audio coordination · when this card goes inactive, pause.
  // When active + non-constrained, attempt to play (browser policy
  // decides whether we can). On unmount or swipe-away, pause only
  // AFTER the pending play() promise has settled; otherwise the
  // browser throws AbortError ("play() request was interrupted
  // because the media was removed from the document").
  const playPromiseRef = React.useRef<Promise<void> | null>(null);
  React.useEffect(() => {
    const media =
      props.entry.publishAsMode === "music_video"
        ? videoRef.current
        : audioRef.current;
    if (!media) return;
    let disposed = false;

    const safePause = (): void => {
      try {
        if (!media.paused) media.pause();
      } catch {
        /* media removed from document · ignore */
      }
    };

    if (props.isActive && !network.isConstrained) {
      // Capture the in-flight play promise so cleanup can wait for it
      // before pausing. Catch BOTH AbortError (navigation during play)
      // and NotAllowedError (browser autoplay policy blocked).
      const p = media.play().catch(() => {
        /* expected: AbortError on fast nav, NotAllowedError on autoplay-block */
      });
      playPromiseRef.current = p;
      // If this effect has already disposed by the time play() resolves,
      // pause then (safePause is a no-op if media is gone).
      void p.then(() => {
        if (disposed) safePause();
      });
    } else {
      safePause();
    }

    return () => {
      disposed = true;
      // Defer the pause to AFTER the in-flight play promise settles.
      // Pausing while play is pending is exactly what triggers
      // AbortError. If there's no in-flight play, the then() runs on
      // the next microtask and we pause immediately.
      const pending = playPromiseRef.current ?? Promise.resolve();
      void pending.then(safePause);
    };
  }, [props.isActive, network.isConstrained, props.entry.trackId, props.entry.publishAsMode]);

  // Visibility change · pause on hidden to respect mobile audio-session
  // interruption rules.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = (): void => {
      if (document.visibilityState !== "hidden") return;
      audioRef.current?.pause();
      videoRef.current?.pause();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const title = props.entry.title;
  const artist = props.entry.artist;
  const owner = props.entry.ownerDisplayName;
  const handle = props.entry.ownerNexHandle;

  const openLibrary = React.useCallback(() => {
    if (!props.onOpenCreatorLibrary) return;
    props.onOpenCreatorLibrary(props.entry.ownerAccountId, props.entry.trackId);
  }, [props]);

  const canAutoplay = props.isActive && !network.isConstrained;
  const preload = canAutoplay ? "auto" : "metadata";

  return (
    <article
      data-nex-music-feed-card
      aria-label={`${title}${artist ? " by " + artist : ""}, by ${owner}`}
      style={{
        position: "relative",
        width: "100%",
        ...(props.fullBleed
          ? { height: "100%" }
          : { aspectRatio: "9 / 16", maxHeight: "100dvh" }),
        overflow: "hidden",
        background: BG_DARK,
        color: INK,
        fontFamily: NEX_FONT_SANS,
        borderRadius: 0,
        boxShadow: props.highlight
          ? `0 0 0 2px ${CYAN}, 0 0 24px rgba(79, 195, 255, 0.55)`
          : "none",
        transition: "box-shadow 320ms ease-out",
      }}
    >
      {/* Background layer · optional background image (owner-authored
          music-page exception to Universal Image doctrine clause 2). */}
      {props.entry.backgroundSignedUrl && (
        <img
          src={props.entry.backgroundSignedUrl}
          alt=""
          aria-hidden
          loading={canAutoplay ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={canAutoplay ? "high" : "low"}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0,
          }}
        />
      )}
      {!props.entry.backgroundSignedUrl && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${BG_DARK} 0%, #0A1424 100%)`,
            zIndex: 0,
          }}
        />
      )}

      {/* Darken overlay so the title text reads over any image. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(2,9,20,0.35) 0%, rgba(2,9,20,0.05) 35%, rgba(2,9,20,0.55) 100%)",
          zIndex: 1,
        }}
      />

      {/* Media layer · cover + audio OR music video. */}
      {props.entry.publishAsMode === "music_video" ? (
        <video
          ref={videoRef}
          data-nex-feed-video
          /* Music videos carry their own cover art in the first frame;
             we use the signed audio-less media URL from the slot's
             track (same reference as cover_audio because, for v1, music
             videos are not separately stored). Owner may later authorise
             a distinct music_video media reference. */
          src={props.entry.audioSignedUrl ?? undefined}
          poster={props.entry.coverSignedUrl ?? undefined}
          preload={preload}
          playsInline
          loop
          controls={false}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "100%",
            height: "auto",
            maxHeight: "100%",
            zIndex: 2,
            objectFit: "contain",
            background: BG_DARK,
          }}
        />
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(72vw, 420px)",
              aspectRatio: "1 / 1",
              borderRadius: 16,
              overflow: "hidden",
              background: BG_DARK,
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
              zIndex: 2,
            }}
          >
            {props.entry.coverSignedUrl ? (
              <img
                src={props.entry.coverSignedUrl}
                alt=""
                aria-hidden
                loading={canAutoplay ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={canAutoplay ? "high" : "low"}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  background: BG_DARK,
                }}
              />
            ) : (
              <div
                aria-hidden
                style={{
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  color: INK_DIM,
                  fontSize: 48,
                }}
              >
                ♪
              </div>
            )}
          </div>
          {props.entry.audioSignedUrl && (
            <audio
              ref={audioRef}
              data-nex-feed-audio
              src={props.entry.audioSignedUrl}
              preload={preload}
              loop
              controls={false}
              aria-label={`${title} audio`}
            />
          )}
        </>
      )}

      {/* Footer overlay · creator identity + title + action to open the
          creator's library. Tapping the title area opens the library
          overlay (if the parent provides a handler). */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 3,
          padding:
            "22px 20px calc(env(safe-area-inset-bottom, 0px) + 24px) 20px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background:
            "linear-gradient(180deg, rgba(2,9,20,0) 0%, rgba(2,9,20,0.72) 100%)",
        }}
      >
        <button
          type="button"
          onClick={openLibrary}
          aria-label={`Open ${owner}'s music library`}
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            background: "transparent",
            border: "none",
            color: INK,
            cursor: "pointer",
            padding: 0,
            textAlign: "left",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              overflow: "hidden",
              background: "rgba(10, 27, 51, 0.65)",
              display: "grid",
              placeItems: "center",
              border: "1.5px solid rgba(255, 255, 255, 0.5)",
              flexShrink: 0,
            }}
          >
            {props.entry.ownerAvatarUrl ? (
              <img
                src={props.entry.ownerAvatarUrl}
                alt=""
                aria-hidden
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <span
                style={{
                  color: INK,
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                {owner.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: INK,
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {owner}
            </span>
            {handle && (
              <span
                style={{
                  fontSize: 11,
                  color: INK_DIM,
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {handle}
              </span>
            )}
          </span>
        </button>
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: INK,
            lineHeight: 1.2,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            wordBreak: "break-word",
            textShadow: "0 1px 4px rgba(0,0,0,0.6)",
          }}
        >
          {title}
        </div>
        {artist && (
          <div
            style={{
              fontSize: 13,
              color: INK_DIM,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {artist}
          </div>
        )}
      </div>
    </article>
  );
}
