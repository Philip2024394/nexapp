"use client";

// src/app/nex-native/live-commerce/enter-broadcast-room/_live-finished-recap.tsx
//
// Owner directive 2026-10-28 · "will turn off the camera and display
// this screen image & 'c:\\Users\\Victus\\Downloads\\NEX Broadcast
// Studio After Hours.png' with owner profile image displaying and
// Live Finished with streaming time under".
//
// Full-bleed post-broadcast recap screen:
//   · After-hours studio PNG stretches to cover.
//   · Dark scrim 0.42 so the overlay copy stays legible.
//   · Owner avatar (88 px circular, white ring + gentle glow,
//     gradient-letter fallback when no URL is available).
//   · "Live Finished" wordmark · 28 px / 900 / white.
//   · Streaming duration · 24 px / 800 / cyan accent · format M:SS
//     when under an hour, H:MM:SS when over.
//   · Peak viewers stat row · one honestly-tracked metric.
//   · Bottom tap-anywhere affordance + thin countdown progress bar
//     ticking down the 8-second auto-dismiss window.
//
// Owner-confirmed design decisions 2026-10-28:
//   · Auto-dismiss after 8 s (brisk enough that the owner doesn't
//     feel stuck · long enough to read the duration + stat).
//   · Destination on dismiss · /nex-native/live-commerce/feed.
//   · Peak viewers is the only stat shown · owner picked just this
//     one from {peak viewers, likes, comments, products featured}.
//
// The caller (enter-broadcast-room/_go-live-client.tsx) is responsible
// for navigation on dismiss · this component is pure UI + a timer.

import * as React from "react";

const BG_IMAGE = "/nex-broadcast-studio-after-hours.png";
const AUTO_DISMISS_MS = 8000;

export interface LiveFinishedRecapProps {
  /** When the broadcast first went live (Date.now() ms). */
  readonly startedAt: number | null;
  /** When Stop Live fired (Date.now() ms). */
  readonly endedAt: number | null;
  /** Max concurrent viewers seen across the session · sealed engine
   *  caps this at 10 (`broadcast-engine.ts:59 MAX_VIEWERS`). */
  readonly peakViewers: number;
  /** Resolvable public URL for the owner avatar · null falls back to
   *  the gradient initial. */
  readonly selfAvatarUrl: string | null;
  /** Owner's business / display name · used for the avatar fallback
   *  initial and for a11y. */
  readonly selfDisplayName: string | null;
  /** Fires after `AUTO_DISMISS_MS` OR on tap-anywhere. The caller
   *  owns navigation (router.push to the live feed). */
  readonly onDismiss: () => void;
}

function formatDuration(ms: number): string {
  if (ms < 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = seconds.toString().padStart(2, "0");
  if (hours > 0) {
    const mm = minutes.toString().padStart(2, "0");
    return `${hours}:${mm}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

export function LiveFinishedRecap(
  props: LiveFinishedRecapProps,
): React.JSX.Element {
  const { startedAt, endedAt, peakViewers, selfAvatarUrl, selfDisplayName, onDismiss } = props;
  const dismissedRef = React.useRef(false);
  const [remainingMs, setRemainingMs] = React.useState<number>(AUTO_DISMISS_MS);

  // Owner-confirmed 8-s auto-dismiss. Countdown bar is driven off the
  // same interval so the progress reads honestly against the timer.
  React.useEffect(() => {
    const start = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, AUTO_DISMISS_MS - elapsed);
      setRemainingMs(remaining);
      if (remaining <= 0) {
        window.clearInterval(interval);
        if (!dismissedRef.current) {
          dismissedRef.current = true;
          onDismiss();
        }
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [onDismiss]);

  const handleTap = React.useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onDismiss();
  }, [onDismiss]);

  const durationMs =
    startedAt !== null && endedAt !== null && endedAt >= startedAt
      ? endedAt - startedAt
      : 0;
  const durationLabel = formatDuration(durationMs);

  const initial = (selfDisplayName ?? "N").trim().slice(0, 1).toUpperCase();
  const progressPct = (1 - remainingMs / AUTO_DISMISS_MS) * 100;

  return (
    <div
      role="dialog"
      aria-label="Live finished"
      data-nex-live-finished-recap
      onClick={handleTap}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 220,
        boxSizing: "border-box",
        background: `rgba(2, 9, 20, 0.42) url("${BG_IMAGE}") 0 0 / 100% 100% no-repeat`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        cursor: "pointer",
        animation: "nexLiveFinishedFadeIn 260ms ease-out",
        WebkitTapHighlightColor: "transparent",
        color: "#F2F5F8",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Owner avatar · white ring + outer glow matching the sealed
          broadcaster-online-presence family. */}
      <div
        data-nex-live-finished-avatar
        style={{
          width: 96,
          height: 96,
          borderRadius: "50%",
          padding: 3,
          background: "#FFFFFF",
          boxShadow:
            "0 0 24px rgba(255, 255, 255, 0.35), 0 6px 18px rgba(0, 0, 0, 0.5)",
          marginBottom: 22,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFFFFF",
            fontSize: 36,
            fontWeight: 800,
            overflow: "hidden",
          }}
        >
          {selfAvatarUrl ? (
            /* Owner troubleshoot 2026-10-27 (sealed) · nex-mock-personas
               PNGs carry 10-15% white padding top/bottom from the
               source crop. `scale(1.4) translateY(-2%)` zooms + the
               parent `overflow: hidden` clips the white edges. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={selfAvatarUrl}
              alt=""
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scale(1.4) translateY(-2%)",
                transformOrigin: "center 48%",
              }}
            />
          ) : (
            <span aria-hidden>{initial}</span>
          )}
        </div>
      </div>

      <div
        data-nex-live-finished-headline
        style={{
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: "0.02em",
          textShadow: "0 2px 12px rgba(0,0,0,0.75), 0 1px 3px rgba(0,0,0,0.6)",
          marginBottom: 10,
        }}
      >
        Live Finished
      </div>

      <div
        data-nex-live-finished-duration
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: "#00AFFF",
          letterSpacing: "0.03em",
          textShadow: "0 1px 6px rgba(0, 0, 0, 0.72)",
          marginBottom: 28,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {durationLabel}
      </div>

      <div
        data-nex-live-finished-stats
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 18px",
          borderRadius: 999,
          background: "rgba(2, 9, 20, 0.55)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          backdropFilter: "blur(6px) saturate(140%)",
          WebkitBackdropFilter: "blur(6px) saturate(140%)",
        }}
      >
        <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>👁</span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#C8D4E8",
          }}
        >
          Peak viewers
        </span>
        <span
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: "#FFFFFF",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {peakViewers}
        </span>
      </div>

      <div
        data-nex-live-finished-affordance
        style={{
          position: "absolute",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 36px)",
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 10.5,
          fontWeight: 700,
          color: "rgba(255, 255, 255, 0.7)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          textShadow: "0 1px 2px rgba(0,0,0,0.75)",
          pointerEvents: "none",
        }}
      >
        Tap anywhere to return
      </div>

      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          left: 24,
          right: 24,
          height: 3,
          borderRadius: 999,
          background: "rgba(255, 255, 255, 0.12)",
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: `${progressPct}%`,
            height: "100%",
            background: "#FF3355",
            boxShadow: "0 0 8px rgba(255, 51, 85, 0.6)",
            transition: "width 100ms linear",
          }}
        />
      </div>

      <style>{`
        @keyframes nexLiveFinishedFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-live-finished-recap] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
