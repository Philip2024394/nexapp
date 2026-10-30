"use client";

// src/components/nex-native/music/NexMusicPlayerOverlay.tsx
//
// Owner-authorised 2026-10-29 · DRAFT §10 player overlay.
//
// Visual target = owner-supplied `music player.png`:
//   · Translucent glass base with cyan/blue luminous outlines.
//   · Album cover on the left · title + artist on top-right of the
//     cover.
//   · Animated waveform.
//   · Scrub bar with elapsed + total.
//   · Prev / play-pause / next.
//   · Volume slider.
//   · Spotify + YouTube source buttons (disabled for uploaded_audio,
//     active with honest "Opens in …" status for external sources).
//   · Minimise + close.
//
// The overlay is positioned ABOVE the Live viewer-footer-pill via
// its container · zIndex 23 keeps it beneath the sealed Stop Live
// button (25) and the Jail confirmation overlay. Honest live
// behaviour: for `uploaded_audio` the music is mixed into the
// outgoing WebRTC audio track via `onAudioElement` → mixer
// attachment in the parent surface. For spotify / youtube the
// controls disable with an honest status.

import * as React from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";
import type { NexMusicTrackRow } from "@/lib/nex-native/music/types";
import { MusicWaveform } from "./MusicWaveform";

const CYAN = "#4FC3FF";
const CYAN_SOFT = "rgba(79, 195, 255, 0.35)";
const DEEP = "#071226";
const INK = "#F0F6FF";
const INK_DIM = "rgba(240, 246, 255, 0.72)";
const RED = "#FF3355";
// Owner-authorised 2026-10-29 (dark-red play button) · classic
// darkred/#8B0000 base with a deeper #550000 gradient end + a soft
// red glow.
const RED_DARK = "#8B0000";
const RED_DEEPER = "#550000";
// Owner-authorised 2026-10-29 (white equaliser · yellow rim light) ·
// EQ bars render in pure white · the running-light on the cover
// container rim sweeps in a classic gold/yellow.
const EQ_WHITE = "#FFFFFF";
const RIM_YELLOW = "#FFD700";
const RIM_YELLOW_SOFT = "rgba(255, 215, 0, 0.5)";

