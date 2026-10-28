// src/components/nex-native/live-commerce/JailOverlay.tsx
//
// NEX Live · full-screen Jail overlay (owner-authorised 2026-10-28 ·
// redesign of the sealed 2026-10-25 version).
//
// Fires on the targeted viewer's device only. Full-bleed takeover
// (100% viewport width + height) with:
//   · Dark red radial-gradient background using sealed NEX accent.
//   · Large lock icon centred (72 px · sealed SVG · prefers-reduced-
//     motion disables the pulse).
//   · "You've Been Jailed" headline (26 px / 900).
//   · "10 Minutes from live feed posting" subcopy (14 px dim).
//   · Full 10:00 countdown pill derived from server-issued
//     `startedAtMs + durationMs`.
//   · Small red progress bar at the bottom ticking the 8-second
//     overlay-dismiss window.
//   · Auto-dismisses after 8 s (owner-sealed 2026-10-28) · fires
//     `onDismiss` so the parent re-renders to the muted-composer
//     state. The jail state itself persists until `durationMs`
//     elapses · that gate is the parent's responsibility.
//
// Doctrine (unchanged from 2026-10-25):
//   · The targeted viewer can still WATCH the stream · the broadcast
//     is NOT torn down. Only comments + composer are suppressed by
//     the parent.
//   · The jail state is Realtime-only in the pilot · a reload clears
//     it. A persistent server-side jail list is a separately-
//     authorised future feature (Phase B scope).
//   · Accessibility:
//       - `role="alertdialog"` + `aria-live="assertive"` + visible
//         `aria-labelledby` headline (owner directive today unwinds
//         the sealed hidden title · "You've Been Jailed" is on
//         screen now).
//       - `prefers-reduced-motion: reduce` disables the lock-pulse
//         animation.

"use client";

import * as React from "react";

export interface JailOverlayProps {
  /** Monotonic epoch ms when the jail started (broadcaster-authored
   *  via sealed jail-channel). */
  readonly startedAtMs: number;
  /** Total jail duration in ms · sealed 10 minutes = 600_000. */
  readonly durationMs: number;
  /** Overlay-dismiss window in ms · owner-sealed 2026-10-28 to 8_000.
   *  When this elapses the overlay fires `onDismiss` so the viewer
   *  returns to the live feed (muted composer still enforced by the
   *  parent for the remainder of `durationMs`). */
  readonly dismissAfterMs?: number;
  /** Fires exactly once when the dismiss window elapses OR on tap. */
  readonly onDismiss: () => void;
  /** Owner directive 2026-10-29 · optional full-bleed video played
   *  behind the overlay content (autoplay · muted · loop ·
   *  playsInline · object-cover). Owner-supplied asset expected at
   *  `/nex-jail-background.mp4` (public dir). When absent the sealed
   *  radial-gradient fallback renders. */
  readonly videoSrc?: string | null;
}

