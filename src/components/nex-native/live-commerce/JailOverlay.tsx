// src/components/nex-native/live-commerce/JailOverlay.tsx
//
// NEX Live · full-screen Jail overlay (owner-authorised 2026-10-25).
//
// Renders over the live stream on the targeted viewer's device only.
// The overlay carries:
//   · A full-screen video background (owner-supplied asset) with a
//     static dark fallback for `prefers-reduced-motion` + for the
//     interval before the real asset is confirmed/committed. Honest-
//     copy: the fallback does not fabricate branded motion when the
//     asset isn't present.
//   · A large top-right countdown · derived locally from the server-
//     issued `startedAtMs + durationMs` payload (see
//     src/lib/nex-native/live-broadcast/jail-channel.ts). Monotonic
//     tick via `performance.now()`-free rAF is overkill here · a 1s
//     setInterval is sufficient for a 10-minute window.
//   · A footer legend "Comments Turned Off" that overlays the video.
//   · Dismisses automatically when the countdown hits 00:00.
//
// Doctrine:
//   · The targeted viewer can still WATCH the stream · the broadcast
//     is NOT torn down. Only comments + composer are suppressed. The
//     caller (viewer client) is responsible for passing an empty
//     comments array AND hiding the composer while this overlay is
//     active (see _viewer-client.tsx).
//   · The jail state is Realtime-only. A reload clears it. This is
//     intentional for a 10-minute cooling-off window; a persistent
//     ban is a separately-authorised future feature.
//   · Accessibility:
//       - `role="alertdialog"` + `aria-live="assertive"` + `aria-
//         labelledby` so a screen reader announces the state.
//       - `prefers-reduced-motion: reduce` disables the video entirely
//         and renders a static dark panel + countdown instead.
//
// Honest video asset:
//   · The owner-provided video file at
//     `C:/Users/Victus/Downloads/Girl_looking_at_phone_and_20261025141623.mp4`
//     has not been added to the repo yet (owner has not confirmed
//     disposition). The component accepts an optional `videoSrc`
//     prop; when absent, the overlay renders the static-dark fallback.
//     Once owner authorises the asset path, pass it in from the
//     consuming site.

"use client";

import * as React from "react";

export interface JailOverlayProps {
  /** Monotonic epoch ms when the jail started (broadcaster-authored). */
  readonly startedAtMs: number;
  /** Jail duration in ms. */
  readonly durationMs: number;
  /** Optional web-safe video source · when absent the overlay renders
   *  the static-dark fallback. Expected at `public/nex-live/jail/*`
   *  once owner authorises the asset. */
  readonly videoSrc?: string | null;
  /** Optional static poster image (shown while video loads AND when
   *  `prefers-reduced-motion: reduce` is active). */
  readonly posterSrc?: string | null;
  /** Fires when the countdown reaches 0 so the parent can tear down
   *  the overlay state. */
  readonly onComplete?: () => void;
}

const NEX = {
  deepBg: "#06101E",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  accent: "#FF3355",
  gold: "#C8A96A",
  footerBg: "rgba(2, 9, 20, 0.82)",
} as const;

const SERIF =
  "Georgia, 'Times New Roman', 'Palatino', 'Palatino Linotype', ui-serif, serif";

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
  const { startedAtMs, durationMs, videoSrc, posterSrc, onComplete } = props;

  // Tick · 1Hz is enough for mm:ss resolution. We derive remaining
  // from the SERVER-ISSUED startedAtMs so a reload would restart the
  // overlay from the correct remaining value (if the parent kept the
  // jail event in its state).
  const [nowMs, setNowMs] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, startedAtMs + durationMs - nowMs);
  const expired = remainingMs <= 0;

  // Fire onComplete exactly once when the countdown first crosses zero.
  const completedRef = React.useRef(false);
  React.useEffect(() => {
    if (expired && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [expired, onComplete]);

  if (expired) {
    // When the countdown has finished, render nothing · the parent
    // typically clears its jail state on `onComplete`. We also guard
    // the render-path so a stale mount doesn't flash 00:00 forever.
    return <></>;
  }

  const videoAvailable = typeof videoSrc === "string" && videoSrc.length > 0;

  return (
    <div
      data-nex-jail-overlay
      role="alertdialog"
      aria-live="assertive"
      aria-labelledby="nex-jail-overlay-title"
      aria-describedby="nex-jail-overlay-footer"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 60,
        background: NEX.deepBg,
        color: NEX.text,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        alignItems: "stretch",
        overflow: "hidden",
      }}
    >
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          [data-nex-jail-overlay] video[data-nex-jail-video] {
            display: none !important;
          }
          [data-nex-jail-overlay] [data-nex-jail-static-fallback] {
            display: block !important;
          }
        }
      `}</style>

      {/* Video layer · honest fallback when asset not provided OR
          when the user prefers reduced motion. */}
      {videoAvailable ? (
        <video
          data-nex-jail-video
          autoPlay
          muted
          loop
          playsInline
          poster={posterSrc ?? undefined}
          src={videoSrc ?? undefined}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0,
            // Slight dim so the countdown + footer stay legible.
            filter: "brightness(0.72)",
          }}
        />
      ) : null}
      <div
        data-nex-jail-static-fallback
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 42%, rgba(255, 51, 85, 0.18) 0%, rgba(6, 16, 30, 0.0) 55%), " +
            NEX.deepBg,
          display: videoAvailable ? "none" : "block",
          zIndex: 0,
        }}
      />

      {/* Hidden visible-only title for a11y · screen reader announces
          "You are on a 10-minute timeout". No visible text to avoid
          duplicating the countdown + footer copy. */}
      <h2
        id="nex-jail-overlay-title"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        You are on a timeout. Comments are turned off until the countdown ends.
      </h2>

      {/* Large countdown · top-right. */}
      <div
        data-nex-jail-overlay-countdown
        aria-hidden
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 20px)",
          right: 18,
          zIndex: 2,
          padding: "10px 16px",
          borderRadius: 14,
          background: "rgba(2, 9, 20, 0.62)",
          border: `1px solid ${NEX.gold}`,
          color: NEX.text,
          fontFamily: SERIF,
          fontSize: 44,
          fontWeight: 700,
          letterSpacing: "0.02em",
          lineHeight: 1,
          textShadow: "0 2px 10px rgba(0, 0, 0, 0.72)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatMMSS(remainingMs)}
      </div>

      {/* Supporting label under the countdown · small-caps serif. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 92px)",
          right: 18,
          zIndex: 2,
          fontFamily: SERIF,
          fontSize: 11,
          letterSpacing: "0.36em",
          textTransform: "uppercase",
          color: NEX.gold,
          textShadow: "0 1px 4px rgba(0, 0, 0, 0.65)",
        }}
      >
        Timeout
      </div>

      {/* Footer · full-width overlay text "Comments Turned Off". */}
      <div
        id="nex-jail-overlay-footer"
        data-nex-jail-overlay-footer
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          padding:
            "16px 20px calc(env(safe-area-inset-bottom, 0px) + 16px)",
          background: NEX.footerBg,
          borderTop: `1px solid ${NEX.gold}`,
          textAlign: "center",
          fontFamily: SERIF,
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: NEX.text,
        }}
      >
        Comments Turned Off
      </div>
    </div>
  );
}