export interface NexMusicPlayerOverlayProps {
  readonly track: NexMusicTrackRow;
  readonly coverUrl: string | null;
  readonly audioSrcUrl: string | null; // null for external sources
  readonly initialVolume?: number;
  readonly onMinimise: () => void;
  readonly onClose: () => void;
  readonly onNext?: (() => void) | null;
  readonly onPrev?: (() => void) | null;
  /** Fired once the <audio> element exists · the host can hand it
   *  to the live-audio-mixer so viewers hear the music. */
  readonly onAudioElement?: (audio: HTMLAudioElement | null) => void;
  /** Owner-authorised 2026-10-29 (Stage 5A · volume defect fix) ·
   *  retained in the interface for Web-Audio-mixer callers · no
   *  longer fired from here (volume UI removed per owner directive). */
  readonly onVolumeChange?: (nextVolume: number) => void;
  /** Owner-authorised 2026-10-29 (broadcaster chip) · the broadcaster
   *  avatar + name render BELOW the live-signal header, OVER the
   *  track cover row. When either is null, that row is suppressed. */
  readonly broadcasterName?: string | null;
  readonly broadcasterAvatarUrl?: string | null;
  /** Owner-authorised 2026-10-29 · public NEX identity handle
   *  (nex-XXXXX form) · rendered directly under the broadcaster
   *  display name as a secondary identity line. */
  readonly broadcasterNexHandle?: string | null;
  /** Owner-authorised 2026-10-29 · broadcaster presence lamp on the
   *  avatar. Sealed palette (`_contact-row.tsx:38-40`):
   *    · `"online"` → green `#16D66B`
   *    · `"busy"`   → orange `#FF7200`
   *    · `"offline"`→ dark red `#A60000`
   *  When null/undefined, no dot is rendered (honest absence). The
   *  preview surface passes `"online"` because the author viewing
   *  their own preview is, by definition, online. */
  readonly broadcasterPresence?: "online" | "busy" | "offline" | null;
  /** Owner-authorised 2026-10-29 · when `true`, a small filled
   *  heart marker sits at the top-left of the cover frame — the
   *  persistent "this track is liked by me" indicator that lingers
   *  after the heart-rain burst completes. */
  readonly isLiked?: boolean;
  /** Owner-authorised 2026-10-30 · when provided, tapping the track
   *  cover frame opens the broadcaster's music library overlay.
   *  The handler receives no arguments — the caller already knows
   *  which track + creator context the overlay should resolve to.
   *  When undefined, the cover frame is non-interactive (default). */
  readonly onTrackCoverTap?: () => void;
  /** Owner-authorised 2026-10-30 · when true, the overlay attempts
   *  to auto-start playback as soon as the <audio> element can play.
   *  Honest limitation · browser autoplay policies may block this
   *  without a prior user gesture on the origin (e.g. a direct URL
   *  load with no history). In that case the attempt is silently
   *  ignored and the user still has the play button. Autoplay is
   *  honoured on same-origin navigations (card tap, swipe, auto-
   *  advance) because the gesture history carries forward. */
  readonly autoPlayOnMount?: boolean;
  /** Owner-authorised 2026-10-30 · prev / next arrow handlers for
   *  the plays-count row in the overlay footer. When provided the
   *  overlay renders a play-arrow glyph on each side of the plays
   *  count. The caller is responsible for wrap-at-ends semantics
   *  (owner directive · if the user is at the oldest track, prev
   *  wraps to the newest; same for next at the end). Omit either
   *  prop to hide its arrow. */
  readonly onPrevTrack?: () => void;
  readonly onNextTrack?: () => void;
  /** Owner-authorised 2026-10-29 (live-video header parity) · ISO
   *  country code (e.g. "ID") used to render the "Live {country}"
   *  line, matching the sealed Live-video header pattern. */
  readonly broadcasterCountry?: string | null;
  /** Owner-authorised 2026-10-29 · ISO timestamp used for the
   *  "Broadcasted {date}" secondary line. For music uploads this
   *  is the track's created_at — the Live-video surface uses the
   *  equivalent `published_at ?? created_at`. */
  readonly broadcastedAtIso?: string | null;
  /** Owner-authorised 2026-10-29 · when the track is AI-generated,
   *  a compact red "(AI)" chip appears after the Broadcasted date,
   *  matching migration-221 behaviour on Live-video. Absence does
   *  NOT imply human origin · NEX makes no claim on unlabelled
   *  music. Music schema (migration 235) does not yet carry an
   *  `is_ai_generated` column · callers pass `false` until that
   *  schema field is added. */
  readonly isAiGenerated?: boolean;
  /** Owner-authorised 2026-10-29 (next-song card at 30s remaining) ·
   *  fired on every `timeupdate` tick with current position + total
   *  duration (both in ms). Callers decide when to render a
   *  "next-up" card (e.g., `durationMs − positionMs ≤ 30_000`). */
  readonly onPositionTick?: (positionMs: number, durationMs: number) => void;
  /** Owner-authorised 2026-10-29 · fires once when the audio
   *  element reports `ended`. Callers use this to auto-advance. */
  readonly onAudioEnded?: () => void;
  /** Owner-authorised 2026-10-29 · fires on every play/pause/end
   *  transition. Callers use this to drive external UI (e.g. a
   *  rotating broadcaster avatar in the page header that spins
   *  while music is playing and stops when paused). */
  readonly onPlayStateChange?: (isPlaying: boolean) => void;
  /** Owner-authorised 2026-10-29 (Live analyser exposure · D3) ·
   *  when provided, the overlay reads frequency data from this
   *  caller-supplied AnalyserNode instead of creating its own
   *  MediaElementSource. Live callers pass the mixer's analyser so
   *  there is one clear source of waveform data per surface.
   *
   *  When present (prop is defined, even if `.current` is null),
   *  the overlay will NOT attempt to create a local MediaElementSource.
   *  This avoids the caught-exception-as-normal-behaviour pattern on
   *  Live where the mixer already owns the audio element.
   *  When undefined, the preview-side local analyser path is used. */
  readonly externalAnalyserRef?: React.RefObject<AnalyserNode | null>;
}