const NEX = {
  deepBg: "#06101E",
  text: "#F4F7FC",
  textDim: "#C8D4E8",
  textMute: "#8BA9D1",
  accent: "#FF3355",
  accentDeep: "#B10E25",
  /* Owner directive 2026-10-29 (reverted) · the orange ping colour
     is retired · ping rings + pulse glow back to NEX.accent red. */
} as const;

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const DEFAULT_DISMISS_MS = 8_000;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatMMSS(remainingMs: number): string {
  const clamped = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

export function JailOverlay(props: JailOverlayProps): React.JSX.Element {
  const { startedAtMs, durationMs, onDismiss, videoSrc } = props;
  const dismissAfterMs = props.dismissAfterMs ?? DEFAULT_DISMISS_MS;
  const hasVideo = typeof videoSrc === "string" && videoSrc.length > 0;

  // Monotonic 100-ms tick drives both the jail-countdown (shown
  // as mm:ss · updates once a second visually) and the 8-s dismiss
  // bar (visually smooth · needs higher resolution).
  const [nowMs, setNowMs] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  const jailRemainingMs = Math.max(0, startedAtMs + durationMs - nowMs);
  const dismissElapsedMs = Math.max(0, nowMs - startedAtMs);
  const dismissProgress = Math.min(1, dismissElapsedMs / dismissAfterMs);
  const dismissed = dismissElapsedMs >= dismissAfterMs;

  // Fire onDismiss exactly once when the dismiss-window closes OR
  // when the parent sets a short durationMs and the whole jail ends
  // before the dismiss elapses (edge case).
  const dismissedRef = React.useRef(false);
  React.useEffect(() => {
    if ((dismissed || jailRemainingMs <= 0) && !dismissedRef.current) {
      dismissedRef.current = true;
      onDismiss();
    }
  }, [dismissed, jailRemainingMs, onDismiss]);

  const handleTap = React.useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onDismiss();
  }, [onDismiss]);

  if (dismissedRef.current) {
    return <></>;
  }

  return (
    <div
      data-nex-jail-overlay
      role="alertdialog"
      aria-live="assertive"
      aria-labelledby="nex-jail-overlay-title"
      onClick={handleTap}
      style={{
        /* Owner directive 2026-10-29 (revert) · reverted from
           `position: fixed; width: 100vw; height: 100dvh` back to
           `position: absolute; inset: 0` · overlay fills the
           sealed `.nex-native-frame` parent (phone-frame size on
           desktop) instead of the whole browser viewport. The
           earlier fixed-viewport sizing is retired per owner
           request. */
        position: "absolute",
        inset: 0,
        zIndex: 300,
        background:
          "radial-gradient(circle at 50% 38%, rgba(255, 51, 85, 0.22) 0%, rgba(6, 16, 30, 0.0) 55%), " +
          NEX.deepBg,
        color: NEX.text,
        fontFamily: SANS,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
        cursor: "pointer",
        animation: "nexJailOverlayFadeIn 220ms ease-out",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Owner directive 2026-10-29 · "video for page jail full
          height and full width" · owner-supplied MP4 played as a
          full-bleed background layer behind the overlay content.
          `object-cover` fills the frame on any aspect ratio.
          autoplay + muted + loop + playsInline so mobile browsers
          start it without user gesture. A 0.52-alpha scrim stacks
          on top so the lock + text + countdown stay legible against
          whatever's in the video. `prefers-reduced-motion` disables
          the video entirely and reveals the sealed radial-gradient
          fallback. */}
      {hasVideo && (
        <>
          {/* Owner troubleshoot 2026-10-29 · "the video should be
             behind the overlay text" · video plays at full brightness
             as the primary visual · text + lock + countdown sit on
             top at zIndex 2 and rely on their own text-shadows +
             the countdown pill's dark backing for legibility. Scrim
             retired to a very subtle 0.22-flat film · just enough to
             guarantee contrast at the darkest frames of the video
             without obscuring it. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- native <video>, not <img> */}
          <video
            data-nex-jail-overlay-video
            src={videoSrc ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden
            data-nex-jail-overlay-scrim
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(2, 9, 20, 0.22)",
              zIndex: 1,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      <style>{`
        @keyframes nexJailOverlayFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-jail-overlay-video] { display: none !important; }
          [data-nex-jail-overlay-scrim] { display: none !important; }
        }
        @keyframes nexJailLockPulse {
          0%, 100% { transform: scale(1);   filter: drop-shadow(0 0 20px rgba(255, 51, 85, 0.6)); }
          50%      { transform: scale(1.06); filter: drop-shadow(0 0 32px rgba(255, 51, 85, 0.95)); }
        }
        @keyframes nexJailRingExpand {
          0%   { transform: scale(0.4); opacity: 0.95; }
          80%  { transform: scale(1.8); opacity: 0;    }
          100% { transform: scale(1.8); opacity: 0;    }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-jail-overlay-lock] { animation: none !important; }
          [data-nex-jail-overlay-ring] { animation: none !important; }
          [data-nex-jail-overlay] { animation: none !important; }
        }
      `}</style>

      {/* Owner directive 2026-10-29 (revised) · "remove the handcuffs
          and ping" · the central handcuffs image + 3 concentric ping
          rings + pulsing halo are retired. The overlay now reads as
          video + headline + countdown + progress bar · no central
          glyph. The `nexJailRingExpand` + `nexJailLockPulse`
          keyframes stay defined in the style block so a future
          re-add is a one-block revert, but no element consumes them. */}

      <h2
        id="nex-jail-overlay-title"
        data-nex-jail-overlay-headline
        style={{
          margin: 0,
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: "0.01em",
          color: "#FFFFFF",
          textShadow: "0 2px 10px rgba(0,0,0,0.78), 0 1px 3px rgba(0,0,0,0.6)",
          textAlign: "center",
          lineHeight: 1.15,
          position: "relative",
          zIndex: 2,
        }}
      >
        You&rsquo;ve Been Jailed
      </h2>

      <p
        data-nex-jail-overlay-subcopy
        style={{
          margin: "10px 0 24px",
          fontSize: 14,
          lineHeight: 1.5,
          color: NEX.textDim,
          textAlign: "center",
          maxWidth: 300,
          textShadow: "0 1px 3px rgba(0,0,0,0.6)",
          position: "relative",
          zIndex: 2,
        }}
      >
        10 Minutes from live feed posting
      </p>

      {/* Full 10-minute countdown pill · tabular-nums for stable
          digit width · ticks every 100 ms (visually readable at
          1-s cadence given the formatMMSS flooring). */}
      <div
        data-nex-jail-overlay-countdown
        aria-hidden
        style={{
          padding: "12px 22px",
          borderRadius: 14,
          background: "rgba(2, 9, 20, 0.72)",
          border: `1.5px solid ${NEX.accent}`,
          boxShadow:
            "0 0 18px rgba(255, 51, 85, 0.4), 0 4px 14px rgba(0, 0, 0, 0.6)",
          color: "#FFFFFF",
          fontSize: 36,
          fontWeight: 900,
          letterSpacing: "0.04em",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          textShadow: "0 2px 10px rgba(0, 0, 0, 0.72)",
          position: "relative",
          zIndex: 2,
        }}
      >
        {formatMMSS(jailRemainingMs)}
      </div>

      {/* 8-second dismiss progress bar · pinned bottom · tells the
          viewer "overlay will clear in …" so returning to the feed
          doesn't feel abrupt. The jail itself persists for the full
          10 minutes · parent enforces that via its muted composer. */}
      <div
        data-nex-jail-overlay-dismiss-track
        aria-hidden
        style={{
          /* Owner directive 2026-10-29 (revert) · back to the
             sealed left/right-inset layout now that the overlay is
             contained to the phone frame again. */
          position: "absolute",
          left: 32,
          right: 32,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 44px)",
          height: 4,
          borderRadius: 999,
          background: "rgba(255, 255, 255, 0.14)",
          overflow: "hidden",
          zIndex: 2,
        }}
      >
        <div
          data-nex-jail-overlay-dismiss-fill
          style={{
            width: `${dismissProgress * 100}%`,
            height: "100%",
            background: NEX.accent,
            boxShadow: "0 0 10px rgba(255, 51, 85, 0.7)",
            transition: "width 100ms linear",
          }}
        />
      </div>

      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 10.5,
          fontWeight: 700,
          color: "rgba(255, 255, 255, 0.72)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          textShadow: "0 1px 2px rgba(0,0,0,0.75)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        Returning to live feed…
      </div>
    </div>
  );
}