export function NexMusicPlayerOverlay(
  props: NexMusicPlayerOverlayProps,
): React.JSX.Element {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [positionMs, setPositionMs] = React.useState(0);
  const [durationMs, setDurationMs] = React.useState(
    props.track.duration_ms ?? 0,
  );
  // Owner-authorised 2026-10-29 (phone-volume policy) · no UI
  // slider · playback gain = phone system volume. `initialVolume` is
  // honoured once on mount for callers that still pass it; the
  // `onVolumeChange` callback is retained in the interface for
  // callers that mix via Web Audio but is no longer fired from here.
  // Owner-authorised 2026-10-30 · default raised from 0.8 → 1.0 to
  // apply NO attenuation at the HTML Audio layer · the phone system
  // volume remains the sole governor per the sealed 2026-10-29
  // phone-volume policy. 1.0 is the maximum standard HTML Audio
  // value · going above 1 is non-standard and risks clipping.
  const initialVolumeValue =
    typeof props.initialVolume === "number"
      ? Math.max(0, Math.min(1, props.initialVolume))
      : 1.0;
  const [error, setError] = React.useState<string | null>(null);

  const isExternal = props.track.source_type !== "uploaded_audio";
  const externalKind =
    props.track.source_type === "spotify_url"
      ? "Spotify"
      : props.track.source_type === "youtube_url"
      ? "YouTube"
      : null;

  // Owner-authorised 2026-10-29 (beat-responsive equaliser) · tap the
  // <audio> element through a Web Audio graph (source → analyser →
  // destination), read 32 frequency bins in a RAF loop, collapse to
  // 6 bar levels, feed `MusicWaveform.levels`.
  //
  // Honest limitation · `createMediaElementSource` can only be called
  // once per audio element. On the Live surface the mixer owns the
  // graph; attempting to create a second source throws. We catch and
  // fall back to the pseudo-random CSS animation there. A proper
  // Live-side fix is to have the mixer expose its own AnalyserNode;
  // that's a separate scope.
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const srcNodeRef = React.useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const binsBufRef = React.useRef<Uint8Array | null>(null);
  const graphAttemptedRef = React.useRef(false);
  const [barLevels, setBarLevels] = React.useState<number[] | null>(null);

  const ensureAnalyserGraph = React.useCallback(() => {
    if (graphAttemptedRef.current) return;
    graphAttemptedRef.current = true; // never retry — any outcome is final
    const audio = audioRef.current;
    if (!audio) return;
    try {
      const Ctor: typeof AudioContext | undefined =
        typeof window === "undefined"
          ? undefined
          : (window.AudioContext ??
              (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext);
      if (!Ctor) return;
      const ctx = new Ctor();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64; // 32 bins · plenty for 6 bars
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      srcNodeRef.current = source;
      analyserRef.current = analyser;
      binsBufRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      // Element already tapped (e.g. by the Live mixer). The CSS
      // fallback animation will take over.
    }
  }, []);

  const stepAnalyser = React.useCallback(() => {
    // Owner-authorised 2026-10-29 (Live analyser exposure · D3) ·
    // prefer caller-supplied analyser (Live mixer tap) over our
    // local one (preview fallback). Each frame we re-read so a late-
    // arriving external ref still takes over cleanly.
    const external = props.externalAnalyserRef?.current ?? null;
    const analyser = external ?? analyserRef.current;
    // Buffer sized for whichever analyser is in use. Both are
    // created with fftSize=64 so the buffer is reusable, but if the
    // caller changes that in future we re-create defensively.
    let bins = binsBufRef.current;
    if (analyser && (!bins || bins.length !== analyser.frequencyBinCount)) {
      bins = new Uint8Array(analyser.frequencyBinCount);
      binsBufRef.current = bins;
    }
    if (!analyser || !bins) {
      rafRef.current = null;
      return;
    }
    analyser.getByteFrequencyData(bins as unknown as Uint8Array<ArrayBuffer>);
    // Map 32 bins into 6 buckets (bass → treble) with a slight bias
    // toward lower frequencies which carry most of the perceived beat.
    const binsPerBar = Math.floor(bins.length / 6);
    const next: number[] = new Array(6);
    for (let i = 0; i < 6; i++) {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < binsPerBar; j++) {
        const v = bins[i * binsPerBar + j];
        if (typeof v === "number") {
          sum += v;
          count++;
        }
      }
      const avg = count > 0 ? sum / count : 0;
      // Normalise to 0..1 and apply a soft gamma so quieter bins
      // still show something but the beat really spikes.
      next[i] = Math.pow(avg / 255, 0.65);
    }
    // Owner-authorised 2026-10-30 · "tallest bar in the center of the
    // animation." Reshape the frequency-sorted levels into a mountain
    // profile so the two center positions always carry the loudest
    // energy, tapering outward. The analyser output stays truthful
    // (same six values); we only rearrange how they are drawn.
    const sortedDesc = [...next].sort((a, b) => b - a);
    const peaked: number[] = [
      sortedDesc[4] ?? 0,
      sortedDesc[2] ?? 0,
      sortedDesc[0] ?? 0, // center-left · tallest
      sortedDesc[1] ?? 0, // center-right · second tallest
      sortedDesc[3] ?? 0,
      sortedDesc[5] ?? 0,
    ];
    setBarLevels(peaked);
    rafRef.current = requestAnimationFrame(stepAnalyser);
  }, []);

  // Drive the loop based on isPlaying · stop + rest when paused.
  React.useEffect(() => {
    if (!isPlaying || isExternal) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Owner directive · "when song stop the animation stop" ·
      // settle bars at a flat resting line.
      setBarLevels([0, 0, 0, 0, 0, 0]);
      return;
    }
    // Owner-authorised 2026-10-29 (Live analyser exposure · D3) ·
    // only attempt the overlay-local graph when there is NO
    // external analyser ref. On Live the mixer already owns the
    // audio element; attempting a second MediaElementSource there
    // would throw. We skip the attempt entirely rather than relying
    // on a caught exception as normal behaviour.
    if (!props.externalAnalyserRef) {
      ensureAnalyserGraph();
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended") {
        void ctx.resume().catch(() => undefined);
      }
    }
    // RAF starts when we have ANY analyser available (external or
    // local). If an external ref is provided but `.current` is not
    // yet populated, we still start the loop · stepAnalyser bails
    // cleanly and the next render will restart it once the ref lands.
    const haveAnalyser = Boolean(
      props.externalAnalyserRef?.current ?? analyserRef.current,
    );
    if (haveAnalyser && rafRef.current === null) {
      rafRef.current = requestAnimationFrame(stepAnalyser);
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [
    isPlaying,
    isExternal,
    ensureAnalyserGraph,
    stepAnalyser,
    props.externalAnalyserRef,
  ]);

  // Teardown on unmount.
  React.useEffect(() => {
    return () => {
      try {
        srcNodeRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        analyserRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        void audioCtxRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Attach ref via callback so the parent can grab it for the mixer.
  const setAudioRef = React.useCallback(
    (el: HTMLAudioElement | null) => {
      audioRef.current = el;
      if (props.onAudioElement) props.onAudioElement(el);
    },
    [props.onAudioElement, props],
  );

  const onLoadedMeta = () => {
    const audio = audioRef.current;
    if (!audio) return;
    // Apply the caller's initial volume once · subsequent loudness
    // is the user's phone system volume.
    audio.volume = initialVolumeValue;
    const ms = Math.round(audio.duration * 1000);
    if (Number.isFinite(ms) && ms > 0) setDurationMs(ms);
  };
  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextPos = Math.round(audio.currentTime * 1000);
    setPositionMs(nextPos);
    // Owner-authorised 2026-10-29 (next-song card at 30s remaining) ·
    // publish position + duration to callers that need to decide
    // when to render a "next up" card. durationMs comes from state
    // which is already synced with the audio element.
    if (props.onPositionTick) {
      try {
        props.onPositionTick(nextPos, durationMs);
      } catch {
        /* host failures must not block the UI */
      }
    }
  };
  const onPlay = () => setIsPlaying(true);
  const onPause = () => setIsPlaying(false);
  // Owner-authorised 2026-10-29 · publish play-state to callers so
  // the page header can rotate the broadcaster avatar in sync with
  // the music.
  const onPlayStateChangeProp = props.onPlayStateChange;
  React.useEffect(() => {
    if (onPlayStateChangeProp) {
      try {
        onPlayStateChangeProp(isPlaying);
      } catch {
        /* host failures must not block the UI */
      }
    }
  }, [isPlaying, onPlayStateChangeProp]);
  const onEnded = () => {
    setIsPlaying(false);
    setPositionMs(0);
    // Owner-authorised 2026-10-29 · auto-advance hook · the preview
    // surface router.pushes the next shared_live track; Live surface
    // can wire its own queue advance here when M1 is authorised.
    if (props.onAudioEnded) {
      try {
        props.onAudioEnded();
      } catch {
        /* host failures must not block the UI */
      }
    }
  };
  const onAudioError = () => {
    setError("Playback error · the file may be unavailable");
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isExternal) return;
    const audio = audioRef.current;
    if (!audio) return;
    // Owner-authorised 2026-10-29 (beat-responsive equaliser) ·
    // Lazy-create the Web Audio graph on first play, inside the user
    // gesture, so Chrome / Safari don't block the AudioContext.
    //
    // Owner-authorised 2026-10-29 (Live analyser exposure · D3) ·
    // skip the local graph entirely when an external analyser ref
    // is provided (Live surface). The mixer already owns the audio
    // element there; creating a second MediaElementSource would
    // throw. The caller's analyser is read in the RAF loop.
    if (!props.externalAnalyserRef) {
      ensureAnalyserGraph();
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended") {
        void ctx.resume().catch(() => undefined);
      }
    }
    if (audio.paused) {
      audio
        .play()
        .then(() => setError(null))
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Playback blocked");
        });
    } else {
      audio.pause();
    }
  };

  const seekToPercent = (pct: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (durationMs <= 0) return;
    const nextMs = Math.max(0, Math.min(durationMs, (pct / 100) * durationMs));
    audio.currentTime = nextMs / 1000;
    setPositionMs(nextMs);
  };

  const openExternal = () => {
    if (!props.track.source_url) return;
    window.open(props.track.source_url, "_blank", "noopener,noreferrer");
  };

  const progressPct =
    durationMs > 0 ? Math.round((positionMs / durationMs) * 1000) / 10 : 0;

  return (
    <div
      role="dialog"
      aria-label="NEX Music player"
      data-nex-music-overlay
      style={{
        position: "absolute",
        left: 10,
        right: 10,
        // Owner directive 2026-10-30 · "move the player down to
        // footer area". Lift reduced from 64 px → 16 px so the
        // overlay sits in the honest footer slot of the music post
        // (preview + feed share this primitive, so both surfaces
        // move together · the Edit/Live cluster on the preview sits
        // at bottom 276 px and is unaffected).
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        zIndex: 23,
        fontFamily: NEX_FONT_SANS,
        // Owner-authorised 2026-10-29 (transparent player) · no
        // background, border, or shadow · the overlay sits directly
        // over the backdrop image + lower text bar. Critical text
        // picks up a soft shadow for legibility across any photo.
        color: INK,
        padding: 0,
        textShadow: "0 1px 2px rgba(0, 0, 0, 0.55)",
      }}
    >
      {/* Owner-authorised 2026-10-29 (overlay header removal) · the
          duplicate vinyl + "Live {country}" + "Broadcasted {date}"
          + satellite/ping block has been removed from inside the
          overlay. That information lives in the TOP page header
          now · keeping it here was redundant. Broadcaster chip
          (avatar + name) is kept as the only header row. */}

      {/* Broadcaster chip · sits over the track cover row.
          Owner-authorised 2026-10-29 · NO presence dot · presence
          is expressed on the AVATAR RIM itself, matching the sealed
          `_contact-row.tsx:60-67, 147-160` convention:
            · online → green rim + heartbeat pulse
            · busy   → orange rim + heartbeat pulse
            · offline→ dark-red rim · static (no pulse)
            · null   → no rim colour · honest absence
          Avatar bumped 24 → 44 px so the broadcaster photo reads
          clearly over the backdrop. */}
      {props.broadcasterName && (() => {
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
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, minWidth: 0 }}>
            <span
              style={{
                position: "relative",
                width: 44,
                height: 44,
                flexShrink: 0,
              }}
            >
              {props.broadcasterAvatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={props.broadcasterAvatarUrl}
                  alt=""
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: presenceColor
                      ? `2px solid ${presenceColor}`
                      : `1.5px solid rgba(255, 255, 255, 0.5)`,
                    display: "block",
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "rgba(10, 27, 51, 0.65)",
                    border: presenceColor
                      ? `2px solid ${presenceColor}`
                      : `1.5px solid rgba(255, 255, 255, 0.5)`,
                    color: INK,
                    fontSize: 15,
                    fontWeight: 800,
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
                    animation: "nex-music-broadcaster-heartbeat 1200ms cubic-bezier(0.4,0,0.2,1) infinite",
                    pointerEvents: "none",
                  }}
                />
              )}
            </span>
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                gap: 1,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: INK,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: 1.2,
                }}
              >
                {props.broadcasterName}
              </span>
              {props.broadcasterNexHandle && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "rgba(240, 246, 255, 0.75)",
                    letterSpacing: "0.04em",
                    lineHeight: 1.2,
                    textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {props.broadcasterNexHandle}
                </span>
              )}
            </span>
            <style>{`
              @keyframes nex-music-broadcaster-heartbeat {
                0% { transform: scale(1); opacity: 0.9; }
                75% { transform: scale(1.35); opacity: 0; }
                100% { transform: scale(1.35); opacity: 0; }
              }
            `}</style>
          </div>
        );
      })()}

      {/* Row 1 · cover (with running-light frame when playing) +
          title / artist / equaliser + play */}
      <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
        <div
          // Owner-authorised 2026-10-30 (Main Feed → Creator Music) ·
          // the track cover is the intentional entry point into the
          // creator's music library. When `onTrackCoverTap` is
          // provided we remove `aria-hidden` so the overlay button
          // layered inside the frame can be reached by AT. When no
          // handler is provided the cover remains decorative.
          {...(props.onTrackCoverTap ? {} : { "aria-hidden": true })}
          data-nex-music-cover-frame
          data-playing={isPlaying ? "1" : "0"}
          style={{
            position: "relative",
            width: 76,
            height: 76,
            flexShrink: 0,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {/* Running-light layer · conic gradient that rotates when
              `isPlaying` is true. Owner-authorised 2026-10-29 (yellow
              rim light). Padding = 2px gap between light sweep and
              inner cover. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 12,
              padding: 2,
              background: isPlaying
                ? `conic-gradient(from 0deg, transparent 0%, ${RIM_YELLOW} 10%, ${RIM_YELLOW_SOFT} 18%, transparent 30%, transparent 100%)`
                : `linear-gradient(135deg, rgba(255,215,0,0.35) 0%, rgba(255,215,0,0.1) 100%)`,
              animation: isPlaying ? "nex-music-cover-sweep 2.4s linear infinite" : "none",
              transition: "background 320ms ease-out",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 2,
              borderRadius: 10,
              // World-class loading colour · match NEX chat free dark
              // navy so the cover placeholder reads as deliberate
              // negative space, not a loading glitch.
              background: `linear-gradient(135deg, #020914 0%, #0A1424 100%)`,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {props.coverUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={props.coverUrl}
                alt=""
                loading="eager"
                decoding="async"
                fetchPriority="high"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 26, color: CYAN }}>♪</span>
            )}
            {/* Owner-authorised 2026-10-29 · "Broadcasted {date}"
                sits OVER the track cover (moved from the page
                header). Dark translucent chip clipped inside the
                cover frame so it reads across any photo. Format
                locked to en-US "Oct 29, 2026" per owner directive
                regardless of browser locale. */}
            <BroadcastedOverCover
              broadcastedAtIso={props.broadcastedAtIso ?? null}
            />
            {/* Owner-authorised 2026-10-29 · persistent liked
                marker on cover top-left. Appears once the track is
                liked, lingers across reloads. Pops into place with
                a 220 ms scale-in so the moment of liking feels
                connected to the heart-rain burst. */}
            {props.isLiked && (
              <span
                aria-label="Liked"
                style={{
                  position: "absolute",
                  top: 4,
                  left: 4,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "rgba(0, 0, 0, 0.55)",
                  display: "grid",
                  placeItems: "center",
                  color: "#FF3355",
                  animation: "nex-music-cover-heart-pop 220ms ease-out",
                  filter: "drop-shadow(0 0 4px rgba(255, 51, 85, 0.65))",
                  pointerEvents: "none",
                }}
              >
                <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor" aria-hidden>
                  <path d="M12 21s-7-4.35-9.5-9.1C.9 8.6 3.1 5 6.6 5c1.9 0 3.6 1 4.4 2.4C11.8 6 13.5 5 15.4 5 18.9 5 21.1 8.6 19.5 11.9 17 16.65 12 21 12 21z" />
                </svg>
              </span>
            )}
          </div>
          <style>{coverSweepKeyframes}</style>
          {/* Owner-authorised 2026-10-30 (Main Feed → Creator Music) ·
              transparent tap button layered over the cover art. Opens
              the creator-library overlay. Z-index 2 sits above the
              running-light layer (z-index 0) and the inner cover
              (also z-index 0) so the tap always lands here first. */}
          {props.onTrackCoverTap && (
            <button
              type="button"
              onClick={props.onTrackCoverTap}
              aria-label="Open creator library"
              style={{
                position: "absolute",
                inset: 0,
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                zIndex: 2,
              }}
            />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Owner-authorised 2026-10-29 · title wraps to a SECOND
              row when the first row isn't long enough (e.g. "My
              Seat Remains the Same") · `-webkit-line-clamp: 2`
              caps at 2 lines so an exceptionally long title still
              ellipses rather than pushing the layout. */}
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: INK,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              lineHeight: 1.2,
              wordBreak: "break-word",
            }}
          >
            {stripTrailingLiveSuffix(props.track.title)}
          </div>
          <div style={{ fontSize: 12, color: INK_DIM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {props.track.artist ?? "Unknown artist"}
            {externalKind && (
              <>
                <span style={{ margin: "0 6px" }}>·</span>
                <span style={{ color: CYAN, fontWeight: 700 }}>{externalKind}</span>
              </>
            )}
          </div>
          {/* Owner-authorised 2026-10-29 · equaliser + play button
              share one row · the play button sits on the right of
              the 6-bar animation and uses the dark-red theme. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              // Owner-authorised 2026-10-30 · equaliser moves to the
              // right-centre of the row (space-between → flex-end
              // with the waveform margin-pushed off the left edge).
              // The play button stays at the far right.
              justifyContent: "flex-end",
              gap: 14,
              marginTop: 2,
            }}
          >
            <div
              style={{
                marginLeft: "auto",
                // Owner-authorised 2026-10-30 · nudge the waveform
                // 35px (15 + 10 + 10) to the left of its right-centre
                // anchor so it sits further from the play button.
                transform: "translateX(-35px)",
              }}
            >
              <MusicWaveform
                isPlaying={isPlaying && !isExternal}
                accent={EQ_WHITE}
                height={28}
                levels={barLevels}
              />
            </div>
            <TransportButton
              disabled={isExternal}
              onClick={isExternal ? openExternal : togglePlay}
              ariaLabel={isPlaying ? "Pause" : "Play"}
              size={44}
              primary
              variant="dark-red"
            >
              {isExternal ? (
                <svg viewBox="0 0 20 20" width={18} height={18}>
                  <path d="M8 4l8 6-8 6V4z" fill="currentColor" />
                </svg>
              ) : isPlaying ? (
                <svg viewBox="0 0 20 20" width={18} height={18}>
                  <rect x="5" y="4" width="4" height="12" fill="currentColor" />
                  <rect x="11" y="4" width="4" height="12" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" width={18} height={18}>
                  <path d="M6 4l10 6-10 6V4z" fill="currentColor" />
                </svg>
              )}
            </TransportButton>
          </div>
        </div>
      </div>

      {/* Row 2 · scrub + times */}
      <div style={{ marginTop: 12 }}>
        {isExternal ? (
          <div
            style={{
              background: "rgba(79,195,255,0.1)",
              border: `1px solid ${CYAN_SOFT}`,
              borderRadius: 10,
              padding: "8px 10px",
              fontSize: 12,
              color: INK_DIM,
              lineHeight: 1.4,
            }}
          >
            Opens in <strong style={{ color: INK, fontWeight: 700 }}>{externalKind}</strong> · viewers hear mic only. Scrub, play, volume and next are not available for this source.
          </div>
        ) : (
          <>
            <ScrubBar
              progress={progressPct}
              onSeek={seekToPercent}
              accent={CYAN}
            />
            {/* Owner-authorised 2026-10-29 · scrub-time row:
                  LEFT   = replay round icon (seek to 0 + play)
                  CENTRE = plays count with sound-wave icon
                           (same underlying `view_count` field;
                           preview-load bumps already represent plays)
                  RIGHT  = total duration (position swapped out — the
                           replay round icon took its place) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, fontWeight: 700, color: INK_DIM, marginTop: 4 }}>
              <button
                type="button"
                aria-label="Replay from start"
                onClick={() => {
                  const audio = audioRef.current;
                  if (!audio) return;
                  try {
                    audio.currentTime = 0;
                    setPositionMs(0);
                    if (audio.paused) {
                      audio.play().catch(() => undefined);
                    }
                  } catch {
                    /* best-effort */
                  }
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: `1px solid rgba(255, 255, 255, 0.5)`,
                  background: "rgba(10, 27, 51, 0.55)",
                  color: INK,
                  cursor: "pointer",
                  padding: 0,
                  filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))",
                }}
              >
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <polyline points="3 3 3 9 9 9" />
                </svg>
              </button>
              {/* Owner-authorised 2026-10-30 · prev / next play-
                  arrow icons flank the plays count. Owner-exact:
                  "the play next song i said is play icon on the
                  right side and left side of the music page plays
                  count in footer". The arrows reuse the shared
                  router-push navigation path · the caller passes
                  pre-wrapped prev / next handlers (chronological
                  cycle wraps at the ends per directive). */}
              {/* Owner-authorised 2026-10-30 · all four elements in
                  this cluster rendered at size 16 — plays-count text
                  (16 px font) · speaker icon (16 × 16 glyph) · prev
                  play-arrow (16 × 16 glyph in a 28 × 28 round
                  button) · next play-arrow (same). */}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 16, color: INK }}>
                {props.onPrevTrack && (
                  <button
                    type="button"
                    onClick={props.onPrevTrack}
                    aria-label="Previous song"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: `1px solid rgba(255, 255, 255, 0.5)`,
                      background: "rgba(10, 27, 51, 0.55)",
                      color: INK,
                      cursor: "pointer",
                      padding: 0,
                      filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))",
                    }}
                  >
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden>
                      <path d="M18 6l-8.5 6L18 18V6z" />
                      <rect x="6" y="6" width="2" height="12" />
                    </svg>
                  </button>
                )}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                  </svg>
                  {formatCount(props.track.view_count)}
                </span>
                {props.onNextTrack && (
                  <button
                    type="button"
                    onClick={props.onNextTrack}
                    aria-label="Next song"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: `1px solid rgba(255, 255, 255, 0.5)`,
                      background: "rgba(10, 27, 51, 0.55)",
                      color: INK,
                      cursor: "pointer",
                      padding: 0,
                      filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))",
                    }}
                  >
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden>
                      <path d="M6 6l8.5 6L6 18V6z" />
                      <rect x="16" y="6" width="2" height="12" />
                    </svg>
                  </button>
                )}
              </span>
              {/* Owner-authorised 2026-10-29 · remaining-time
                  countdown. The right-side label now shows how
                  much of the song is LEFT (durationMs − positionMs)
                  rather than the static total. Leading minus sign
                  makes the countdown semantic unambiguous. Falls
                  back to the full duration until durationMs is
                  known (metadata not yet loaded). */}
              <span>
                {durationMs > 0
                  ? `-${formatClock(Math.max(0, durationMs - positionMs))}`
                  : formatClock(durationMs)}
              </span>
            </div>
          </>
        )}
      </div>


      {error && (
        <div
          role="status"
          style={{
            marginTop: 10,
            fontSize: 12,
            color: RED,
            background: "rgba(255,51,85,0.1)",
            borderRadius: 8,
            padding: "6px 10px",
          }}
        >
          {error}
        </div>
      )}

      {/* Hidden audio element · the mixer owns playback for
          uploaded_audio. Owner-authorised 2026-10-30 · when the
          caller passes `autoPlayOnMount`, the <audio autoPlay>
          attribute is set so the browser attempts to start playing
          as soon as data is ready. Preload bumped to "auto" in that
          case so the player doesn't have to buffer after the attempt
          starts. Autoplay may be silently blocked by browser policy
          on hard-loaded URLs with no prior gesture (honest limit). */}
      {!isExternal && props.audioSrcUrl && (
        <audio
          ref={setAudioRef}
          src={props.audioSrcUrl}
          preload={props.autoPlayOnMount ? "auto" : "metadata"}
          autoPlay={props.autoPlayOnMount === true}
          onLoadedMetadata={onLoadedMeta}
          onTimeUpdate={onTimeUpdate}
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
          onError={onAudioError}
          crossOrigin="anonymous"
          style={{ display: "none" }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// Scrub bar — reuses the sealed draggable-dot pattern.
// -----------------------------------------------------------------

function ScrubBar(props: {
  readonly progress: number; // 0..100
  readonly onSeek: (pct: number) => void;
  readonly accent: string;
}): React.JSX.Element {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const handlePoint = React.useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pct = ((clientX - rect.left) / rect.width) * 100;
      props.onSeek(Math.max(0, Math.min(100, pct)));
    },
    [props],
  );

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePoint(e.clientX);
  };
  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!dragging) return;
    handlePoint(e.clientX);
  };
  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(props.progress)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: "relative",
        height: 18,
        display: "flex",
        alignItems: "center",
        cursor: "pointer",
        touchAction: "none",
      }}
    >
      {/* Owner-authorised 2026-10-29 (white dashed line) · the
          REMAINING portion of the track is a WHITE broken line in
          front of the dot. Already-played portion invisible. */}
      <span
        style={{
          position: "absolute",
          left: `${props.progress}%`,
          right: 0,
          height: 4,
          backgroundImage: `repeating-linear-gradient(to right, #FFFFFF 0, #FFFFFF 6px, transparent 6px, transparent 10px)`,
          backgroundSize: "10px 4px",
          backgroundRepeat: "repeat-x",
          filter: "drop-shadow(0 0 4px rgba(255, 255, 255, 0.6))",
        }}
      />
      {/* Owner-authorised 2026-10-29 (clamped playhead) · dot stays
          fully inside the track bounds · at progress=100% it stops
          16 px before the right edge so the white circle doesn't
          clip against the screen edge when the song finishes.
          `clamp()` keeps the center at `progress%` for middle
          positions while locking both ends. */}
      <span
        style={{
          position: "absolute",
          left: `clamp(0px, calc(${props.progress}% - 8px), calc(100% - 16px))`,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: "#FFFFFF",
          border: `2px solid ${props.accent}`,
          boxShadow: `0 0 10px ${props.accent}`,
        }}
      />
    </div>
  );
}

// -----------------------------------------------------------------
// Buttons + chips
// -----------------------------------------------------------------

function TransportButton(props: {
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly ariaLabel: string;
  readonly size: number;
  readonly primary?: boolean;
  /** Owner-authorised 2026-10-29 · colour variant for primary buttons.
   *  "cyan" is the original NEX blue · "dark-red" is the deep red
   *  used on the music overlay's play button. */
  readonly variant?: "cyan" | "dark-red";
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const variant = props.variant ?? "cyan";
  const primaryColor = variant === "dark-red" ? RED_DARK : CYAN;
  const primaryGradientEnd = variant === "dark-red" ? RED_DEEPER : "#2A8FD4";
  const primaryGlow =
    variant === "dark-red"
      ? "rgba(139, 0, 0, 0.55)"
      : "rgba(79, 195, 255, 0.6)";
  const primaryInk = variant === "dark-red" ? "#FFF0F0" : DEEP;
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      aria-label={props.ariaLabel}
      style={{
        width: props.size,
        height: props.size,
        borderRadius: 999,
        border: props.primary
          ? `1px solid ${primaryColor}`
          : "1px solid rgba(255,255,255,0.18)",
        background: props.primary
          ? `linear-gradient(135deg, ${primaryColor} 0%, ${primaryGradientEnd} 100%)`
          : "rgba(255, 255, 255, 0.1)",
        color: props.primary ? primaryInk : INK,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: props.primary
          ? `0 0 18px ${primaryGlow}, 0 0 1px #FFFFFF inset`
          : "none",
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.4 : 1,
        fontFamily: "inherit",
      }}
    >
      {props.children}
    </button>
  );
}

function IconChip(props: {
  readonly onClick: () => void;
  readonly ariaLabel: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={props.ariaLabel}
      style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.08)",
        color: INK,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {props.children}
    </button>
  );
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const mm = Math.floor(total / 60);
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

// Owner-authorised 2026-10-29 · LiveCountryLine + BroadcastedDateLine
// helpers removed · the overlay-internal header row they rendered
// has been retired per owner directive. Live-signal + Broadcasted
// date now live only in the preview-page top header.
// SatelliteIconWithPing import also removed with them.

// Owner-authorised 2026-10-29 · compact view count on the scrub-time
// row. Mirrors the formatter in MusicActionsStack · kept local to
// avoid a cross-component import for one function.
// Owner-authorised 2026-10-29 · "we never show anything after the
// user adds the track name — remove (Live …)". Trailing "(Live …)"
// segments (any case, any content inside the parens) are stripped
// at render time. Underlying data remains untouched.
// Owner-authorised 2026-10-29 · Broadcasted overlay on cover.
// Format locked to en-US "Oct 29, 2026" per owner directive · same
// shape every browser locale. Hydration-safe · format resolves on
// mount, so SSR renders empty + hydrates to the formatted string.
function BroadcastedOverCover(props: {
  readonly broadcastedAtIso: string | null;
}): React.JSX.Element | null {
  const [label, setLabel] = React.useState<string>("");
  React.useEffect(() => {
    if (!props.broadcastedAtIso) {
      setLabel("");
      return;
    }
    const d = new Date(props.broadcastedAtIso);
    if (Number.isNaN(d.getTime())) {
      setLabel("");
      return;
    }
    try {
      const fmt = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      setLabel(fmt.format(d));
    } catch {
      setLabel("");
    }
  }, [props.broadcastedAtIso]);
  if (!label) return null;
  return (
    <div
      aria-label={`Broadcasted ${label}`}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: "3px 4px 4px",
        background:
          "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 100%)",
        color: "#FFFFFF",
        fontSize: 8,
        fontWeight: 800,
        letterSpacing: "0.03em",
        textAlign: "center",
        lineHeight: 1.15,
        textShadow: "0 1px 2px rgba(0,0,0,0.9)",
        pointerEvents: "none",
      }}
    >
      Broadcasted {label}
    </div>
  );
}

function stripTrailingLiveSuffix(title: string): string {
  return title.replace(/\s*\(\s*live[^)]*\)\s*$/i, "").trim();
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  if (n < 1_000_000) return Math.floor(n / 1000) + "k";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

// Owner-authorised 2026-10-29 · cover running-light keyframe. The
// `nex-music-vinyl-spin` keyframe was removed with the overlay-
// internal vinyl icon · the preview-page header vinyl uses its own
// `nex-music-page-vinyl-spin` keyframe mounted from the page client.
const coverSweepKeyframes = `
  @keyframes nex-music-cover-sweep {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes nex-music-cover-heart-pop {
    0%   { transform: scale(0.3); opacity: 0; }
    60%  { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  [data-nex-music-cover-frame][data-playing="1"] > div:first-of-type {
    /* rotation is applied to the gradient layer via transform; the
       animation name above is referenced inline where defined. */
  }
`;
